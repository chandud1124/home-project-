/*
 * AquaGuard - ESP32 Sump Tank Controller (Enhanced)
 * Complete hybrid system with backend communication and local control
 * 
 * Enhanced Features:
 * - Robust heartbeat system with backend health monitoring
 * - Smart restart logic (panic mode only, not WiFi disconnection)
 * - Daily automatic restart at 2:00 AM
 * - Safe relay handling during restart
 * - Comprehensive error detection and recovery
 * - Hybrid connectivity (backend + local ESP32-to-ESP32)
 * 
 * Hardware:
 * - Ultrasonic sensor (TRIG=5, ECHO=18)
 * - Float switch safety (GPIO 4) 
 * - Motor relay control (GPIO 13)
 * - LED indicators and buzzer alarm
 * - Manual switches for override control
 * 
 * Tank: Rectangular 230×230×250cm (1322L capacity)
 */

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <time.h>

// ========== DEVICE CONFIGURATION ==========
#define DEVICE_ID "SUMP_TANK"
#define DEVICE_NAME "Sump Tank"

// ========== WIFI CONFIGURATION ==========
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ========== BACKEND CONFIGURATION ==========
#define BACKEND_HOST "192.168.0.108"  // Your backend server IP (actual computer IP)
#define BACKEND_PORT 3001
#define BACKEND_USE_HTTPS false
#define BACKEND_ENABLED true

// ========== AUTHENTICATION ==========
#define DEVICE_API_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"
#define DEVICE_HMAC_SECRET "c2858fe0513830bfe988a46e8162d9ef6fec933758156a901a41012afde8bb5b7fa1cee9e677cbe72aa0e84a4b4c72aabf8f33ad1d989ba4b69ca9e1b1e1e0c2"

// ========== HARDWARE PINS ==========
#define TRIG_PIN 5
#define ECHO_PIN 18
#define FLOAT_SWITCH_PIN 4
#define MOTOR_RELAY_PIN 13
#define BUZZER_PIN 14
#define AUTO_MODE_LED_PIN 16
#define SUMP_FULL_LED_PIN 17
#define SUMP_LOW_LED_PIN 21
#define MANUAL_MOTOR_SWITCH_PIN 25
#define MODE_SWITCH_PIN 26

// ========== RELAY CONFIGURATION ==========
// Set to true if your relay module is ACTIVE LOW (LOW = ON, HIGH = OFF)
// Set to false if your relay module is ACTIVE HIGH (HIGH = ON, LOW = OFF)
#define RELAY_ACTIVE_LOW true

#define RELAY_ON (RELAY_ACTIVE_LOW ? LOW : HIGH)
#define RELAY_OFF (RELAY_ACTIVE_LOW ? HIGH : LOW)

// ========== TANK CONFIGURATION ==========
#define TANK_HEIGHT_CM 250.0
#define TANK_LENGTH_CM 230.0
#define TANK_WIDTH_CM 230.0
#define TANK_CAPACITY_LITERS 1322.5
#define SENSOR_OFFSET_CM 10.0

// ========== CONTROL LEVELS ==========
#define SUMP_LOW_LEVEL 25.0
#define SUMP_HIGH_LEVEL 85.0
#define SUMP_CRITICAL_LEVEL 90.0
#define AUTO_START_LEVEL 75.0
#define AUTO_STOP_LEVEL 25.0

// ========== TIMING CONFIGURATION ==========
#define SENSOR_READ_INTERVAL 2000
#define HEARTBEAT_INTERVAL 30000      // Send heartbeat every 30 seconds
#define BACKEND_CHECK_INTERVAL 60000  // Check backend every 60 seconds
#define STATUS_REPORT_INTERVAL 30000  // Report status every 30 seconds
#define COMMAND_CHECK_INTERVAL 10000  // Check for commands every 10 seconds
#define WIFI_RECONNECT_DELAY 10000    // Wait 10s before WiFi reconnect
#define PANIC_THRESHOLD_MS 300000     // 5 minutes of no response = panic
#define DAILY_RESTART_HOUR 2          // Restart at 2:00 AM
#define WATCHDOG_TIMEOUT_S 30         // Watchdog timeout
#define LOCAL_SERVER_PORT 80

// ========== SAFETY & ERROR HANDLING ==========
#define MAX_WIFI_RETRIES 3
#define MAX_BACKEND_RETRIES 3
#define MOTOR_MAX_RUNTIME_MS 1800000  // 30 minutes max motor runtime
#define MOTOR_COOLDOWN_MS 300000      // 5 minutes cooldown between runs

// ========== GLOBAL VARIABLES ==========
WebServer server(LOCAL_SERVER_PORT);

// System state
bool isAutoMode = true;
bool motorRunning = false;
bool systemInPanic = false;
bool backendAvailable = false;
bool wifiConnected = false;
bool topTankNeedsWater = false;
bool emergencyStopActive = false;

// Sensor data
float currentLevel = 0.0;
float currentVolume = 0.0;
bool floatSwitchState = false;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastBackendCheck = 0;
unsigned long lastStatusReport = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastWifiConnect = 0;
unsigned long motorStartTime = 0;
unsigned long lastMotorStop = 0;
unsigned long lastBackendResponse = 0;
unsigned long lastPanicCheck = 0;
unsigned long systemStartTime = 0;

