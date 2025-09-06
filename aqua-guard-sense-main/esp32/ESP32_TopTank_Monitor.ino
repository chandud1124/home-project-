/*
 * Aqua Guard Sense - ESP32 Top Tank Monitor (IMPROVED)
 * Dedicated top tank monitoring and motor command system
 *
 * Features:
 * - WiFi connectivity with HTTPS POST communication
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
 * - AJ-SR04M TRIG -> ESP32 GPIO 5
 * - AJ-SR04M ECHO -> ESP32 GPIO 18
 * - AJ-SR04M GND -> ESP32 GND
 * - AJ-SR04M VCC -> ESP32 5V
 * - Buzzer -> ESP32 GPIO 14 (optional)
 * - LED -> ESP32 GPIO 15 (optional)
 *
 * Communication:
* - HTTPS POST to backend for data transmission
 * - Commands to Sump Tank ESP32 for motor control
 *
 * IMPORTANT: AJ-SR04M cannot reliably detect distances below 20cm
 * Readings closer than 20cm will be inaccurate/wrong
 */

// ========== CONFIGURATION SECTION ==========

// WiFi Configuration - UPDATED FOR YOUR NETWORK
const char* WIFI_SSID = "I am Not A Witch I am Your Wifi";
const char* WIFI_PASSWORD = "Whoareu@0000";

// Backend Configuration (Supabase Edge Functions) - UPDATED FOR PRODUCTION
// Backend Configuration (Direct Express API) - updated BEFORE deploy
const char* BACKEND_HOST = "dwcouaacpqipvvsxiygo.supabase.co";   // Supabase project URL
const uint16_t BACKEND_PORT = 443;            // HTTPS port
const bool BACKEND_USE_TLS = true;            // true for Supabase
// Endpoint paths centralized
#include "firmware_common.h"
// Secrets (create secrets.h from secrets.example.h)
#include "secrets.h" // defines DEVICE_API_KEY, DEVICE_HMAC_SECRET
// Legacy Supabase constants removed (fully migrated to direct backend)

// Device Configuration
const char* DEVICE_TYPE = "top_tank_monitor";
const char* DEVICE_ID = "ESP32_TOP_002";  // Updated to unique ID

// Firmware Metadata
#define FIRMWARE_VERSION "2.1.0"
#define BUILD_TIMESTAMP __DATE__ " " __TIME__

// Sump Tank ESP32 Configuration (for motor commands)
// NOTE: Update SUMP_ESP32_IP with the actual IP address of your Sump ESP32 after it connects to WiFi
const char* SUMP_ESP32_IP = "192.168.0.184";  // Will be updated with actual Sump ESP32 IP address
const int SUMP_ESP32_PORT = 80;

// Hardware Pin Configuration
// AJ-SR04M Ultrasonic Sensor Pins (TRIG/ECHO mode)
#define TRIGPIN 5
#define ECHOPIN 18
#define BUZZER_PIN 14          // Alert buzzer (optional)
#define LED_PIN 15             // Status LED (optional)

// Tank Configuration - CYLINDRICAL TANK 1000L CAPACITY
const float TANK_HEIGHT_CM = 120.0;     // Height of cylindrical top tank in cm
const float TANK_RADIUS_CM = 51.5;      // Radius of cylindrical top tank in cm (calculated for 1000L)
const float TANK_DIAMETER_CM = 103.0;   // Diameter of cylindrical top tank in cm
const float LOW_LEVEL_THRESHOLD = 20.0;  // Alert when below this percentage
const float CRITICAL_LEVEL_THRESHOLD = 10.0; // Critical alert threshold

// Motor Control Thresholds (commands sent to Sump ESP32)
const float MOTOR_START_LEVEL = 30.0;  // Start when top tank < 30%
const float MOTOR_STOP_LEVEL = 90.0;   // Stop when top tank > 90%

// AJ-SR04M Sensor Configuration
const float MIN_SENSOR_DISTANCE_CM = 20.0;  // Minimum reliable detection distance
const float MAX_SENSOR_DISTANCE_CM = 450.0; // Maximum detection distance

// ========== LIBRARIES ==========
// WebSocket library removed after migration to stateless HTTPS POST
#include <WiFi.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <esp_task_wdt.h>  // ESP32 Watchdog Timer
#include <mbedtls/md.h>
#include <time.h>

// ========== WATCHDOG CONFIGURATION ==========
#define WDT_TIMEOUT 60  // Watchdog timeout in seconds (INCREASED from 30s)
unsigned long lastWatchdogFeed = 0;
const unsigned long WATCHDOG_FEED_INTERVAL = 10000; // Feed watchdog every 10 seconds
unsigned long startupTime = 0; // Track when ESP32 started
const unsigned long MIN_UPTIME_BEFORE_WDT = 5000; // 5 seconds minimum before aggressive WDT operations

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

