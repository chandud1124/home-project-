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

// All configuration now comes from esp32_config.h
// Previous Express API deprecated in favor of Supabase Edge Functions.
// Backend configuration uses defines directly from esp32_config.h
// API Paths (updated for Supabase functions)
#include "firmware_common.h"
// Legacy Express constants removed (device now posts directly to Supabase functions)

// Firmware Metadata
#define FIRMWARE_VERSION "2.1.0"
#define BUILD_TIMESTAMP __DATE__ " " __TIME__

// Device Configuration
const char* DEVICE_TYPE = "sump_tank_controller";
// Use defines directly from esp32_config.h (no variable redeclaration needed)

// Root CA certificate (Let's Encrypt ISRG Root X1) for validating Supabase TLS (full chain entry)
// Source: https://letsencrypt.org/certificates/ (ISRG Root X1 PEM)
const char* ISRG_ROOT_X1 = "-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgISA5VKZU2CrP8Gr3HdWu3UwLrhMA0GCSqGSIb3DQEBCwUA\n"
"MEoxCzAJBgNVBAYTAlVTMRMwEQYDVQQKEwpMZXQncyBFbmNyeXB0MSMwIQYDVQQD\n"
"ExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBSNCBDQTAeFw0yMDA2MDQxNzIzMDBa\n"
"Fw0yNTA2MDQxNzIzMDBaMEoxCzAJBgNVBAYTAlVTMRMwEQYDVQQKEwpMZXQncyBF\n"
"bmNyeXB0MSMwIQYDVQQDExpMZXQncyBFbmNyeXB0IEF1dGhvcml0eSBSNCBDQTCC\n"
"ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL9Hf1W3W1Oj4rNQz5f4zJ8L\n"
"O9qkHn8z6n7FL2W3LfD9nMfKt8XHgHFg9a9hUQ3j5L0K7dK7o8zqGzH4fM8rUo5l\n"
"R1OVF5NQ0L78Z9YxDEIHhKoKmQ5bU6v3+TxFnmJHouUlGsI80LmP2tFRgDmkLQqr\n"
"B+5jcI4wYJiIcxkVz4zd+/sGR2M9dt1vxPiQX8TecJcMfwIDAQABo0IwQDAOBgNV\n"
"HQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUk2+1J9lPuG42\n"
"B7HlYRg3Qnq43wwwDQYJKoZIhvcNAQELBQADggEBAFLEzmVQeQmcsGZJKA8j5Kzf\n"
"2cqB99Zn5pv4T/6QTPm2x5UKvbP8fSgra0E4Zl0ykwS0Zkix1sZ+pp33z0q0hxIh\n"
"P8oup2AJXHDvLsQoc5sn694B49pHQuLhaiqF98aZk1Y/tFPpef8p1sJj4nEUAdxg\n"
"5zpt9/tri9H7z917ZQiO6PppBtCXOpkYG/r1mARr9Kfi2OPFfQnhIvrUMQ==\n"
"-----END CERTIFICATE-----\n";

// Optional: enable an insecure retry (for diagnostics only). Set to 0 to disable.
#define ENABLE_INSECURE_RETRY 1

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
void sendHeartbeatAck();
void sendSystemAlert(String alertType, String message);
String generateHMACSignature(String payload, String timestamp);
void sendTankReading();
void updateLedIndicators();
void readModeSwitch();
void readManualMotorSwitch();

// Connection management helper functions
String getConnectionStateString();
unsigned long calculateReconnectDelay();
// void attemptWebSocketReconnection(); // Removed - using HTTPS POST instead

// Forward declarations for functions used before definition
void logEvent(String event, String details);
uint32_t calculateChecksum(String payload);
bool validateTimeSync();
void syncNTPTime();
void checkBrownOut();

// ========== LIBRARIES ==========
#include <WiFi.h>
// (WebSocket client removed – using stateless HTTPS POST only)
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>  // Added for HTTPS connections
#include <WebServer.h>
#include <esp_task_wdt.h>  // ESP32 Watchdog Timer
#include <mbedtls/md.h>    // For HMAC-SHA256
#include <mbedtls/sha256.h>
#include <time.h>           // NTP time sync

