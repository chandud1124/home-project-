/*
 * Aqua Guard Sense - ESP32 Sump Tank Controller (IMPROVED)
 * Dedicated sump tank monitoring and motor control system
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - AJ-SR04M Ultrasonic sensor for sump tank water level measurement
 * - Float switch for hardware-level safety verification
 * - Relay control for water pump motor
 * - Manual override button for emergency control
 * - HTTP server to receive commands from Top Tank ESP32
 * - Real-time data transmission to backend
 * - Comprehensive safety and alert systems
 * - ENHANCED: Stable connection management - no unnecessary restarts
 * - ENHANCED: Improved heartbeat monitoring without auto-restart
 * - ENHANCED: Advanced error handling and recovery
 * - ENHANCED: Crash-only restart policy
 *
 * Connection Stability:
 * - Once connected to backend, maintains connection indefinitely
 * - Only restarts on actual crashes or panic mode
 * - Smart reconnection with exponential backoff
 * - No auto-restart for connection issues
 *
 * Heartbeat System:
 * - Sends ping every 30 seconds to keep connection alive
 * - Sends sensor data every 30 seconds as heartbeat
 * - Monitors backend responses with warnings only
 * - No automatic restart - only logs connection issues
 * - Prevents ESP32 sleep mode for continuous operation
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - AJ-SR04M Ultrasonic Sensor (TRIG/ECHO mode)
 * - Float Switch (normally open)
 * - Manual Override Button (normally open)
 * - Relay Module for Motor Control
 * - Buzzer and LED for alerts
 *
 * Wiring:
 * - AJ-SR04M TRIG -> ESP32 GPIO 5
 * - AJ-SR04M ECHO -> ESP32 GPIO 18
 * - AJ-SR04M GND -> ESP32 GND
 * - AJ-SR04M VCC -> ESP32 5V
 * - Float Switch -> ESP32 GPIO 4 (with pull-up)
 * - Manual Button -> ESP32 GPIO 12 (with pull-up)
 * - Motor Relay -> ESP32 GPIO 13
 * - Buzzer -> ESP32 GPIO 14
 * - LED -> ESP32 GPIO 15
 * - Auto Mode LED -> ESP32 GPIO 16
 * - Sump Full LED -> ESP32 GPIO 17
 * - Sump Low LED -> ESP32 GPIO 21
 * - Manual Motor Switch -> ESP32 GPIO 25 (with pull-up)
 * - Mode Switch -> ESP32 GPIO 26 (with pull-up)
 *
 * Communication:
 * - HTTP server (port 80) for Top Tank ESP32 commands
 * - WebSocket to backend for data transmission
 *
 * IMPORTANT: AJ-SR04M cannot reliably detect distances below 20cm
 * Readings closer than 20cm will be inaccurate/wrong
 */

// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATE THESE VALUES FOR YOUR NETWORK
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Server Configuration - PRODUCTION SUPABASE URLs
const char* SUPABASE_URL = "https://dwcouaacpqipvvsxiygo.supabase.co";
const int WEBSOCKET_PORT = 443;  // HTTPS port for Supabase
const char* WEBSOCKET_PATH = "/functions/v1/websocket";  // Supabase Edge Function path
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4";

// Device Configuration
const char* DEVICE_TYPE = "sump_tank_controller";
const char* DEVICE_ID = "ESP32_SUMP_002";  // Updated to match actual device

// HTTP Server Configuration
const int HTTP_PORT = 80;

// Hardware Pin Configuration
// AJ-SR04M Ultrasonic Sensor Pins (TRIG/ECHO mode) - Standardized with Top Tank
#define SUMP_TRIGPIN 5
#define SUMP_ECHOPIN 18

// Control Pins
#define FLOAT_SWITCH_PIN 4     // Float switch for safety
#define MANUAL_BUTTON_PIN 12   // Manual override button
#define MOTOR_RELAY_PIN 13     // Motor relay control
#define BUZZER_PIN 14          // Alert buzzer
#define LED_PIN 15             // Status LED

// New LED Indicator Pins
#define AUTO_MODE_LED_PIN 16   // LED 1: Auto mode indicator
#define SUMP_FULL_LED_PIN 17   // LED 2: Sump water full (90%)
#define SUMP_LOW_LED_PIN 21    // LED 3: Sump water low (25%) - Moved from GPIO 18

// New Switch Pins
#define MANUAL_MOTOR_SWITCH_PIN 25  // Switch 1: Manual motor toggle (ON/OFF)
#define MODE_SWITCH_PIN 26          // Switch 2: Auto/Manual mode toggle

// Motor Control Configuration
const unsigned long MOTOR_MAX_RUNTIME = 1800000; // 30 minutes max runtime
const unsigned long MOTOR_MIN_REST_TIME = 300000; // 5 minutes minimum rest between runs
const float SUMP_MIN_LEVEL = 15.0;     // Stop if sump < 15% (dry run prevention)
const float SUMP_MAX_LEVEL = 90.0;     // Stop if sump > 90% (overflow prevention)
const float SUMP_CRITICAL_LEVEL = 5.0; // Critical alert threshold

// Tank Configuration
const float SUMP_TANK_HEIGHT_CM = 250.0;     // Height of sump tank in cm
const float SUMP_TANK_LENGTH_CM = 230.0;     // Length of sump tank in cm
const float SUMP_TANK_BREADTH_CM = 230.0;    // Breadth of sump tank in cm

// AJ-SR04M Sensor Configuration
const float MIN_SENSOR_DISTANCE_CM = 20.0;  // Minimum reliable detection distance
const float MAX_SENSOR_DISTANCE_CM = 450.0; // Maximum detection distance

// ========== FUNCTION PROTOTYPES ==========
bool startMotor(bool manualOverride = false);
bool canMotorStart(bool manualOverride = false);
void stopMotor();
void sendMotorStatus();
void sendSensorData();
void sendPing();
void sendSystemAlert(String alertType, String message);
void sendTankReading();
void updateLedIndicators();
void readModeSwitch();
void readManualMotorSwitch();

// Connection management helper functions
String getConnectionStateString();
unsigned long calculateReconnectDelay();
void attemptWebSocketReconnection();

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>
#include <WebServer.h>
#include <esp_task_wdt.h>  // ESP32 Watchdog Timer

// ========== WATCHDOG CONFIGURATION ==========
#define WDT_TIMEOUT 60  // Watchdog timeout in seconds (INCREASED from 30s)
unsigned long lastWatchdogFeed = 0;
const unsigned long WATCHDOG_FEED_INTERVAL = 10000; // Feed watchdog every 10 seconds

// ========== CONNECTION MANAGEMENT ==========
enum ConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  RECONNECTING,
  STABLE
};

ConnectionState connectionState = DISCONNECTED;
unsigned long connectionEstablishedTime = 0;
unsigned long lastConnectionAttempt = 0;
int connectionAttempts = 0;
const int MAX_CONNECTION_ATTEMPTS = 10;
const unsigned long BASE_RECONNECT_DELAY = 5000; // 5 seconds base delay
const unsigned long MAX_RECONNECT_DELAY = 300000; // 5 minutes max delay

// ========== GLOBAL VARIABLES ==========
WebSocketsClient webSocket;
WebServer server(HTTP_PORT);
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool wifiConnected = false;
bool websocketConnected = false;