// ===== HTTPS POST SUPPORT (NEW BACKEND) =====
bool ensureTimeSynced() {
  time_t now = time(nullptr);
  if (now < 1700000000) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    for (int i = 0; i < 20; i++) { // wait up to ~10s
      delay(500);
      now = time(nullptr);
      if (now >= 1700000000) break;
    }
  }
  return now >= 1700000000;
}
String generateHMACSignatureTop(const String &payload, const String &timestamp) {
  // Combine device_id + payload + timestamp similar to sump device for consistency
  String dataToSign = String(DEVICE_ID) + payload + timestamp;
  unsigned char hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  mbedtls_md_init(&ctx);
  const mbedtls_md_info_t *mdInfo = mbedtls_md_info_from_type(md_type);
  if (mdInfo == NULL) {
    return String("");
  }
  if (mbedtls_md_setup(&ctx, mdInfo, 1) != 0) {
    mbedtls_md_free(&ctx);
    return String("");
  }
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)DEVICE_HMAC_SECRET, strlen(DEVICE_HMAC_SECRET));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)dataToSign.c_str(), dataToSign.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  char hexResult[65];
  for (int i = 0; i < 32; i++) {
    sprintf(hexResult + (i * 2), "%02x", hmacResult[i]);
  }
  hexResult[64] = '\0';
  return String(hexResult);
}
bool postToBackendTop(const String &jsonPayload, const char* path, const String *timestampPtr = nullptr, const String *signaturePtr = nullptr) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("HTTP: WiFi not connected (top)");
    return false;
  }
  HTTPClient http;
  String scheme = BACKEND_USE_TLS ? "https://" : "http://";
  String url = scheme + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + String(path);
  bool began = false;
  if (BACKEND_USE_TLS) {
    WiFiClientSecure tls;
    // If using custom CA, set here via tls.setCACert(...)
    began = http.begin(tls, url);
  } else {
    began = http.begin(url);
  }
  if (!began) {
    Serial.println("HTTP: begin() failed (top)");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-api-key", DEVICE_API_KEY);
  if (timestampPtr && signaturePtr) {
    http.addHeader("x-timestamp", *timestampPtr);
    http.addHeader("x-signature", *signaturePtr);
  }
  int status = http.POST(jsonPayload);
  if (status <= 0) {
    Serial.print("HTTP: POST error (top): ");
    Serial.println(http.errorToString(status));
    http.end();
    return false;
  }
  Serial.print("HTTP: POST status (top) "); Serial.println(status);
  if (status != 200) {
    Serial.println(http.getString());
  }
  http.end();
  return status == 200;
}
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool wifiConnected = false;
// (Removed) websocketConnected flag - no persistent socket now

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
// (Removed) websocketErrorCount / websocketReconnectAttempts - legacy
int wifiReconnectAttempts = 0;
unsigned long lastWifiReconnectAttempt = 0;
// (Removed) lastWebsocketReconnectAttempt - legacy

// Heartbeat and keep-alive variables (IMPROVED - No auto restart)
unsigned long lastHeartbeatResponse = 0;
int heartbeatMissedCount = 0;
const unsigned long HEARTBEAT_TIMEOUT = 120000; // 2 minutes timeout for heartbeat response
bool backendResponsive = true;

// Command polling (for potential future top-tank targeted commands)
unsigned long topLastCommandPoll = 0;
const unsigned long TOP_COMMAND_POLL_INTERVAL = 15000; // 15s
void topPollCommands();
bool topAcknowledgeCommand(const String &commandId);

// ========== OFFLINE MESSAGE QUEUE (NEW) ==========
struct QueuedMessage {
  String payload;
  uint8_t attempts;
  unsigned long nextAttempt;
};

const int TOP_QUEUE_CAPACITY = 20;
const uint8_t TOP_QUEUE_MAX_ATTEMPTS = 8;
const unsigned long TOP_QUEUE_BASE_DELAY = 5000; // 5s
const unsigned long TOP_QUEUE_MAX_DELAY = 300000; // 5m
QueuedMessage topQueue[TOP_QUEUE_CAPACITY];
int topQueueCount = 0;

unsigned long topComputeBackoff(uint8_t attempts) {
  unsigned long factor = 1UL << attempts; // 2^attempts
  unsigned long d = TOP_QUEUE_BASE_DELAY * factor;
  if (d > TOP_QUEUE_MAX_DELAY) d = TOP_QUEUE_MAX_DELAY;
  return d;
}

bool topEnqueue(const String &payload) {
  if (topQueueCount >= TOP_QUEUE_CAPACITY) {
    // Drop oldest (lowest nextAttempt)
    int dropIndex = -1;
    unsigned long earliest = ULONG_MAX;
    for (int i=0;i<TOP_QUEUE_CAPACITY;i++) {
      if (topQueue[i].payload.length()>0 && topQueue[i].nextAttempt < earliest) {
        earliest = topQueue[i].nextAttempt;
        dropIndex = i;
      }
    }
    if (dropIndex >=0) {
      topQueue[dropIndex].payload = "";
      topQueueCount--;
    }
    Serial.println("QUEUE: Top queue full - dropped oldest message");
  }
  for (int i=0;i<TOP_QUEUE_CAPACITY;i++) {
    if (topQueue[i].payload.length()==0) {
      topQueue[i].payload = payload;
      topQueue[i].attempts = 0;
      topQueue[i].nextAttempt = millis();
      topQueueCount++;
      Serial.print("QUEUE: Top message enqueued. Size=");
      Serial.println(topQueueCount);
      return true;
    }
  }
  Serial.println("QUEUE: Failed to enqueue top message");
  return false;
}