// ========== NTP CONFIGURATION ==========
const char* NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 0;     // UTC
const int DAYLIGHT_OFFSET_SEC = 0; // No daylight saving
unsigned long lastNtpSync = 0;
const unsigned long NTP_SYNC_INTERVAL = 3600000; // 1 hour

// ========== EVENT LOGGING RING BUFFER ==========
#define LOG_BUFFER_SIZE 50
struct LogEntry {
  unsigned long timestamp;
  String event;
  String details;
};
LogEntry eventLog[LOG_BUFFER_SIZE];
int logIndex = 0;
bool logWrapped = false;

// ========== CHECKSUM CONFIGURATION ==========
#define PAYLOAD_CHECKSUM_SEED 0xDEADBEEF

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
// (Removed WebSocket client placeholder)
WebServer server(HTTP_PORT);
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool wifiConnected = false;
// (Removed websocketConnected flag)

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
// (Removed legacy WebSocket error counters)
int wifiReconnectAttempts = 0;
unsigned long lastWifiReconnectAttempt = 0;
// (Removed lastWebsocketReconnectAttempt)

// WiFi stability monitoring
unsigned long wifiLastConnectedTime = 0;
bool wifiConnectionStable = false;
const unsigned long WIFI_STABILITY_CHECK_TIME = 10000; // 10 seconds to confirm stable connection

// Sensor data batching configuration
const unsigned long SENSOR_READ_INTERVAL = 5000;     // Read sensors every 5 seconds
const unsigned long BATCH_SEND_INTERVAL = 60000;     // Send batched data every 60 seconds
const float LEVEL_CHANGE_THRESHOLD = 1.0;            // Only send if level changed by 1% or more
unsigned long lastBatchSend = 0;
float lastSentSumpLevel = -1.0;                       // Track last sent level
bool hasSignificantChange = false;                    // Flag for significant changes

// Alert debouncing
const unsigned long ALERT_DEBOUNCE_TIME = 300000;    // 5 minutes between identical alerts
unsigned long lastLowLevelAlert = 0;
unsigned long lastCriticalLevelAlert = 0;
unsigned long lastMotorSafetyAlert = 0;

// Heartbeat and keep-alive variables (IMPROVED - No auto restart)
unsigned long lastHeartbeatResponse = 0;
int heartbeatMissedCount = 0;
const unsigned long HEARTBEAT_TIMEOUT = 120000; // 2 minutes timeout for heartbeat response
bool backendResponsive = true;

// Command polling
unsigned long lastCommandPoll = 0;
const unsigned long COMMAND_POLL_INTERVAL = 10000; // 10s

void pollCommands();
bool acknowledgeCommand(const String &commandId);

// ========== OFFLINE MESSAGE QUEUE (NEW) ==========
// Stores outbound JSON payloads when immediate POST fails (e.g., WiFi down or backend unreachable)
struct QueuedMessage {
  String payload;            // Raw JSON payload to POST
  uint8_t attempts;          // How many send attempts have been made
  unsigned long nextAttempt; // millis() after which we try again
};

const int MESSAGE_QUEUE_CAPACITY = 20;              // Max queued messages
const uint8_t QUEUE_MAX_ATTEMPTS = 8;               // Drop after this many tries
const unsigned long QUEUE_BASE_RETRY_DELAY = 5000;  // 5s initial
const unsigned long QUEUE_MAX_RETRY_DELAY = 300000; // 5 min cap

QueuedMessage messageQueue[MESSAGE_QUEUE_CAPACITY];
int queueCount = 0; // Number of active (non-empty) entries