// Switch states
bool lastMotorSwitchState = HIGH;
bool lastModeSwitchState = HIGH;

// LED and buzzer
unsigned long lastLedBlink = 0;
unsigned long lastBuzzerRing = 0;
int buzzerRingCount = 0;

// Error counters
int wifiRetryCount = 0;
int backendRetryCount = 0;
int heartbeatMissCount = 0;

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(2000); // Allow serial to initialize
  
  Serial.println("\n🚀 AquaGuard Sump Tank Controller Enhanced Starting...");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.printf("Firmware Version: 2.1.0\n");
  
  systemStartTime = millis();
  
  // CRITICAL: Initialize relay to OFF immediately for safety
  pinMode(MOTOR_RELAY_PIN, OUTPUT);
  digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
  motorRunning = false;
  Serial.println("🔒 SAFETY: Motor relay initialized to OFF");
  
  // Initialize all pins
  initializePins();
  
  // Setup watchdog timer
  setupWatchdog();
  
  // Initialize WiFi with retry logic
  initializeWiFi();
  
  // Setup NTP for time synchronization
  setupNTP();
  
  // Setup local HTTP server
  setupLocalServer();
  
  // Initialize backend connection
  checkBackendAvailability();
  
  Serial.println("✅ Enhanced Setup Complete!");
  Serial.printf("📊 Tank: Rectangle %.1f×%.1f×%.1fcm (%.1fL)\n", 
                TANK_LENGTH_CM, TANK_WIDTH_CM, TANK_HEIGHT_CM, TANK_CAPACITY_LITERS);
  Serial.printf("🌐 Local IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("📡 Backend: %s:%d\n", BACKEND_HOST, BACKEND_PORT);
}

// ========== MAIN LOOP ==========
void loop() {
  unsigned long currentMillis = millis();
  
  // Feed watchdog to prevent unnecessary resets
  esp_task_wdt_reset();
  
  // Handle local HTTP server
  server.handleClient();
  
  // Check for daily restart (2:00 AM)
  checkDailyRestart();
  
  // Check for panic conditions (only restart on panic, not WiFi issues)
  checkPanicConditions(currentMillis);
  
  // Read sensors periodically
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    lastSensorRead = currentMillis;
  }
  
  // Handle WiFi connection (but don't restart on disconnection)
  if (currentMillis - lastWifiConnect >= WIFI_RECONNECT_DELAY) {
    maintainWiFiConnection();
    lastWifiConnect = currentMillis;
  }
  
  // Check backend availability
  if (currentMillis - lastBackendCheck >= BACKEND_CHECK_INTERVAL) {
    checkBackendAvailability();
    lastBackendCheck = currentMillis;
  }
  
  // Send heartbeat to backend
  if (wifiConnected && backendAvailable && 
      currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = currentMillis;
  }
  
  // Check for pending commands from backend
  if (wifiConnected && backendAvailable && 
      currentMillis - lastCommandCheck >= COMMAND_CHECK_INTERVAL) {
    checkPendingCommands();
    lastCommandCheck = currentMillis;
  }
  
  // Handle manual switches
  handleSwitches();
  
  // Update LEDs and buzzer
  updateLEDs();
  handleBuzzer();
  
  // Auto motor control with safety checks
  if (isAutoMode && !systemInPanic) {
    autoMotorControl();
  }
  
  // Safety: Check motor runtime
  checkMotorSafety();
  
  // Report system status periodically
  if (currentMillis - lastStatusReport >= STATUS_REPORT_INTERVAL) {
    reportSystemStatus();
    lastStatusReport = currentMillis;
  }
}

// ========== INITIALIZATION FUNCTIONS ==========
void initializePins() {
  // Sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  
  // Control pins (relay already initialized in setup for safety)
  pinMode(BUZZER_PIN, OUTPUT);
  
  // LED pins
  pinMode(AUTO_MODE_LED_PIN, OUTPUT);
  pinMode(SUMP_FULL_LED_PIN, OUTPUT);
  pinMode(SUMP_LOW_LED_PIN, OUTPUT);
  
  // Switch pins
  pinMode(MANUAL_MOTOR_SWITCH_PIN, INPUT_PULLUP);
  pinMode(MODE_SWITCH_PIN, INPUT_PULLUP);
  
  // Initialize outputs to safe state
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(AUTO_MODE_LED_PIN, HIGH); // Auto mode by default
  digitalWrite(SUMP_FULL_LED_PIN, LOW);
  digitalWrite(SUMP_LOW_LED_PIN, LOW);
  
  Serial.println("📌 All pins initialized safely");
}

void setupWatchdog() {
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WATCHDOG_TIMEOUT_S * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic = true
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.printf("⏰ Watchdog configured: %d seconds timeout\n", WATCHDOG_TIMEOUT_S);
}

void initializeWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.printf("🔗 Connecting to WiFi: %s", WIFI_SSID);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    esp_task_wdt_reset(); // Feed watchdog during connection
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    wifiRetryCount = 0;
    Serial.println("\n✅ WiFi Connected!");
    Serial.printf("📍 IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("📶 Signal: %d dBm\n", WiFi.RSSI());
  } else {
    wifiConnected = false;
    Serial.println("\n❌ WiFi Connection Failed - Will retry later");
  }
}

void setupNTP() {
  if (wifiConnected) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("🕒 NTP time synchronization started");
  }
}

void setupLocalServer() {
  // Motor control endpoint for Top Tank ESP32
  server.on("/motor", HTTP_POST, []() {
    if (server.hasArg("plain")) {
      DynamicJsonDocument doc(256);
      deserializeJson(doc, server.arg("plain"));
      
      String command = doc["command"];
      String deviceId = doc["device_id"];
      
      if (deviceId == "TOP_TANK" && !systemInPanic) {
        if (command == "start" && floatSwitchState) {
          topTankNeedsWater = true;
          server.send(200, "application/json", "{\"status\":\"command_received\",\"action\":\"start\"}");
          Serial.println("📨 Top Tank requests motor START");
        } else if (command == "stop") {
          topTankNeedsWater = false;
          server.send(200, "application/json", "{\"status\":\"command_received\",\"action\":\"stop\"}");
          Serial.println("📨 Top Tank requests motor STOP");
        } else {
          server.send(400, "application/json", "{\"error\":\"invalid_command_or_unsafe\"}");
        }
      } else {
        server.send(401, "application/json", "{\"error\":\"unauthorized_or_panic_mode\"}");
      }
    } else {
      server.send(400, "application/json", "{\"error\":\"no_data\"}");
    }
  });
  
  // Status endpoint
  server.on("/status", HTTP_GET, []() {
    DynamicJsonDocument doc(512);
    doc["device_id"] = DEVICE_ID;
    doc["level_percentage"] = currentLevel;
    doc["level_liters"] = currentVolume;
    doc["motor_running"] = motorRunning;
    doc["auto_mode"] = isAutoMode;
    doc["float_switch"] = floatSwitchState;
    doc["system_panic"] = systemInPanic;
    doc["backend_available"] = backendAvailable;
    doc["wifi_connected"] = wifiConnected;
    doc["uptime_seconds"] = (millis() - systemStartTime) / 1000;
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });
  
  server.begin();
  Serial.println("🌐 Local HTTP server started on port 80");
}

// ========== SENSOR FUNCTIONS ==========
void readSensors() {
  static float lastValidLevel = 0.0;
  static int invalidReadingCount = 0;
  static float readings[5] = {0}; // Store last 5 readings for filtering
  static int readingIndex = 0;
  
  // Read ultrasonic sensor with error handling
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  float newLevel = currentLevel; // Default to previous level
  float newVolume = currentVolume;
  float effectiveHeight = TANK_HEIGHT_CM - SENSOR_OFFSET_CM; // Effective measurement range
  
  if (duration > 0 && duration < 25000) { // Valid reading range
    float distance = duration * 0.034 / 2.0;
    
    if (distance <= TANK_HEIGHT_CM && distance >= SENSOR_OFFSET_CM) {
      float waterHeight = TANK_HEIGHT_CM - distance - SENSOR_OFFSET_CM;
      newLevel = (waterHeight / effectiveHeight) * 100.0;
      newLevel = constrain(newLevel, 0.0, 100.0);
      
      // Store reading for filtering
      readings[readingIndex] = newLevel;
      readingIndex = (readingIndex + 1) % 5;
      
      // Check if this reading is reasonable (not more than 20% change from last valid)
      if (lastValidLevel > 0 && abs(newLevel - lastValidLevel) > 20.0) {
        invalidReadingCount++;
        Serial.printf("⚠️ Suspicious reading: %.1f%% (last valid: %.1f%%, diff: %.1f%%)\n", 
                      newLevel, lastValidLevel, abs(newLevel - lastValidLevel));
        
        // If we have multiple invalid readings, use filtered average
        if (invalidReadingCount >= 3) {
          // Calculate average of stored readings
          float sum = 0;
          int validCount = 0;
          for (int i = 0; i < 5; i++) {
            if (readings[i] > 0 && abs(readings[i] - lastValidLevel) <= 20.0) {
              sum += readings[i];
              validCount++;
            }
          }
          
          if (validCount > 0) {
            newLevel = sum / validCount;
            Serial.printf("🔧 Using filtered reading: %.1f%% (from %d valid samples)\n", newLevel, validCount);
          } else {
            newLevel = lastValidLevel; // Keep last known good value
            Serial.printf("🔧 Using last valid reading: %.1f%%\n", newLevel);
          }
        } else {
          newLevel = lastValidLevel; // Keep last known good value
        }
      } else {
        // Reading looks reasonable
        lastValidLevel = newLevel;
        invalidReadingCount = 0;
      }
      
      // Calculate volume for rectangular tank using the already calculated effectiveHeight
      float waterHeightFromLevel = (newLevel / 100.0) * effectiveHeight;
      newVolume = (TANK_LENGTH_CM * TANK_WIDTH_CM * waterHeightFromLevel) / 1000.0;
    } else {
      invalidReadingCount++;
      Serial.printf("⚠️ Distance out of range: %.1fcm\n", distance);
    }
  } else {
    invalidReadingCount++;
    Serial.println("⚠️ Ultrasonic sensor reading timeout");
  }
  
  // Update global values only if they're reasonable
  if (newLevel >= 0 && newLevel <= 100) {
    currentLevel = newLevel;
    currentVolume = newVolume;
  }
  
  // Read float switch
  floatSwitchState = digitalRead(FLOAT_SWITCH_PIN) == LOW;
  
  // Enhanced logging with error count
  if (invalidReadingCount > 0) {
    Serial.printf("📊 Tank: %.1f%% (%.1fL) | Float: %s | Errors: %d\n", 
                  currentLevel, currentVolume, floatSwitchState ? "OK" : "LOW", invalidReadingCount);
  } else {
    Serial.printf("📊 Tank: %.1f%% (%.1fL) | Float: %s\n", 
                  currentLevel, currentVolume, floatSwitchState ? "OK" : "LOW");
  }
  
  // Reset error count periodically
  if (invalidReadingCount > 10) {
    invalidReadingCount = 0;
    Serial.println("🔄 Sensor error count reset");
  }
  
  // Send data to backend if available
  if (backendAvailable && wifiConnected) {
    sendSensorDataToBackend();
  }
}