void processTopQueue() {
  if (topQueueCount == 0) return;
  unsigned long now = millis();
  for (int i=0;i<TOP_QUEUE_CAPACITY;i++) {
    if (topQueue[i].payload.length()==0) continue;
    if (topQueue[i].attempts >= TOP_QUEUE_MAX_ATTEMPTS) {
      Serial.println("QUEUE: Dropping top message (max attempts)");
      topQueue[i].payload = "";
      topQueueCount--;
      continue;
    }
    if (now < topQueue[i].nextAttempt) continue;
    Serial.print("QUEUE: Top resend attempt ");
    Serial.println(topQueue[i].attempts + 1);
  bool ok = postToBackendTop(topQueue[i].payload, FW_PATH_SENSOR_DATA);
    if (ok) {
      Serial.println("QUEUE: Top resend success");
      topQueue[i].payload = "";
      topQueueCount--;
    } else {
      topQueue[i].attempts++;
      unsigned long b = topComputeBackoff(topQueue[i].attempts);
      topQueue[i].nextAttempt = now + b;
      Serial.print("QUEUE: Top resend failed - backoff ms=");
      Serial.println(b);
    }
  }
}

int getTopQueueSize() { return topQueueCount; }

// ========== FUNCTIONS ==========

// Test AJ-SR04M ultrasonic sensor
void testAJ_SR04MCommunication() {
  Serial.println("\nMANUAL: Testing AJ-SR04M Ultrasonic Sensor...");

  // Test multiple readings
  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIGPIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIGPIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIGPIN, LOW);

    duration = pulseIn(ECHOPIN, HIGH, 30000);
    distance = (duration * 0.0343) / 2;

    Serial.print("RULER: Test ");
    Serial.print(i + 1);
    Serial.print(": Distance = ");
    Serial.print(distance);
    Serial.println(" cm");

    delay(500);
  }

  Serial.println("SUCCESS: AJ-SR04M test completed");
  Serial.println("BULB: Sensor Specifications:");
  Serial.println("   - Minimum detection distance: 20 cm (IMPORTANT LIMITATION)");
  Serial.println("   - Maximum detection distance: 450 cm");
  Serial.println("   - WARNING: Readings below 20cm will be inaccurate");
  Serial.println("BULB: If readings are 0.00 or inconsistent:");
  Serial.println("   1. Check wiring: TRIG->GPIO 5, ECHO->GPIO 18");
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
      Serial.println("WARNING: Top tank ultrasonic sensor timeout - no echo received");
      invalidReadings++;
      delay(50); // Short delay before retry
      continue;
    }

    // Convert duration to distance
    float distance = (duration * 0.0343) / 2;

    // Validate distance reading
    if (distance < MIN_SENSOR_DISTANCE_CM || distance > MAX_SENSOR_DISTANCE_CM || isnan(distance) || isinf(distance)) {
      Serial.print("WARNING: Invalid top tank distance reading: ");
      Serial.print(distance);
      Serial.println(" cm (out of valid range)");
      invalidReadings++;
    } else {
      readings[validReadings] = distance;
      validReadings++;
      Serial.print("SUCCESS: Valid top tank reading ");
      Serial.print(validReadings);
      Serial.print(": ");
      Serial.print(distance);
      Serial.println(" cm");
    }

    delay(100); // Delay between readings to avoid interference
  }

  // Check if we have enough valid readings
  if (validReadings < (NUM_READINGS - MAX_INVALID_READINGS)) {
    Serial.print("ERROR: Too many invalid top tank readings (");
    Serial.print(invalidReadings);
    Serial.print("/");
    Serial.print(NUM_READINGS);
    Serial.println(") - sensor may be faulty");
    return -1;
  }

  if (validReadings == 0) {
    Serial.println("ERROR: No valid top tank readings obtained");
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
    Serial.print("WARNING: Top tank average distance out of range: ");
    Serial.print(averageDistance);
    Serial.println(" cm");
    return -1;
  }

  Serial.print("DATA: Top tank average distance: ");
  Serial.print(averageDistance);
  Serial.println(" cm");

  // Calculate water level percentage
  float waterHeight = TANK_HEIGHT_CM - averageDistance;
  float levelPercent = (waterHeight / TANK_HEIGHT_CM) * 100.0;
  levelPercent = constrain(levelPercent, 0, 100);

  Serial.print("WATER: Top tank calculated level: ");
  Serial.print(levelPercent, 1);
  Serial.println("%");

  return levelPercent;
}

// Calculate water volume in liters for top tank (CYLINDRICAL)
float calculateVolume(float levelPercent) {
  float waterHeight = (levelPercent / 100.0) * TANK_HEIGHT_CM;
  float volumeLiters = (PI * TANK_RADIUS_CM * TANK_RADIUS_CM * waterHeight) / 1000.0;
  return volumeLiters;
}

