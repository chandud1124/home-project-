/*
 * Aqua Guard Sense - ESP32 Top Tank Monitor (IMPROVED)
 * Dedicated top tank monitoring and motor command system
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - AJ-SR04M Ultrasonic sensor for top tank water level measurement
 * - Real-time data transmission to backend
 * - Motor control commands sent to Sump Tank ESP32
 * - Alert system for top tank water levels
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
 * - Optional: Buzzer and LED for alerts
 *
 * Wiring:
 * - AJ-SR04M TRIG → ESP32 GPIO 5
 * - AJ-SR04M ECHO → ESP32 GPIO 18
 * - AJ-SR04M GND → ESP32 GND
 * - AJ-SR04M VCC → ESP32 5V
 * - Buzzer → ESP32 GPIO 14 (optional)
 * - LED → ESP32 GPIO 15 (optional)
 *
 * Communication:
 * - WebSocket to backend for data transmission
 * - Commands to Sump Tank ESP32 for motor control
 *
 * IMPORTANT: AJ-SR04M cannot reliably detect distances below 20cm
 * Readings closer than 20cm will be inaccurate/wrong
 */

// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATE THESE VALUES FOR YOUR NETWORK
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Server Configuration - PRODUCTION SUPABASE URLs
const char* SUPABASE_URL = "dwcouaacpqipvvsxiygo.supabase.co";
const char* WEBSOCKET_PATH = "/functions/v1/websocket";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4";

// Device Configuration
const char* DEVICE_TYPE = "top_tank_monitor";
const char* DEVICE_ID = "ESP32_TOP_002";  // Updated to unique ID

// Sump Tank ESP32 Configuration (for motor commands)
const char* SUMP_ESP32_IP = "192.168.0.184";  // Updated with actual Sump ESP32 IP address
const int SUMP_ESP32_PORT = 80;

// Hardware Pin Configuration
// AJ-SR04M Ultrasonic Sensor Pins (TRIG/ECHO mode)
#define TRIGPIN 5
#define ECHOPIN 18
#define BUZZER_PIN 14          // Alert buzzer (optional)
#define LED_PIN 15             // Status LED (optional)

// Tank Configuration - UPDATE FOR YOUR TOP TANK
const float TANK_HEIGHT_CM = 250.0;     // Height of top tank in cm (UPDATED)
const float TANK_LENGTH_CM = 230.0;     // Length of top tank in cm (UPDATED)
const float TANK_BREADTH_CM = 230.0;    // Breadth of top tank in cm (UPDATED)
const float LOW_LEVEL_THRESHOLD = 20.0;  // Alert when below this percentage (UPDATED)
const float CRITICAL_LEVEL_THRESHOLD = 10.0; // Critical alert threshold

// Motor Control Thresholds (commands sent to Sump ESP32)
const float MOTOR_START_LEVEL = 15.0;  // Start when top tank < 15% (UPDATED)
const float MOTOR_STOP_LEVEL = 85.0;   // Stop when top tank > 85% (UPDATED)

// AJ-SR04M Sensor Configuration
const float MIN_SENSOR_DISTANCE_CM = 20.0;  // Minimum reliable detection distance
const float MAX_SENSOR_DISTANCE_CM = 450.0; // Maximum detection distance

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>  // ESP32 Watchdog Timer

// ========== WATCHDOG CONFIGURATION ==========
#define WDT_TIMEOUT 30  // Watchdog timeout in seconds
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
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool wifiConnected = false;
bool websocketConnected = false;

// Sensor readings
float currentLevel = 0.0;
float waterVolume = 0.0;
String alertStatus = "normal";
float duration = 0.0;
float distance = 0.0;

// Motor control state (tracked for commands to Sump ESP32)
bool motorRunning = false;
bool autoModeEnabled = true;

// Alert states
bool lowLevelAlert = false;
bool criticalLevelAlert = false;