// ========== HEARTBEAT SYSTEM ==========
void sendHeartbeat() {
  if (!wifiConnected || !backendAvailable) {
    Serial.println("⚠️ Heartbeat skipped - WiFi or backend not available");
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/heartbeat";
  
  Serial.printf("📤 Sending heartbeat to: %s\n", url.c_str());
  
  if (http.begin(url)) {
    String timestamp = String(millis());
    
    DynamicJsonDocument doc(256);
    doc["device_id"] = DEVICE_ID;
    doc["status"] = "alive";
    doc["level_percentage"] = currentLevel;
    doc["motor_running"] = motorRunning;
    doc["auto_mode"] = isAutoMode;
    doc["connection_state"] = "connected";
    doc["uptime_seconds"] = (millis() - systemStartTime) / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["timestamp"] = timestamp;
    
    String payload;
    serializeJson(doc, payload);
    
    Serial.printf("📤 Heartbeat payload: %s\n", payload.c_str());
    
    // Generate HMAC signature
    String signature = generateHMACSignature(payload, timestamp);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    http.addHeader("x-signature", signature);
    http.addHeader("x-timestamp", timestamp);
    http.setTimeout(10000); // 10 second timeout
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
      lastBackendResponse = millis();
      heartbeatMissCount = 0;
      backendRetryCount = 0;
      Serial.println("💓 Heartbeat sent successfully");
    } else {
      heartbeatMissCount++;
      backendRetryCount++;
      String errorResponse = http.getString();
      Serial.printf("❌ Heartbeat failed: HTTP %d (Miss count: %d)\n", httpCode, heartbeatMissCount);
      Serial.printf("❌ Error response: %s\n", errorResponse.c_str());
      
      // If backend has database issues, don't mark it completely unavailable
      // Just continue trying with increased interval
      if (httpCode == 500 && errorResponse.indexOf("db.collection") > -1) {
        Serial.println("🔧 Backend database issue detected - continuing with reduced frequency");
        backendRetryCount = MAX_BACKEND_RETRIES - 1; // Keep trying but less frequently
      } else if (backendRetryCount >= MAX_BACKEND_RETRIES) {
        backendAvailable = false;
        Serial.println("🔌 Backend marked as unavailable");
      }
    }
    
    http.end();
  } else {
    Serial.println("❌ Failed to initialize HTTP client for heartbeat");
  }
}

String generateHMACSignature(String payload, String timestamp) {
  String message = String(DEVICE_ID) + payload + timestamp;
  
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  const size_t key_len = strlen(DEVICE_HMAC_SECRET);
  const size_t msg_len = message.length();
  
  byte hmac_result[32];
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)DEVICE_HMAC_SECRET, key_len);
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), msg_len);
  mbedtls_md_hmac_finish(&ctx, hmac_result);
  mbedtls_md_free(&ctx);
  
  String signature = "";
  for (int i = 0; i < 32; i++) {
    char hex[3];
    sprintf(hex, "%02x", hmac_result[i]);
    signature += hex;
  }
  
  return signature;
}

// ========== COMMAND PROCESSING ==========
void checkPendingCommands() {
  if (!wifiConnected || !backendAvailable) {
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/commands/" + DEVICE_ID;
  
  if (http.begin(url)) {
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    http.setTimeout(5000); // 5 second timeout
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      String response = http.getString();
      
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, response);
      
      if (!error) {
        JsonArray commands = doc["commands"];
        Serial.printf("📋 Found %d pending commands\n", commands.size());
        
        for (JsonObject command : commands) {
          String commandId = command["id"];
          String commandType = command["type"];
          JsonObject payload = command["payload"];
          
          Serial.printf("🎯 Processing command: %s (%s)\n", commandType.c_str(), commandId.c_str());
          
          if (commandType == "motor_control") {
            processMotorCommand(commandId, payload);
          } else if (commandType == "emergency_stop") {
            processEmergencyStop(commandId, payload);
          } else if (commandType == "emergency_reset") {
            processEmergencyReset(commandId, payload);
          }
          
          // Acknowledge the command
          acknowledgeCommand(commandId, "processed");
        }
      } else {
        Serial.println("❌ Failed to parse commands JSON");
      }
    } else if (httpCode != 404) { // 404 means no commands, which is normal
      Serial.printf("❌ Failed to fetch commands: HTTP %d\n", httpCode);
    }
    
    http.end();
  }
}

