/*
 * Aqua Guard Sense - ESP32 Sump Tank Monitor
 * Enhanced ESP32 code for sump tank with motor control
 *
 * IMPORTANT: This code is configured for ACTIVE LOW relay modules
 * - LOW signal = Relay ON (motor runs)
 * - HIGH signal = Relay OFF (motor stops)
 * If you have ACTIVE HIGH relays, change MOTOR_RELAY_PIN logic
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - AJ-SR04M Ultrasonic sensor for water level measurement (TRIG/ECHO)
 * - Float switch for dual-sensor verification
 * - Motor control with safety features
 * - Manual override button
 * - Real-time data transmission
 * - Automatic motor control based on tank levels
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - AJ-SR04M Ultrasonic Sensor (TRIG/ECHO mode)
 * - Wiring: AJ-SR04M TRIG → ESP32 GPIO 5
 *          AJ-SR04M ECHO → ESP32 GPIO 18
 *          AJ-SR04M GND → ESP32 GND
 *          AJ-SR04M VCC → ESP32 5V
 * - Float Switch (GPIO 4)
 * - Manual Button (GPIO 12) - Toggles auto/manual mode
 * - Motor On Switch (GPIO 19) - Directly starts motor
 * - Relay Module for motor (GPIO 13)
 * - Buzzer (GPIO 14) - Optional
 * - LED (GPIO 15) - Optional
 *
 * IMPORTANT: AJ-SR04M cannot reliably detect distances below 20cm
 * Readings closer than 20cm will be inaccurate/wrong
 */

// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATE THESE VALUES
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Server Configuration - UPDATE SERVER IP
const char* SERVER_IP = "192.168.0.108";
const int WEBSOCKET_PORT = 8083;

// Device Configuration
const char* DEVICE_TYPE = "sump_tank";
const char* DEVICE_ID = "ESP32_SUMP_001";

// Hardware Pin Configuration
const int FLOAT_SWITCH_PIN = 4;
const int MANUAL_BUTTON_PIN = 12;
const int MOTOR_ON_SWITCH_PIN = 19;  // New manual switch to turn motor on
const int MOTOR_RELAY_PIN = 13;
const int BUZZER_PIN = 14;
const int LED_PIN = 15;

// AJ-SR04M Ultrasonic Sensor Pins
#define TRIGPIN 5
#define ECHOPIN 18

// Tank Configuration
const float TANK_HEIGHT_CM = 100.0;  // Height of sump tank in cm
const float TANK_DIAMETER_CM = 80.0; // Diameter of sump tank in cm
const float MIN_LEVEL_PERCENT = 20.0; // Minimum water level percentage
const float MAX_LEVEL_PERCENT = 85.0; // Maximum water level percentage

// AJ-SR04M Sensor Configuration
const float MIN_SENSOR_DISTANCE_CM = 20.0;  // Minimum reliable detection distance (sensor limitation)
const float MAX_SENSOR_DISTANCE_CM = 450.0; // Maximum detection distance

// Motor Control Configuration
const unsigned long MOTOR_MAX_RUNTIME = 1800000; // 30 minutes max
const unsigned long MOTOR_MIN_REST = 300000;     // 5 minutes rest between cycles
const unsigned long MOTOR_CHECK_INTERVAL = 5000;  // Check every 5 seconds

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ========== GLOBAL VARIABLES ==========
WebSocketsClient webSocket;
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
unsigned long motorStartTime = 0;
unsigned long lastMotorStop = 0;
bool motorRunning = false;
bool manualOverride = false;
bool wifiConnected = false;
bool websocketConnected = false;
bool autoModeEnabled = true; // Start with auto mode enabled by default

// Sensor readings
float ultrasonicLevel = 0.0;
bool floatSwitchState = false;x
float combinedLevel = 0.0;
float duration = 0.0;
float distance = 0.0;

// Test AJ-SR04M ultrasonic sensor
void testAJ_SR04MCommunication() {
  Serial.println("🔧 Testing AJ-SR04M Ultrasonic Sensor...");

  // Test multiple readings
  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGPIN, LOW);

    duration = pulseIn(ECHOPIN, HIGH, 30000); // 30ms timeout
    distance = (duration * 0.0343) / 2;

    Serial.print("📏 Test ");
    Serial.print(i + 1);
    Serial.print(": Distance = ");
    Serial.print(distance);
    Serial.println(" cm");

    delay(500); // Wait 500ms between tests
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