// Sensor readings
float sumpLevel = 0.0;
float sumpVolume = 0.0;
bool floatSwitchOn = false;
bool manualButtonPressed = false;

// Motor control variables
bool motorRunning = false;
bool autoModeEnabled = true;  // Default: Auto mode
bool manualOverride = false;
bool manualMotorOn = false;   // Manual motor control state
unsigned long motorStartTime = 0;
unsigned long motorLastStopTime = 0;
unsigned long manualOverrideStartTime = 0; // Track manual override timeout
String motorStatus = "stopped";
String lastMotorCommand = "";
String lastCommandSource = "";

// LED and Switch state variables
bool autoModeLedOn = true;    // LED 1: Auto mode (default ON)
bool sumpFullLedOn = false;   // LED 2: Sump full (90%)
bool sumpLowLedOn = false;    // LED 3: Sump low/empty (ON when empty, blinking at 85%, steady ON at 90%)
bool lastModeSwitchState = HIGH;     // For debouncing mode switch
bool lastManualMotorSwitchState = HIGH; // For debouncing manual motor switch
unsigned long lastModeSwitchTime = 0;
unsigned long lastManualMotorSwitchTime = 0;

// Error handling and recovery variables
int websocketErrorCount = 0;
int websocketReconnectAttempts = 0;
int wifiReconnectAttempts = 0;
unsigned long lastWifiReconnectAttempt = 0;
unsigned long lastWebsocketReconnectAttempt = 0;

// WiFi stability monitoring
unsigned long wifiLastConnectedTime = 0;
bool wifiConnectionStable = false;
const unsigned long WIFI_STABILITY_CHECK_TIME = 10000; // 10 seconds to confirm stable connection

// Heartbeat and keep-alive variables (IMPROVED - No auto restart)
unsigned long lastHeartbeatResponse = 0;
int heartbeatMissedCount = 0;
const unsigned long HEARTBEAT_TIMEOUT = 120000; // 2 minutes timeout for heartbeat response
bool backendResponsive = true;

// Alert states
bool lowLevelAlert = false;
bool criticalLevelAlert = false;
bool motorSafetyAlert = false;

// Button debouncing
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY = 200; // 200ms debounce

// ========== FUNCTIONS ==========

// HTTP Server handlers
void handleMotorCommand() {
  Serial.println("==========================================");
  Serial.println("📡 SUMP TANK ESP32 ← TOP TANK ESP32 COMMUNICATION");
  Serial.println("==========================================");

  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
    Serial.println("❌ ERROR: Invalid HTTP method received (not POST)");
    Serial.println("🔍 EXPECTED: POST request with JSON payload");
    return;
  }

  String payload = server.arg("plain");
  Serial.println("📦 RAW PAYLOAD RECEIVED:");
  Serial.println(payload);
  Serial.println("==========================================");

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    server.send(400, "text/plain", "Invalid JSON");
    Serial.println("❌ ERROR: Invalid JSON format in payload");
    Serial.print("🔍 DESERIALIZATION ERROR: ");
    Serial.println(error.c_str());
    return;
  }

  String command = doc["command"];
  String source = doc["source"];
  float topLevel = doc["top_level"];
  String esp32Id = doc["esp32_id"] | "unknown";
  unsigned long timestamp = doc["timestamp"] | 0;

  Serial.println("✅ JSON PARSED SUCCESSFULLY!");
  Serial.print("🎯 COMMAND: ");
  Serial.println(command);
  Serial.print("📍 SOURCE: ");
  Serial.println(source);
  Serial.print("🏷️  ESP32 ID: ");
  Serial.println(esp32Id);
  Serial.print("📊 TOP TANK LEVEL: ");
  Serial.print(topLevel, 1);
  Serial.println("%");
  Serial.print("⏰ TIMESTAMP: ");
  Serial.println(timestamp);
  Serial.println("==========================================");

  lastCommandSource = source;

  if (command == "start") {
    Serial.println("🚀 MOTOR START COMMAND RECEIVED");
    Serial.println("🔍 CHECKING SAFETY CONDITIONS...");

    // Check float switch before starting motor
    Serial.print("🏊 FLOAT SWITCH STATUS: ");
    Serial.println(floatSwitchOn ? "ON (SAFE)" : "OFF (UNSAFE)");

    if (floatSwitchOn) {
      Serial.println("✅ SAFETY CHECK PASSED - Starting motor...");
      if (startMotor()) {
        server.send(200, "text/plain", "Motor started");
        Serial.println("✅ SUCCESS: Motor started successfully!");
        Serial.println("📤 RESPONSE SENT: HTTP 200 - Motor started");
      } else {
        server.send(400, "text/plain", "Cannot start motor - safety check failed");
        Serial.println("❌ ERROR: Motor start failed - safety check failed");
        Serial.println("📤 RESPONSE SENT: HTTP 400 - Safety check failed");
      }
    } else {
      Serial.println("❌ SAFETY VIOLATION: Cannot start motor - float switch is OFF");
      Serial.println("🛡️  SAFETY PROTOCOL: Motor will not start without water in sump");
      server.send(400, "text/plain", "Cannot start motor - float switch is OFF");
      Serial.println("📤 RESPONSE SENT: HTTP 400 - Float switch OFF");
    }
  } else if (command == "stop") {
    Serial.println("🛑 MOTOR STOP COMMAND RECEIVED");
    Serial.println("🔄 ACTION: Stopping motor...");
    stopMotor();
    server.send(200, "text/plain", "Motor stopped");
    Serial.println("✅ SUCCESS: Motor stopped successfully!");
    Serial.println("📤 RESPONSE SENT: HTTP 200 - Motor stopped");
  } else {
    Serial.println("❓ UNKNOWN COMMAND RECEIVED");
    Serial.print("🔍 RECEIVED COMMAND: '");
    Serial.print(command);
    Serial.println("'");
    Serial.println("📋 VALID COMMANDS: 'start', 'stop'");
    server.send(400, "text/plain", "Invalid command");
    Serial.println("📤 RESPONSE SENT: HTTP 400 - Invalid command");
  }

  Serial.println("==========================================");
  Serial.println("🎉 COMMUNICATION COMPLETED!");
  Serial.println("==========================================");
}

void handleStatus() {
  StaticJsonDocument<256> doc;
  doc["esp32_id"] = DEVICE_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["mac_address"] = WiFi.macAddress();
  doc["wifi_signal"] = WiFi.RSSI();
  doc["wifi_connected"] = wifiConnected;
  doc["sump_level"] = sumpLevel;
  doc["motor_running"] = motorRunning;
  doc["motor_status"] = motorStatus;
  doc["float_switch"] = floatSwitchOn;
  doc["auto_mode"] = autoModeEnabled;
  doc["manual_motor_switch"] = manualMotorOn;
  doc["safety_alert"] = motorSafetyAlert;

  // LED status
  doc["led_auto_mode"] = autoModeLedOn;
  doc["led_sump_full"] = sumpFullLedOn;
  doc["led_sump_low"] = sumpLowLedOn;

  String jsonString;
  serializeJson(doc, jsonString);
  server.send(200, "application/json", jsonString);
}