void processMotorCommand(String commandId, JsonObject payload) {
  String action = payload["action"];
  bool manual = payload["manual"] | false;
  
  Serial.printf("🎛️ Motor command: %s (manual: %s)\n", action.c_str(), manual ? "true" : "false");
  
  // Check for emergency stop state first
  if (emergencyStopActive && action == "start") {
    Serial.printf("❌ Motor start blocked - Emergency stop active\n");
    acknowledgeCommand(commandId, "failed_emergency_stop_active");
    return;
  }
  
  if (action == "start") {
    // Safety checks before starting motor
    if (floatSwitchState && !systemInPanic) {
      digitalWrite(MOTOR_RELAY_PIN, RELAY_ON);
      motorRunning = true;
      motorStartTime = millis();
      Serial.printf("✅ Motor started via command %s\n", commandId.c_str());
      
      // If this is a manual command, temporarily disable auto mode
      if (manual) {
        isAutoMode = false;
        digitalWrite(AUTO_MODE_LED_PIN, LOW);
        Serial.println("🔧 Auto mode disabled for manual control");
      }
    } else {
      Serial.printf("❌ Motor start blocked - Float: %s, Panic: %s\n", 
                    floatSwitchState ? "OK" : "LOW", systemInPanic ? "YES" : "NO");
    }
  } else if (action == "stop") {
    digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
    if (motorRunning) {
      motorRunning = false;
      lastMotorStop = millis();
      Serial.printf("✅ Motor stopped via command %s\n", commandId.c_str());
    }
    
    // Re-enable auto mode after manual stop
    if (manual && !isAutoMode) {
      isAutoMode = true;
      digitalWrite(AUTO_MODE_LED_PIN, HIGH);
      Serial.println("🔄 Auto mode re-enabled");
    }
  }
}

void processEmergencyStop(String commandId, JsonObject payload) {
  Serial.printf("🚨 EMERGENCY STOP COMMAND RECEIVED: %s\n", commandId.c_str());
  
  // Immediate motor shutdown - no safety checks, highest priority
  digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
  
  if (motorRunning) {
    motorRunning = false;
    lastMotorStop = millis();
    Serial.println("🛑 MOTOR FORCE STOPPED - EMERGENCY SHUTDOWN");
  }
  
  // Force disable auto mode to prevent automatic restart
  isAutoMode = false;
  digitalWrite(AUTO_MODE_LED_PIN, LOW);
  Serial.println("🔒 AUTO MODE DISABLED - Emergency Stop Active");
  
  // Sound emergency buzzer pattern (5 quick beeps)
  for (int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  
  // Set system in temporary emergency state
  systemInPanic = true;
  emergencyStopActive = true;
  Serial.println("🚨 SYSTEM IN EMERGENCY STATE - Manual reset required");
  
  // Get emergency reason if provided
  String reason = payload["reason"] | "User initiated emergency stop";
  Serial.printf("🔍 Emergency reason: %s\n", reason.c_str());
  
  // Acknowledge immediately
  acknowledgeCommand(commandId, "emergency_stop_executed");
}

void processEmergencyReset(String commandId, JsonObject payload) {
  Serial.printf("🔄 EMERGENCY RESET COMMAND RECEIVED: %s\n", commandId.c_str());
  
  if (!emergencyStopActive) {
    Serial.println("ℹ️ No emergency stop active - reset not needed");
    acknowledgeCommand(commandId, "no_emergency_active");
    return;
  }
  
  // Clear emergency stop state
  emergencyStopActive = false;
  systemInPanic = false;
  Serial.println("✅ EMERGENCY STOP CLEARED");
  
  // Re-enable auto mode (user can disable manually if needed)
  isAutoMode = true;
  digitalWrite(AUTO_MODE_LED_PIN, HIGH);
  Serial.println("🔄 AUTO MODE RE-ENABLED");
  
  // Sound confirmation beep (2 short beeps)
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
  
  Serial.println("✅ SYSTEM RESET - Normal operation resumed");
  
  // Acknowledge reset completion
  acknowledgeCommand(commandId, "emergency_reset_completed");
}

void acknowledgeCommand(String commandId, String status) {
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/commands/" + commandId + "/ack";
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(128);
    doc["status"] = status;
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
      Serial.printf("✅ Command %s acknowledged\n", commandId.c_str());
    } else {
      Serial.printf("❌ Failed to acknowledge command %s: HTTP %d\n", commandId.c_str(), httpCode);
    }
    
    http.end();
  }
}