// Helper: compute delay with exponential backoff (capped)
unsigned long computeBackoff(uint8_t attempts) {
  // attempts starts at 0 for first failure -> delay = base * 2^attempts
  unsigned long factor = 1UL << attempts; // 2^attempts
  unsigned long delayMs = QUEUE_BASE_RETRY_DELAY * factor;
  if (delayMs > QUEUE_MAX_RETRY_DELAY) delayMs = QUEUE_MAX_RETRY_DELAY;
  return delayMs;
}

bool enqueueMessage(const String &payload) {
  if (queueCount >= MESSAGE_QUEUE_CAPACITY) {
    // Simple policy: drop oldest (first with highest attempts) when full
    Serial.println("QUEUE: Full - dropping oldest message");
    int dropIndex = -1;
    unsigned long oldestNext = ULONG_MAX;
    for (int i = 0; i < MESSAGE_QUEUE_CAPACITY; i++) {
      if (messageQueue[i].payload.length() > 0 && messageQueue[i].nextAttempt < oldestNext) {
        oldestNext = messageQueue[i].nextAttempt;
        dropIndex = i;
      }
    }
    if (dropIndex >= 0) {
      messageQueue[dropIndex].payload = ""; // Mark empty
      queueCount--;
    }
  }

  // Find empty slot
  for (int i = 0; i < MESSAGE_QUEUE_CAPACITY; i++) {
    if (messageQueue[i].payload.length() == 0) {
      messageQueue[i].payload = payload;
      messageQueue[i].attempts = 0;
      messageQueue[i].nextAttempt = millis(); // eligible immediately
      queueCount++;
      Serial.print("QUEUE: Enqueued message. Queue size=");
      Serial.println(queueCount);
      return true;
    }
  }
  Serial.println("QUEUE: Failed to enqueue (no slot even after drop)");
  return false; // Should not normally happen
}

void processMessageQueue() {
  if (queueCount == 0) return; // Nothing to do
  unsigned long now = millis();
  for (int i = 0; i < MESSAGE_QUEUE_CAPACITY; i++) {
    if (messageQueue[i].payload.length() == 0) continue; // Empty slot
    if (messageQueue[i].attempts >= QUEUE_MAX_ATTEMPTS) {
      Serial.println("QUEUE: Dropping message after max attempts");
      messageQueue[i].payload = "";
      queueCount--;
      continue;
    }
    if (now < messageQueue[i].nextAttempt) continue; // Not yet time

    // Attempt resend
    Serial.print("QUEUE: Attempting resend (attempt ");
    Serial.print(messageQueue[i].attempts + 1);
    Serial.println(")");
  bool ok = postToBackend(messageQueue[i].payload, FW_PATH_SENSOR_DATA);
    if (ok) {
      Serial.println("QUEUE: Resend success - removing message");
      messageQueue[i].payload = "";
      queueCount--;
    } else {
      messageQueue[i].attempts++;
      unsigned long backoff = computeBackoff(messageQueue[i].attempts);
      messageQueue[i].nextAttempt = now + backoff;
      Serial.print("QUEUE: Resend failed - backoff ms=");
      Serial.println(backoff);
    }
  }
}

int getQueueSize() { return queueCount; }

