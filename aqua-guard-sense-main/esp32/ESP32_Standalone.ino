/*
 * Aqua Guard Sense - ESP32 Water Tank Monitor
 * Standalone ESP32 code for water tank monitoring system
 *
 * Features:
 * - WiFi connectivity with WebSocket communication
 * - Ultrasonic sensor for water level measurement
 * - Optional float switch for dual-sensor verification
 * - Motor control with safety features
 * - Manual override button
 * - Real-time data transmission
 * - Automatic motor control based on tank levels
 *
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - HC-SR04 Ultrasonic Sensor (Trig: GPIO 5, Echo: GPIO 18)
 * - Optional: Float Switch (GPIO 4)
 * - Optional: Manual Button (GPIO 12)
 * - Optional: Relay Module for motor (GPIO 13)
 *
 * Setup Instructions:
 * 1. Update WiFi credentials below
 * 2. Update server IP address
 * 3. Comment/uncomment features as needed
 * 4. Upload to ESP32 using Arduino IDE
 */

// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATE THESE VALUES
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Server Configuration - UPDATE SERVER IP
const char* SERVER_IP = "192.168.0.108";
const int WEBSOCKET_PORT = 8083;

// Device Configuration
const char* DEVICE_TYPE = "sump_tank";  // "top_tank" or "sump_tank"
const char* DEVICE_ID = "ESP32_MAIN_001";

// Hardware Pin Configuration
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int FLOAT_SWITCH_PIN = 4;    // Optional
const int MANUAL_BUTTON_PIN = 12;  // Optional
const int MOTOR_RELAY_PIN = 13;    // Optional
const int BUZZER_PIN = 14;         // Optional
const int LED_PIN = 15;           // Optional

// Tank Configuration
const float TANK_HEIGHT_CM = 150.0;
const float SENSOR_HEIGHT_CM = 15.0;
const float TANK_CAPACITY_LITERS = 800.0;

// Motor Control Settings (for sump tank only)
const float AUTO_START_LEVEL = 30.0;  // Start when top tank below 30%
const float AUTO_STOP_LEVEL = 85.0;   // Stop when top tank above 85%
const unsigned long MAX_RUNTIME = 3600000; // 1 hour max runtime
const unsigned long MIN_OFF_TIME = 900000; // 15 minutes min off time

// Communication Settings
const unsigned long HEARTBEAT_INTERVAL = 10000; // 10 seconds
const unsigned long SENSOR_UPDATE_INTERVAL = 3000; // 3 seconds
const unsigned long WIFI_RETRY_INTERVAL = 30000; // 30 seconds

// ========== END CONFIGURATION ==========

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ========== GLOBAL VARIABLES ==========
WebSocketsClient webSocket;
Preferences preferences;

bool wifiConnected = false;
bool websocketConnected = false;
bool motorRunning = false;
bool manualOverride = false;
bool autoMode = true;

unsigned long lastHeartbeat = 0;
unsigned long lastSensorUpdate = 0;
unsigned long lastWifiRetry = 0;
unsigned long motorStartTime = 0;
unsigned long motorStopTime = 0;

float lastTopTankLevel = 50.0;

// ========== SETUP FUNCTION ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Aqua Guard Sense ESP32 Starting ===");

  // Initialize pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Optional pins (uncomment if using)
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(MOTOR_RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  // Ensure motor is off initially
  digitalWrite(MOTOR_RELAY_PIN, LOW);

  // Attach interrupt for manual button (optional)
  attachInterrupt(digitalPinToInterrupt(MANUAL_BUTTON_PIN), manualButtonISR, FALLING);

  // Initialize preferences
  preferences.begin("aquaguard", false);

  // Connect to WiFi
  setupWiFi();

  // Setup WebSocket
  setupWebSocket();

  Serial.println("ESP32 initialization complete!");
  Serial.print("Device Type: ");
  Serial.println(DEVICE_TYPE);
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
}