void handleRoot() {
  String html = "<html><body>";
  html += "<h1>ESP32 Sump Tank Controller</h1>";
  html += "<p>ID: " + String(DEVICE_ID) + "</p>";

  // Network Information
  html += "<h2>Network Information:</h2>";
  html += "<p>ANTENNA: IP Address: " + WiFi.localIP().toString() + "</p>";
  html += "<p>LINK: MAC Address: " + WiFi.macAddress() + "</p>";
  html += "<p>SIGNAL: WiFi Signal: " + String(WiFi.RSSI()) + " dBm</p>";
  html += "<p>WEB: Connection Status: " + String(wifiConnected ? "Connected" : "Disconnected") + "</p>";

  html += "<h2>Tank Status:</h2>";
  html += "<p>Sump Level: " + String(sumpLevel, 1) + "%</p>";
  html += "<p>Motor Status: " + motorStatus + "</p>";
  html += "<p>Float Switch: " + String(floatSwitchOn ? "ON" : "OFF") + "</p>";
  html += "<p>Mode: " + String(autoModeEnabled ? "AUTO" : "MANUAL") + "</p>";
  html += "<p>Manual Motor Switch: " + String(manualMotorOn ? "ON" : "OFF") + "</p>";

  // LED Status
  html += "<h2>LED Indicators:</h2>";
  html += "<p>BLUE: Auto Mode LED: " + String(autoModeLedOn ? "ON" : "OFF") + "</p>";
  html += "<p>RED: Sump Full LED (90%): " + String(sumpFullLedOn ? "ON" : "OFF") + "</p>";
  html += "<p>YELLOW: Sump Low LED (25%): " + String(sumpLowLedOn ? "ON" : "OFF") + "</p>";

  html += "</body></html>";
  server.send(200, "text/html", html);
}