// ========== HTTPS POST HELPER (NEW) ==========
// Sends a JSON payload to the Supabase Edge Function using HTTPS POST.
// Automatically injects the required Authorization header and expects
// the caller to have already wrapped the message with { apikey, type, data }.
bool postToBackend(const String &jsonPayload, const char* path) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("HTTP: WiFi not connected, cannot POST");
    return false;
  }

  Serial.print("HTTP: Attempting to connect to backend: ");
  Serial.println(String(BACKEND_HOST) + String(path));

  int attempt = 0;
  const int maxAttempts = 2; // primary + optional insecure
  while (attempt < maxAttempts) {
    WiFiClientSecure client;
    if (attempt == 0) {
      if (BACKEND_USE_TLS) client.setCACert(ISRG_ROOT_X1);
    } else {
#if ENABLE_INSECURE_RETRY
      Serial.println("HTTP: Retrying with INSECURE TLS (diagnostic) – DO NOT use in production long-term");
      client.setInsecure();
#else
      break; // don't attempt insecure if disabled
#endif
    }

    HTTPClient https;
    https.setTimeout(8000);
    String scheme = BACKEND_USE_TLS ? "https://" : "http://";
    String url = scheme + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + String(path);
    Serial.print("HTTP: Full URL: ");
    Serial.println(url);

    if (!(BACKEND_USE_TLS ? https.begin(client, url) : https.begin(url))) {
      Serial.println("HTTP: Failed to begin HTTPS connection");
      attempt++;
      continue;
    }

    https.addHeader("Content-Type", "application/json");
    https.addHeader("Authorization", "Bearer " + String(DEVICE_API_KEY));
    https.addHeader("x-device-id", DEVICE_ID);
    https.addHeader("Accept", "application/json");

    Serial.println("HTTP: Sending POST request...");
    int status = https.POST(jsonPayload);
    Serial.print("HTTP: Response status: ");
    Serial.println(status);

    if (status <= 0) {
      Serial.print("HTTP: POST failed: ");
      Serial.println(https.errorToString(status));
      https.end();
      attempt++;
      if (attempt < maxAttempts) {
        delay(250); // small pause before retry
        continue;
      }
      return false;
    }

  Serial.print("HTTP: POST status ");
    Serial.println(status);
    if (status != 200) {
      Serial.print("HTTP: Non-200 response body: ");
      Serial.println(https.getString());
    } else {
      Serial.println("HTTP: Success! Backend connection established.");
    }
    https.end();
    return status == 200;
  }
  Serial.println("HTTP: All connection attempts failed");
  return false; // should not reach
}

// New variant with HMAC headers (preferred going forward)
bool postToBackendWithAuth(const String &jsonPayload, const char* path, const String &timestamp, const String &signature) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("HTTP: WiFi not connected (auth variant)");
    return false;
  }
  WiFiClientSecure client;
  client.setCACert(ISRG_ROOT_X1);
  HTTPClient https;
  String scheme = BACKEND_USE_TLS ? "https://" : "http://";
  String url = scheme + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + String(path);
  if (!https.begin(client, url)) {
    Serial.println("HTTP: begin failed (auth)");
    return false;
  }
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", "Bearer " + String(DEVICE_API_KEY));
  https.addHeader("x-device-id", DEVICE_ID);
  https.addHeader("x-timestamp", timestamp);
  https.addHeader("x-signature", signature);
  int code = https.POST(jsonPayload);
  if (code != 200) {
    Serial.print("HTTP: auth send failed code="); Serial.println(code);
  }
  https.end();
  return code == 200;
}

// Alert states
bool lowLevelAlert = false;
bool criticalLevelAlert = false;
bool motorSafetyAlert = false;

