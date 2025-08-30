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
 * - SR04M-2 Ultrasonic sensor for water level measurement (UART)
 * - Float switch for dual-sensor verification
 * - Motor control with safety features
 * - Manual override button
 * - Real-time data transmission
 * - Automatic motor control based on tank levels
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - SR04M-2 Ultrasonic Sensor (UART communication)
 * - Wiring: ESP32 TX (GPIO 17) → SR04M-2 RX
 *          ESP32 RX (GPIO 16) → SR04M-2 TX
 *          ESP32 GND → SR04M-2 GND
 *          ESP32 5V → SR04M-2 VCC
 * - Float Switch (GPIO 4)
 * - Manual Button (GPIO 12)
 * - Relay Module for motor (GPIO 13)
 * - Buzzer (GPIO 14) - Optional
 * - LED (GPIO 15) - Optional
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
const int RX_PIN = 16;        // SR04M-2 RX pin (connect to ESP32 TX)
const int TX_PIN = 17;        // SR04M-2 TX pin (connect to ESP32 RX)
const int FLOAT_SWITCH_PIN = 4;
const int MANUAL_BUTTON_PIN = 12;
const int MOTOR_RELAY_PIN = 13;
const int BUZZER_PIN = 14;
const int LED_PIN = 15;

// SR04M-2 Serial Communication
HardwareSerial ultrasonicSerial(1); // Use UART1 for SR04M-2

// Tank Configuration
const float TANK_HEIGHT_CM = 100.0;  // Height of sump tank in cm
const float TANK_DIAMETER_CM = 80.0; // Diameter of sump tank in cm
const float MIN_LEVEL_PERCENT = 20.0; // Minimum water level percentage
const float MAX_LEVEL_PERCENT = 85.0; // Maximum water level percentage

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
bool floatSwitchState = false;
float combinedLevel = 0.0;