// ========== PANIC MODE & RESTART LOGIC ==========
void checkPanicConditions(unsigned long currentMillis) {
  // Only check panic every 10 seconds to avoid constant checking
  if (currentMillis - lastPanicCheck < 10000) return;
  lastPanicCheck = currentMillis;
  
  bool shouldPanic = false;
  String panicReason = "";
  
  // Check 1: Backend unresponsive for too long (only if backend was available)
  if (backendAvailable && lastBackendResponse > 0 && 
      currentMillis - lastBackendResponse > PANIC_THRESHOLD_MS) {
    shouldPanic = true;
    panicReason = "Backend unresponsive for " + String(PANIC_THRESHOLD_MS/1000) + " seconds";
  }
  
  // Check 2: Critical hardware failure (sensor always reading 0 or max)
  static int sensorErrorCount = 0;
  if (currentLevel == 0.0 || currentLevel >= 99.9) {
    sensorErrorCount++;
    if (sensorErrorCount > 10) { // 10 consecutive bad readings
      shouldPanic = true;
      panicReason = "Sensor hardware failure detected";
    }
  } else {
    sensorErrorCount = 0;
  }
  
  // Check 3: Motor stuck on for too long
  if (motorRunning && motorStartTime > 0 && 
      currentMillis - motorStartTime > MOTOR_MAX_RUNTIME_MS) {
    shouldPanic = true;
    panicReason = "Motor running too long - possible mechanical failure";
  }
  
  // Check 4: Low memory condition
  if (ESP.getFreeHeap() < 10000) { // Less than 10KB free
    shouldPanic = true;
    panicReason = "Critical memory shortage";
  }
  
  if (shouldPanic && !systemInPanic) {
    systemInPanic = true;
    Serial.println("\n🚨 PANIC MODE ACTIVATED 🚨");
    Serial.printf("Reason: %s\n", panicReason.c_str());
    
    // Immediate safety actions
    digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
    motorRunning = false;
    
    // Alert via buzzer (if not hardware failure)
    for (int i = 0; i < 5; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      delay(200);
    }
    
    // Try to report panic to backend
    reportPanicToBackend(panicReason);
    
    delay(5000); // Allow time for panic report
    
    Serial.println("🔄 SYSTEM RESTART DUE TO PANIC MODE");
    ESP.restart();
  }
}

void reportPanicToBackend(String reason) {
  if (!wifiConnected) return;
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/panic";
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(256);
    doc["device_id"] = DEVICE_ID;
    doc["panic_reason"] = reason;
    doc["uptime_seconds"] = (millis() - systemStartTime) / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["level_percentage"] = currentLevel;
    doc["motor_running"] = motorRunning;
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    int httpCode = http.POST(payload);
    Serial.printf("📤 Panic report sent: %d\n", httpCode);
    
    http.end();
  }
}

// ========== DAILY RESTART ==========
void checkDailyRestart() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return; // No time sync yet
  
  static bool restartScheduled = false;
  
  // Check if it's 2:00 AM and we haven't restarted today
  if (timeinfo.tm_hour == DAILY_RESTART_HOUR && timeinfo.tm_min == 0 && !restartScheduled) {
    restartScheduled = true;
    
    Serial.println("\n🌙 SCHEDULED DAILY RESTART (2:00 AM)");
    
    // Safety: Turn off motor
    digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
    motorRunning = false;
    
    // Report scheduled restart
    if (backendAvailable && wifiConnected) {
      reportScheduledRestart();
    }
    
    delay(2000);
    Serial.println("🔄 DAILY RESTART INITIATED");
    ESP.restart();
  }
  
  // Reset schedule flag after 2:00 AM window
  if (timeinfo.tm_hour != DAILY_RESTART_HOUR) {
    restartScheduled = false;
  }
}

void reportScheduledRestart() {
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/scheduled-restart";
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(128);
    doc["device_id"] = DEVICE_ID;
    doc["restart_type"] = "daily_scheduled";
    doc["uptime_seconds"] = (millis() - systemStartTime) / 1000;
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    http.POST(payload);
    http.end();
    Serial.println("📤 Scheduled restart reported");
  }
}

// ========== WIFI MANAGEMENT (NO RESTART ON DISCONNECTION) ==========
void maintainWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("📡 WiFi disconnected");
      wifiConnected = false;
      backendAvailable = false;
    }
    
    wifiRetryCount++;
    if (wifiRetryCount <= MAX_WIFI_RETRIES) {
      Serial.printf("🔄 WiFi reconnect attempt %d/%d\n", wifiRetryCount, MAX_WIFI_RETRIES);
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      
      // Wait up to 10 seconds for connection
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        attempts++;
        esp_task_wdt_reset();
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        wifiRetryCount = 0;
        Serial.println("✅ WiFi reconnected!");
        // Check backend availability after WiFi reconnection
        checkBackendAvailability();
      }
    } else {
      Serial.println("❌ WiFi reconnection failed - operating in local mode only");
    }
  } else if (!wifiConnected) {
    wifiConnected = true;
    wifiRetryCount = 0;
    Serial.println("✅ WiFi connection restored");
  }
}