// ========== MAIN LOOP ==========
void loop() {
  // Handle WebSocket communication
  webSocket.loop();

  unsigned long currentTime = millis();

  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    if (currentTime - lastWifiRetry > WIFI_RETRY_INTERVAL) {
      Serial.println("WiFi disconnected, attempting reconnection...");
      setupWiFi();
      lastWifiRetry = currentTime;
    }
  }

  // Send heartbeat
  if (currentTime - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = currentTime;
  }

  // Send sensor data
  if (currentTime - lastSensorUpdate > SENSOR_UPDATE_INTERVAL) {
    sendSensorData();
    lastSensorUpdate = currentTime;
  }

  // Auto motor control (sump tank only)
  if (strcmp(DEVICE_TYPE, "sump_tank") == 0 && autoMode) {
    if (!motorRunning && shouldStartMotor()) {
      controlMotor("start", "auto_low_level");
    } else if (motorRunning && shouldStopMotor()) {
      controlMotor("stop", "auto_high_level");
    }

    // Safety timeout
    if (motorRunning && currentTime - motorStartTime > MAX_RUNTIME) {
      controlMotor("stop", "safety_timeout");
      Serial.println("MOTOR SAFETY TIMEOUT!");
    }
  }

  // Handle manual override
  if (manualOverride) {
    handleManualOverride();
  }

  delay(100);
}

// ========== WIFI SETUP ==========
void setupWiFi() {
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
    wifiConnected = true;
    Serial.println("\n✅ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("\n❌ WiFi connection failed!");
  }
}

// ========== WEBSOCKET SETUP ==========
void setupWebSocket() {
  String wsUrl = String("ws://") + SERVER_IP + ":" + WEBSOCKET_PORT;
  Serial.print("Connecting to WebSocket: ");
  Serial.println(wsUrl);

  webSocket.begin(SERVER_IP, WEBSOCKET_PORT, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

// ========== WEBSOCKET EVENT HANDLER ==========
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      websocketConnected = false;
      Serial.println("❌ WebSocket disconnected");
      break;

    case WStype_CONNECTED:
      websocketConnected = true;
      Serial.println("✅ WebSocket connected");
      registerDevice();
      break;

    case WStype_TEXT:
      handleServerMessage(String((char*)payload));
      break;

    case WStype_ERROR:
      Serial.println("❌ WebSocket error");
      break;
  }
}

// ========== DEVICE REGISTRATION ==========
void registerDevice() {
  StaticJsonDocument<200> doc;
  doc["type"] = "esp32_register";
  doc["esp32_id"] = DEVICE_ID;
  doc["device_type"] = DEVICE_TYPE;

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("📡 Device registered with server");
}

// ========== HEARTBEAT FUNCTION ==========
void sendHeartbeat() {
  if (!websocketConnected) return;

  StaticJsonDocument<256> doc;
  doc["type"] = "heartbeat";
  doc["esp32_id"] = DEVICE_ID;
  doc["device_type"] = DEVICE_TYPE;
  doc["timestamp"] = millis();
  doc["wifi_connected"] = wifiConnected;
  doc["motor_running"] = motorRunning;

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("💓 Heartbeat sent");
}

// ========== SENSOR DATA FUNCTION ==========
void sendSensorData() {
  if (!websocketConnected) return;

  // Get ultrasonic reading
  float distance = getUltrasonicDistance();
  float level = calculateWaterLevel(distance);
  bool floatStatus = digitalRead(FLOAT_SWITCH_PIN) == LOW; // Active low

  StaticJsonDocument<512> doc;
  doc["type"] = "sensor_data";
  doc["esp32_id"] = DEVICE_ID;
  doc["device_type"] = DEVICE_TYPE;
  doc["timestamp"] = millis();

  JsonObject payload = doc.createNestedObject("payload");
  payload["level_percentage"] = level;
  payload["level_liters"] = (level / 100.0) * TANK_CAPACITY_LITERS;
  payload["ultrasonic_distance"] = distance;
  payload["sensor_valid"] = isUltrasonicValid(distance);
  payload["float_switch"] = floatStatus;
  payload["motor_running"] = motorRunning;
  payload["auto_mode"] = autoMode;

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.print("📊 Sensor data sent - Level: ");
  Serial.print(level);
  Serial.println("%");
}

