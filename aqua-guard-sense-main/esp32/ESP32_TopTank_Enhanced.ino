/*
 * Aqua Guard Sense - ESP32 Top Tank Monitor
 * Enhanced ESP32 code for top tank monitoring only
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - SR04M-2 Ultrasonic sensor for water level measurement (UART)
 * - Real-time data transmission
 * - Simple monitoring without motor control
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - SR04M-2 Ultrasonic Sensor (UART communication)
 * - Wiring: ESP32 TX (GPIO 17) → SR04M-2 RX
 *          ESP32 RX (GPIO 16) → SR04M-2 TX
 *          ESP32 GND → SR04M-2 GND
 *          ESP32 5V → SR04M-2 VCC
 * - Optional: Buzzer (GPIO 14)
 * - Optional: LED (GPIO 15)
 */



// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATE THESE VALUES
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Server Configuration - UPDATE SERVER IP
const char* SERVER_IP = "192.168.0.108";
const int WEBSOCKET_PORT = 8083;

// Device Configuration
const char* DEVICE_TYPE = "top_tank";
const char* DEVICE_ID = "ESP32_TOP_001";

// Hardware Pin Configuration
const int RX_PIN = 16;        // ESP32 RX pin (connect to SR04M-2 TX)
const int TX_PIN = 17;        // ESP32 TX pin (connect to SR04M-2 RX)
const int BUZZER_PIN = 14;    // Optional
const int LED_PIN = 15;       // Optional

// SR04M-2 Serial Communication
HardwareSerial ultrasonicSerial(1); // Use UART1 for SR04M-2

// Tank Configuration
const float TANK_HEIGHT_CM = 150.0;  // Height of top tank in cm
const float TANK_DIAMETER_CM = 100.0; // Diameter of top tank in cm
const float LOW_LEVEL_THRESHOLD = 25.0;  // Alert when below this percentage
const float CRITICAL_LEVEL_THRESHOLD = 10.0; // Critical alert threshold

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

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

// Alert states
bool lowLevelAlert = false;
bool criticalLevelAlert = false;