// Send motor command to Sump Tank ESP32
void sendMotorCommandToSump(bool startMotor) {
  // Feed watchdog before network operation
  esp_task_wdt_reset();
  Serial.println("==========================================");
  Serial.println("🚀 TOP TANK ESP32 → SUMP TANK ESP32 COMMUNICATION");
  Serial.println("==========================================");
  Serial.println("📡 WATCHDOG: Watchdog fed before motor command");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ ERROR: Cannot send motor command - WiFi not connected");
    Serial.println("🔄 STATUS: Top Tank ESP32 WiFi Status: DISCONNECTED");
    return;
  }

  Serial.println("✅ WIFI: Top Tank ESP32 WiFi connected");
  Serial.print("📍 TARGET: Sump ESP32 IP: ");
  Serial.println(SUMP_ESP32_IP);
  Serial.print("🔌 TARGET: Sump ESP32 Port: ");
  Serial.println(SUMP_ESP32_PORT);

  HTTPClient http;
  String url = "http://" + String(SUMP_ESP32_IP) + ":" + String(SUMP_ESP32_PORT) + "/motor";

  Serial.print("🌐 HTTP URL: ");
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  StaticJsonDocument<128> doc;
  doc["command"] = startMotor ? "start" : "stop";
  doc["source"] = "top_tank";
  doc["top_level"] = currentLevel;
  doc["timestamp"] = millis();
  doc["esp32_id"] = DEVICE_ID;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("📦 JSON PAYLOAD TO SEND:");
  Serial.println(jsonString);
  Serial.println("==========================================");

  Serial.print("📤 SENDING: Motor command to Sump ESP32: ");
  Serial.println(startMotor ? "START" : "STOP");

  unsigned long startTime = millis();
  int httpResponseCode = http.POST(jsonString);
  unsigned long endTime = millis();

  Serial.print("⏱️  RESPONSE TIME: ");
  Serial.print(endTime - startTime);
  Serial.println("ms");

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ SUCCESS: Sump ESP32 Response Received!");
    Serial.print("📥 RESPONSE CODE: ");
    Serial.println(httpResponseCode);
    Serial.print("📄 RESPONSE BODY: ");
    Serial.println(response);
    Serial.println("==========================================");
    Serial.println("🎉 COMMUNICATION SUCCESSFUL!");
  } else {
    Serial.println("❌ ERROR: HTTP Request Failed!");
    Serial.print("📥 ERROR CODE: ");
    Serial.println(httpResponseCode);
    Serial.println("🔍 POSSIBLE CAUSES:");
    Serial.println("   - Sump ESP32 not responding");
    Serial.println("   - Wrong IP address");
    Serial.println("   - Network connectivity issues");
    Serial.println("   - Sump ESP32 HTTP server not running");
  }

  http.end();
  Serial.println("🔚 HTTP CONNECTION CLOSED");
  Serial.println("==========================================");
}