// ========== SERVER MESSAGE HANDLER ==========
void handleServerMessage(String message) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.println("❌ Failed to parse server message");
    return;
  }

  String messageType = doc["type"];

  if (messageType == "top_tank_update") {
    // Update top tank level for auto motor control
    if (doc["level_percentage"].is<float>()) {
      lastTopTankLevel = doc["level_percentage"];
      Serial.print("🔄 Updated top tank level: ");
      Serial.print(lastTopTankLevel);
      Serial.println("%");
    }
  } else if (messageType == "motor_command") {
    String command = doc["command"];
    String reason = doc["reason"];
    controlMotor(command, reason);
  } else if (messageType == "emergency_stop") {
    controlMotor("stop", "emergency_stop_from_server");
    Serial.println("🚨 EMERGENCY STOP activated!");
  } else if (messageType == "ping") {
    // Respond to ping
    webSocket.sendTXT("{\"type\":\"pong\",\"device_type\":\"" + String(DEVICE_TYPE) + "\"}");
  }
}

// ========== MOTOR CONTROL FUNCTIONS ==========
void controlMotor(String action, String reason) {
  if (strcmp(DEVICE_TYPE, "sump_tank") != 0) return; // Only sump tank has motor

  if (action == "start") {
    if (!motorRunning && millis() - motorStopTime > MIN_OFF_TIME) {
      digitalWrite(MOTOR_RELAY_PIN, HIGH);
      motorRunning = true;
      motorStartTime = millis();
      Serial.println("▶️  MOTOR STARTED: " + reason);

      // Visual feedback
      digitalWrite(LED_PIN, HIGH);
    }
  } else if (action == "stop") {
    if (motorRunning) {
      digitalWrite(MOTOR_RELAY_PIN, LOW);
      motorRunning = false;
      motorStopTime = millis();
      Serial.println("⏹️  MOTOR STOPPED: " + reason);

      // Visual feedback
      digitalWrite(LED_PIN, LOW);
    }
  }
}

bool shouldStartMotor() {
  return (lastTopTankLevel < AUTO_START_LEVEL);
}

bool shouldStopMotor() {
  return (lastTopTankLevel > AUTO_STOP_LEVEL);
}

// ========== MANUAL OVERRIDE ==========
void manualButtonISR() {
  static unsigned long lastInterrupt = 0;
  if (millis() - lastInterrupt > 200) { // Debounce
    manualOverride = true;
    lastInterrupt = millis();
  }
}

void handleManualOverride() {
  Serial.println("🔘 Manual override activated");

  // Toggle motor state
  if (motorRunning) {
    controlMotor("stop", "manual_override");
  } else {
    controlMotor("start", "manual_override");
  }

  // Disable auto mode temporarily
  autoMode = false;

  // Re-enable auto mode after 5 minutes
  delay(300000);
  autoMode = true;
  Serial.println("🔄 Auto mode re-enabled");

  manualOverride = false;
}

// ========== ULTRASONIC SENSOR FUNCTIONS ==========
float getUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) return -1; // Invalid reading

  return duration * 0.034 / 2;
}

bool isUltrasonicValid(float distance) {
  return (distance > 0 && distance < TANK_HEIGHT_CM + 50);
}

float calculateWaterLevel(float distance) {
  if (distance < 0) return -1;

  float waterLevel = TANK_HEIGHT_CM - distance - SENSOR_HEIGHT_CM;
  return max(0.0f, min(100.0f, (waterLevel / TANK_HEIGHT_CM) * 100.0f));
}

// ========== UTILITY FUNCTIONS ==========
void playBuzzer(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

void blinkLED(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_PIN, LOW);
    delay(duration);
  }
}