void testHardware() {
  Serial.println("\n🔧 HARDWARE DIAGNOSTICS");
  Serial.println("========================");

  // Test Float Switch
  Serial.print("🏊 Float Switch (GPIO ");
  Serial.print(FLOAT_SWITCH_PIN);
  Serial.print("): ");
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  bool floatState = digitalRead(FLOAT_SWITCH_PIN);
  Serial.println(floatState ? "HIGH (Water detected)" : "LOW (No water)");

  // Test Manual Button
  Serial.print("🔘 Manual Button (GPIO ");
  Serial.print(MANUAL_BUTTON_PIN);
  Serial.print("): ");
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  bool buttonState = digitalRead(MANUAL_BUTTON_PIN);
  Serial.println(buttonState ? "HIGH (Not pressed)" : "LOW (Pressed)");

  // Test Motor On Switch
  Serial.print("🔘 Motor On Switch (GPIO ");
  Serial.print(MOTOR_ON_SWITCH_PIN);
  Serial.print("): ");
  pinMode(MOTOR_ON_SWITCH_PIN, INPUT_PULLUP);
  bool motorOnSwitchState = digitalRead(MOTOR_ON_SWITCH_PIN);
  Serial.println(motorOnSwitchState ? "HIGH (Not pressed)" : "LOW (Pressed)");

  // Test Motor Relay - COMMENT OUT THIS SECTION IF YOU DON'T WANT RELAY TESTING
  /*
  Serial.print("⚙️ Motor Relay (GPIO ");
  Serial.print(MOTOR_RELAY_PIN);
  Serial.println("): Testing...");
  Serial.println("   ⚠️  WARNING: Relay test will actually turn motor on/off!");

  // Ensure relay is OFF before testing
  digitalWrite(MOTOR_RELAY_PIN, HIGH);  // HIGH = OFF for active LOW relay
  delay(100);

  digitalWrite(MOTOR_RELAY_PIN, LOW);   // LOW = ON for active LOW relay
  delay(500);
  digitalWrite(MOTOR_RELAY_PIN, HIGH);  // HIGH = OFF for active LOW relay
  Serial.println("   ✓ Relay toggled (check if motor responded - Active LOW: LOW=ON, HIGH=OFF)");
  */

  // Test LED
  Serial.print("💡 LED (GPIO ");
  Serial.print(LED_PIN);
  Serial.println("): Testing...");
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("   ✓ LED blinked");

  // Test Buzzer
  Serial.print("🔊 Buzzer (GPIO ");
  Serial.print(BUZZER_PIN);
  Serial.println("): Testing...");
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("   ✓ Buzzer beeped");

  Serial.println("========================\n");
}

// Calculate water volume based on level percentage
float calculateVolume(float levelPercent) {
  float radius = TANK_DIAMETER_CM / 2.0;
  float height = (levelPercent / 100.0) * TANK_HEIGHT_CM;
  float volume = PI * radius * radius * height / 1000.0; // Convert to liters
  return volume;
}