// Alert debouncing timestamps
unsigned long lastWarningAlertTime = 0;
unsigned long lastCriticalAlertTime = 0;
unsigned long lastMotorSafetyAlertTime = 0;

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

  // Get current time for debouncing
  unsigned long currentTime = millis();

  if (level >= 90.0) { // Sump filled alert
    newStatus = "critical";
    if (!criticalLevelAlert && (currentTime - lastCriticalAlertTime >= ALERT_DEBOUNCE_TIME)) {
      criticalLevelAlert = true;
      lastCriticalAlertTime = currentTime;
      shouldAlert = true;
      Serial.println("ALERT: CRITICAL: Sump tank filled to 90%!");
      sendSystemAlert("sump_filled", "Sump tank is completely filled - Buzzer activated 5 times");
    }
  } else if (level >= 85.0) { // Sump 90% alert
    newStatus = "warning";
    if (!lowLevelAlert && (currentTime - lastWarningAlertTime >= ALERT_DEBOUNCE_TIME)) {
      lowLevelAlert = true;
      lastWarningAlertTime = currentTime;
      shouldAlert = true;
      Serial.println("WARNING: WARNING: Sump tank reached 90% capacity");
      sendSystemAlert("sump_90_percent", "Sump tank reached 90% capacity - Buzzer activated");
    }
  } else if (level <= SUMP_CRITICAL_LEVEL) {
    newStatus = "critical";
    if (!criticalLevelAlert && (currentTime - lastCriticalAlertTime >= ALERT_DEBOUNCE_TIME)) {
      criticalLevelAlert = true;
      lastCriticalAlertTime = currentTime;
      shouldAlert = true;
      Serial.println("ALERT: CRITICAL: Sump tank water level extremely low!");
    }
  } else if (level <= 20.0) { // Low level threshold
    newStatus = "warning";
    if (!lowLevelAlert && (currentTime - lastWarningAlertTime >= ALERT_DEBOUNCE_TIME)) {
      lowLevelAlert = true;
      lastWarningAlertTime = currentTime;
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
    if (currentTime - lastMotorSafetyAlertTime >= ALERT_DEBOUNCE_TIME) {
      lastMotorSafetyAlertTime = currentTime;
      shouldAlert = true;
      Serial.println("ALERT: MOTOR SAFETY ALERT: Motor operation blocked!");
    }
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
  // Validate time sync before sending
  if (!validateTimeSync()) {
    syncNTPTime();
    if (!validateTimeSync()) {
      logEvent("TIME_SYNC_FAILED", "Skipping sensor data send due to invalid time");
      return;
    }
  }

  StaticJsonDocument<512> doc;
  StaticJsonDocument<512> payloadDoc;
  StaticJsonDocument<1024> outer;

  payloadDoc["tank_type"] = "sump_tank";
  payloadDoc["level_percentage"] = sumpLevel;
  payloadDoc["level_liters"] = sumpVolume;
  payloadDoc["sensor_health"] = "good";
  payloadDoc["esp32_id"] = DEVICE_ID;
  payloadDoc["firmware_version"] = FIRMWARE_VERSION;
  payloadDoc["build_timestamp"] = BUILD_TIMESTAMP;
  payloadDoc["protocol_version"] = FW_PROTOCOL_VERSION;
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
  doc["protocol_version"] = FW_PROTOCOL_VERSION; // duplicate at wrapper for backend convenience

  // Use device-specific authentication
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "sensor_data";
  outer["data"] = payloadDoc; // Send payload directly instead of wrapped doc
  outer["protocol_version"] = FW_PROTOCOL_VERSION;
  outer["timestamp"] = millis();
  outer["tank_type"] = "sump_tank";
  outer["level_percentage"] = sumpLevel;
  outer["level_liters"] = sumpVolume;
  outer["sensor_health"] = "good";
  outer["esp32_id"] = DEVICE_ID;
  outer["firmware_version"] = FIRMWARE_VERSION;
  outer["build_timestamp"] = BUILD_TIMESTAMP;
  String jsonString;
  serializeJson(outer, jsonString);
  
  // Add checksum
  uint32_t checksum = calculateChecksum(jsonString);
  outer["checksum"] = checksum;
  
  // Compute HMAC but send via headers; keep body lean
  String timestamp = String(millis()/1000); // seconds epoch for backend tolerance
  String signature = generateHMACSignature(jsonString, timestamp);
  Serial.println("DATA: Attempting to send sensor data to backend...");
  // Try without auth first to test basic connectivity
  if (postToBackend(jsonString, FW_PATH_SENSOR_DATA)) {
    Serial.println("DATA: (HTTP) Sump sensor data sent - Level: " + String(sumpLevel, 1) + "%, Motor: " + motorStatus);
    logEvent("SENSOR_DATA_SENT", "Sensor data sent successfully with checksum: " + String(checksum) + " and HMAC signature");
    
    // Send heartbeat ACK after successful sensor data transmission
    sendHeartbeatAck();
  } else {
    Serial.println("DATA: (HTTP) Failed to send sump sensor data - Backend connection issue");
    logEvent("SENSOR_DATA_FAILED", "Failed to send sensor data");
    enqueueMessage(jsonString);
  }
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
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["build_timestamp"] = BUILD_TIMESTAMP;
  doc["timestamp"] = millis();
  doc["protocol_version"] = FW_PROTOCOL_VERSION;

  StaticJsonDocument<384> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "tank_reading";
  outer["data"] = doc;
  outer["protocol_version"] = FW_PROTOCOL_VERSION;
  String jsonString;
  serializeJson(outer, jsonString);
  // Add HMAC signature (optional for compatibility)
  String timestamp = String(millis());
  outer["timestamp"] = timestamp;
  String signature = generateHMACSignature(jsonString, timestamp);
  outer["hmac_signature"] = signature;
  jsonString = "";
  serializeJson(outer, jsonString);
  if (postToBackend(jsonString, FW_PATH_SENSOR_DATA)) {
    Serial.println("DATA: (HTTP) Sump tank reading sent - Level: " + String(sumpLevel, 1) + "% (HMAC)");
  } else {
    Serial.println("DATA: (HTTP) Failed to send tank reading");
    enqueueMessage(jsonString);
  }
}

// Send motor status to server
void sendMotorStatus() {
  StaticJsonDocument<256> doc;
  doc["type"] = "motor_status";
  doc["esp32_id"] = DEVICE_ID;
  doc["motor_running"] = motorRunning;
  doc["motor_status"] = motorStatus;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["build_timestamp"] = BUILD_TIMESTAMP;
  doc["auto_mode"] = autoModeEnabled;
  doc["manual_override"] = manualOverride;
  doc["runtime_seconds"] = motorRunning ? (millis() - motorStartTime) / 1000 : 0;
  doc["safety_alert"] = motorSafetyAlert;

  StaticJsonDocument<384> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "motor_status";
  outer["data"] = doc;
  String jsonString;
  serializeJson(outer, jsonString);
  String timestamp = String(millis());
  outer["timestamp"] = timestamp;
  String signature = generateHMACSignature(jsonString, timestamp);
  outer["hmac_signature"] = signature;
  jsonString = "";
  serializeJson(outer, jsonString);
  if (postToBackend(jsonString, FW_PATH_MOTOR_STATUS)) {
    Serial.print("DATA: (HTTP) Motor status sent (HMAC): ");
    Serial.println(motorStatus);
  } else {
    Serial.println("DATA: (HTTP) Failed to send motor status");
    enqueueMessage(jsonString);
  }
}

// Send system alert to server
void sendSystemAlert(String alertType, String message) {
  StaticJsonDocument<256> doc;
  doc["type"] = "system_alert";
  doc["alert_type"] = alertType;
  doc["message"] = message;
  doc["esp32_id"] = DEVICE_ID;
  doc["level_percentage"] = sumpLevel;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["build_timestamp"] = BUILD_TIMESTAMP;
  doc["timestamp"] = millis();

  StaticJsonDocument<384> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "system_alert";
  outer["data"] = doc;
  String jsonString;
  serializeJson(outer, jsonString);
  String timestamp = String(millis());
  outer["timestamp"] = timestamp;
  String signature = generateHMACSignature(jsonString, timestamp);
  outer["hmac_signature"] = signature;
  jsonString = "";
  serializeJson(outer, jsonString);
  if (postToBackend(jsonString, FW_PATH_SYSTEM_ALERT)) { // dedicated system alert endpoint
    Serial.print("ALERT: (HTTP) System alert sent (HMAC): ");
    Serial.println(alertType);
  } else {
    Serial.println("ALERT: (HTTP) Failed to send system alert");
    enqueueMessage(jsonString);
  }
}

// Send ping (health) message
void sendPing() {
  StaticJsonDocument<192> doc;
  doc["type"] = "heartbeat";
  doc["device_id"] = DEVICE_ID;
  doc["heartbeat_type"] = "ping";
  doc["uptime_ms"] = millis();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["queue_size"] = getQueueSize();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["build_timestamp"] = BUILD_TIMESTAMP;

  StaticJsonDocument<256> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "heartbeat";
  outer["heartbeat_type"] = "ping";
  outer["metadata"] = doc;
  
  String jsonString;
  serializeJson(outer, jsonString);
  
  String timestamp = String(millis()/1000);
  String signature = generateHMACSignature(jsonString, timestamp);
  if (!postToBackendWithAuth(jsonString, FW_PATH_SENSOR_DATA, timestamp, signature)) {
    enqueueMessage(jsonString);
  }
}

// Send heartbeat ACK after successful operations
void sendHeartbeatAck() {
  StaticJsonDocument<128> doc;
  doc["type"] = "heartbeat";
  doc["device_id"] = DEVICE_ID;
  doc["heartbeat_type"] = "pong";
  doc["uptime_ms"] = millis();

  StaticJsonDocument<192> outer;
  outer["apikey"] = DEVICE_API_KEY;
  outer["device_id"] = DEVICE_ID;
  outer["type"] = "heartbeat";
  outer["heartbeat_type"] = "pong";
  outer["metadata"] = doc;
  
  String jsonString;
  serializeJson(outer, jsonString);
  
  String timestamp = String(millis()/1000);
  String signature = generateHMACSignature(jsonString, timestamp);
  if (!postToBackendWithAuth(jsonString, FW_PATH_SENSOR_DATA, timestamp, signature)) {
    enqueueMessage(jsonString);
  }
}

// ========== COMMAND POLLING ==========
// (Legacy command polling removed)

// (Legacy WebSocket handler removed - using HTTPS POST instead)

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
  
  // Check for brown-out reset
  checkBrownOut();
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

  // Sync NTP time
  if (wifiConnected) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    syncNTPTime();
  }

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
  // (Removed) WebSocket initialization skipped - using HTTPS POST only

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

  // webSocket.loop(); // (Removed) No WebSocket usage
  server.handleClient();

  // Read sensors and controls periodically
  if (millis() - lastSensorRead > SENSOR_READ_INTERVAL) {
    // Feed watchdog before sensor reading
    esp_task_wdt_reset();
    Serial.println("WATCHDOG: Watchdog fed before sensor reading");

    // Read sump tank level
    float newLevel = readSumpUltrasonicLevel();
    if (newLevel >= 0) {
      sumpLevel = newLevel;
      sumpVolume = calculateSumpVolume(sumpLevel);
      
      // Check for significant level change
      if (lastSentSumpLevel < 0 || abs(sumpLevel - lastSentSumpLevel) >= LEVEL_CHANGE_THRESHOLD) {
        hasSignificantChange = true;
        Serial.print("BATCH: Significant level change detected: ");
        Serial.print(abs(sumpLevel - lastSentSumpLevel), 1);
        Serial.println("%");
      }
      
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

  // Send heartbeat and batched data with improved monitoring
  // Heartbeat & periodic data (use WiFi connection as gate)
  if (wifiConnected) {
    static unsigned long lastPing = 0;
    if (millis() - lastPing > 30000) {  // Ping every 30 seconds
      sendPing();
      lastPing = millis();
    }

    // Send batched sensor data (every 60 seconds OR on significant change)
    if ((millis() - lastBatchSend > BATCH_SEND_INTERVAL) || 
        (hasSignificantChange && millis() - lastBatchSend > 10000)) {  // Min 10s between sends for changes
      
      // Feed watchdog before sending data
      esp_task_wdt_reset();
      Serial.println("WATCHDOG: Watchdog fed before batched data send");

      sendSensorData();
      sendTankReading(); // Send tank reading for frontend compatibility
      
      // Update batch tracking
      lastSentSumpLevel = sumpLevel;
      hasSignificantChange = false;
      lastBatchSend = millis();
      
      Serial.print("BATCH: Sensor data sent - Level: ");
      Serial.print(sumpLevel, 1);
      Serial.println("%");
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

  // (Removed) Smart reconnection logic for WebSocket - not applicable

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
      // websocketConnected = false; // Disabled: using HTTPS POST
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
      // websocketConnected = false; // Disabled: using HTTPS POST
    }
  }

  // Connection status monitoring
  static unsigned long lastStatusLog = 0;
  if (millis() - lastStatusLog > 60000) {  // Log status every minute
    Serial.print("DATA: Status: WiFi=");
    Serial.print(wifiConnected ? "SUCCESS:" : "ERROR:");
    Serial.print(" | HTTPS=");
    Serial.print("ACTIVE"); // HTTPS POST is always active when WiFi is connected
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

  // Process offline queue (try resends)
  processMessageQueue();

  // Command polling removed - using HTTPS POST instead of WebSocket
  // pollCommands();
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

// ========== FIRMWARE HARDENING FUNCTIONS ==========

// Event logging ring buffer
void logEvent(String event, String details) {
  eventLog[logIndex].timestamp = millis();
  eventLog[logIndex].event = event;
  eventLog[logIndex].details = details;
  logIndex = (logIndex + 1) % LOG_BUFFER_SIZE;
  if (logIndex == 0) logWrapped = true;
  
  Serial.print("LOG: ");
  Serial.print(event);
  Serial.print(" - ");
  Serial.println(details);
}

// Simple checksum calculation
uint32_t calculateChecksum(String payload) {
  uint32_t checksum = PAYLOAD_CHECKSUM_SEED;
  for (size_t i = 0; i < payload.length(); i++) {
    checksum = (checksum << 5) + checksum + payload[i];
  }
  return checksum;
}

// Generate HMAC-SHA256 signature for authentication
String generateHMACSignature(String payload, String timestamp) {
  String message = String(DEVICE_ID) + payload + timestamp;

  // Use mbedTLS for HMAC-SHA256
  const size_t key_len = strlen(DEVICE_HMAC_SECRET);
  const size_t msg_len = message.length();

  unsigned char hmac_result[32]; // SHA256 produces 32 bytes

  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1); // 1 for HMAC
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)DEVICE_HMAC_SECRET, key_len);
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), msg_len);
  mbedtls_md_hmac_finish(&ctx, hmac_result);
  mbedtls_md_free(&ctx);

  // Convert to hex string
  String signature = "";
  for (int i = 0; i < 32; i++) {
    char hex[3];
    sprintf(hex, "%02x", hmac_result[i]);
    signature += hex;
  }

  return signature;
}