// Auto motor control logic (sends commands to Sump ESP32)
void autoMotorControl() {
  if (!autoModeEnabled) {
    Serial.println("🔇 AUTO MODE: DISABLED - Skipping motor control logic");
    return; // Auto mode disabled
  }

  Serial.println("==========================================");
  Serial.println("🤖 AUTO MOTOR CONTROL LOGIC - TOP TANK ESP32");
  Serial.println("==========================================");
  Serial.print("📊 CURRENT TOP TANK LEVEL: ");
  Serial.print(currentLevel, 1);
  Serial.println("%");
  Serial.print("⚙️  MOTOR CURRENT STATUS: ");
  Serial.println(motorRunning ? "RUNNING" : "STOPPED");
  Serial.print("🎯 MOTOR START THRESHOLD: < ");
  Serial.print(MOTOR_START_LEVEL, 1);
  Serial.println("%");
  Serial.print("🛑 MOTOR STOP THRESHOLD: > ");
  Serial.print(MOTOR_STOP_LEVEL, 1);
  Serial.println("%");

  // Stop conditions (highest priority)
  if (currentLevel > MOTOR_STOP_LEVEL) {
    if (motorRunning) {
      Serial.println("==========================================");
      Serial.println("🛑 AUTO STOP TRIGGERED!");
      Serial.println("📈 REASON: Top tank level > 90% (overflow prevention)");
      Serial.println("🔄 ACTION: Sending STOP command to Sump ESP32");
      Serial.println("==========================================");
      sendMotorCommandToSump(false);
      motorRunning = false;
      Serial.println("✅ MOTOR STATUS UPDATED: STOPPED");
    } else {
      Serial.println("ℹ️  STATUS: Motor already stopped, no action needed");
    }
  }
  // Start conditions
  else if (currentLevel < MOTOR_START_LEVEL) {
    if (!motorRunning) {
      Serial.println("==========================================");
      Serial.println("🚀 AUTO START TRIGGERED!");
      Serial.println("📉 REASON: Top tank level < 30%");
      Serial.println("🔄 ACTION: Sending START command to Sump ESP32");
      Serial.println("==========================================");
      sendMotorCommandToSump(true);
      motorRunning = true;
      Serial.println("✅ MOTOR STATUS UPDATED: RUNNING");
    } else {
      Serial.println("ℹ️  STATUS: Motor already running, no action needed");
    }
  } else {
    Serial.println("⏸️  STATUS: Tank level in normal range - no motor action needed");
    Serial.print("📊 NORMAL RANGE: ");
    Serial.print(MOTOR_START_LEVEL, 1);
    Serial.print("% to ");
    Serial.print(MOTOR_STOP_LEVEL, 1);
    Serial.println("%");
  }

  Serial.println("==========================================");
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
      Serial.println("ALERT: CRITICAL: Top tank water level extremely low!");
    }
  } else if (level <= LOW_LEVEL_THRESHOLD) {
    newStatus = "warning";
    if (!lowLevelAlert) {
      lowLevelAlert = true;
      shouldAlert = true;
      Serial.println("WARNING: WARNING: Top tank water level getting low");
    }
  } else {
    if (lowLevelAlert || criticalLevelAlert) {
      Serial.println("SUCCESS: Top tank water level back to normal");
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
  Serial.println("==========================================");
  Serial.println("📡 TOP TANK ESP32 → BACKEND COMMUNICATION");
  Serial.println("==========================================");
  Serial.println("📊 SENDING: Sensor data to backend");
  Serial.print("🏷️  ESP32 ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("🏊 TANK TYPE: top_tank");
  Serial.print("📈 WATER LEVEL: ");
  Serial.print(currentLevel, 1);
  Serial.println("%");
  Serial.print("💧 WATER VOLUME: ");
  Serial.print(waterVolume, 1);
  Serial.println(" liters");
  Serial.print("📶 WIFI SIGNAL: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.print("⚡ MOTOR STATUS: ");
  Serial.println(motorRunning ? "RUNNING" : "STOPPED");
  Serial.print("🔗 CONNECTION STATE: ");
  Serial.println(getConnectionStateString());
  Serial.print("🖥️  BACKEND RESPONSIVE: ");
  Serial.println(backendResponsive ? "YES" : "NO");

  StaticJsonDocument<512> doc;
  StaticJsonDocument<512> payloadDoc;

  payloadDoc["tank_type"] = "top_tank";
  payloadDoc["level_percentage"] = currentLevel;
  payloadDoc["level_liters"] = waterVolume;
  payloadDoc["sensor_health"] = "good";
  payloadDoc["esp32_id"] = DEVICE_ID;
  payloadDoc["firmware_version"] = FIRMWARE_VERSION;
  payloadDoc["build_timestamp"] = BUILD_TIMESTAMP;
  payloadDoc["protocol_version"] = FW_PROTOCOL_VERSION;
  payloadDoc["battery_voltage"] = 3.3;
  payloadDoc["signal_strength"] = WiFi.RSSI();
  payloadDoc["motor_command_sent"] = motorRunning;
  payloadDoc["connection_state"] = getConnectionStateString();
  payloadDoc["backend_responsive"] = backendResponsive;

  doc["type"] = "sensor_data";
  doc["payload"] = payloadDoc;
  doc["protocol_version"] = FW_PROTOCOL_VERSION;

  // Wrap for HTTPS POST
  StaticJsonDocument<640> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "sensor_data";
  outer["data"] = doc; // doc has type + payload
  outer["protocol_version"] = FW_PROTOCOL_VERSION;
  String jsonBody; serializeJson(outer, jsonBody);
  if (!ensureTimeSynced()) {
    Serial.println("TIME: NTP sync failed, using millis-based fallback timestamp");
  }
  time_t epochNow = time(nullptr);
  String ts = String(epochNow >= 1700000000 ? epochNow : (millis()/1000));
  String sig = generateHMACSignatureTop(jsonBody, ts);

  Serial.println("📦 JSON PAYLOAD:");
  Serial.println(jsonString);
  Serial.println("📤 SENDING TO BACKEND...");

  if (postToBackendTop(jsonBody, FW_PATH_SENSOR_DATA, &ts, &sig)) {
    Serial.println("✅ SUCCESS: (HTTP) Sensor data sent to backend");
  } else {
    Serial.println("❌ ERROR: (HTTP) Failed to send sensor data - queued");
    topEnqueue(jsonString);
  }
  Serial.println("==========================================");
}

// Send ping to keep connection alive
void sendPing() {
  Serial.println("==========================================");
  Serial.println("🏓 TOP TANK ESP32 → BACKEND PING");
  Serial.println("==========================================");
  Serial.println("📡 SENDING: Ping to backend (keep-alive)");
  Serial.print("🏷️  ESP32 ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("⏰ TIMESTAMP: ");
  time_t epochPing = time(nullptr);
  Serial.println(epochPing >= 1700000000 ? epochPing : millis());

  StaticJsonDocument<64> inner;
  inner["type"] = "ping";
  inner["firmware_version"] = FIRMWARE_VERSION;
  inner["build_timestamp"] = BUILD_TIMESTAMP;
  StaticJsonDocument<160> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "ping";
  outer["data"] = inner;
  String jsonBody; serializeJson(outer, jsonBody);
  if (!ensureTimeSynced()) {
    Serial.println("TIME: NTP sync failed, using millis-based fallback timestamp (ping)");
  }
  time_t epochPingSig = time(nullptr);
  String ts = String(epochPingSig >= 1700000000 ? epochPingSig : (millis()/1000));
  String sig = generateHMACSignatureTop(jsonBody, ts);

  Serial.println("📦 PING PAYLOAD:");
  Serial.println(jsonString);
  Serial.println("📤 SENDING PING...");

  if (postToBackendTop(jsonBody, FW_PATH_HEARTBEAT, &ts, &sig)) {
    Serial.println("✅ SUCCESS: (HTTP) Ping sent to backend");
  } else {
    Serial.println("❌ ERROR: (HTTP) Ping failed - queued");
    topEnqueue(jsonString);
  }
  Serial.println("==========================================");
}

// ===== COMMAND POLLING REMOVED =====
void topPollCommands() { /* no-op: command polling removed after backend migration */ }
bool topAcknowledgeCommand(const String &commandId) { return true; }

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

        doc["type"] = "esp32_register";
        doc["esp32_id"] = DEVICE_ID;
        doc["device_type"] = DEVICE_TYPE;
  // doc["firmware_version"] = FIRMWARE_VERSION; // (legacy WS path deprecated)

        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("ANTENNA: Top Tank ESP32 registered with server");
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
            Serial.println("CLIPBOARD: Status sent on request");
          } else if (messageType == "acknowledge_alert") {
            Serial.println("SUCCESS: Alert acknowledged by server");
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
              Serial.println(" Connection stabilized - no unnecessary restarts");
            }

            Serial.println("GREEN: Heartbeat response confirmed - system healthy");
          }
        }
      }
      break;

    case WStype_ERROR:
      Serial.println("ERROR: WebSocket Error!");
      websocketConnected = false;
      backendResponsive = false;
      websocketErrorCount++;

      if (connectionState == STABLE) {
        connectionState = RECONNECTING;
      }

      Serial.print(" WebSocket error count: ");
      Serial.println(websocketErrorCount);
      break;
  }
}
*/