// Test AJ-SR04M ultrasonic sensor with enhanced diagnostics and timeout protection
void testAJ_SR04MCommunication() {
  Serial.println("Testing AJ-SR04M Ultrasonic Sensor...");

  // Test multiple readings with enhanced diagnostics and timeout protection
  for (int i = 0; i < 5; i++) {
    Serial.print("RULER: Test ");
    Serial.print(i + 1);
    Serial.print(": ");

    // Feed watchdog during test to prevent timeout
    esp_task_wdt_reset();

    // Trigger ultrasonic pulse
    digitalWrite(SUMP_TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(SUMP_TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(SUMP_TRIGPIN, LOW);

    // Read echo with timeout and diagnostics
    long duration = pulseIn(SUMP_ECHOPIN, HIGH, 30000);

    if (duration == 0) {
      Serial.println("TIMEOUT - No echo received (check wiring/power/sensor position)");
      Serial.println("   Possible issues:");
      Serial.println("   - Sensor not powered (needs 5V)");
      Serial.println("   - Wiring incorrect (TRIG=GPIO5, ECHO=GPIO18)");
      Serial.println("   - Sensor too close to surface (<20cm)");
      Serial.println("   - Sensor faulty or damaged");
    } else {
      float distance = (duration * 0.0343) / 2;
      Serial.print("Duration = ");
      Serial.print(duration);
      Serial.print(" us, Distance = ");
      Serial.print(distance);
      Serial.println(" cm");

      if (distance < 20.0) {
        Serial.println("   WARNING: Distance below minimum detection range (20cm)");
      }
    }

    delay(500);
  }

  Serial.println("SUCCESS: AJ-SR04M test completed");
  Serial.println("BULB: Sensor Specifications:");
  Serial.println("   - Minimum detection distance: 20 cm (IMPORTANT LIMITATION)");
  Serial.println("   - Maximum detection distance: 450 cm");
  Serial.println("   - Operating voltage: 5V DC");
  Serial.println("   - Current consumption: <15mA");
}

// Read sump tank ultrasonic sensor with comprehensive error handling and validation
float readSumpUltrasonicLevel() {
  const int NUM_READINGS = 5; // Take multiple readings for averaging
  const int MAX_INVALID_READINGS = 3; // Maximum allowed invalid readings
  float readings[NUM_READINGS];
  int validReadings = 0;
  int invalidReadings = 0;

  // Take multiple readings with error handling
  for (int i = 0; i < NUM_READINGS; i++) {
    // Feed watchdog during sensor readings
    esp_task_wdt_reset();

    // Trigger ultrasonic pulse
    digitalWrite(SUMP_TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(SUMP_TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(SUMP_TRIGPIN, LOW);

    // Read echo with timeout
    long duration = pulseIn(SUMP_ECHOPIN, HIGH, 30000); // 30ms timeout

    // Check for timeout (no echo received)
    if (duration == 0) {
      Serial.println("WARNING: Ultrasonic sensor timeout - no echo received");
      invalidReadings++;
      delay(50); // Short delay before retry
      continue;
    }

    // Convert duration to distance
    float distance = (duration * 0.0343) / 2;

    // Validate distance reading
    if (distance < MIN_SENSOR_DISTANCE_CM || distance > MAX_SENSOR_DISTANCE_CM || isnan(distance) || isinf(distance)) {
      Serial.print("WARNING: Invalid distance reading: ");
      Serial.print(distance);
      Serial.println(" cm (out of valid range)");
      invalidReadings++;
    } else {
      readings[validReadings] = distance;
      validReadings++;
      Serial.print("SUCCESS: Valid reading ");
      Serial.print(validReadings);
      Serial.print(": ");
      Serial.print(distance);
      Serial.println(" cm");
    }

    delay(100); // Delay between readings to avoid interference
  }

  // Check if we have enough valid readings
  if (validReadings < (NUM_READINGS - MAX_INVALID_READINGS)) {
    Serial.print("ERROR: Too many invalid readings (");
    Serial.print(invalidReadings);
    Serial.print("/");
    Serial.print(NUM_READINGS);
    Serial.println(") - sensor may be faulty");
    return -1;
  }

  if (validReadings == 0) {
    Serial.println("ERROR: No valid readings obtained");
    return -1;
  }

  // Calculate average of valid readings (simple mean for now)
  float averageDistance = 0;
  for (int i = 0; i < validReadings; i++) {
    averageDistance += readings[i];
  }
  averageDistance /= validReadings;

  // Additional validation of average
  if (averageDistance < MIN_SENSOR_DISTANCE_CM || averageDistance > MAX_SENSOR_DISTANCE_CM) {
    Serial.print("WARNING: Average distance out of range: ");
    Serial.print(averageDistance);
    Serial.println(" cm");
    return -1;
  }

  Serial.print("DATA: Average distance: ");
  Serial.print(averageDistance);
  Serial.println(" cm");

  // Calculate water level percentage
  float waterHeight = SUMP_TANK_HEIGHT_CM - averageDistance;
  float levelPercent = (waterHeight / SUMP_TANK_HEIGHT_CM) * 100.0;
  levelPercent = constrain(levelPercent, 0, 100);

  Serial.print("WATER: Calculated sump level: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return levelPercent;
}

// Calculate water volume in liters for sump tank (RECTANGULAR)
float calculateSumpVolume(float levelPercent) {
  float waterHeight = (levelPercent / 100.0) * SUMP_TANK_HEIGHT_CM;
  float volumeLiters = (SUMP_TANK_LENGTH_CM * SUMP_TANK_BREADTH_CM * waterHeight) / 1000.0;
  return volumeLiters;
}

// Read float switch and manual button with debouncing
void readControls() {
  // Read float switch
  floatSwitchOn = digitalRead(FLOAT_SWITCH_PIN);

  // Read manual button with debouncing
  bool buttonState = digitalRead(MANUAL_BUTTON_PIN);
  if (buttonState == LOW && millis() - lastButtonPress > DEBOUNCE_DELAY) {
    manualButtonPressed = true;
    lastButtonPress = millis();
    Serial.println("CIRCLE: Manual button pressed!");
  } else if (buttonState == HIGH) {
    manualButtonPressed = false;
  }
}

// Motor control functions
// manualOverride = true bypasses rest time and runtime checks for manual control
// Returns true if motor started successfully, false otherwise
bool startMotor(bool manualOverride) {
  Serial.println("==========================================");
  Serial.println("🔄 MOTOR START SEQUENCE - SUMP TANK ESP32");
  Serial.println("==========================================");
  Serial.print("🎛️  MODE: ");
  Serial.println(manualOverride ? "MANUAL OVERRIDE" : "AUTO MODE");
  Serial.print("🏊 FLOAT SWITCH: ");
  Serial.println(floatSwitchOn ? "ON (SAFE)" : "OFF (UNSAFE)");
  Serial.print("📊 SUMP LEVEL: ");
  Serial.print(sumpLevel, 1);
  Serial.println("%");
  Serial.print("⚡ MOTOR CURRENT STATUS: ");
  Serial.println(motorRunning ? "RUNNING" : "STOPPED");

  if (!canMotorStart(manualOverride)) {
    Serial.println("❌ BLOCKED: Motor start blocked by safety checks");
    Serial.println("🔍 REASON: See safety check details above");
    Serial.println("==========================================");
    return false;
  }

  Serial.println("✅ SAFETY CHECKS PASSED - Starting motor...");
  Serial.println("🔌 ACTION: Activating motor relay...");

  digitalWrite(MOTOR_RELAY_PIN, HIGH);
  motorRunning = true;
  motorStartTime = millis();
  motorStatus = "running";

  Serial.println("✅ SUCCESS: Motor STARTED!");
  Serial.print("⏰ START TIME: ");
  Serial.println(motorStartTime);
  Serial.println("📡 SENDING: Motor status update to backend");
  Serial.println("🚨 SENDING: System alert - motor started");

  sendMotorStatus();
  sendSystemAlert("motor_auto_start", "Motor started automatically - Sump filling, filling top tank");

  Serial.println("==========================================");
  Serial.println("🎉 MOTOR START SEQUENCE COMPLETED!");
  Serial.println("==========================================");

  return true;
}

void stopMotor() {
  Serial.println("==========================================");
  Serial.println("🛑 MOTOR STOP SEQUENCE - SUMP TANK ESP32");
  Serial.println("==========================================");
  Serial.print("⚡ MOTOR CURRENT STATUS: ");
  Serial.println(motorRunning ? "RUNNING" : "STOPPED");

  Serial.println("🔌 ACTION: Deactivating motor relay...");
  digitalWrite(MOTOR_RELAY_PIN, LOW);
  motorRunning = false;
  motorLastStopTime = millis();
  motorStatus = "stopped";

  Serial.println("✅ SUCCESS: Motor STOPPED!");
  Serial.print("⏰ STOP TIME: ");
  Serial.println(motorLastStopTime);

  if (motorStartTime > 0) {
    unsigned long runtime = motorLastStopTime - motorStartTime;
    Serial.print("⏱️  TOTAL RUNTIME: ");
    Serial.print(runtime / 1000);
    Serial.println(" seconds");
  }

  Serial.println("📡 SENDING: Motor status update to backend");
  Serial.println("🚨 SENDING: System alert - motor stopped");

  sendMotorStatus();
  sendSystemAlert("motor_auto_stop", "Motor stopped automatically - Top tank is full");

  Serial.println("==========================================");
  Serial.println("🎉 MOTOR STOP SEQUENCE COMPLETED!");
  Serial.println("==========================================");
}

// Safety checks before starting motor with optional manual override
// manualOverride = true bypasses rest time and runtime checks (but keeps critical safety)
bool canMotorStart(bool manualOverride) {
  // Check float switch - CRITICAL SAFETY (always check, even for manual override)
  if (!floatSwitchOn) {
    Serial.println("ALERT: SAFETY: Float switch is OFF - Motor cannot start!");
    motorSafetyAlert = true;
    return false;
  }

  // Check sump level - prevent dry run (always check, even for manual override)
  if (sumpLevel < SUMP_MIN_LEVEL) {
    Serial.println("ALERT: SAFETY: Sump level too low - Motor cannot start!");
    motorSafetyAlert = true;
    return false;
  }

  // For manual override, skip rest time and runtime checks
  if (!manualOverride) {
    // Check minimum rest time
    if (millis() - motorLastStopTime < MOTOR_MIN_REST_TIME) {
      Serial.println("HOURGLASS: Motor rest time not elapsed - cannot start yet");
      return false;
    }

    // Check maximum runtime
    if (motorRunning && (millis() - motorStartTime) > MOTOR_MAX_RUNTIME) {
      Serial.println("CLOCK: Motor exceeded maximum runtime - stopping");
      stopMotor();
      return false;
    }
  } else {
    Serial.println("MANUAL: MANUAL OVERRIDE: Bypassing rest time and runtime checks");
  }

  motorSafetyAlert = false;
  return true;
}

// Manual motor control via toggle switch - works in both auto and manual modes
void manualMotorControl() {
  // Handle manual motor switch (works in both auto and manual modes with override)
  if (manualMotorOn && !motorRunning) {
    // Switch is ON but motor is OFF - start with manual override
    if (startMotor(true)) {  // true = manual override
      lastCommandSource = "manual_switch";
      Serial.println("MANUAL: MANUAL CONTROL: Motor started via switch with override");
    } else {
      Serial.println("ERROR: MANUAL CONTROL: Failed to start motor via switch");
    }
  } else if (!manualMotorOn && motorRunning && lastCommandSource == "manual_switch") {
    // Switch is OFF and motor was started by switch - stop it
    stopMotor();
    Serial.println("MANUAL: MANUAL CONTROL: Motor stopped via switch");
  }

  // Handle manual override timer (for button presses)
  if (manualOverride && (millis() - manualOverrideStartTime >= 30000)) {
    manualOverride = false;
    Serial.println("REFRESH: Manual override expired - returning to auto mode");
  }
}

// Check motor safety conditions and reset alerts if safe
void checkMotorSafety() {
  if (floatSwitchOn && sumpLevel >= SUMP_MIN_LEVEL) {
    if (motorSafetyAlert) {
      Serial.println("SUCCESS: Motor safety conditions restored");
      motorSafetyAlert = false;
    }
  }
}

// Check for alerts
void checkAlerts(float level) {
  String newStatus = "normal";
  bool shouldAlert = false;

  if (level >= 90.0) { // Sump filled alert
    newStatus = "critical";
    if (!criticalLevelAlert) {
      criticalLevelAlert = true;
      shouldAlert = true;
      Serial.println("ALERT: CRITICAL: Sump tank filled to 90%!");
      sendSystemAlert("sump_filled", "Sump tank is completely filled - Buzzer activated 5 times");
    }
  } else if (level >= 85.0) { // Sump 90% alert
    newStatus = "warning";
    if (!lowLevelAlert) {
      lowLevelAlert = true;
      shouldAlert = true;
      Serial.println("WARNING: WARNING: Sump tank reached 90% capacity");
      sendSystemAlert("sump_90_percent", "Sump tank reached 90% capacity - Buzzer activated");
    }
  } else if (level <= SUMP_CRITICAL_LEVEL) {
    newStatus = "critical";
    if (!criticalLevelAlert) {
      criticalLevelAlert = true;
      shouldAlert = true;
      Serial.println("ALERT: CRITICAL: Sump tank water level extremely low!");
    }
  } else if (level <= 20.0) { // Low level threshold
    newStatus = "warning";
    if (!lowLevelAlert) {
      lowLevelAlert = true;
      shouldAlert = true;
      Serial.println("WARNING: WARNING: Sump tank water level getting low");
    }
  } else {
    if (lowLevelAlert || criticalLevelAlert) {
      Serial.println("SUCCESS: Sump tank water level back to normal");
    }
    lowLevelAlert = false;
    criticalLevelAlert = false;
  }

  // Motor safety alerts
  if (motorSafetyAlert) {
    newStatus = "critical";
    shouldAlert = true;
    Serial.println("ALERT: MOTOR SAFETY ALERT: Motor operation blocked!");
  }

  // Visual/audio alerts
  if (shouldAlert) {
    for (int i = 0; i < 3; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }

  // LED status indication
  if (newStatus == "critical" || motorSafetyAlert) {
    digitalWrite(LED_PIN, HIGH);
  } else if (newStatus == "warning") {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 1000) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else if (motorRunning) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 2000) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}

// Send sensor data to server
void sendSensorData() {
  StaticJsonDocument<512> doc;
  StaticJsonDocument<512> payloadDoc;

  payloadDoc["tank_type"] = "sump_tank";
  payloadDoc["level_percentage"] = sumpLevel;
  payloadDoc["level_liters"] = sumpVolume;
  payloadDoc["sensor_health"] = "good";
  payloadDoc["esp32_id"] = DEVICE_ID;
  payloadDoc["battery_voltage"] = 3.3;
  payloadDoc["signal_strength"] = WiFi.RSSI();
  payloadDoc["float_switch"] = floatSwitchOn;

  // Motor status
  payloadDoc["motor_running"] = motorRunning;
  payloadDoc["motor_status"] = motorRunning ? "running" : "stopped";
  payloadDoc["auto_mode_enabled"] = autoModeEnabled;
  payloadDoc["manual_override"] = manualOverride;

  // Connection status
  payloadDoc["connection_state"] = getConnectionStateString();
  payloadDoc["backend_responsive"] = backendResponsive;

  doc["type"] = "sensor_data";
  doc["payload"] = payloadDoc;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("DATA: Sump sensor data sent - Level: " + String(sumpLevel, 1) + "%, Motor: " + motorStatus);
}

// Send tank reading data to server (for frontend compatibility)
void sendTankReading() {
  StaticJsonDocument<256> doc;
  doc["type"] = "tank_reading";
  doc["tank_type"] = "sump_tank";
  doc["level_percentage"] = sumpLevel;
  doc["level_liters"] = sumpVolume;
  doc["sensor_health"] = "good";
  doc["esp32_id"] = DEVICE_ID;
  doc["timestamp"] = millis();

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("DATA: Sump tank reading sent - Level: " + String(sumpLevel, 1) + "%");
}

// Send motor status to server
void sendMotorStatus() {
  StaticJsonDocument<256> doc;
  doc["type"] = "motor_status";
  doc["esp32_id"] = DEVICE_ID;
  doc["motor_running"] = motorRunning;
  doc["motor_status"] = motorStatus;
  doc["auto_mode"] = autoModeEnabled;
  doc["manual_override"] = manualOverride;
  doc["runtime_seconds"] = motorRunning ? (millis() - motorStartTime) / 1000 : 0;
  doc["safety_alert"] = motorSafetyAlert;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.print("DATA: Motor status sent: ");
  Serial.println(motorStatus);
}

// Send system alert to server
void sendSystemAlert(String alertType, String message) {
  StaticJsonDocument<256> doc;
  doc["type"] = "system_alert";
  doc["alert_type"] = alertType;
  doc["message"] = message;
  doc["esp32_id"] = DEVICE_ID;
  doc["level_percentage"] = sumpLevel;
  doc["timestamp"] = millis();

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.print("ALERT: System alert sent: ");
  Serial.println(alertType);
}

// Send ping to keep connection alive
void sendPing() {
  StaticJsonDocument<64> doc;
  doc["type"] = "ping";
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  Serial.println("PING: Ping sent");
}

// Get connection state as string for debugging
String getConnectionStateString() {
  switch (connectionState) {
    case DISCONNECTED: return "disconnected";
    case CONNECTING: return "connecting";
    case CONNECTED: return "connected";
    case RECONNECTING: return "reconnecting";
    case STABLE: return "stable";
    default: return "unknown";
  }
}

// Calculate exponential backoff delay
unsigned long calculateReconnectDelay() {
  unsigned long delay = BASE_RECONNECT_DELAY * (1 << min(connectionAttempts, 6)); // Max 64x multiplier
  return min(delay, MAX_RECONNECT_DELAY);
}

// Attempt WebSocket reconnection with smart backoff
void attemptWebSocketReconnection() {
  if (connectionState == CONNECTING || connectionState == CONNECTED) {
    return; // Already attempting connection
  }

  unsigned long now = millis();
  unsigned long delay = calculateReconnectDelay();

  if (now - lastConnectionAttempt < delay) {
    return; // Too soon to retry
  }

  Serial.print("REFRESH: Attempting WebSocket reconnection (attempt ");
  Serial.print(connectionAttempts + 1);
  Serial.print("/");
  Serial.print(MAX_CONNECTION_ATTEMPTS);
  Serial.print(") in ");
  Serial.print(delay / 1000);
  Serial.println(" seconds...");

  connectionState = CONNECTING;
  connectionAttempts++;
  lastConnectionAttempt = now;

  webSocket.begin(SUPABASE_URL, WEBSOCKET_PORT, WEBSOCKET_PATH);
  // webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY); // Not needed for local backend
}

// WebSocket event handler (IMPROVED)
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  Serial.print("WEBSOCKET: WebSocket Event: ");
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("DISCONNECTED");
      websocketConnected = false;
      backendResponsive = false;

      if (connectionState == STABLE) {
        Serial.println("WARNING: Stable connection lost - entering reconnection mode");
        connectionState = RECONNECTING;
        connectionAttempts = 0; // Reset attempts for reconnection
      } else {
        connectionState = DISCONNECTED;
      }
      break;

    case WStype_CONNECTED:
      Serial.println("CONNECTED");
      websocketConnected = true;
      backendResponsive = true;
      connectionEstablishedTime = millis();
      connectionAttempts = 0; // Reset on successful connection

      if (connectionState != STABLE) {
        connectionState = CONNECTED;
        Serial.println("REFRESH: Connection established - monitoring for stability");
      }

      // Send device registration
      {
        StaticJsonDocument<256> doc;
        doc["type"] = "esp32_register";
        doc["esp32_id"] = DEVICE_ID;
        doc["device_type"] = DEVICE_TYPE;
        doc["firmware_version"] = "2.0.0";

        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("ANTENNA: ESP32 registered with server");
      }
      break;

    case WStype_TEXT:
      {
        Serial.print("RECEIVED: Received TEXT message: ");
        Serial.println((char*)payload);

        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, payload, length);

        if (!error) {
          String messageType = doc["type"];
          Serial.print("NOTE: Message type: ");
          Serial.println(messageType);

          if (messageType == "get_status") {
            sendSensorData();
            sendMotorStatus();
            Serial.println("CLIPBOARD: Status sent on request");
          } else if (messageType == "motor_control") {
            bool motorState = doc["state"];
            Serial.print("GAME: Motor control command received: ");
            Serial.println(motorState ? "START" : "STOP");

            manualOverride = true;
            manualOverrideStartTime = millis(); // Start the timer

            if (motorState) {
              bool success = startMotor(true);  // Manual override for WebSocket motor control
              if (!success) {
                Serial.println("ERROR: WebSocket motor start failed - safety checks failed");
              }
            } else {
              stopMotor();
            }

            // Manual override will be reset by manualMotorControl() after 30 seconds
          } else if (messageType == "auto_mode_control") {
            autoModeEnabled = doc["enabled"];
            Serial.print("ROBOT: Auto mode ");
            Serial.println(autoModeEnabled ? "ENABLED" : "DISABLED");
          } else if (messageType == "pong") {
            Serial.println("PING: Pong received - connection is alive");
            lastHeartbeatResponse = millis();
            heartbeatMissedCount = 0;
            backendResponsive = true;

            // Upgrade to stable connection after successful pong
            if (connectionState == CONNECTED && (millis() - connectionEstablishedTime) > 60000) {
              connectionState = STABLE;
              Serial.println("LOCK: Connection stabilized - no unnecessary restarts");
            }

            Serial.println("GREEN: Heartbeat response confirmed - system healthy");
          }
        }
      }
      break;

    case WStype_ERROR:
      Serial.println("ERROR: WebSocket Error!");
      Serial.print("SEARCH: Error details - Length: ");
      Serial.print(length);
      Serial.print(", Payload: ");
      if (payload && length > 0) {
        Serial.println((char*)payload);
      } else {
        Serial.println("No payload");
      }
      websocketConnected = false;
      backendResponsive = false;
      websocketErrorCount++;

      if (connectionState == STABLE) {
        connectionState = RECONNECTING;
      }

      Serial.print("SEARCH: WebSocket error count: ");
      Serial.println(websocketErrorCount);
      break;
  }
}

// Connect to WiFi with comprehensive error handling and retry logic
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("INFO:TEXT: WiFi already connected");
    return;
  }

  // Check if using placeholder credentials
  if (strcmp(WIFI_SSID, "Your_WiFi_Name") == 0 || strcmp(WIFI_PASSWORD, "Your_WiFi_Password") == 0) {
    Serial.println("ERROR: ERROR: WiFi credentials not configured!");
    Serial.println("   Please update WIFI_SSID and WIFI_PASSWORD in the configuration section");
    Serial.println("   Current values:");
    Serial.print("   SSID: ");
    Serial.println(WIFI_SSID);
    Serial.print("   Password: ");
    Serial.println(WIFI_PASSWORD);
    wifiConnected = false;
    return;
  }

  Serial.print("REFRESH: Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  const int MAX_ATTEMPTS = 30; // Increased from 20
  const int RETRY_DELAY = 1000; // 1 second delay between attempts

  while (WiFi.status() != WL_CONNECTED && attempts < MAX_ATTEMPTS) {
    delay(RETRY_DELAY);
    Serial.print(".");

    // Print connection status for debugging
    switch (WiFi.status()) {
      case WL_NO_SSID_AVAIL:
        if (attempts == MAX_ATTEMPTS - 1) Serial.print("(No SSID found)");
        break;
      case WL_CONNECT_FAILED:
        if (attempts == MAX_ATTEMPTS - 1) Serial.print("(Connection failed)");
        break;
      case WL_CONNECTION_LOST:
        if (attempts == MAX_ATTEMPTS - 1) Serial.print("(Connection lost)");
        break;
      case WL_DISCONNECTED:
        if (attempts == MAX_ATTEMPTS - 1) Serial.print("(Disconnected)");
        break;
    }

    attempts++;

    // Reset WiFi every 10 attempts if still failing
    if (attempts % 10 == 0 && attempts < MAX_ATTEMPTS) {
      Serial.println("\nREFRESH: Resetting WiFi connection...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nSUCCESS: WiFi connected successfully!");
    Serial.print("ANTENNA: IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("SIGNAL: Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    wifiConnected = true;
    wifiLastConnectedTime = millis(); // Mark connection time for stability check
    wifiConnectionStable = false; // Will be set to true after stability period
    connectionState = CONNECTING; // Ready to attempt WebSocket connection
  } else {
    Serial.println("\nERROR: WiFi connection failed after maximum attempts!");
    Serial.print("SEARCH: Last WiFi status: ");
    switch (WiFi.status()) {
      case WL_NO_SSID_AVAIL:
        Serial.println("No SSID available");
        break;
      case WL_CONNECT_FAILED:
        Serial.println("Connection failed");
        break;
      case WL_CONNECTION_LOST:
        Serial.println("Connection lost");
        break;
      case WL_DISCONNECTED:
        Serial.println("Disconnected");
        break;
      default:
        Serial.println("Unknown error");
        break;
    }
    wifiConnected = false;
  }
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Aqua Guard Sense ESP32 Sump Tank + Motor Controller v2.0 (IMPROVED) ===");
  Serial.println("START: ESP32 STARTUP - Device restarted or powered on");
  Serial.println("Sump Tank Sensor: AJ-SR04M Ultrasonic Sensor (TRIG/ECHO)");
  Serial.println("Safety: Float Switch + Dual Verification");
  Serial.println("Motor Control: Relay + Manual Override Button");
  Serial.print("Sump Tank: ");
  Serial.print(SUMP_TANK_LENGTH_CM);
  Serial.print("cm x ");
  Serial.print(SUMP_TANK_BREADTH_CM);
  Serial.print("cm x ");
  Serial.print(SUMP_TANK_HEIGHT_CM);
  Serial.println("cm (Length x Breadth x Height)");

  Serial.println("\nWARNING:  IMPORTANT WIRING:");
  Serial.println("   SUMP TANK AJ-SR04M:");
  Serial.println("   - TRIG -> ESP32 GPIO 5");
  Serial.println("   - ECHO -> ESP32 GPIO 18");
  Serial.println("   - GND -> ESP32 GND");
  Serial.println("   - VCC -> ESP32 5V");
  Serial.println("   CONTROLS:");
  Serial.println("   - FLOAT SWITCH -> ESP32 GPIO 4");
  Serial.println("   - MANUAL BUTTON -> ESP32 GPIO 12");
  Serial.println("   - MOTOR RELAY -> ESP32 GPIO 13");
  Serial.println("   ALERTS:");
  Serial.println("   - BUZZER -> ESP32 GPIO 14");
  Serial.println("   - LED -> ESP32 GPIO 15");

  Serial.println("\nWARNING:  CRITICAL SAFETY NOTES:");
  Serial.println("   - Sensor CANNOT detect below 20cm - readings will be wrong!");
  Serial.println("   - Float switch prevents motor start when water is too low");
  Serial.println("   - Manual button allows emergency motor control");
  Serial.println("   - Motor has 30-minute timeout for safety");
  Serial.println("   - FORBIDDEN: NO AUTO-RESTART POLICY: Only restarts on PANIC/CRASH");
  Serial.println("   - REFRESH: Only heartbeat sent to backend, no forced restarts");
  Serial.println("   - WATCHDOG: Watchdog timeout increased to 60s for stability");

  // Initialize pins
  pinMode(SUMP_TRIGPIN, OUTPUT);
  pinMode(SUMP_ECHOPIN, INPUT);
  Serial.println("SUCCESS: Sump tank AJ-SR04M initialized");

  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(MOTOR_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // Initialize new LED pins
  pinMode(AUTO_MODE_LED_PIN, OUTPUT);
  pinMode(SUMP_FULL_LED_PIN, OUTPUT);
  pinMode(SUMP_LOW_LED_PIN, OUTPUT);

  // Initialize new switch pins
  pinMode(MANUAL_MOTOR_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MODE_SWITCH_PIN, INPUT_PULLUP);

  Serial.println("SUCCESS: Control pins initialized");

  // Initialize Watchdog Timer
  Serial.print("LOCK: Initializing Watchdog Timer (");
  Serial.print(WDT_TIMEOUT);
  Serial.println("s timeout)...");

  // Deinitialize first to avoid "already initialized" error
  esp_task_wdt_deinit();

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config); // Enable panic reset
  esp_task_wdt_add(NULL); // Add current task to watchdog
  lastWatchdogFeed = millis();
  Serial.println("SUCCESS: Watchdog Timer initialized");

  // Prevent ESP32 from going to sleep
  Serial.println("COFFEE: Preventing ESP32 sleep mode...");
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  WiFi.setSleep(false);  // Disable WiFi sleep to maintain connection
  Serial.println("SUCCESS: Sleep prevention enabled");

  // Test sensors
  testAJ_SR04MCommunication();

  // Ensure all outputs are off at startup
  digitalWrite(MOTOR_RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Initialize new LED states
  digitalWrite(AUTO_MODE_LED_PIN, HIGH);  // Auto mode LED ON by default
  digitalWrite(SUMP_FULL_LED_PIN, LOW);   // Sump full LED OFF
  digitalWrite(SUMP_LOW_LED_PIN, LOW);    // Sump low LED OFF

  Serial.println("SUCCESS: All outputs set to OFF state");

  // Connect to WiFi
  connectToWiFi();

  // Initialize HTTP server
  if (wifiConnected) {
    server.on("/", handleRoot);
    server.on("/motor", HTTP_POST, handleMotorCommand);
    server.on("/status", HTTP_GET, handleStatus);
    server.begin();
    Serial.println("WEB: HTTP Server started on port 80");
    Serial.print("LOCATION: HTTP Server URL: http://");
    Serial.println(WiFi.localIP());
  }

  // Initialize WebSocket
  if (wifiConnected) {
    Serial.println("REFRESH: Initializing WebSocket connection...");
    webSocket.begin(SUPABASE_URL, WEBSOCKET_PORT, WEBSOCKET_PATH);
    webSocket.onEvent(webSocketEvent);
    // webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY); // Not needed for local backend
    // webSocket.setExtraHeaders("apikey: ..."); // Not needed for local backend

    connectionState = CONNECTING;
  }

  Serial.println("========== Setup Complete ==========");
  Serial.println("\nSTART: NEXT STEPS:");
  Serial.println("1. Check serial output for sensor test results");
  Serial.println("2. Monitor sump tank levels every 3 seconds");
  Serial.println("3. Test manual button for motor control");
  Serial.println("4. Verify float switch safety mechanism");
  Serial.println("5. IMPROVED: System will maintain connection without unnecessary restarts");
  Serial.println("6. Device ID: ESP32_SUMP_002 - Sump Tank Controller (MAC: 80:F3:DA:65:86:6C)");
}

// ========== MAIN LOOP ==========
void loop() {
  // Feed watchdog timer periodically (MORE FREQUENT) with safeguard
  if (millis() - lastWatchdogFeed > WATCHDOG_FEED_INTERVAL) {
    // Safeguard: Don't feed if it's been less than 1 second (prevents infinite loop detection)
    if (millis() - lastWatchdogFeed < 1000) {
      Serial.println("ALERT: WARNING: Watchdog being fed too frequently - possible infinite loop!");
      delay(1000); // Brief delay to prevent rapid feeding
    }

    esp_task_wdt_reset();
    lastWatchdogFeed = millis();
    Serial.println("WATCHDOG: Watchdog fed - System healthy");
  }

  webSocket.loop();
  server.handleClient();

  // Read sensors and controls periodically
  if (millis() - lastSensorRead > 3000) {
    // Feed watchdog before sensor reading
    esp_task_wdt_reset();
    Serial.println("WATCHDOG: Watchdog fed before sensor reading");

    // Read sump tank level
    float newLevel = readSumpUltrasonicLevel();
    if (newLevel >= 0) {
      sumpLevel = newLevel;
      sumpVolume = calculateSumpVolume(sumpLevel);
      checkAlerts(sumpLevel);

      Serial.print("SWIM: Sump Tank Level: ");
      Serial.print(sumpLevel, 1);
      Serial.print("% | Volume: ");
      Serial.print(sumpVolume, 1);
      Serial.print("L | Distance: ");
      float distance = SUMP_TANK_HEIGHT_CM - ((sumpLevel / 100.0) * SUMP_TANK_HEIGHT_CM);
      Serial.print(distance, 1);
      Serial.println(" cm");

      if (sumpLevel > 85) {
        Serial.println("WARNING: CRITICAL: High sump level - sensor cannot detect < 20cm!");
      }
    } else {
      Serial.println("ERROR: Sump AJ-SR04M sensor error - invalid reading");
    }

    // Read controls
    readControls();

    // Check motor safety and handle manual control
    checkMotorSafety();
    manualMotorControl();

    // Update LED indicators based on current sump level and mode
    updateLedIndicators();

    // Read manual switches
    readModeSwitch();
    readManualMotorSwitch();

    lastSensorRead = millis();
  }

  // Send heartbeat and data with improved monitoring (NO AUTO RESTART)
  if (websocketConnected) {
    static unsigned long lastPing = 0;
    if (millis() - lastPing > 30000) {  // Ping every 30 seconds
      sendPing();
      lastPing = millis();
    }

    // More frequent heartbeat (every 30 seconds)
    if (millis() - lastHeartbeat > 30000) {
      // Feed watchdog before sending data
      esp_task_wdt_reset();
      Serial.println("WATCHDOG: Watchdog fed before heartbeat");

      sendSensorData();
      sendTankReading(); // Send tank reading for frontend compatibility
      lastHeartbeat = millis();
      Serial.println("HEARTBEAT: Heartbeat sent - NO RESTART POLICY ACTIVE");
    }

    // IMPROVED: Only log warnings, NO AUTO-RESTART
    if (millis() - lastHeartbeatResponse > HEARTBEAT_TIMEOUT) {
      heartbeatMissedCount++;
      backendResponsive = false;

      Serial.print("WARNING: Heartbeat response timeout! Missed count: ");
      Serial.print(heartbeatMissedCount);
      Serial.print(" (Connection State: ");
      Serial.print(getConnectionStateString());
      Serial.println(") - CONTINUING OPERATION, NO RESTART");

      if (heartbeatMissedCount >= 5) {  // After 5 missed heartbeats (10 minutes)
        Serial.println("ALERT: WARNING: Backend not responsive for 10+ minutes!");
        Serial.println("REFRESH: Attempting reconnection but NOT restarting ESP32");
        Serial.println("BULB: System will continue operating and attempt reconnection");

        if (connectionState == STABLE) {
          connectionState = RECONNECTING;
          connectionAttempts = 0;
        }
      }
    }
  } else {
    // Reset heartbeat tracking when disconnected
    lastHeartbeatResponse = millis();
    heartbeatMissedCount = 0;
    backendResponsive = false;
  }

  // IMPROVED: Smart reconnection logic
  if (!websocketConnected && WiFi.status() == WL_CONNECTED) {
    if (connectionState == DISCONNECTED || connectionState == RECONNECTING) {
      attemptWebSocketReconnection();
    }
  }

  // Monitor WiFi connection stability
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnectionStable && millis() - wifiLastConnectedTime > WIFI_STABILITY_CHECK_TIME) {
      wifiConnectionStable = true;
      Serial.println("LOCK: WiFi connection stable (10s confirmation period passed)");
    }
  } else {
    wifiConnectionStable = false;
  }

  // Reconnect WiFi only if truly disconnected and stable connection was lost
  if (WiFi.status() != WL_CONNECTED && wifiConnectionStable) {
    if (wifiConnected) {
      Serial.println("WARNING: WiFi disconnected! (confirmed after stability check)");
      wifiConnected = false;
      websocketConnected = false;
      connectionState = DISCONNECTED;
      wifiConnectionStable = false;
      lastWifiReconnectAttempt = millis();
    }

    // Only attempt reconnection every 30 seconds to avoid constant retry loops
    if (millis() - lastWifiReconnectAttempt > 30000) {
      Serial.println("REFRESH: Attempting WiFi reconnection...");
      connectToWiFi();
      lastWifiReconnectAttempt = millis();
    }
  }

  // Periodic WiFi health check (every 5 minutes when stable)
  static unsigned long lastHealthCheck = 0;
  if (wifiConnectionStable && millis() - lastHealthCheck > 300000) { // 5 minutes
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("GREEN: WiFi health check passed");
      lastHealthCheck = millis();
    } else {
      Serial.println("WARNING: WiFi health check failed - connection unstable");
      wifiConnectionStable = false;
      wifiConnected = false;
      websocketConnected = false;
    }
  }

  // Connection status monitoring
  static unsigned long lastStatusLog = 0;
  if (millis() - lastStatusLog > 60000) {  // Log status every minute
    Serial.print("DATA: Status: WiFi=");
    Serial.print(wifiConnected ? "SUCCESS:" : "ERROR:");
    Serial.print(" | WS=");
    Serial.print(websocketConnected ? "SUCCESS:" : "ERROR:");
    Serial.print(" | State=");
    Serial.print(getConnectionStateString());
    Serial.print(" | Backend=");
    Serial.print(backendResponsive ? "SUCCESS:" : "ERROR:");
    Serial.print(" | Motor=");
    Serial.print(motorRunning ? "SUCCESS:" : "ERROR:");
    Serial.print(" | Level=");
    Serial.print(sumpLevel, 1);
    Serial.println("%");
    lastStatusLog = millis();
  }

  delay(100);
}

// Update LED indicators based on current states
void updateLedIndicators() {
  // LED 1: Auto mode indicator
  digitalWrite(AUTO_MODE_LED_PIN, autoModeEnabled ? HIGH : LOW);

  // LED 2: Sump water full (90% level)
  digitalWrite(SUMP_FULL_LED_PIN, (sumpLevel >= 90.0) ? HIGH : LOW);

  // LED 3: Sump water level indicator
  static unsigned long lastBlinkTime = 0;
  static bool blinkState = false;
  
  if (sumpLevel <= 10.0) {
    // LED ON when empty
    digitalWrite(SUMP_LOW_LED_PIN, HIGH);
  } else if (sumpLevel >= 85.0 && sumpLevel < 90.0) {
    // Blinking at 85%
    if (millis() - lastBlinkTime > 500) { // Blink every 500ms
      blinkState = !blinkState;
      lastBlinkTime = millis();
    }
    digitalWrite(SUMP_LOW_LED_PIN, blinkState ? HIGH : LOW);
  } else if (sumpLevel >= 90.0) {
    // Steady ON at 90%
    digitalWrite(SUMP_LOW_LED_PIN, HIGH);
  } else {
    // OFF for other levels
    digitalWrite(SUMP_LOW_LED_PIN, LOW);
  }
}

// ========== SWITCH CONTROL FUNCTIONS ==========

// Read and handle mode switch (Auto/Manual toggle)
void readModeSwitch() {
  bool currentState = digitalRead(MODE_SWITCH_PIN);

  // Check for state change with debouncing
  if (currentState != lastModeSwitchState) {
    lastModeSwitchTime = millis();
  }

  // If state has been stable for debounce delay
  if ((millis() - lastModeSwitchTime) > DEBOUNCE_DELAY) {
    if (currentState == LOW && lastModeSwitchState == HIGH) {
      // Switch pressed (toggle mode)
      autoModeEnabled = !autoModeEnabled;
      Serial.print("REFRESH: Mode switched to: ");
      Serial.println(autoModeEnabled ? "AUTO" : "MANUAL");

      // If switching to manual mode, stop auto motor control
      if (!autoModeEnabled && motorRunning && lastCommandSource == "auto") {
        stopMotor();
        Serial.println("STOP: Auto motor stopped due to manual mode switch");
      }
    }
  }

  lastModeSwitchState = currentState;
}

// Read and handle manual motor switch (toggle switch) - works in both auto and manual modes
void readManualMotorSwitch() {
  bool currentState = digitalRead(MANUAL_MOTOR_SWITCH_PIN);

  // Check for state change with debouncing
  if (currentState != lastManualMotorSwitchState) {
    lastManualMotorSwitchTime = millis();
  }

  // If state has been stable for debounce delay
  if ((millis() - lastManualMotorSwitchTime) > DEBOUNCE_DELAY) {
    if (currentState == LOW && lastManualMotorSwitchState == HIGH) {
      // Switch pressed (toggle motor state)
      if (lastCommandSource == "manual_switch" && motorRunning) {
        // If motor was started by manual switch and is running, stop it
        stopMotor();
        manualMotorOn = false;
        Serial.println("CIRCLE: MANUAL SWITCH: Motor stopped (toggle OFF)");
      } else {
        // Start motor with manual override (bypasses safety checks except critical ones)
        bool success = startMotor(true);  // true = manual override
        if (success) {
          lastCommandSource = "manual_switch";
          manualMotorOn = true;
          Serial.println("CIRCLE: MANUAL SWITCH: Motor started with manual override (toggle ON)");
        } else {
          Serial.println("ERROR: MANUAL SWITCH: Failed to start motor - safety checks failed");
          manualMotorOn = false;
        }
      }
    }
  }

  lastManualMotorSwitchState = currentState;
}