// Error handling and recovery variables
int websocketErrorCount = 0;
int websocketReconnectAttempts = 0;
int wifiReconnectAttempts = 0;
unsigned long lastWifiReconnectAttempt = 0;
unsigned long lastWebsocketReconnectAttempt = 0;

// Heartbeat and keep-alive variables (IMPROVED - No auto restart)
unsigned long lastHeartbeatResponse = 0;
int heartbeatMissedCount = 0;
const unsigned long HEARTBEAT_TIMEOUT = 120000; // 2 minutes timeout for heartbeat response
bool backendResponsive = true;

// ========== FUNCTIONS ==========

// Test AJ-SR04M ultrasonic sensor
void testAJ_SR04MCommunication() {
  Serial.println("\n🔧 Testing AJ-SR04M Ultrasonic Sensor...");

  // Test multiple readings
  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGPIN, LOW);

    duration = pulseIn(ECHOPIN, HIGH, 30000);
    distance = (duration * 0.0343) / 2;

    Serial.print("📏 Test ");
    Serial.print(i + 1);
    Serial.print(": Distance = ");
    Serial.print(distance);
    Serial.println(" cm");

    delay(500);
  }

  Serial.println("✅ AJ-SR04M test completed");
  Serial.println("💡 Sensor Specifications:");
  Serial.println("   • Minimum detection distance: 20 cm (IMPORTANT LIMITATION)");
  Serial.println("   • Maximum detection distance: 450 cm");
  Serial.println("   • WARNING: Readings below 20cm will be inaccurate");
  Serial.println("💡 If readings are 0.00 or inconsistent:");
  Serial.println("   1. Check wiring: TRIG→GPIO 5, ECHO→GPIO 18");
  Serial.println("   2. Verify 5V power supply to sensor");
  Serial.println("   3. Ensure sensor is not obstructed");
  Serial.println("   4. Check for loose connections");
  Serial.println("   5. NOTE: Sensor cannot reliably detect < 20cm");
}