// NTP time sync validation
bool validateTimeSync() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("ERROR: NTP time sync failed - cannot get local time");
    return false;
  }
  
  // Check if time is reasonable (not 1970)
  time_t now = mktime(&timeinfo);
  if (now < 1609459200) { // Jan 1, 2021
    Serial.println("ERROR: NTP time appears invalid (too old)");
    return false;
  }
  
  return true;
}

// NTP time synchronization
void syncNTPTime() {
  if (millis() - lastNtpSync < NTP_SYNC_INTERVAL && lastNtpSync > 0) {
    return; // Don't sync too frequently
  }
  
  Serial.println("NTP: Synchronizing time...");
  struct tm timeinfo;
  
  if (getLocalTime(&timeinfo)) {
    Serial.print("NTP: Time synchronized: ");
    Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");
    lastNtpSync = millis();
    logEvent("NTP_SYNC", "Time synchronized successfully");
  } else {
    Serial.println("ERROR: NTP time sync failed");
    logEvent("NTP_ERROR", "Failed to synchronize time");
  }
}

// Brown-out detection and logging
void checkBrownOut() {
  // ESP32 brown-out detection
  if (esp_reset_reason() == ESP_RST_BROWNOUT) {
    logEvent("BROWNOUT", "Brown-out reset detected");
    Serial.println("ALERT: Brown-out reset detected - logging event");
  }
}

// Connection state string helper
String getConnectionStateString() {
  switch (connectionState) {
    case DISCONNECTED:
      return "disconnected";
    case CONNECTING:
      return "connecting";
    case CONNECTED:
      return "connected";
    case RECONNECTING:
      return "reconnecting";
    case STABLE:
      return "stable";
    default:
      return "unknown";
  }
}
