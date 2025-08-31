/*
 * Aqua Guard Sense - ESP32 Top Tank Monitor
 * Enhanced ESP32 code for top tank monitoring only
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - HC-SR04 Ultrasonic sensor for water level measurement (TRIG/ECHO)
 * - Real-time data transmission
 * - Simple monitoring without motor control
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - HC-SR04 Ultrasonic Sensor (TRIG/ECHO mode)
 * - Wiring: HC-SR04 TRIG → ESP32 GPIO 5
 *          HC-SR04 ECHO → ESP32 GPIO 18
 *          HC-SR04 GND → ESP32 GND
 *          HC-SR04 VCC → ESP32 5V
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
// HC-SR04 Ultrasonic Sensor Pins
#define TRIGPIN 5
#define ECHOPIN 18
const int BUZZER_PIN = 14;    // Optional
const int LED_PIN = 15;       // Optional

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
float duration = 0.0;
float distance = 0.0;

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

// Read HC-SR04 ultrasonic sensor via TRIG/ECHO pins
float readUltrasonicLevel() {
  digitalWrite(TRIGPIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGPIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGPIN, LOW);

  duration = pulseIn(ECHOPIN, HIGH);
  distance = (duration * 0.0343) / 2;

  Serial.print("distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  // Calculate water level percentage
  float waterHeight = TANK_HEIGHT_CM - distance;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;
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
  Serial.println("Sensor: HC-SR04 Ultrasonic Sensor (TRIG/ECHO)");
  Serial.println("⚠️  IMPORTANT: Connect HC-SR04 to digital pins!");
  Serial.println("   HC-SR04 TRIG → ESP32 GPIO 5");
  Serial.println("   HC-SR04 ECHO → ESP32 GPIO 18");
  Serial.println("   HC-SR04 GND → ESP32 GND");
  Serial.println("   HC-SR04 VCC → ESP32 5V");

  // Initialize HC-SR04 pins
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);
  Serial.println("HC-SR04 initialized (TRIG/ECHO mode)");

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