// Read top tank ultrasonic sensor with comprehensive error handling and validation
float readUltrasonicLevel() {
  const int NUM_READINGS = 5; // Take multiple readings for averaging
  const int MAX_INVALID_READINGS = 3; // Maximum allowed invalid readings
  float readings[NUM_READINGS];
  int validReadings = 0;
  int invalidReadings = 0;

  // Take multiple readings with error handling
  for (int i = 0; i < NUM_READINGS; i++) {
    // Trigger ultrasonic pulse
    digitalWrite(TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGPIN, LOW);

    // Read echo with timeout
    long duration = pulseIn(ECHOPIN, HIGH, 30000); // 30ms timeout

    // Check for timeout (no echo received)
    if (duration == 0) {
      Serial.println("⚠️ Top tank ultrasonic sensor timeout - no echo received");
      invalidReadings++;
      delay(50); // Short delay before retry
      continue;
    }

    // Convert duration to distance
    float distance = (duration * 0.0343) / 2;

    // Validate distance reading
    if (distance < MIN_SENSOR_DISTANCE_CM || distance > MAX_SENSOR_DISTANCE_CM || isnan(distance) || isinf(distance)) {
      Serial.print("⚠️ Invalid top tank distance reading: ");
      Serial.print(distance);
      Serial.println(" cm (out of valid range)");
      invalidReadings++;
    } else {
      readings[validReadings] = distance;
      validReadings++;
      Serial.print("✅ Valid top tank reading ");
      Serial.print(validReadings);
      Serial.print(": ");
      Serial.print(distance);
      Serial.println(" cm");
    }

    delay(100); // Delay between readings to avoid interference
  }

  // Check if we have enough valid readings
  if (validReadings < (NUM_READINGS - MAX_INVALID_READINGS)) {
    Serial.print("❌ Too many invalid top tank readings (");
    Serial.print(invalidReadings);
    Serial.print("/");
    Serial.print(NUM_READINGS);
    Serial.println(") - sensor may be faulty");
    return -1;
  }

  if (validReadings == 0) {
    Serial.println("❌ No valid top tank readings obtained");
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
    Serial.print("⚠️ Top tank average distance out of range: ");
    Serial.print(averageDistance);
    Serial.println(" cm");
    return -1;
  }

  Serial.print("📊 Top tank average distance: ");
  Serial.print(averageDistance);
  Serial.println(" cm");

  // Calculate water level percentage
  float waterHeight = TANK_HEIGHT_CM - averageDistance;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;
  levelPercent = constrain(levelPercent, 0, 100);

  Serial.print("💧 Top tank calculated level: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return levelPercent;
}

// Calculate water volume in liters for top tank (RECTANGULAR)
float calculateVolume(float levelPercent) {
  float waterHeight = (levelPercent / 100.0) * TANK_HEIGHT_CM;
  float volumeLiters = (TANK_LENGTH_CM * TANK_BREADTH_CM * waterHeight) / 1000.0;
  return volumeLiters;
}

// Send motor command to Sump Tank ESP32
void sendMotorCommandToSump(bool startMotor) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Cannot send motor command - WiFi not connected");
    return;
  }

  HTTPClient http;
  String url = "http://" + String(SUMP_ESP32_IP) + ":" + String(SUMP_ESP32_PORT) + "/motor";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  StaticJsonDocument<128> doc;
  doc["command"] = startMotor ? "start" : "stop";
  doc["source"] = "top_tank";
  doc["top_level"] = currentLevel;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.print("🚀 Sending motor command to Sump ESP32: ");
  Serial.println(startMotor ? "START" : "STOP");

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("✅ Sump ESP32 Response: ");
    Serial.println(response);
  } else {
    Serial.print("❌ HTTP Error: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}

// Auto motor control logic (sends commands to Sump ESP32)
void autoMotorControl() {
  if (!autoModeEnabled) {
    return; // Auto mode disabled
  }

  // Stop conditions (highest priority)
  if (currentLevel > MOTOR_STOP_LEVEL) {
    if (motorRunning) {
      Serial.println("🛑 AUTO STOP: Top tank > 90% (overflow prevention)");
      sendMotorCommandToSump(false);
      motorRunning = false;
    }
  }
  // Start conditions
  else if (currentLevel < MOTOR_START_LEVEL) {
    if (!motorRunning) {
      Serial.println("🚀 AUTO START: Top tank < 20%");
      sendMotorCommandToSump(true);
      motorRunning = true;
    }
  }
}

// Check for alerts
void checkAlerts(float level) {
  String newStatus = "normal";
  bool shouldAlert = false;

  if (level <= CRITICAL_LEVEL_THRESHOLD) {
    newStatus = "critical";
    if (!criticalLevelAlert) {
      criticalLevelAlert = true;
      shouldAlert = true;
      Serial.println("🚨 CRITICAL: Top tank water level extremely low!");
    }
  } else if (level <= LOW_LEVEL_THRESHOLD) {
    newStatus = "warning";
    if (!lowLevelAlert) {
      lowLevelAlert = true;
      shouldAlert = true;
      Serial.println("⚠️ WARNING: Top tank water level getting low");
    }
  } else {
    if (lowLevelAlert || criticalLevelAlert) {
      Serial.println("✅ Top tank water level back to normal");
    }
    lowLevelAlert = false;
    criticalLevelAlert = false;
  }

  alertStatus = newStatus;

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
  if (alertStatus == "critical") {
    digitalWrite(LED_PIN, HIGH);
  } else if (alertStatus == "warning") {
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

// Send sensor data to backend
void sendSensorData() {
  StaticJsonDocument<512> doc;
  StaticJsonDocument<512> payloadDoc;

  payloadDoc["tank_type"] = "top_tank";
  payloadDoc["level_percentage"] = currentLevel;
  payloadDoc["level_liters"] = waterVolume;
  payloadDoc["sensor_health"] = "good";
  payloadDoc["esp32_id"] = DEVICE_ID;
  payloadDoc["battery_voltage"] = 3.3;
  payloadDoc["signal_strength"] = WiFi.RSSI();
  payloadDoc["motor_command_sent"] = motorRunning;
  payloadDoc["connection_state"] = getConnectionStateString();
  payloadDoc["backend_responsive"] = backendResponsive;

  doc["type"] = "sensor_data";
  doc["payload"] = payloadDoc;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("📊 Top tank sensor data sent - Level: " + String(currentLevel, 1) + "%, Motor Command: " + (motorRunning ? "START" : "STOP"));
}

// Send ping to keep connection alive
void sendPing() {
  StaticJsonDocument<64> doc;
  doc["type"] = "ping";
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  Serial.println("🏓 Ping sent");
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

  Serial.print("🔄 Attempting WebSocket reconnection (attempt ");
  Serial.print(connectionAttempts + 1);
  Serial.print("/");
  Serial.print(MAX_CONNECTION_ATTEMPTS);
  Serial.print(") in ");
  Serial.print(delay / 1000);
  Serial.println(" seconds...");

  connectionState = CONNECTING;
  connectionAttempts++;
  lastConnectionAttempt = now;

  webSocket.beginSSL(SUPABASE_URL, 443, WEBSOCKET_PATH);
  webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY);
  webSocket.setInsecure();
}

// WebSocket event handler (IMPROVED)
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("🔌 WebSocket disconnected");
      websocketConnected = false;
      backendResponsive = false;

      if (connectionState == STABLE) {
        Serial.println("⚠️ Stable connection lost - entering reconnection mode");
        connectionState = RECONNECTING;
        connectionAttempts = 0; // Reset attempts for reconnection
      } else {
        connectionState = DISCONNECTED;
      }
      break;

    case WStype_CONNECTED:
      Serial.println("✅ WebSocket connected successfully!");
      websocketConnected = true;
      backendResponsive = true;
      connectionEstablishedTime = millis();
      connectionAttempts = 0; // Reset on successful connection

      if (connectionState != STABLE) {
        connectionState = CONNECTED;
        Serial.println("🔄 Connection established - monitoring for stability");
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
        Serial.println("📡 Top Tank ESP32 registered with server");
      }
      break;

    case WStype_TEXT:
      {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, payload, length);

        if (!error) {
          String messageType = doc["type"];

          if (messageType == "get_status") {
            sendSensorData();
            Serial.println("📋 Status sent on request");
          } else if (messageType == "acknowledge_alert") {
            Serial.println("✅ Alert acknowledged by server");
          } else if (messageType == "auto_mode_control") {
            autoModeEnabled = doc["enabled"];
            Serial.print("🤖 Auto mode ");
            Serial.println(autoModeEnabled ? "ENABLED" : "DISABLED");
          } else if (messageType == "pong") {
            Serial.println("🏓 Pong received - connection is alive");
            lastHeartbeatResponse = millis();
            heartbeatMissedCount = 0;
            backendResponsive = true;

            // Upgrade to stable connection after successful pong
            if (connectionState == CONNECTED && (millis() - connectionEstablishedTime) > 60000) {
              connectionState = STABLE;
              Serial.println("� Connection stabilized - no unnecessary restarts");
            }

            Serial.println("💚 Heartbeat response confirmed - system healthy");
          }
        }
      }
      break;

    case WStype_ERROR:
      Serial.println("❌ WebSocket Error!");
      websocketConnected = false;
      backendResponsive = false;
      websocketErrorCount++;

      if (connectionState == STABLE) {
        connectionState = RECONNECTING;
      }

      Serial.print("� WebSocket error count: ");
      Serial.println(websocketErrorCount);
      break;
  }
}