// Test SR04M-2 UART communication
void testSR04M2Communication() {
  Serial.println("\n🔧 Testing SR04M-2 UART Communication...");
  
  // Check if UART is initialized
  Serial.print("UART initialized: ");
  Serial.println(ultrasonicSerial ? "YES" : "NO");
  
  // Clear any pending data
  int cleared = 0;
  while (ultrasonicSerial.available()) {
    ultrasonicSerial.read();
    cleared++;
  }
  if (cleared > 0) {
    Serial.print("🧹 Cleared ");
    Serial.print(cleared);
    Serial.println(" pending bytes");
  }
  
  // Test different baud rates
  int baudRates[] = {9600, 115200, 57600, 38400, 19200, 4800};
  bool foundWorkingBaud = false;
  
  for (int i = 0; i < 6; i++) {
    Serial.print("\n📤 Testing baud rate: ");
    Serial.println(baudRates[i]);
    
  ultrasonicSerial.begin(baudRates[i], SERIAL_8N1, RX_PIN, TX_PIN);
  Serial.println("Sent measurement command (0x55)");
    
    delay(200); // Wait for response
    
    int availableBytes = ultrasonicSerial.available();
    Serial.print("📥 Available bytes: ");
    Serial.println(availableBytes);
    
    if (availableBytes >= 2) {
      byte data[2];
      ultrasonicSerial.readBytes(data, 2);
      
      Serial.print("📖 Bytes read: 2 | Data: ");
      for (int j = 0; j < 2; j++) {
        Serial.print("0x");
        if (data[j] < 16) Serial.print("0");
        Serial.print(data[j], HEX);
        if (j < 1) Serial.print(" ");
      }
      Serial.println();
      
      // Check if we got a valid response
      if (data[0] != 0x00 && data[1] != 0x00) {
        Serial.print("✅ Got non-zero response at baud rate ");
        Serial.println(baudRates[i]);
        foundWorkingBaud = true;
        
        // Calculate distance (2 bytes: high + low = distance in mm)
        uint16_t distance = (data[0] << 8) | data[1];
        Serial.print("📏 Distance: ");
        Serial.print(distance);
        Serial.println(" mm");
        break;
      }
    } else if (availableBytes > 0) {
      Serial.print("� Partial data: ");
      for (int j = 0; j < availableBytes; j++) {
        byte byteData = ultrasonicSerial.read();
        Serial.print("0x");
        if (byteData < 16) Serial.print("0");
        Serial.print(byteData, HEX);
        Serial.print(" ");
      }
      Serial.println();
    } else {
      Serial.println("❌ No response");
    }
  }
  
  // Reset to default baud rate
  ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  
  if (!foundWorkingBaud) {
    Serial.println("\n❌ No valid response from ultrasonic sensor at any baud rate");
    Serial.println("🔧 Troubleshooting:");
    Serial.println("1. Check wiring: ESP32 TX→SR04M-2 RX, ESP32 RX→SR04M-2 TX");
    Serial.println("2. Verify 5V power supply to sensor");
    Serial.println("3. Confirm sensor model (should be SR04M-2 UART)");
    Serial.println("4. Try swapping RX/TX wires");
    Serial.println("5. Check for loose connections");
  }
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

// Read SR04M-2 ultrasonic sensor via UART
float readUltrasonicLevel() {
  // Clear any pending data first
  while (ultrasonicSerial.available()) {
    ultrasonicSerial.read();
  }

  // Send measurement command to SR04M-2
  ultrasonicSerial.write(0x55); // SR04M-2 measurement command
  Serial.println("📤 Sent ultrasonic command (0x55)");

  // Wait for response with timeout
  unsigned long startTime = millis();
  while (!ultrasonicSerial.available() && (millis() - startTime) < 200) {
    delay(1);
  }

  if (!ultrasonicSerial.available()) {
    Serial.println("❌ No response from SR04M-2 sensor");
    return -1; // No response from sensor
  }

  // Read response (9 bytes for SR04M-2)
  byte buffer[9];
  int bytesRead = ultrasonicSerial.readBytes(buffer, 9);

  Serial.print("📥 Received ");
  Serial.print(bytesRead);
  Serial.print(" bytes: ");
  for (int i = 0; i < bytesRead; i++) {
    Serial.print("0x");
    if (buffer[i] < 16) Serial.print("0");
    Serial.print(buffer[i], HEX);
    Serial.print(" ");
  }
  Serial.println();

  if (bytesRead != 9) {
    Serial.println("❌ Incomplete response from SR04M-2");
    return -1; // Incomplete response
  }

  // Check for all zeros (common issue)
  bool allZeros = true;
  for (int i = 0; i < 9; i++) {
    if (buffer[i] != 0x00) {
      allZeros = false;
      break;
    }
  }
  
  if (allZeros) {
    Serial.println("❌ All zeros received - check sensor wiring and power");
    return -1;
  }

  // Validate response header - SR04M-2 should return 0xFF
  if (buffer[0] != 0xFF) {
    Serial.print("❌ Invalid header: 0x");
    Serial.print(buffer[0], HEX);
    Serial.println(" (expected 0xFF for SR04M-2)");
    Serial.println("💡 Try: 'swap' command to test RX/TX wiring");
    return -1; // Invalid header
  }

  // Calculate distance from SR04M-2 response
  // SR04M-2 sends distance in mm (High byte + Low byte)
  int distance_mm = (buffer[1] << 8) + buffer[2];
  float distance_cm = distance_mm / 10.0;

  Serial.print("📏 Raw distance: ");
  Serial.print(distance_mm);
  Serial.print("mm (");
  Serial.print(distance_cm);
  Serial.println("cm)");

  // SR04M-2 minimum detection distance is 25cm
  if (distance_cm < 25.0) {
    Serial.println("❌ Distance too close for SR04M-2");
    return -1; // Too close for SR04M-2
  }

  // SR04M-2 maximum detection distance is 400cm
  if (distance_cm > 400.0) {
    Serial.println("❌ Distance too far for SR04M-2");
    return -1; // Too far for SR04M-2
  }

  float waterHeight = TANK_HEIGHT_CM - distance_cm;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;

  Serial.print("✅ Valid reading: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return constrain(levelPercent, 0, 100);
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
  Serial.println("Sensor: SR04M-2 Ultrasonic Sensor (UART)");
  Serial.println("⚠️  IMPORTANT: Connect SR04M-2 to UART pins!");
  Serial.println("   ESP32 TX (GPIO 17) → SR04M-2 RX");
  Serial.println("   ESP32 RX (GPIO 16) → SR04M-2 TX");
  Serial.println("🔄 Auto Mode: ENABLED by default");
  Serial.println("   - Press manual button to disable auto mode and enable manual control");
  Serial.println("   - Use UI to toggle auto mode on/off");
  Serial.println("   - Use 'Reset Manual' to re-enable auto mode");

  // Initialize SR04M-2 UART communication
  ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  Serial.println("SR04M-2 UART initialized at 9600 baud");
  
  // Test SR04M-2 communication
  delay(1000); // Wait for sensor to initialize
  testSR04M2Communication();

  // Test all hardware components
  testHardware();

  // Initialize other pins
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
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
      testSR04M2Communication();
    } else if (command == "hardware") {
      testHardware();
    } else if (command == "swap") {
      Serial.println("🔄 Testing with RX/TX swapped...");
      ultrasonicSerial.begin(9600, SERIAL_8N1, TX_PIN, RX_PIN); // Swap RX/TX
      delay(100);
      ultrasonicSerial.write(0x55);
      delay(200);
      int availableBytes = ultrasonicSerial.available();
      Serial.print("📥 Available bytes with swapped wiring: ");
      Serial.println(availableBytes);
      if (availableBytes >= 2) {
        byte data[2];
        ultrasonicSerial.readBytes(data, 2);
        Serial.print("📖 Data: 0x");
        if (data[0] < 16) Serial.print("0");
        Serial.print(data[0], HEX);
        Serial.print(" 0x");
        if (data[1] < 16) Serial.print("0");
        Serial.println(data[1], HEX);
      }
      ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN); // Restore original
      Serial.println("🔄 Restored original wiring");
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
    } else {
      Serial.println("❌ SR04M-2 Ultrasonic sensor error (UART)");
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