// ========== BACKEND COMMUNICATION ==========
bool checkBackendAvailability() {
  if (!wifiConnected) {
    backendAvailable = false;
    return false;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/ping";
  
  if (http.begin(url)) {
    http.setTimeout(5000); // 5 second timeout
    http.addHeader("x-device-id", DEVICE_ID);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      if (!backendAvailable) {
        Serial.println("✅ Backend connection established");
      }
      backendAvailable = true;
      backendRetryCount = 0;
      lastBackendResponse = millis();
    } else {
      if (backendAvailable) {
        Serial.printf("❌ Backend unavailable: %d\n", httpCode);
      }
      backendAvailable = false;
      backendRetryCount++;
    }
    
    http.end();
  } else {
    backendAvailable = false;
  }
  
  return backendAvailable;
}

void sendSensorDataToBackend() {
  if (!backendAvailable || !wifiConnected) return;
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/sensor-data";
  
  if (http.begin(url)) {
    String timestamp = String(millis());
    
    DynamicJsonDocument doc(400);
    doc["esp32_id"] = DEVICE_ID;
    doc["tank_type"] = "sump_tank";
    doc["level_percentage"] = currentLevel;
    doc["level_liters"] = currentVolume;
    doc["motor_running"] = motorRunning;
    doc["auto_mode"] = isAutoMode;
    doc["float_switch"] = floatSwitchState;
    doc["manual_motor_switch"] = !digitalRead(MANUAL_MOTOR_SWITCH_PIN); // Invert because LOW = pressed
    doc["mode_switch"] = !digitalRead(MODE_SWITCH_PIN); // Invert because LOW = pressed
    doc["sensor_health"] = "online";
    doc["connection_state"] = "connected";
    doc["signal_strength"] = WiFi.RSSI();
    doc["timestamp"] = timestamp;
    
    String payload;
    serializeJson(doc, payload);
    
    String signature = generateHMACSignature(payload, timestamp);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    http.addHeader("x-signature", signature);
    http.addHeader("x-timestamp", timestamp);
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
      lastBackendResponse = millis();
    }
    
    http.end();
  }
}

// ========== MOTOR CONTROL WITH SAFETY ==========
void autoMotorControl() {
  static unsigned long lastLogicCheck = 0;
  if (millis() - lastLogicCheck < 5000) return; // Check every 5 seconds
  lastLogicCheck = millis();
  
  // If emergency stop is active, prevent any motor control
  if (emergencyStopActive) {
    return;
  }
  
  bool shouldStartMotor = false;
  bool shouldStopMotor = false;
  String reason = "";
  
  // Check stop conditions first (safety priority)
  if (motorRunning) {
    if (!floatSwitchState) {
      shouldStopMotor = true;
      reason = "Float switch safety stop";
    } else if (currentLevel <= AUTO_STOP_LEVEL) {
      shouldStopMotor = true;
      reason = "Auto stop level reached";
    } else if (currentLevel >= SUMP_HIGH_LEVEL) {
      shouldStopMotor = true;
      reason = "Sump tank full";
    }
  }
  
  // Check start conditions - simplified logic without topTankNeedsWater dependency
  if (!motorRunning && !shouldStopMotor) {
    if (floatSwitchState && currentLevel >= AUTO_START_LEVEL && currentLevel < SUMP_HIGH_LEVEL) {
      shouldStartMotor = true;
      reason = "Auto start conditions met";
    }
  }
  
  // Execute motor control
  if (shouldStopMotor) {
    digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
    if (motorRunning) {
      motorRunning = false;
      lastMotorStop = millis();
      Serial.printf("🔌 Motor OFF: %s\n", reason.c_str());
    }
  } else if (shouldStartMotor) {
    // Check cooldown period
    if (lastMotorStop == 0 || millis() - lastMotorStop >= MOTOR_COOLDOWN_MS) {
      digitalWrite(MOTOR_RELAY_PIN, RELAY_ON);
      motorRunning = true;
      motorStartTime = millis();
      Serial.printf("🔌 Motor ON: %s\n", reason.c_str());
    } else {
      Serial.println("⏳ Motor in cooldown period");
    }
  }
}

void checkMotorSafety() {
  if (motorRunning && motorStartTime > 0) {
    unsigned long runtime = millis() - motorStartTime;
    
    if (runtime > MOTOR_MAX_RUNTIME_MS) {
      digitalWrite(MOTOR_RELAY_PIN, RELAY_OFF);
      motorRunning = false;
      Serial.println("🚨 EMERGENCY MOTOR STOP - Max runtime exceeded");
      
      // This could trigger panic mode if it happens repeatedly
      static int motorTimeoutCount = 0;
      motorTimeoutCount++;
      if (motorTimeoutCount >= 3) {
        systemInPanic = true;
      }
    }
  }
}