// Read AJ-SR04M ultrasonic sensor via TRIG/ECHO pins
float readUltrasonicLevel() {
  digitalWrite(TRIGPIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGPIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGPIN, LOW);

  duration = pulseIn(ECHOPIN, HIGH, 30000); // 30ms timeout
  distance = (duration * 0.0343) / 2;

  Serial.print("Raw distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  // Validate sensor reading
  if (distance < MIN_SENSOR_DISTANCE_CM || distance > MAX_SENSOR_DISTANCE_CM || distance == 0) {
    Serial.println("⚠️ Invalid sensor reading - distance out of range or < 20cm");
    return -1; // Invalid reading
  }

  // Calculate water level percentage
  float waterHeight = TANK_HEIGHT_CM - distance;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;

  // Ensure level is within valid range
  levelPercent = constrain(levelPercent, 0, 100);

  Serial.print("Calculated level: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return levelPercent;
}

// Read float switch
bool readFloatSwitch() {
  bool state = digitalRead(FLOAT_SWITCH_PIN) == HIGH;
  static bool lastState = !state; // Initialize to opposite

  if (state != lastState) {
    Serial.print("🏊 Float switch changed: ");
    Serial.println(state ? "WATER DETECTED (HIGH)" : "NO WATER (LOW)");
    lastState = state;
  }

  return state;
}

// Get combined sensor reading
float getCombinedLevel() {
  ultrasonicLevel = readUltrasonicLevel();
  floatSwitchState = readFloatSwitch();

  // Use ultrasonic as primary, float switch as backup
  if (ultrasonicLevel >= 0) {
    // If ultrasonic is working, use it primarily
    // But verify with float switch if available
    if (floatSwitchState && ultrasonicLevel < 10) {
      return 5.0; // Minimum level when float switch detects water
    } else if (!floatSwitchState && ultrasonicLevel > 90) {
      return 95.0; // Maximum level when float switch doesn't detect water
    }
    return ultrasonicLevel;
  } else {
    // Ultrasonic failed, use float switch
    return floatSwitchState ? 50.0 : 10.0;
  }
}

// Control motor
void controlMotor(bool state) {
  if (state && !motorRunning) {
    // Start motor
    if (millis() - lastMotorStop > MOTOR_MIN_REST) {
      digitalWrite(MOTOR_RELAY_PIN, LOW);   // LOW = Relay ON for active LOW module
      motorRunning = true;
      motorStartTime = millis();
      digitalWrite(LED_PIN, HIGH);
      Serial.println("🔄 Motor STARTED");
    }
  } else if (!state && motorRunning) {
    // Stop motor
    digitalWrite(MOTOR_RELAY_PIN, HIGH);  // HIGH = Relay OFF for active LOW module
    motorRunning = false;
    lastMotorStop = millis();
    digitalWrite(LED_PIN, LOW);
    Serial.println("⏹️ Motor STOPPED");
  }
}

// Check manual button
void checkManualButton() {
  static bool lastButtonState = HIGH;
  static unsigned long lastDebounceTime = 0;
  const unsigned long debounceDelay = 200; // 200ms debounce

  bool buttonState = digitalRead(MANUAL_BUTTON_PIN);

  // Only process if enough time has passed since last change
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (buttonState == LOW && lastButtonState == HIGH) {
      // Button pressed (LOW to HIGH transition)
      if (!manualOverride) {
        Serial.println("🔘 Manual button pressed - disabling auto mode and enabling manual override");
        autoModeEnabled = false;
        manualOverride = true;
        // SAFETY CHECK: Don't start motor manually if no water in sump
        if (!floatSwitchState) {
          Serial.println("🚫 SAFETY: Cannot start motor manually - No water in sump tank!");
          manualOverride = false; // Reset manual override
          return;
        }
        Serial.println("🔘 MANUAL MODE: ACTIVATED (Auto mode disabled)");
        controlMotor(true);
      } else {
        Serial.println("🔘 Manual button pressed - re-enabling auto mode and disabling manual override");
        manualOverride = false;
        autoModeEnabled = true;
        controlMotor(false); // Stop motor if running manually
        Serial.println("🔄 Auto mode re-enabled, manual override OFF");
      }
      lastDebounceTime = millis();
    }
  }
  lastButtonState = buttonState;
}

// Check motor on switch
void checkMotorOnSwitch() {
  static bool lastSwitchState = HIGH;
  static unsigned long lastDebounceTime = 0;
  const unsigned long debounceDelay = 200; // 200ms debounce

  bool switchState = digitalRead(MOTOR_ON_SWITCH_PIN);

  // Only process if enough time has passed since last change
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (switchState == LOW && lastSwitchState == HIGH) {
      // Switch pressed (LOW to HIGH transition)
      Serial.println("🔘 Motor On Switch pressed - attempting to start motor");

      // SAFETY CHECK: Don't start motor if no water in sump
      if (!floatSwitchState) {
        Serial.println("🚫 SAFETY: Cannot start motor - No water detected in sump tank!");
        return;
      }

      // Start motor regardless of auto/manual mode
      Serial.println("🔄 Starting motor via manual switch");
      controlMotor(true);
      lastDebounceTime = millis();
    }
  }
  lastSwitchState = switchState;
}