// Connect to WiFi with comprehensive error handling and retry logic
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("INFO: WiFi already connected");
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
    wifiReconnectAttempts = 0; // Reset counter on success
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
    wifiReconnectAttempts++;
  }
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize

  Serial.println("\nALERT: === CRASH-ONLY RESTART POLICY ACTIVE ===");
  Serial.println("SPEAKER: This ESP32 will ONLY restart on:");
  Serial.println("   - Actual crashes/panics");
  Serial.println("   - Power loss");
  Serial.println("   - Manual reset button");
  Serial.println("ERROR: Will NOT restart for:");
  Serial.println("   - Network disconnections");
  Serial.println("   - Backend unavailability");
  Serial.println("   - Watchdog initialization issues");
  Serial.println("=====================================\n");

  Serial.println("=== Aqua Guard Sense ESP32 Top Tank Monitor v2.0 (CRASH-ONLY) ===");
  Serial.println("START: ESP32 STARTUP - Device restarted or powered on");
  Serial.println("Top Tank Sensor: AJ-SR04M Ultrasonic Sensor (TRIG/ECHO)");
  Serial.println("Communication: WiFi + HTTPS POST to Backend + HTTP to Sump ESP32");
  Serial.print("Top Tank: Cylindrical, Diameter ");
  Serial.print(TANK_DIAMETER_CM);
  Serial.print("cm, Height ");
  Serial.print(TANK_HEIGHT_CM);
  Serial.println("cm (1000L Capacity)");

  Serial.println("\nWARNING:  IMPORTANT WIRING:");
  Serial.println("   TOP TANK AJ-SR04M:");
  Serial.println("   - TRIG -> ESP32 GPIO 5");
  Serial.println("   - ECHO -> ESP32 GPIO 18");
  Serial.println("   - GND -> ESP32 GND");
  Serial.println("   - VCC -> ESP32 5V");
  Serial.println("   ALERTS:");
  Serial.println("   - BUZZER -> ESP32 GPIO 14");
  Serial.println("   - LED -> ESP32 GPIO 15");
  Serial.println("   TANK SPECS:");
  Serial.print("   - Dimensions: Cylindrical, Diameter ");
  Serial.print(TANK_DIAMETER_CM);
  Serial.print("cm, Height ");
  Serial.print(TANK_HEIGHT_CM);
  Serial.println("cm");
  Serial.println("   - Capacity: 1,000 liters");
  Serial.println("   - Sensor: AJ-SR04M Ultrasonic (20cm minimum detection)");

  Serial.println("\nWARNING:  CRITICAL NOTES:");
  Serial.println("   - Sensor CANNOT detect below 20cm - readings will be wrong!");
  Serial.println("   - Motor commands sent to Sump ESP32 via HTTP");
  Serial.println("   - Update SUMP_ESP32_IP with actual Sump ESP32 IP address");
  Serial.println("   - FORBIDDEN: NO AUTO-RESTART POLICY: Only restarts on PANIC/CRASH");
  Serial.println("   - REFRESH: Only heartbeat sent to backend, no forced restarts");
  Serial.println("   - WATCHDOG: Watchdog timeout increased to 60s for stability");

  // Initialize pins
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("SUCCESS: Pins initialized");

  // Initialize Watchdog Timer - Handle already initialized case
  Serial.print("LOCK: Initializing Watchdog Timer (");
  Serial.print(WDT_TIMEOUT);
  Serial.println("s timeout)...");

  // Check if watchdog is already initialized (from previous restart)
  if (esp_task_wdt_status(NULL) == ESP_OK) {
    Serial.println("INFO: Watchdog already initialized - deinitializing first...");
    esp_task_wdt_delete(NULL); // Remove existing watchdog
    delay(100); // Small delay to ensure cleanup
  }

  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT * 1000,  // Convert to milliseconds
    .idle_core_mask = 0,               // No idle core monitoring
    .trigger_panic = true              // Enable panic reset
  };

  esp_err_t wdt_init_result = esp_task_wdt_init(&wdt_config);
  if (wdt_init_result == ESP_OK) {
    esp_task_wdt_add(NULL); // Add current task to watchdog
    Serial.println("SUCCESS: Watchdog Timer initialized successfully");
  } else {
    Serial.print("ERROR: Watchdog Timer initialization failed: ");
    Serial.println(wdt_init_result);
    Serial.println("ALERT: CRASH-ONLY POLICY: Continuing without watchdog (not restarting)");
  }

  startupTime = millis(); // Record startup time for crash-only policy
  lastWatchdogFeed = millis();

  // Prevent ESP32 from going to sleep
  Serial.println("COFFEE: Preventing ESP32 sleep mode...");
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  WiFi.setSleep(false);  // Disable WiFi sleep to maintain connection
  Serial.println("SUCCESS: Sleep prevention enabled");

  // Test sensors
  testAJ_SR04MCommunication();

  // Ensure outputs are off at startup
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  Serial.println("SUCCESS: Outputs set to OFF state");

  // Connect to WiFi
  Serial.println("\nREFRESH: Starting WiFi connection process...");
  connectToWiFi();

  // Verify WiFi connection
  if (wifiConnected) {
    Serial.println("SUCCESS: WiFi connection verified!");
  } else {
    Serial.println("ERROR: WiFi connection failed - check credentials and network");
  }

  // Poll for any commands targeting top tank (future extensibility)
  topPollCommands();

  // Using periodic HTTPS POST only (WebSocket removed)
  if (wifiConnected) {
  Serial.println("INFO: Skipping legacy socket init - using HTTP POST only");
    connectionState = CONNECTED; // Treat as connected for state tracking
  } else {
  Serial.println("ERROR: Cannot initialize network - WiFi not connected");
  }

  Serial.println("========== Setup Complete ==========");
  Serial.println("\nSTART: NEXT STEPS:");
  Serial.println("1. Check serial output for sensor test results");
  Serial.println("2. Monitor top tank levels every 3 seconds");
  Serial.println("3. Verify motor commands are sent to Sump ESP32 (192.168.0.184)");
  Serial.print("4. Tank: Cylindrical, Diameter ");
  Serial.print(TANK_DIAMETER_CM);
  Serial.print("cm, Height ");
  Serial.print(TANK_HEIGHT_CM);
  Serial.println("cm = 1,000L capacity");
  Serial.println("5. IMPORTANT: Sensor cannot detect below 20cm - expect wrong data!");
  Serial.println("6. ENHANCED: System will maintain connection without unnecessary restarts");
  Serial.println("7. Device ID: ESP32_TOP_002 - Top Tank Monitor (MAC: 6C:C8:40:4D:B8:3C)");
}