// ========== UI CONTROLS ==========
void handleSwitches() {
  static unsigned long lastSwitchCheck = 0;
  if (millis() - lastSwitchCheck < 200) return; // Debounce
  lastSwitchCheck = millis();
  
  // Mode switch
  bool modeSwitchState = digitalRead(MODE_SWITCH_PIN);
  if (modeSwitchState != lastModeSwitchState && modeSwitchState == LOW) {
    isAutoMode = !isAutoMode;
    digitalWrite(AUTO_MODE_LED_PIN, isAutoMode ? HIGH : LOW);
    Serial.printf("🔄 Mode: %s\n", isAutoMode ? "AUTO" : "MANUAL");
    
    // If switching to auto mode and motor is running manually, keep it running
    // If switching to manual mode, allow manual control
  }
  lastModeSwitchState = modeSwitchState;
  
  // Manual motor switch (works in both AUTO and MANUAL modes as override)
  if (!systemInPanic && !emergencyStopActive) {
    bool motorSwitchState = digitalRead(MANUAL_MOTOR_SWITCH_PIN);
    if (motorSwitchState != lastMotorSwitchState && motorSwitchState == LOW) {
      if (floatSwitchState) { // Safety check
        motorRunning = !motorRunning;
        digitalWrite(MOTOR_RELAY_PIN, motorRunning ? RELAY_ON : RELAY_OFF);
        if (motorRunning) {
          motorStartTime = millis();
          Serial.printf("🔧 Manual override: Motor ON\n");
        } else {
          Serial.printf("🔧 Manual override: Motor OFF\n");
        }
        
        // Report switch action to backend immediately
        if (wifiConnected && backendAvailable) {
          reportSystemStatus();
        }
      } else {
        Serial.println("⚠️ Manual motor blocked - Float switch safety");
      }
    }
    lastMotorSwitchState = motorSwitchState;
  }
}

void updateLEDs() {
  // Auto mode LED
  digitalWrite(AUTO_MODE_LED_PIN, isAutoMode ? HIGH : LOW);
  
  // Low level LED (solid when low)
  digitalWrite(SUMP_LOW_LED_PIN, currentLevel <= SUMP_LOW_LEVEL ? HIGH : LOW);
  
  // Full level LED (blink at high, solid at critical)
  if (currentLevel >= SUMP_CRITICAL_LEVEL) {
    digitalWrite(SUMP_FULL_LED_PIN, HIGH);
  } else if (currentLevel >= SUMP_HIGH_LEVEL) {
    // Blink LED
    if (millis() - lastLedBlink >= 500) {
      digitalWrite(SUMP_FULL_LED_PIN, !digitalRead(SUMP_FULL_LED_PIN));
      lastLedBlink = millis();
    }
  } else {
    digitalWrite(SUMP_FULL_LED_PIN, LOW);
  }
}

void handleBuzzer() {
  if (currentLevel >= SUMP_CRITICAL_LEVEL && buzzerRingCount < 3) {
    unsigned long currentMillis = millis();
    
    if (currentMillis - lastBuzzerRing >= 400) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      buzzerRingCount++;
      lastBuzzerRing = currentMillis;
    }
  } else if (currentLevel < SUMP_CRITICAL_LEVEL) {
    buzzerRingCount = 0;
  }
  
  // Panic mode buzzer pattern
  if (systemInPanic) {
    static unsigned long lastPanicBuzz = 0;
    if (millis() - lastPanicBuzz >= 1000) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      lastPanicBuzz = millis();
    }
  }
}

// ========== STATUS REPORTING ==========
void reportSystemStatus() {
  Serial.println("\n========== ENHANCED SYSTEM STATUS ==========");
  Serial.printf("Device: %s (Uptime: %lu min)\n", DEVICE_ID, (millis() - systemStartTime) / 60000);
  Serial.printf("Tank: Rectangle %.1f×%.1f×%.1fcm (%.1fL capacity)\n", 
                TANK_LENGTH_CM, TANK_WIDTH_CM, TANK_HEIGHT_CM, TANK_CAPACITY_LITERS);
  Serial.printf("Water Level: %.1f%% (%.1fL)\n", currentLevel, currentVolume);
  Serial.printf("Float Switch: %s\n", floatSwitchState ? "Water Present" : "No Water");
  Serial.printf("Motor: %s", motorRunning ? "RUNNING" : "STOPPED");
  if (motorRunning && motorStartTime > 0) {
    Serial.printf(" (Runtime: %lu min)", (millis() - motorStartTime) / 60000);
  }
  Serial.println();
  Serial.printf("Mode: %s\n", isAutoMode ? "AUTO" : "MANUAL");
  Serial.printf("System Status: %s\n", systemInPanic ? "PANIC MODE" : "NORMAL");
  Serial.printf("WiFi: %s", wifiConnected ? "Connected" : "Disconnected");
  if (wifiConnected) {
    Serial.printf(" (%d dBm)", WiFi.RSSI());
  }
  Serial.println();
  Serial.printf("Backend: %s", backendAvailable ? "Available" : "Unavailable");
  if (backendAvailable && lastBackendResponse > 0) {
    Serial.printf(" (Last response: %lu sec ago)", (millis() - lastBackendResponse) / 1000);
  }
  Serial.println();
  Serial.printf("Top Tank Command: %s\n", topTankNeedsWater ? "NEEDS WATER" : "NO REQUEST");
  Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("Local Server: http://%s/\n", WiFi.localIP().toString().c_str());
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.printf("Current Time: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  }
  
  Serial.println("==========================================\n");
}