// Test different baud rates for SR04M-2 sensor
void testDifferentBaudRates() {
  Serial.println("\n🔧 Testing different baud rates...");
  
  int baudRates[] = {4800, 9600, 19200, 38400, 57600, 115200};
  int numRates = sizeof(baudRates) / sizeof(baudRates[0]);
  
  for (int i = 0; i < numRates; i++) {
    Serial.print("Testing baud rate: ");
    Serial.println(baudRates[i]);
    
    // Reinitialize UART with new baud rate
    ultrasonicSerial.end();
    delay(100);
    ultrasonicSerial.begin(baudRates[i], SERIAL_8N1, RX_PIN, TX_PIN);
    delay(100);
    
    // Clear any pending data
    while (ultrasonicSerial.available()) {
      ultrasonicSerial.read();
    }
    
    // Test communication
    ultrasonicSerial.write(0x55);
    delay(100);
    
    int availableBytes = ultrasonicSerial.available();
    Serial.print("📥 Available bytes: ");
    Serial.println(availableBytes);
    
    if (availableBytes >= 2) {
      byte data[2];
      ultrasonicSerial.readBytes(data, 2);
      
      Serial.print("📖 Data: ");
      for (int j = 0; j < 2; j++) {
        Serial.print("0x");
        if (data[j] < 16) Serial.print("0");
        Serial.print(data[j], HEX);
        if (j < 1) Serial.print(" ");
      }
      Serial.println();
      
      uint16_t distance = (data[0] << 8) | data[1];
      Serial.print("✅ SUCCESS! Working baud rate: ");
      Serial.print(baudRates[i]);
      Serial.print(" | Distance: ");
      Serial.print(distance);
      Serial.println(" mm");
      
      // Revert to default baud rate
      ultrasonicSerial.end();
      ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
      return;
    } else if (availableBytes > 0) {
      Serial.print("📖 Partial data: ");
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
    
    delay(200);
  }
  
  Serial.println("❌ No working baud rate found");
  // Revert to default baud rate
  ultrasonicSerial.end();
  ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
}

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
  
  // Test 1: Standard SR04M-2 protocol (0x55 command)
  Serial.println("\n� Test 1: Standard protocol (0x55)");
  ultrasonicSerial.write(0x55);
  Serial.println("Sent measurement command (0x55)");
  
  delay(100); // Wait for response
  
  int availableBytes = ultrasonicSerial.available();
  Serial.print("📥 Available bytes: ");
  Serial.println(availableBytes);
  
  if (availableBytes >= 2) {
    byte data[2];
    ultrasonicSerial.readBytes(data, 2);
    
    Serial.print("📖 Bytes read: 2 | Data: ");
    for (int i = 0; i < 2; i++) {
      Serial.print("0x");
      if (data[i] < 16) Serial.print("0");
      Serial.print(data[i], HEX);
      if (i < 1) Serial.print(" ");
    }
    Serial.println();
    
    // Calculate distance (2 bytes: high + low = distance in mm)
    uint16_t distance = (data[0] << 8) | data[1];
    Serial.print("✅ Valid response! Distance: ");
    Serial.print(distance);
    Serial.println(" mm");
  } else if (availableBytes > 0) {
    Serial.print("📖 Partial data: ");
    for (int i = 0; i < availableBytes; i++) {
      byte byteData = ultrasonicSerial.read();
      Serial.print("0x");
      if (byteData < 16) Serial.print("0");
      Serial.print(byteData, HEX);
      Serial.print(" ");
    }
    Serial.println();
  } else {
    Serial.println("❌ No response from SR04M-2 sensor");
  }
  
  // Test 2: Alternative command (0x01)
  Serial.println("\n📤 Test 2: Alternative protocol (0x01)");
  ultrasonicSerial.write(0x01);
  Serial.println("Sent alternative command (0x01)");
  
  delay(100);
  
  availableBytes = ultrasonicSerial.available();
  Serial.print("📥 Available bytes: ");
  Serial.println(availableBytes);
  
  if (availableBytes >= 2) {
    Serial.print("📖 Response: ");
    byte data[2];
    ultrasonicSerial.readBytes(data, 2);
    for (int i = 0; i < 2; i++) {
      Serial.print("0x");
      if (data[i] < 16) Serial.print("0");
      Serial.print(data[i], HEX);
      Serial.print(" ");
    }
    uint16_t distance = (data[0] << 8) | data[1];
    Serial.print("| Distance: ");
    Serial.print(distance);
    Serial.println(" mm");
  } else {
    Serial.println("❌ No response to alternative command");
  }
  
  // Test 3: ASCII command
  Serial.println("\n📤 Test 3: ASCII command ('R')");
  ultrasonicSerial.print("R");
  Serial.println("Sent ASCII command 'R'");
  
  delay(100);
  
  availableBytes = ultrasonicSerial.available();
  Serial.print("📥 Available bytes: ");
  Serial.println(availableBytes);
  
  if (availableBytes >= 2) {
    Serial.print("📖 ASCII Response: ");
    byte data[2];
    ultrasonicSerial.readBytes(data, 2);
    for (int i = 0; i < 2; i++) {
      Serial.print("0x");
      if (data[i] < 16) Serial.print("0");
      Serial.print(data[i], HEX);
      Serial.print(" ");
    }
    uint16_t distance = (data[0] << 8) | data[1];
    Serial.print("| Distance: ");
    Serial.print(distance);
    Serial.println(" mm");
  } else {
    Serial.println("❌ No ASCII response");
  }
  
  Serial.println("\n� Troubleshooting Recommendations:");
  Serial.println("1. Check wiring: RX↔TX, GND↔GND, 5V↔VCC");
  Serial.println("2. Verify power supply (must be 5V)");
  Serial.println("3. Confirm sensor model (SR04M-2 UART)");
  Serial.println("4. Try different baud rates if needed");
  Serial.println("5. Check for loose connections");
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
  ultrasonicSerial.flush(); // Wait for transmission to complete
  
  Serial.println("📤 Sent 0x55 to SR04M-2");
  
  // Wait for response with timeout
  unsigned long startTime = millis();
  int availableBytes = 0;
  
  while ((millis() - startTime) < 200) { // 200ms timeout
    availableBytes = ultrasonicSerial.available();
    if (availableBytes >= 2) break; // We need at least 2 bytes for distance
    delay(5);
  }
  
  Serial.print("📥 Available bytes: ");
  Serial.println(availableBytes);
  
  if (availableBytes < 2) {
    Serial.println("❌ Insufficient data from SR04M-2");
    return -1; // Insufficient data
  }
  
  if (availableBytes > 2) {
    Serial.print("⚠️  Extra data received: ");
    Serial.println(availableBytes);
  }
  
  // Read response (2 bytes for distance in mm)
  byte buffer[2];
  int bytesRead = ultrasonicSerial.readBytes(buffer, 2);
  
  Serial.print("📖 Bytes read: ");
  Serial.print(bytesRead);
  Serial.print(" | Data: ");
  for (int i = 0; i < bytesRead; i++) {
    Serial.print("0x");
    if (buffer[i] < 16) Serial.print("0");
    Serial.print(buffer[i], HEX);
    if (i < bytesRead - 1) Serial.print(" ");
  }
  Serial.println();
  
  if (bytesRead != 2) {
    Serial.println("❌ Incomplete response from SR04M-2");
    return -1; // Incomplete response
  }
  
  // Calculate distance from response (2 bytes: high byte + low byte = distance in mm)
  int distance_mm = (buffer[0] << 8) | buffer[1];
  float distance_cm = distance_mm / 10.0;
  
  Serial.print("📏 Raw distance: ");
  Serial.print(distance_mm);
  Serial.print("mm (");
  Serial.print(distance_cm);
  Serial.println("cm)");
  
  // Check for invalid readings (allow 0mm as full tank)
  if (distance_mm < 0) {
    Serial.println("❌ Invalid distance reading (< 0mm)");
    return -1; // Invalid reading
  }
  
  // If distance is 0mm, assume tank is full (water at sensor level)
  if (distance_mm == 0) {
    Serial.println("💧 Tank appears to be full (0mm distance)");
    return 100.0; // Full tank
  }
  
  // SR04M-2 minimum detection distance is 25cm
  if (distance_cm < 25.0) {
    Serial.println("❌ Distance too close for SR04M-2 (< 25cm)");
    return -1; // Too close for SR04M-2
  }
  
  // SR04M-2 maximum detection distance is 400cm
  if (distance_cm > 400.0) {
    Serial.println("❌ Distance too far for SR04M-2 (> 400cm)");
    return -1; // Too far for SR04M-2
  }

  float waterHeight = TANK_HEIGHT_CM - distance_cm;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;
  
  Serial.print("💧 Water level: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return constrain(levelPercent, 0, 100);
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
      Serial.println("🚨 CRITICAL: Water level extremely low!");
    }
  } else if (level <= LOW_LEVEL_THRESHOLD) {
    newStatus = "warning";
    if (!lowLevelAlert) {
      lowLevelAlert = true;
      shouldAlert = true;
      Serial.println("⚠️ WARNING: Water level getting low");
    }
  } else {
    // Reset alerts when level is normal
    if (lowLevelAlert || criticalLevelAlert) {
      Serial.println("✅ Water level back to normal");
    }
    lowLevelAlert = false;
    criticalLevelAlert = false;
  }

  alertStatus = newStatus;

  // Visual/audio alerts
  if (shouldAlert) {
    // Buzzer alert pattern
    for (int i = 0; i < 3; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }

  // Continuous LED indication
  if (alertStatus == "critical") {
    digitalWrite(LED_PIN, HIGH);
  } else if (alertStatus == "warning") {
    // Blink LED for warning
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 1000) {
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

  // Create payload structure
  payloadDoc["tank_type"] = "top_tank";
  payloadDoc["level_percentage"] = currentLevel;
  payloadDoc["level_liters"] = waterVolume;
  payloadDoc["sensor_health"] = "good";
  payloadDoc["esp32_id"] = DEVICE_ID;
  payloadDoc["battery_voltage"] = 3.3;
  payloadDoc["signal_strength"] = WiFi.RSSI();

  // Main message structure
  doc["type"] = "sensor_data";
  doc["payload"] = payloadDoc;

  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);

  Serial.println("📊 Sensor data sent - Level: " + String(currentLevel, 1) + "% (" + alertStatus + ")");
}