// Automatic motor control logic
void autoMotorControl(float level) {
  if (!autoModeEnabled || manualOverride) return; // Skip auto control if disabled or in manual mode

  // SAFETY CHECK: Never start motor if no water in sump (float switch OFF)
  if (level <= MIN_LEVEL_PERCENT && !motorRunning) {
    if (!floatSwitchState) {
      Serial.println("🚫 SAFETY: No water in sump tank - Motor NOT started (would run dry!)");
      return; // Don't start motor - no water in sump
    }
    // Start motor - water level too low AND sump has water
    Serial.println("🚨 LOW WATER LEVEL - Starting motor");
    controlMotor(true);
  } else if (level >= MAX_LEVEL_PERCENT && motorRunning) {
    // Stop motor - water level high enough
    Serial.println("✅ HIGH WATER LEVEL - Stopping motor");
    controlMotor(false);
  }

  // Safety timeout - stop motor but don't set manual override
  if (motorRunning && millis() - motorStartTime > MOTOR_MAX_RUNTIME) {
    Serial.println("⚠️ MOTOR SAFETY TIMEOUT - Stopping motor to prevent damage");
    controlMotor(false);
    // Don't set manual override - allow auto mode to continue working
    Serial.println("🔄 Auto mode remains active after safety timeout");
  }
}

// Send sensor data to server
void sendSensorData() {
  StaticJsonDocument<512> doc;

  doc["type"] = "sensor_data";

  // Wrap data in payload as expected by server
  JsonObject payload = doc.createNestedObject("payload");
  payload["esp32_id"] = DEVICE_ID;
  payload["tank_type"] = DEVICE_TYPE;
  payload["level_percentage"] = combinedLevel;
  payload["level_liters"] = calculateVolume(combinedLevel);
  payload["sensor_health"] = (ultrasonicLevel >= 0) ? "good" : "error";
  payload["battery_voltage"] = 0; // ESP32 doesn't have battery
  payload["signal_strength"] = WiFi.RSSI();
  payload["float_switch"] = floatSwitchState;
  payload["motor_running"] = motorRunning;
  payload["manual_override"] = manualOverride;
  payload["auto_mode_enabled"] = autoModeEnabled;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("📊 Sensor data sent - Level: " + String(combinedLevel, 1) + "%");
}