// Connect to WiFi with comprehensive error handling and retry logic
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("ℹ️ WiFi already connected");
    return;
  }

  Serial.print("🔄 Connecting to WiFi: ");
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
      Serial.println("\n🔄 Resetting WiFi connection...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected successfully!");
    Serial.print("📡 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    wifiConnected = true;
    wifiReconnectAttempts = 0; // Reset counter on success
  } else {
    Serial.println("\n❌ WiFi connection failed after maximum attempts!");
    Serial.print("🔍 Last WiFi status: ");
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
    wifiReconnectAttempts++;
  }
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Aqua Guard Sense ESP32 Top Tank Monitor v2.0 (IMPROVED) ===");
  Serial.println("Top Tank Sensor: AJ-SR04M Ultrasonic Sensor (TRIG/ECHO)");
  Serial.println("Communication: WiFi + WebSocket to Backend + HTTP to Sump ESP32");
  Serial.print("Top Tank: ");
  Serial.print(TANK_LENGTH_CM);
  Serial.print("cm x ");
  Serial.print(TANK_BREADTH_CM);
  Serial.print("cm x ");
  Serial.print(TANK_HEIGHT_CM);
  Serial.println("cm (RECTANGULAR)");

  Serial.println("\n⚠️  IMPORTANT WIRING:");
  Serial.println("   TOP TANK AJ-SR04M:");
  Serial.println("   • TRIG → ESP32 GPIO 5");
  Serial.println("   • ECHO → ESP32 GPIO 18");
  Serial.println("   • GND → ESP32 GND");
  Serial.println("   • VCC → ESP32 5V");
  Serial.println("   ALERTS:");
  Serial.println("   • BUZZER → ESP32 GPIO 14");
  Serial.println("   • LED → ESP32 GPIO 15");
  Serial.println("   TANK SPECS:");
  Serial.println("   • Dimensions: 230cm x 230cm x 250cm (RECTANGULAR)");
  Serial.println("   • Capacity: 13,225 liters");
  Serial.println("   • Sensor: AJ-SR04M Ultrasonic (20cm minimum detection)");

  Serial.println("\n⚠️  CRITICAL NOTES:");
  Serial.println("   • Sensor CANNOT detect below 20cm - readings will be wrong!");
  Serial.println("   • Motor commands sent to Sump ESP32 via HTTP");
  Serial.println("   • Update SUMP_ESP32_IP with actual Sump ESP32 IP address");
  Serial.println("   • IMPROVED: No auto-restart on connection issues");
  Serial.println("   • IMPROVED: Stable connection management");
  Serial.println("   • IMPROVED: Crash-only restart policy");

  // Initialize pins
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("✅ Pins initialized");

  // Initialize Watchdog Timer
  Serial.print("🔒 Initializing Watchdog Timer (");
  Serial.print(WDT_TIMEOUT);
  Serial.println("s timeout)...");
  esp_task_wdt_init(WDT_TIMEOUT, true); // Enable panic reset
  esp_task_wdt_add(NULL); // Add current task to watchdog
  lastWatchdogFeed = millis();
  Serial.println("✅ Watchdog Timer initialized");

  // Prevent ESP32 from going to sleep
  Serial.println("☕ Preventing ESP32 sleep mode...");
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  WiFi.setSleep(false);  // Disable WiFi sleep to maintain connection
  Serial.println("✅ Sleep prevention enabled");

  // Test sensors
  testAJ_SR04MCommunication();

  // Ensure outputs are off at startup
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  Serial.println("✅ Outputs set to OFF state");

  // Connect to WiFi
  connectToWiFi();

  // Initialize WebSocket
  if (wifiConnected) {
    Serial.println("🔄 Initializing WebSocket connection...");
    webSocket.beginSSL(SUPABASE_URL, 443, WEBSOCKET_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY);
    webSocket.setInsecure();
    connectionState = CONNECTING;
  }

  Serial.println("========== Setup Complete ==========");
  Serial.println("\n🚀 NEXT STEPS:");
  Serial.println("1. Check serial output for sensor test results");
  Serial.println("2. Monitor top tank levels every 3 seconds");
  Serial.println("3. Verify motor commands are sent to Sump ESP32 (192.168.0.184)");
  Serial.println("4. Tank: 230cm x 230cm x 250cm = 13,225L capacity");
  Serial.println("5. IMPORTANT: Sensor cannot detect below 20cm - expect wrong data!");
  Serial.println("6. ENHANCED: System will maintain connection without unnecessary restarts");
  Serial.println("7. Device ID: ESP32_TOP_002 - Top Tank Monitor (MAC: 6C:C8:40:4D:B8:3C)");
}