// WebSocket event handler
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      websocketConnected = false;
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
        doc["firmware_version"] = "1.0.0";

        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("📡 ESP32 registered with server");
      }
      break;

    case WStype_TEXT:
      {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, payload, length);

        if (!error) {
          String messageType = doc["type"];

          if (messageType == "get_status") {
            // Server requesting current status
            sendSensorData();
            Serial.println("📋 Status sent on request");
          } else if (messageType == "acknowledge_alert") {
            // Server acknowledged alert
            Serial.println("✅ Alert acknowledged by server");
          }
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
  Serial.println("\n=== Aqua Guard Sense ESP32 Top Tank Starting ===");
  Serial.println("Sensor: SR04M-2 Ultrasonic Sensor (UART)");
  Serial.println("⚠️  IMPORTANT: Connect SR04M-2 to UART pins!");
  Serial.println("   ESP32 TX (GPIO 17) → SR04M-2 RX");
  Serial.println("   ESP32 RX (GPIO 16) → SR04M-2 TX");
  Serial.println("   ESP32 GND → SR04M-2 GND");
  Serial.println("   ESP32 5V → SR04M-2 VCC");

  // Initialize SR04M-2 UART communication
  ultrasonicSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  Serial.println("SR04M-2 UART initialized at 9600 baud");
  Serial.print("RX Pin: GPIO ");
  Serial.println(RX_PIN);
  Serial.print("TX Pin: GPIO ");
  Serial.println(TX_PIN);
  
  // Test SR04M-2 communication
  delay(1000); // Wait for sensor to initialize
  testSR04M2Communication();
  
  // If communication test failed, try different baud rates
  Serial.println("\n🔄 If the above test failed, trying different baud rates...");
  testDifferentBaudRates();

  // Initialize optional pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // Ensure outputs are off at startup
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

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
  Serial.println("\n🚀 NEXT STEPS:");
  Serial.println("1. Check the serial output above for SR04M-2 test results");
  Serial.println("2. If tests failed, verify wiring and power supply");
  Serial.println("3. Monitor the loop() readings every 3 seconds");
  Serial.println("4. Use the data for your water tank monitoring system");
}

// ========== MAIN LOOP ==========
void loop() {
  // Handle WebSocket
  webSocket.loop();

  // Read sensors periodically
  if (millis() - lastSensorRead > 3000) { // Every 3 seconds
    float newLevel = readUltrasonicLevel();

    if (newLevel >= 0) { // Valid reading
      currentLevel = newLevel;
      waterVolume = calculateVolume(currentLevel);
      checkAlerts(currentLevel);

      // Debug output
      Serial.print("📏 Level: ");
      Serial.print(currentLevel, 1);
      Serial.print("% | Volume: ");
      Serial.print(waterVolume, 1);
      Serial.print("L | Distance: ");
      float distance = TANK_HEIGHT_CM - ((currentLevel / 100.0) * TANK_HEIGHT_CM);
      Serial.print(distance, 1);
      Serial.println(" cm");
    } else {
      Serial.println("❌ SR04M-2 Ultrasonic sensor error (UART)");
    }

    lastSensorRead = millis();
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