// WebSocket event handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      websocketConnected = false;
      Serial.println("🔄 WebSocket disconnected - auto mode may reset on reconnect");
      break;

    case WStype_CONNECTED:
      Serial.println("✅ WebSocket connected");
      websocketConnected = true;

      // Send device registration
      {
        StaticJsonDocument<256> doc;
        doc["type"] = "esp32_register";
        doc["esp32_id"] = DEVICE_ID;
        doc["device_type"] = DEVICE_TYPE;
        doc["capabilities"] = "ultrasonic,float_switch,motor_control,manual_override";

        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("📡 Device registered with server");
      }
      break;

    case WStype_TEXT:
      {
        Serial.print("📨 Raw WebSocket message: ");
        for (size_t i = 0; i < length; i++) {
          Serial.print((char)payload[i]);
        }
        Serial.println();

        StaticJsonDocument<512> doc; // Increased size to handle timestamp
        DeserializationError error = deserializeJson(doc, payload, length);

        if (!error) {
          String messageType = doc["type"];
          Serial.println("📨 Parsed message type: '" + messageType + "'");

          // Debug: Log all received message types
          Serial.print("🔍 DEBUG: Received message type: ");
          Serial.println(messageType);
          
          // Special debug for auto_mode_control
          if (messageType == "auto_mode_control") {
            Serial.println("🎯 SPECIAL DEBUG: auto_mode_control message detected!");
            bool enabled = doc["enabled"];
            Serial.print("🎯 enabled value: ");
            Serial.println(enabled ? "true" : "false");
          }

          if (messageType == "motor_control") {
            bool motorState = doc["state"];
            Serial.println("🎮 Motor control received - State: " + String(motorState ? "START" : "STOP"));

            // Check if manual override is active
            if (manualOverride) {
              Serial.println("🚫 Cannot control motor remotely - Manual override is active!");
              // Send error response back to server
              StaticJsonDocument<128> errorDoc;
              errorDoc["type"] = "motor_control_error";
              errorDoc["error"] = "manual_override_active";
              errorDoc["message"] = "Cannot control motor - manual override is active";
              String errorJson;
              serializeJson(errorDoc, errorJson);
              webSocket.sendTXT(errorJson);
              return;
            }

            if (motorState != motorRunning) {
              // SAFETY CHECK: Don't start motor remotely if no water in sump
              if (motorState && !floatSwitchState) {
                Serial.println("🚫 SAFETY: Cannot start motor remotely - No water in sump tank!");
                // Send error response back to server
                StaticJsonDocument<128> errorDoc;
                errorDoc["type"] = "motor_control_error";
                errorDoc["error"] = "no_water_in_sump";
                errorDoc["message"] = "Cannot start motor - no water detected in sump tank";
                String errorJson;
                serializeJson(errorDoc, errorJson);
                webSocket.sendTXT(errorJson);
                return;
              }
              Serial.println("🖥️ Remote motor control: " + String(motorState ? "START" : "STOP"));
              controlMotor(motorState);
            } else {
              Serial.println("⚠️ Motor already in requested state");
            }
          } else if (messageType == "auto_mode_control") {
            bool enabled = doc["enabled"];
            Serial.println("🔄 Auto mode control received - Enabled: " + String(enabled ? "TRUE" : "FALSE"));
            Serial.print("🔄 Previous autoModeEnabled: ");
            Serial.println(autoModeEnabled ? "TRUE" : "FALSE");
            autoModeEnabled = enabled;
            if (!enabled) {
              manualOverride = false; // When disabling auto mode from UI, also disable manual override
              Serial.println("🔄 Auto mode DISABLED from UI - manual override OFF");
            } else {
              Serial.println("🔄 Auto mode ENABLED from UI");
            }
            Serial.println("🔄 Auto mode " + String(autoModeEnabled ? "ENABLED" : "DISABLED"));

            // Send confirmation back to server
            StaticJsonDocument<128> confirmDoc;
            confirmDoc["type"] = "auto_mode_status";
            confirmDoc["enabled"] = autoModeEnabled;
            String confirmJson;
            serializeJson(confirmDoc, confirmJson);
            webSocket.sendTXT(confirmJson);
            Serial.println("📤 Sent auto_mode_status confirmation");
          } else if (messageType == "reset_manual") {
            manualOverride = false;
            autoModeEnabled = true; // Re-enable auto mode when manual override is reset
            Serial.println("🔄 Manual override reset by server - Auto mode re-enabled");

            // Send confirmation back to server
            StaticJsonDocument<128> confirmDoc;
            confirmDoc["type"] = "manual_override_status";
            confirmDoc["active"] = manualOverride;
            String confirmJson;
            serializeJson(confirmDoc, confirmJson);
            webSocket.sendTXT(confirmJson);
          } else {
            Serial.println("❓ Unknown message type: " + messageType);
          }
        } else {
          Serial.println("❌ JSON parsing error: " + String(error.c_str()));
        }
      }
      break;

    case WStype_ERROR:
      Serial.println("WebSocket error");
      break;
  }
}

// Connect to WiFi
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    wifiConnected = true;
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    wifiConnected = false;
  }
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Aqua Guard Sense ESP32 Sump Tank Starting ===");
  Serial.println("Sensor: AJ-SR04M Ultrasonic Sensor (TRIG/ECHO)");
  Serial.println("⚠️  IMPORTANT: Connect AJ-SR04M to digital pins!");
  Serial.println("   AJ-SR04M TRIG → ESP32 GPIO 5");
  Serial.println("   AJ-SR04M ECHO → ESP32 GPIO 18");
  Serial.println("⚠️  CRITICAL: Sensor CANNOT detect below 20cm - readings will be wrong!");
  Serial.println("   This is a hardware limitation of the AJ-SR04M sensor");
  Serial.println("🔄 Auto Mode: ENABLED by default");
  Serial.println("   - Press manual button (GPIO 12) to disable auto mode and enable manual control");
  Serial.println("   - Press motor on switch (GPIO 19) to start motor manually");
  Serial.println("   - Use UI to toggle auto mode on/off");
  Serial.println("   - Use 'Reset Manual' to re-enable auto mode");

  // Initialize AJ-SR04M pins
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);
  Serial.println("AJ-SR04M initialized (TRIG/ECHO mode)");

  // Test all hardware components
  testHardware();

  // Initialize other pins
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(MOTOR_ON_SWITCH_PIN, INPUT_PULLUP);  // Initialize motor on switch
  pinMode(MOTOR_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // CRITICAL: Ensure motor is OFF at startup (Active LOW relay: HIGH = OFF)
  digitalWrite(MOTOR_RELAY_PIN, HIGH);  // HIGH = Relay OFF for active LOW module
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Double-check relay is off after a short delay
  delay(100);
  digitalWrite(MOTOR_RELAY_PIN, HIGH);  // Keep relay OFF
  delay(100);
  digitalWrite(MOTOR_RELAY_PIN, HIGH);  // Triple-check relay is OFF

  Serial.println("🔌 Motor relay initialized to OFF state (Active LOW: HIGH = OFF)");
  motorRunning = false; // Ensure global state matches

  // Connect to WiFi
  connectToWiFi();

  // Connect to WebSocket
  if (wifiConnected) {
    String wsUrl = String("ws://") + SERVER_IP + ":" + WEBSOCKET_PORT;
    Serial.println("Connecting to WebSocket: " + wsUrl);
    webSocket.begin(SERVER_IP, WEBSOCKET_PORT, "/");
    webSocket.onEvent(webSocketEvent);
  }

  Serial.println("========== After Setup End ==========");
}