// ========== MAIN LOOP ==========
void loop() {
  // Feed watchdog timer periodically
  if (millis() - lastWatchdogFeed > WATCHDOG_FEED_INTERVAL) {
    esp_task_wdt_reset();
    lastWatchdogFeed = millis();
    Serial.println("🐕 Watchdog fed");
  }

  webSocket.loop();

  // Read sensors periodically
  if (millis() - lastSensorRead > 3000) {
    float newLevel = readUltrasonicLevel();
    if (newLevel >= 0) {
      currentLevel = newLevel;
      waterVolume = calculateVolume(currentLevel);
      checkAlerts(currentLevel);

      // Debug output
      Serial.print("📏 Top Tank Level: ");
      Serial.print(currentLevel, 1);
      Serial.print("% | Volume: ");
      Serial.print(waterVolume, 1);
      Serial.print("L | Distance: ");
      float distance = TANK_HEIGHT_CM - ((currentLevel / 100.0) * TANK_HEIGHT_CM);
      Serial.print(distance, 1);
      Serial.println(" cm");

      if (currentLevel > 80) {
        Serial.println("⚠️ CRITICAL: High water level - sensor cannot detect < 20cm!");
      }
    } else {
      Serial.println("❌ AJ-SR04M sensor error - invalid reading");
    }

    // Auto motor control (sends commands to Sump ESP32)
    autoMotorControl();

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
      sendSensorData();
      lastHeartbeat = millis();
      Serial.println("💓 Heartbeat sent");
    }

    // IMPROVED: Only log warnings, no auto-restart
    if (millis() - lastHeartbeatResponse > HEARTBEAT_TIMEOUT) {
      heartbeatMissedCount++;
      backendResponsive = false;

      Serial.print("⚠️ Heartbeat response timeout! Missed count: ");
      Serial.print(heartbeatMissedCount);
      Serial.print(" (Connection State: ");
      Serial.print(getConnectionStateString());
      Serial.println(")");

      if (heartbeatMissedCount >= 5) {  // After 5 missed heartbeats (10 minutes)
        Serial.println("🚨 WARNING: Backend not responsive for 10+ minutes!");
        Serial.println("🔄 Attempting reconnection but NOT restarting ESP32");
        Serial.println("💡 System will continue operating and attempt reconnection");

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

  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("� WiFi disconnected!");
      wifiConnected = false;
      websocketConnected = false;
      connectionState = DISCONNECTED;
    }
    connectToWiFi();
  }

  // Connection status monitoring
  static unsigned long lastStatusLog = 0;
  if (millis() - lastStatusLog > 60000) {  // Log status every minute
    Serial.print("📊 Status: WiFi=");
    Serial.print(wifiConnected ? "✅" : "❌");
    Serial.print(" | WS=");
    Serial.print(websocketConnected ? "✅" : "❌");
    Serial.print(" | State=");
    Serial.print(getConnectionStateString());
    Serial.print(" | Backend=");
    Serial.print(backendResponsive ? "✅" : "❌");
    Serial.print(" | Level=");
    Serial.print(currentLevel, 1);
    Serial.println("%");
    lastStatusLog = millis();
  }  // Reconnect WebSocket if disconnected
  if (!websocketConnected && WiFi.status() == WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 5000) {
      Serial.println("🔄 Attempting WebSocket reconnection...");
      webSocket.beginSSL(SUPABASE_URL, 443, WEBSOCKET_PATH);
      webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY);
      webSocket.setInsecure();
      lastReconnectAttempt = millis();
    }
  }

  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi disconnected!");
      wifiConnected = false;
      websocketConnected = false;
    }
    connectToWiFi();
  }

  delay(100);
}