// ========== MAIN LOOP ==========
void loop() {
  // Feed watchdog timer periodically with enhanced safeguards
  if (millis() - lastWatchdogFeed > WATCHDOG_FEED_INTERVAL) {
    unsigned long uptime = millis() - startupTime;

    // Multiple safeguards to prevent infinite restart loops
    if (millis() - lastWatchdogFeed < 1000) {
      Serial.println("ALERT: WARNING: Watchdog being fed too frequently - possible infinite loop!");
      Serial.println("BULB: CRASH-ONLY POLICY: Not feeding watchdog to allow natural timeout if needed");
      Serial.print("DATA: Current uptime: ");
      Serial.print(uptime / 1000);
      Serial.println(" seconds");
      delay(2000); // Longer delay to break potential loops
      return; // Skip this iteration
    }

    // Be more cautious with watchdog operations during early startup
    if (uptime < MIN_UPTIME_BEFORE_WDT) {
      Serial.print("HOURGLASS: Early startup phase (");
      Serial.print(uptime / 1000);
      Serial.println("s) - being cautious with watchdog");
    }

    // Only feed if watchdog is properly initialized
    if (esp_task_wdt_status(NULL) == ESP_OK) {
      esp_err_t reset_result = esp_task_wdt_reset();
      if (reset_result == ESP_OK) {
        lastWatchdogFeed = millis();
        Serial.println("WATCHDOG: Watchdog fed - System healthy");
      } else {
        Serial.print("WARNING: Watchdog reset failed: ");
        Serial.println(reset_result);
        Serial.println("BULB: Continuing operation - CRASH-ONLY RESTART POLICY ACTIVE");
      }
    } else {
      // Only log watchdog inactive message once every 30 seconds to reduce spam
      static unsigned long lastWatchdogWarning = 0;
      if (millis() - lastWatchdogWarning > 30000) {
        Serial.println("WARNING: Watchdog not active - CRASH-ONLY RESTART POLICY: System will restart only on actual crash");
        lastWatchdogWarning = millis();
      }
    }
  }

  // (Socket loop removed) Using stateless HTTPS POST only

  // (Removed) Legacy socket status tracking

  // Read sensors periodically
  if (millis() - lastSensorRead > 3000) {
    float newLevel = readUltrasonicLevel();
    if (newLevel >= 0) {
      currentLevel = newLevel;
      waterVolume = calculateVolume(currentLevel);
      checkAlerts(currentLevel);

      // Debug output
      Serial.print("RULER: Top Tank Level: ");
      Serial.print(currentLevel, 1);
      Serial.print("% | Volume: ");
      Serial.print(waterVolume, 1);
      Serial.print("L | Distance: ");
      float distance = TANK_HEIGHT_CM - ((currentLevel / 100.0) * TANK_HEIGHT_CM);
      Serial.print(distance, 1);
      Serial.println(" cm");

      if (currentLevel > 80) {
        Serial.println("WARNING: CRITICAL: High water level - sensor cannot detect < 20cm!");
      }
    } else {
      Serial.println("ERROR: AJ-SR04M sensor error - invalid reading");
    }

    // Auto motor control (sends commands to Sump ESP32)
    autoMotorControl();

    lastSensorRead = millis();
  }

  // Send heartbeat and data with improved monitoring (NO AUTO RESTART)
  if (wifiConnected) {
    static unsigned long lastPing = 0;
    if (millis() - lastPing > 30000) {  // Ping every 30 seconds
      sendPing();
      lastPing = millis();
    }

    // More frequent heartbeat (every 30 seconds)
    if (millis() - lastHeartbeat > 30000) {
      sendSensorData();
      lastHeartbeat = millis();
      Serial.println("HEARTBEAT: Heartbeat sent - CRASH-ONLY RESTART POLICY ACTIVE");
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
  // (Removed) Legacy reconnection logic

  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println(" WiFi disconnected!");
      wifiConnected = false;
  // (Removed) websocketConnected flag update
      connectionState = DISCONNECTED;
    }
    connectToWiFi();
  }

  // Connection status monitoring - MORE FREQUENT for debugging
  static unsigned long lastStatusLog = 0;
  if (millis() - lastStatusLog > 10000) {  // Log status every 10 seconds (increased frequency)
    Serial.println("\n=== CONNECTION STATUS CHECK ===");
    Serial.print("DATA: WiFi Status: ");
    Serial.print(wifiConnected ? "SUCCESS: CONNECTED" : "ERROR: DISCONNECTED");
    Serial.print(" | IP: ");
    Serial.println(WiFi.localIP());
  Serial.print("DATA: Transport mode: HTTPS POST");
    Serial.print(websocketConnected ? "SUCCESS: CONNECTED" : "ERROR: DISCONNECTED");
    Serial.print(" | State: ");
    Serial.println(getConnectionStateString());
    Serial.print("DATA: Backend: ");
    Serial.print(backendResponsive ? "SUCCESS: RESPONSIVE" : "ERROR: NOT RESPONSIVE");
    Serial.print(" | Level: ");
    Serial.print(currentLevel, 1);
    Serial.println("%");
    Serial.println("===============================\n");
    lastStatusLog = millis();
  }  // Reconnect WebSocket if disconnected
  // (Removed) periodic WebSocket reconnection attempt

  // Reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi disconnected!");
      wifiConnected = false;
      websocketConnected = false;
    }
    connectToWiFi();
  }

  // Check for serial commands
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    if (command == "status" || command == "STATUS") {
      Serial.println("\n=== MANUAL STATUS CHECK ===");
      Serial.print("LINK: WiFi Connected: ");
      Serial.println(wifiConnected ? "YES" : "NO");
      Serial.print("WEB: IP Address: ");
      Serial.println(WiFi.localIP());
  // Serial.print("WEBSOCKET: WebSocket Connected: ");
      Serial.println(websocketConnected ? "YES" : "NO");
      Serial.print("ANTENNA: Backend Responsive: ");
      Serial.println(backendResponsive ? "YES" : "NO");
      Serial.print("DATA: Current Water Level: ");
      Serial.print(currentLevel, 1);
      Serial.println("%");
      Serial.print("TIMER:  Uptime: ");
      Serial.print((millis() - startupTime) / 1000);
      Serial.println(" seconds");
      Serial.print("WATCHDOG: Watchdog Status: ");
      Serial.println(esp_task_wdt_status(NULL) == ESP_OK ? "ACTIVE" : "INACTIVE");
      Serial.println("===========================\n");
    } else if (command == "wifi" || command == "WIFI") {
      Serial.println("\nREFRESH: Manual WiFi reconnection triggered...");
      wifiConnected = false;
      websocketConnected = false;
      connectionState = DISCONNECTED;
      WiFi.disconnect();
      delay(1000);
      connectToWiFi();
      Serial.println("SUCCESS: WiFi reconnection attempt completed\n");
    } else if (command == "help" || command == "HELP") {
      Serial.println("\n=== AVAILABLE COMMANDS ===");
      Serial.println("status    - Show current connection and sensor status");
      Serial.println("wifi      - Manually trigger WiFi reconnection");
      Serial.println("help      - Show this help message");
      Serial.println("=========================\n");
    }
  }

  // Process queued messages for resend
  processTopQueue();
}