// ========== MAIN LOOP ==========
void loop() {
  // Handle WebSocket
  webSocket.loop();

  // Check for serial commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "test") {
      testAJ_SR04MCommunication();
    } else if (command == "hardware") {
      testHardware();
    } else if (command == "status") {
      Serial.println("\n📊 SYSTEM STATUS");
      Serial.println("===============");
      Serial.print("WiFi: ");
      Serial.println(wifiConnected ? "Connected" : "Disconnected");
      Serial.print("WebSocket: ");
      Serial.println(websocketConnected ? "Connected" : "Disconnected");
      Serial.print("Float Switch: ");
      Serial.println(floatSwitchState ? "ON (Water)" : "OFF (No Water)");
      Serial.print("Motor: ");
      Serial.println(motorRunning ? "RUNNING" : "STOPPED");
      Serial.print("Manual Override: ");
      Serial.println(manualOverride ? "ON" : "OFF");
      Serial.print("Combined Level: ");
      Serial.print(combinedLevel, 1);
      Serial.println("%");
      Serial.println("===============\n");
    }
  }

  // Check manual button
  checkManualButton();

  // Check motor on switch
  checkMotorOnSwitch();

  // Read sensors periodically
  if (millis() - lastSensorRead > 2000) { // Every 2 seconds
    combinedLevel = getCombinedLevel();
    lastSensorRead = millis();

    // Debug output
    if (ultrasonicLevel >= 0) {
      Serial.print("📏 Level: ");
      Serial.print(combinedLevel, 1);
      Serial.print("% | Ultrasonic: ");
      Serial.print(ultrasonicLevel, 1);
      Serial.print("% | Float: ");
      Serial.println(floatSwitchState ? "ON" : "OFF");

      // Warning for high water levels (sensor cannot detect < 20cm)
      if (ultrasonicLevel > 80) {
        Serial.println("⚠️ CRITICAL: High water level - sensor cannot detect < 20cm!");
        Serial.println("   Readings will be WRONG when water is very close to sensor");
      }
    } else {
      Serial.println("❌ AJ-SR04M Ultrasonic sensor error (TRIG/ECHO)");
    }
  }

  // Motor control logic
  if (millis() - lastSensorRead > MOTOR_CHECK_INTERVAL) {
    // Debug auto mode status periodically
    static unsigned long lastDebugTime = 0;
    if (millis() - lastDebugTime > 30000) { // Every 30 seconds
      Serial.print("🔄 Auto Mode: ");
      Serial.print(autoModeEnabled ? "ENABLED" : "DISABLED");
      Serial.print(" | Manual Override: ");
      Serial.print(manualOverride ? "ACTIVE" : "INACTIVE");
      Serial.print(" | Motor: ");
      Serial.println(motorRunning ? "RUNNING" : "STOPPED");
      lastDebugTime = millis();
    }

    autoMotorControl(combinedLevel);
  }

  // Send heartbeat and data
  if (websocketConnected && millis() - lastHeartbeat > 10000) { // Every 10 seconds
    sendSensorData();
    lastHeartbeat = millis();
    Serial.println("💓 Heartbeat sent");
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
