/*
 * Aqua Guard Sense - ESP32 Top Tank Monitor
 * Enhanced ESP32 code for top tank monitoring only
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - AJ-SR04M Ultrasonic sensor for water level measurement (TRIG/ECHO)
 * - Real-time data transmission
 * - Simple monitoring without motor control
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - AJ-SR04M Ultrasonic Sensor (TRIG/ECHO mode)
 * - Wiring: AJ-SR04M TRIG → ESP32 GPIO 5
 *          AJ-SR04M ECHO → ESP32 GPIO 18
 *          AJ-SR04M GND → ESP32 GND
 *          AJ-SR04M VCC → ESP32 5V
 * - Optional: Buzzer (GPIO 14)
 * - Optional: LED (GPIO 15)
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
const char* DEVICE_TYPE = "top_tank";
const char* DEVICE_ID = "ESP32_TOP_001";

// Hardware Pin Configuration
// AJ-SR04M Ultrasonic Sensor Pins (TRIG/ECHO mode)
#define TRIGPIN 5
#define ECHOPIN 18
const int BUZZER_PIN = 14;    // Optional
const int LED_PIN = 15;       // Optional

// Tank Configuration
const float TANK_HEIGHT_CM = 100.0;  // Height of top tank in cm (reduced for realistic volume)
const float TANK_DIAMETER_CM = 80.0; // Diameter of top tank in cm (reduced for realistic volume)
const float LOW_LEVEL_THRESHOLD = 25.0;  // Alert when below this percentage
const float CRITICAL_LEVEL_THRESHOLD = 10.0; // Critical alert threshold

// AJ-SR04M Sensor Configuration
const float MIN_SENSOR_DISTANCE_CM = 20.0;  // Minimum reliable detection distance (sensor limitation)
const float MAX_SENSOR_DISTANCE_CM = 450.0; // Maximum detection distance

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

// Calculate water volume based on level percentage
// Formula: V = πr²h (cylindrical tank)
// Volume in liters = (π × radius² × height) / 1000
float calculateVolume(float levelPercent) {
  if (levelPercent < 0 || levelPercent > 100) {
    return 0.0; // Invalid level
  }

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

// Send ping to keep connection alive
void sendPing() {
  StaticJsonDocument<64> doc;
  doc["type"] = "ping";
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  Serial.println("🏓 Ping sent");
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
          } else if (messageType == "pong") {
            Serial.println("🏓 Pong received - connection is alive");
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
  Serial.println("Sensor: AJ-SR04M Ultrasonic Sensor (TRIG/ECHO)");
  Serial.print("Tank: ");
  Serial.print(TANK_DIAMETER_CM);
  Serial.print("cm diameter x ");
  Serial.print(TANK_HEIGHT_CM);
  Serial.println("cm height");
  Serial.println("⚠️  IMPORTANT: Connect AJ-SR04M to digital pins!");
  Serial.println("   AJ-SR04M TRIG → ESP32 GPIO 5");
  Serial.println("   AJ-SR04M ECHO → ESP32 GPIO 18");
  Serial.println("   AJ-SR04M GND → ESP32 GND");
  Serial.println("   AJ-SR04M VCC → ESP32 5V");
  Serial.println("⚠️  CRITICAL: Sensor CANNOT detect below 20cm - readings will be wrong!");
  Serial.println("   This is a hardware limitation of the AJ-SR04M sensor");
  Serial.println("   When water level is > 80%, expect inaccurate readings");

  // Initialize AJ-SR04M pins
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);
  Serial.println("AJ-SR04M initialized (TRIG/ECHO mode)");

  // Test AJ-SR04M sensor
  testAJ_SR04MCommunication();

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
    Serial.println("Connecting to Supabase WebSocket...");
    Serial.print("URL: wss://");
    Serial.println(SUPABASE_URL);
    Serial.print("Path: ");
    Serial.println(WEBSOCKET_PATH);

    // Try SSL connection with insecure mode
    webSocket.beginSSL(SUPABASE_URL, 443, WEBSOCKET_PATH);
    webSocket.onEvent(webSocketEvent);

    // Set authorization header for Supabase
    webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY);

    // Disable SSL certificate verification
    webSocket.setInsecure();
  }

  Serial.println("========== After Setup End ==========");
  Serial.println("\n🚀 NEXT STEPS:");
  Serial.println("1. Check the serial output above for AJ-SR04M test results");
  Serial.println("2. If tests failed, verify wiring and power supply");
  Serial.println("3. Monitor the loop() readings every 3 seconds");
  Serial.println("4. IMPORTANT: Sensor cannot detect below 20cm - expect wrong data!");
  Serial.println("5. Use the data for your water tank monitoring system");
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

      // Warning for high water levels (sensor cannot detect < 20cm)
      if (currentLevel > 80) {
        Serial.println("⚠️ CRITICAL: High water level - sensor cannot detect < 20cm!");
        Serial.println("   Readings will be WRONG when water is very close to sensor");
      }
    } else {
      Serial.println("❌ AJ-SR04M Ultrasonic sensor error - invalid reading");
    }

    lastSensorRead = millis();
  }

  // Send heartbeat and data
  if (websocketConnected) {
    // Send ping every 30 seconds to keep connection alive
    static unsigned long lastPing = 0;
    if (millis() - lastPing > 30000) {
      sendPing();
      lastPing = millis();
    }

    // Send sensor data every 60 seconds (less frequent now that we have pings)
    if (millis() - lastHeartbeat > 60000) {
      sendSensorData();
      lastHeartbeat = millis();
      Serial.println("💓 Heartbeat sent");
    }
  }

  // Reconnect WebSocket if disconnected
  if (!websocketConnected && WiFi.status() == WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 5000) { // Try to reconnect every 5 seconds
      Serial.println("🔄 Attempting WebSocket reconnection...");
      webSocket.beginSSL(SUPABASE_URL, 443, WEBSOCKET_PATH);
      webSocket.setAuthorization("Bearer", SUPABASE_ANON_KEY);
      webSocket.setInsecure(); // Disable SSL certificate verification
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
