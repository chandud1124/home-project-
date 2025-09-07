/*
 * AquaGuard - ESP32 Top Tank Monitor (Enhanced + Cloud)
 * Hybrid system with backend communication, cloud connectivity, and local control
 * 
 * Enhanced Features:
 * - Robust heartbeat system with backend health monitoring
 * - Smart restart logic (panic mode only, not WiFi disconnection)
 * - Daily automatic restart at 2:00 AM
 * - Comprehensive error detection and recovery
 * - Hybrid connectivity (local backend + Supabase cloud + ESP32-to-ESP32)
 * - Dual fallback communication system
 * 
 * Hardware:
 * - Ultrasonic sensor (TRIG=5, ECHO=18)
 * - Status LED and buzzer for alerts
 * - Cylindrical tank monitoring and motor control commands
 * 
 * Tank: Cylindrical Ø103cm × 120cm (1000L capacity)
 */

// ========== LIBRARIES ==========
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <time.h>

// ========== DEVICE CONFIGURATION ==========
#define DEVICE_ID "TOP_TANK"
#define DEVICE_NAME "Top Tank"

// ========== WIFI CONFIGURATION ==========
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ========== BACKEND CONFIGURATION ==========
#define BACKEND_HOST "192.168.0.108"  // Your backend server IP (actual computer IP)
#define BACKEND_PORT 3001
#define BACKEND_USE_HTTPS false
#define BACKEND_ENABLED false  // DISABLED - Using cloud-only mode

// ========== SUMP ESP32 CONFIGURATION ==========
#define SUMP_ESP32_IP "192.168.0.107"  // IP of the Sump Tank ESP32
#define SUMP_ESP32_PORT 80

// ========== CLOUD CONFIGURATION (SUPABASE) ==========
#define CLOUD_ENABLED true
#define SUPABASE_URL "https://dwcouaacpqipvvsxiygo.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"

// ========== AUTHENTICATION ==========
#define DEVICE_API_KEY "993fbea1a7aa7bcdbc1b9af943c0836db68cb6080ce772d0a0570708517c1318"
#define DEVICE_HMAC_SECRET "ed85bbf0607cb4371a3456618097d7cf46674d8fd929c19ec212bd23162fb485"

// ========== HARDWARE PINS ==========
#define TRIG_PIN 5
#define ECHO_PIN 18
#define BUZZER_PIN 14
#define LED_PIN 15

// ========== TANK CONFIGURATION - CYLINDRICAL ==========
#define TANK_HEIGHT_CM 120.0
#define TANK_RADIUS_CM 51.5
#define TANK_DIAMETER_CM 103.0
#define TANK_CAPACITY_LITERS 1000.0
#define SENSOR_OFFSET_CM 10.0

// ========== CONTROL LEVELS ==========
#define LOW_LEVEL_THRESHOLD 20.0
#define CRITICAL_LEVEL_THRESHOLD 10.0
#define MOTOR_START_LEVEL 30.0
#define MOTOR_STOP_LEVEL 90.0

// ========== TIMING CONFIGURATION ==========
#define SENSOR_READ_INTERVAL 3000
#define HEARTBEAT_INTERVAL 30000      // Send heartbeat every 30 seconds
#define BACKEND_CHECK_INTERVAL 60000  // Check backend every 60 seconds
#define CLOUD_SYNC_INTERVAL 60000     // Sync with cloud every 60 seconds
#define STATUS_REPORT_INTERVAL 30000  // Report status every 30 seconds
#define COMMAND_CHECK_INTERVAL 10000  // Check for commands every 10 seconds
#define MOTOR_COMMAND_INTERVAL 15000  // Send motor commands every 15 seconds
#define WIFI_RECONNECT_DELAY 10000    // Wait 10s before WiFi reconnect
#define PANIC_THRESHOLD_MS 300000     // 5 minutes of no response = panic
#define DAILY_RESTART_HOUR 2          // Restart at 2:00 AM
#define WATCHDOG_TIMEOUT_S 60         // Increased to 60 seconds watchdog timeout

// ========== SAFETY & ERROR HANDLING ==========
#define MAX_WIFI_RETRIES 3
#define MAX_BACKEND_RETRIES 3

// ========== GLOBAL VARIABLES ==========
// System state
bool systemInPanic = false;
bool backendAvailable = false;
bool cloudAvailable = false;
bool wifiConnected = false;
bool sumpESP32Available = false;
bool lastMotorCommand = false;  // false = stop, true = start

// Sensor data
float currentLevel = 0.0;
float currentVolume = 0.0;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastBackendCheck = 0;
unsigned long lastCloudSync = 0;
unsigned long lastStatusReport = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastMotorCommand = 0;
unsigned long lastWifiConnect = 0;
unsigned long lastBackendResponse = 0;
unsigned long lastCloudResponse = 0;
unsigned long lastPanicCheck = 0;
unsigned long systemStartTime = 0;

// LED and buzzer
unsigned long lastLedBlink = 0;
unsigned long lastBuzzerRing = 0;
int buzzerRingCount = 0;

// Error counters
int wifiRetryCount = 0;
int backendRetryCount = 0;
int cloudRetryCount = 0;
int heartbeatMissCount = 0;

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(2000); // Allow serial to initialize
  
  Serial.println("\n🚀 AquaGuard Top Tank Monitor Enhanced + Cloud Starting...");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.printf("Firmware Version: 2.2.0 (Hybrid)\n");
  
  systemStartTime = millis();
  
  // Initialize all pins
  initializePins();
  
  // Setup watchdog timer
  setupWatchdog();
  
  // Initialize WiFi with retry logic
  initializeWiFi();
  
  // Setup NTP for time synchronization
  setupNTP();
  
  // Initialize backend connection (only if enabled)
  if (BACKEND_ENABLED) {
    checkBackendAvailability();
  }
  
  // Initialize cloud connection
  Serial.println("☁️ Testing cloud connectivity...");
  checkCloudAvailability();
  
  // Check Sump ESP32 availability
  checkSumpESP32Availability();
  
  Serial.println(BACKEND_ENABLED ? "✅ Enhanced + Cloud Setup Complete!" : "✅ Cloud-Only Setup Complete!");
  Serial.printf("📊 Tank: Cylinder Ø%.1fcm × %.1fcm (%.1fL)\n", 
                TANK_DIAMETER_CM, TANK_HEIGHT_CM, TANK_CAPACITY_LITERS);
  Serial.printf("🌐 Local IP: %s\n", WiFi.localIP().toString().c_str());
  if (BACKEND_ENABLED) {
    Serial.printf("📡 Backend: %s:%d (Available: %s)\n", BACKEND_HOST, BACKEND_PORT, backendAvailable ? "Yes" : "No");
  } else {
    Serial.printf("📡 Backend: Disabled (Cloud-Only Mode)\n");
  }
  Serial.printf("☁️ Cloud: %s (Available: %s)\n", SUPABASE_URL, cloudAvailable ? "Yes" : "No");
  Serial.printf("⚙️ Sump ESP32: %s:%d (Available: %s)\n", SUMP_ESP32_IP, SUMP_ESP32_PORT, sumpESP32Available ? "Yes" : "No");
}

// ========== MAIN LOOP ==========
void loop() {
  unsigned long currentMillis = millis();
  
  // Feed watchdog to prevent unnecessary resets
  esp_task_wdt_reset();
  
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
  
  // Check backend availability (only if backend enabled)
  if (BACKEND_ENABLED && currentMillis - lastBackendCheck >= BACKEND_CHECK_INTERVAL) {
    checkBackendAvailability();
    checkSumpESP32Availability();
    lastBackendCheck = currentMillis;
  }
  
  // Check cloud availability and sync
  if (currentMillis - lastCloudSync >= CLOUD_SYNC_INTERVAL) {
    checkCloudAvailability();
    syncWithCloud();
    lastCloudSync = currentMillis;
  }
  
  // Send heartbeat to backend (only if backend enabled)
  if (BACKEND_ENABLED && wifiConnected && backendAvailable && 
      currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = currentMillis;
  }
  
  // Check for pending commands from backend and cloud
  if (wifiConnected && 
      currentMillis - lastCommandCheck >= COMMAND_CHECK_INTERVAL) {
    if (BACKEND_ENABLED && backendAvailable) {
      checkPendingCommands();
    }
    // TEMPORARILY DISABLED: Cloud commands causing HTTP 400 errors
    /*
    if (cloudAvailable) {
      checkPendingCloudCommands();
    }
    */
    lastCommandCheck = currentMillis;
  }
  
  // Send motor control commands to Sump ESP32
  if (currentMillis - lastMotorCommand >= MOTOR_COMMAND_INTERVAL) {
    controlSumpMotor();
    lastMotorCommand = currentMillis;
  }
  
  // Update LEDs and buzzer
  updateLED();
  handleBuzzer();
  
  // Report system status periodically
  if (currentMillis - lastStatusReport >= STATUS_REPORT_INTERVAL) {
    reportSystemStatus();
    lastStatusReport = currentMillis;
  }
  
  // Check for serial commands (diagnostic mode)
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    if (command == "diag" || command == "DIAG") {
      Serial.println("\n🔧 Manual diagnostic requested...");
      diagnosticSensorTest();
    } else if (command == "restart" || command == "RESTART") {
      Serial.println("🔄 Manual restart requested...");
      ESP.restart();
    }
  }
}

// ========== INITIALIZATION FUNCTIONS ==========
void initializePins() {
  // Sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Output pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Initialize outputs
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("📌 All pins initialized");
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

// ========== CLOUD FUNCTIONS ==========
void checkCloudAvailability() {
  if (!wifiConnected || !CLOUD_ENABLED) {
    cloudAvailable = false;
    return;
  }
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/tank_readings?select=esp32_id&esp32_id=eq." + DEVICE_ID + "&limit=1"; // Changed to tank_readings table
  
  if (http.begin(url)) {
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.setTimeout(10000);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      cloudAvailable = true;
      cloudRetryCount = 0;
      lastCloudResponse = millis();
      Serial.println("☁️ Cloud available");
    } else {
      cloudRetryCount++;
      Serial.printf("❌ Cloud check failed: HTTP %d\n", httpCode);
      
      if (cloudRetryCount >= MAX_BACKEND_RETRIES) {
        cloudAvailable = false;
        Serial.println("☁️ Cloud marked as unavailable");
      }
    }
    
    http.end();
  } else {
    Serial.println("❌ Failed to initialize HTTP client for cloud check");
  }
}

void syncWithCloud() {
  if (!cloudAvailable || !wifiConnected) {
    return;
  }
  
  // Send device status to cloud
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/tank_readings"; // Changed from device_readings to tank_readings
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(512);
    doc["esp32_id"] = DEVICE_ID; // Match Supabase schema
    doc["tank_type"] = "top_tank"; // Standard tank type
    doc["level_percentage"] = currentLevel;
    doc["level_liters"] = currentVolume;
    doc["motor_running"] = false; // Top tank doesn't have motor
    doc["auto_mode_enabled"] = true; // Default auto mode
    doc["sensor_health"] = "good"; // Default sensor health
    doc["battery_voltage"] = 12.0; // Assume 12V power supply
    doc["signal_strength"] = WiFi.RSSI();
    // Removed wifi_rssi and uptime_seconds - not in table schema
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    http.setTimeout(15000);
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 201 || httpCode == 200) {
      Serial.println("☁️ Data synced to cloud successfully");
      lastCloudResponse = millis();
    } else {
      Serial.printf("❌ Cloud sync failed: HTTP %d\n", httpCode);
      String errorResponse = http.getString();
      Serial.printf("❌ Error response: %s\n", errorResponse.c_str());
    }
    
    http.end();
  }
}

void checkPendingCloudCommands() {
  if (!cloudAvailable || !wifiConnected) {
    return;
  }
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_commands?select=*&device_id=eq." + DEVICE_ID + "&acknowledged=eq.false&order=created_at.asc"; // Fixed: use acknowledged=false not status=pending
  
  if (http.begin(url)) {
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.setTimeout(10000);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      String response = http.getString();
      
      DynamicJsonDocument doc(2048);
      DeserializationError error = deserializeJson(doc, response);
      
      if (!error) {
        JsonArray commands = doc.as<JsonArray>();
        Serial.printf("☁️ Found %d pending cloud commands\n", commands.size());
        
        for (JsonObject command : commands) {
          String commandId = command["id"];
          String commandType = command["type"]; // Fixed: use 'type' column name, not 'command_type'
          JsonObject payload = command["payload"];
          
          Serial.printf("☁️ Processing cloud command: %s (%s)\n", commandType.c_str(), commandId.c_str());
          
          if (commandType == "motor_control") {
            processMotorControlCommand(commandId, payload);
          }
          
          // Acknowledge the cloud command
          acknowledgeCloudCommand(commandId, "processed");
        }
      } else {
        Serial.println("❌ Failed to parse cloud commands JSON");
      }
    } else if (httpCode != 404) { // 404 means no commands, which is normal
      Serial.printf("❌ Failed to fetch cloud commands: HTTP %d\n", httpCode);
    }
    
    http.end();
  }
}

void acknowledgeCloudCommand(String commandId, String status) {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/device_commands?id=eq." + commandId;
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(128);
    doc["acknowledged"] = true; // Fixed: use 'acknowledged' column, not 'status'
    // Note: removed 'processed_at' as it doesn't exist in the schema
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    http.setTimeout(10000);
    
    int httpCode = http.PATCH(payload);
    
    if (httpCode == 200 || httpCode == 204) {
      Serial.printf("☁️ Cloud command %s acknowledged\n", commandId.c_str());
    } else {
      Serial.printf("❌ Failed to acknowledge cloud command %s: HTTP %d\n", commandId.c_str(), httpCode);
    }
    
    http.end();
  }
}

// ========== SENSOR FUNCTIONS ==========
void diagnosticSensorTest() {
  Serial.println("\n🔍 ULTRASONIC SENSOR DIAGNOSTIC TEST (TOP TANK)");
  Serial.printf("📍 Sensor Pins - TRIG: %d, ECHO: %d\n", TRIG_PIN, ECHO_PIN);
  Serial.printf("📏 Tank Dimensions: Ø%.1fcm × %.1fcm (Cylindrical)\n", 
                TANK_DIAMETER_CM, TANK_HEIGHT_CM);
  Serial.printf("📐 Valid Distance Range: 5.0cm to %.1fcm\n", TANK_HEIGHT_CM + 50.0);
  
  for (int i = 0; i < 10; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(20);
    digitalWrite(TRIG_PIN, LOW);
    
    long duration = pulseIn(ECHO_PIN, HIGH, 50000);
    float distance = duration * 0.034 / 2.0;
    
    Serial.printf("Test %d: Duration=%ld μs, Distance=%.1fcm", i+1, duration, distance);
    
    if (duration == 0) {
      Serial.println(" ❌ NO ECHO");
    } else if (distance < 5.0) {
      Serial.println(" ⚠️ TOO CLOSE");
    } else if (distance > TANK_HEIGHT_CM + 50.0) {
      Serial.println(" ⚠️ TOO FAR");
    } else {
      float waterHeight = TANK_HEIGHT_CM - distance - SENSOR_OFFSET_CM;
      float level = (waterHeight / (TANK_HEIGHT_CM - SENSOR_OFFSET_CM)) * 100.0;
      Serial.printf(" ✅ VALID (Water: %.1fcm, Level: %.1f%%)", waterHeight, level);
    }
    Serial.println();
    
    delay(500);
  }
  
  Serial.println("🔍 Diagnostic complete. Check wiring if seeing 'NO ECHO' or 'TOO FAR'\n");
}

void readSensors() {
  static float lastValidLevel = 0.0;
  static int invalidReadingCount = 0;
  static float readings[5] = {0}; // Store last 5 readings for filtering
  static int readingIndex = 0;
  
  // Read ultrasonic sensor with improved error handling
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(10); // Longer stabilization
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(20); // Longer trigger pulse for better reliability
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 50000); // Extended timeout to 50ms
  float newLevel = currentLevel; // Default to previous level
  float newVolume = currentVolume;
  float effectiveHeight = TANK_HEIGHT_CM - SENSOR_OFFSET_CM; // Effective measurement range
  
  if (duration > 0 && duration < 40000) { // More generous valid reading range
    float distance = duration * 0.034 / 2.0;
    
    // More restrictive distance validation for tank dimensions
    if (distance >= 5.0 && distance <= (TANK_HEIGHT_CM + 50.0)) { // Allow 50cm buffer above tank
      float waterHeight = TANK_HEIGHT_CM - distance - SENSOR_OFFSET_CM;
      
      // Ensure water height is reasonable
      if (waterHeight >= 0 && waterHeight <= (TANK_HEIGHT_CM - SENSOR_OFFSET_CM)) {
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
      
      // Calculate volume for cylindrical tank using the already calculated effectiveHeight
      float waterHeightFromLevel = (newLevel / 100.0) * effectiveHeight;
      newVolume = PI * TANK_RADIUS_CM * TANK_RADIUS_CM * waterHeightFromLevel / 1000.0;
      } else {
        invalidReadingCount++;
        Serial.printf("⚠️ Invalid water height: %.1fcm (distance: %.1fcm)\n", waterHeight, distance);
      }
    } else {
      invalidReadingCount++;
      Serial.printf("⚠️ Distance out of range: %.1fcm (valid: 5-%.1fcm)\n", distance, TANK_HEIGHT_CM + 50.0);
    }
  } else {
    invalidReadingCount++;
    if (duration == 0) {
      Serial.println("⚠️ Ultrasonic sensor - No echo received (check wiring)");
    } else {
      Serial.printf("⚠️ Ultrasonic sensor reading timeout: %ld μs\n", duration);
    }
  }
  
  // Update global values only if they're reasonable
  if (newLevel >= 0 && newLevel <= 100) {
    currentLevel = newLevel;
    currentVolume = newVolume;
  }
  
  // Enhanced logging with error count
  if (invalidReadingCount > 0) {
    Serial.printf("📊 Top Tank: %.1f%% (%.1fL) | Errors: %d\n", 
                  currentLevel, currentVolume, invalidReadingCount);
  } else {
    Serial.printf("📊 Top Tank: %.1f%% (%.1fL)\n", 
                  currentLevel, currentVolume);
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
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/heartbeat";
  
  Serial.printf("📤 Sending heartbeat to: %s\n", url.c_str());
  
  if (http.begin(url)) {
    String timestamp = String(millis());
    
    DynamicJsonDocument doc(256);
    doc["device_id"] = DEVICE_ID;
    doc["status"] = "alive";
    doc["level_percentage"] = currentLevel;
    doc["motor_command"] = lastMotorCommand ? "start" : "stop";
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
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/commands/" + DEVICE_ID;
  
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
            processMotorControlCommand(commandId, payload);
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

void processMotorControlCommand(String commandId, JsonObject payload) {
  String action = payload["action"];
  
  Serial.printf("🎛️ Motor control command: %s\n", action.c_str());
  
  if (action == "start") {
    lastMotorCommand = true;
    Serial.printf("✅ Motor start command received via %s\n", commandId.c_str());
  } else if (action == "stop") {
    lastMotorCommand = false;
    Serial.printf("✅ Motor stop command received via %s\n", commandId.c_str());
  }
  
  // Send command to Sump ESP32 immediately
  sendMotorCommandToSump(lastMotorCommand);
}

void acknowledgeCommand(String commandId, String status) {
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/commands/" + commandId + "/ack";
  
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

// ========== SUMP ESP32 COMMUNICATION ==========
void checkSumpESP32Availability() {
  if (!wifiConnected) {
    sumpESP32Available = false;
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + SUMP_ESP32_IP + ":" + String(SUMP_ESP32_PORT) + "/status";
  
  if (http.begin(url)) {
    http.setTimeout(5000); // 5 second timeout
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      if (!sumpESP32Available) {
        Serial.println("✅ Sump ESP32 connection established");
      }
      sumpESP32Available = true;
    } else {
      if (sumpESP32Available) {
        Serial.printf("❌ Sump ESP32 unavailable: %d\n", httpCode);
      }
      sumpESP32Available = false;
    }
    
    http.end();
  } else {
    sumpESP32Available = false;
  }
}

void controlSumpMotor() {
  bool shouldStart = false;
  bool shouldStop = false;
  
  // Determine motor control logic
  if (currentLevel <= MOTOR_START_LEVEL && !lastMotorCommand) {
    shouldStart = true;
  } else if (currentLevel >= MOTOR_STOP_LEVEL && lastMotorCommand) {
    shouldStop = true;
  }
  
  // Send command if state changed
  if (shouldStart || shouldStop) {
    lastMotorCommand = shouldStart;
    sendMotorCommandToSump(lastMotorCommand);
    
    String action = lastMotorCommand ? "START" : "STOP";
    String reason = shouldStart ? "Top tank low" : "Top tank full";
    Serial.printf("⚙️ Motor command: %s (%s)\n", action.c_str(), reason.c_str());
  }
}

void sendMotorCommandToSump(bool start) {
  if (!sumpESP32Available || !wifiConnected) {
    Serial.println("⚠️ Motor command skipped - Sump ESP32 not available");
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + SUMP_ESP32_IP + ":" + String(SUMP_ESP32_PORT) + "/motor";
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(128);
    doc["command"] = start ? "start" : "stop";
    doc["device_id"] = DEVICE_ID;
    doc["level_percentage"] = currentLevel;
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);
    
    int httpCode = http.POST(payload);
    
    if (httpCode == 200) {
      Serial.printf("✅ Motor command sent to Sump: %s\n", start ? "START" : "STOP");
    } else {
      Serial.printf("❌ Failed to send motor command: HTTP %d\n", httpCode);
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
  if (BACKEND_ENABLED && backendAvailable && lastBackendResponse > 0 && 
      currentMillis - lastBackendResponse > PANIC_THRESHOLD_MS) {
    shouldPanic = true;
    panicReason = "Backend unresponsive for " + String(PANIC_THRESHOLD_MS/1000) + " seconds";
  }
  
  // TEMPORARILY DISABLE sensor-based panic to avoid restart loops
  // Check 2: Critical hardware failure (sensor always reading 0 or max)
  /*
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
  */
  
  // Check 3: Low memory condition
  if (ESP.getFreeHeap() < 10000) { // Less than 10KB free
    shouldPanic = true;
    panicReason = "Critical memory shortage";
  }
  
  if (shouldPanic && !systemInPanic) {
    systemInPanic = true;
    Serial.println("\n🚨 PANIC MODE ACTIVATED 🚨");
    Serial.printf("Reason: %s\n", panicReason.c_str());
    
    // Alert via buzzer
    for (int i = 0; i < 5; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      delay(200);
    }
    
    // Try to report panic to backend and cloud
    reportPanicToBackend(panicReason);
    reportPanicToCloud(panicReason);
    
    delay(5000); // Allow time for panic report
    
    Serial.println("🔄 SYSTEM RESTART DUE TO PANIC MODE");
    ESP.restart();
  }
}

void reportPanicToBackend(String reason) {
  if (!wifiConnected || !backendAvailable) return;
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/panic";
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(256);
    doc["device_id"] = DEVICE_ID;
    doc["panic_reason"] = reason;
    doc["uptime_seconds"] = (millis() - systemStartTime) / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["level_percentage"] = currentLevel;
    doc["motor_command"] = lastMotorCommand ? "start" : "stop";
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    int httpCode = http.POST(payload);
    Serial.printf("📤 Panic report sent to backend: %d\n", httpCode);
    
    http.end();
  }
}

void reportPanicToCloud(String reason) {
  if (!wifiConnected || !cloudAvailable) return;
  
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/alerts"; // Fixed: use 'alerts' table name, not 'device_alerts'
  
  if (http.begin(url)) {
    DynamicJsonDocument doc(512);
    doc["esp32_id"] = DEVICE_ID; // Fixed: use 'esp32_id' not 'device_id'
    doc["type"] = "error"; // Fixed: use 'type' not 'alert_type', and 'error' is valid enum value
    doc["severity"] = "critical";
    doc["title"] = "Panic Mode Activated"; // Added required 'title' field
    doc["message"] = reason;
    // Removed fields that don't exist in alerts table schema
    
    String payload;
    serializeJson(doc, payload);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    
    int httpCode = http.POST(payload);
    Serial.printf("☁️ Panic report sent to cloud: %d\n", httpCode);
    
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
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/scheduled-restart";
  
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

// ========== WIFI MANAGEMENT ==========
void maintainWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("📡 WiFi disconnected");
      wifiConnected = false;
      backendAvailable = false;
      cloudAvailable = false;
      sumpESP32Available = false;
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
        // Check all services availability after WiFi reconnection
        checkBackendAvailability();
        checkCloudAvailability();
        checkSumpESP32Availability();
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
  // If backend is disabled, always return false
  if (!BACKEND_ENABLED) {
    backendAvailable = false;
    return false;
  }
  
  if (!wifiConnected) {
    backendAvailable = false;
    return false;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/ping";
  
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
  String url = String("http://") + BACKEND_HOST + ":" + String(BACKEND_PORT) + "/api/esp32/sensor-data";
  
  if (http.begin(url)) {
    String timestamp = String(millis());
    
    DynamicJsonDocument doc(400);
    doc["esp32_id"] = DEVICE_ID;
    doc["tank_type"] = "top_tank";
    doc["level_percentage"] = currentLevel;
    doc["level_liters"] = currentVolume;
    doc["motor_command"] = lastMotorCommand ? "start" : "stop";
    doc["low_level_alert"] = currentLevel <= LOW_LEVEL_THRESHOLD;
    doc["critical_level_alert"] = currentLevel <= CRITICAL_LEVEL_THRESHOLD;
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

// ========== UI CONTROLS ==========
void updateLED() {
  // Status LED patterns
  if (systemInPanic) {
    // Fast blink for panic
    if (millis() - lastLedBlink >= 200) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastLedBlink = millis();
    }
  } else if (currentLevel <= CRITICAL_LEVEL_THRESHOLD) {
    // Solid on for critical level
    digitalWrite(LED_PIN, HIGH);
  } else if (currentLevel <= LOW_LEVEL_THRESHOLD) {
    // Slow blink for low level
    if (millis() - lastLedBlink >= 1000) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastLedBlink = millis();
    }
  } else {
    // Normal: LED off
    digitalWrite(LED_PIN, LOW);
  }
}

void handleBuzzer() {
  if (currentLevel <= CRITICAL_LEVEL_THRESHOLD && buzzerRingCount < 5) {
    unsigned long currentMillis = millis();
    
    if (currentMillis - lastBuzzerRing >= 500) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
      buzzerRingCount++;
      lastBuzzerRing = currentMillis;
    }
  } else if (currentLevel > CRITICAL_LEVEL_THRESHOLD) {
    buzzerRingCount = 0;
  }
  
  // Panic mode buzzer pattern
  if (systemInPanic) {
    static unsigned long lastPanicBuzz = 0;
    if (millis() - lastPanicBuzz >= 800) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      lastPanicBuzz = millis();
    }
  }
}

// ========== STATUS REPORTING ==========
void reportSystemStatus() {
  Serial.println(BACKEND_ENABLED ? 
    "\n========== ENHANCED + CLOUD TOP TANK STATUS ==========" :
    "\n========== CLOUD-ONLY TOP TANK STATUS ==========");
  Serial.printf("Device: %s (Uptime: %lu min)\n", DEVICE_ID, (millis() - systemStartTime) / 60000);
  Serial.printf("Tank: Cylinder Ø%.1fcm × %.1fcm (%.1fL capacity)\n", 
                TANK_DIAMETER_CM, TANK_HEIGHT_CM, TANK_CAPACITY_LITERS);
  Serial.printf("Water Level: %.1f%% (%.1fL)\n", currentLevel, currentVolume);
  Serial.printf("Motor Command: %s\n", lastMotorCommand ? "START" : "STOP");
  Serial.printf("Alerts: Low=%s, Critical=%s\n", 
                currentLevel <= LOW_LEVEL_THRESHOLD ? "YES" : "NO",
                currentLevel <= CRITICAL_LEVEL_THRESHOLD ? "YES" : "NO");
  Serial.printf("System Status: %s\n", systemInPanic ? "PANIC MODE" : "NORMAL");
  Serial.printf("WiFi: %s", wifiConnected ? "Connected" : "Disconnected");
  if (wifiConnected) {
    Serial.printf(" (%d dBm)", WiFi.RSSI());
  }
  Serial.println();
  Serial.printf("Backend: %s", BACKEND_ENABLED ? (backendAvailable ? "Available" : "Unavailable") : "Disabled (Cloud-Only Mode)");
  if (BACKEND_ENABLED && backendAvailable && lastBackendResponse > 0) {
    Serial.printf(" (Last response: %lu sec ago)", (millis() - lastBackendResponse) / 1000);
  }
  Serial.println();
  Serial.printf("Cloud: %s", cloudAvailable ? "Available" : "Unavailable");
  if (cloudAvailable && lastCloudResponse > 0) {
    Serial.printf(" (Last response: %lu sec ago)", (millis() - lastCloudResponse) / 1000);
  }
  Serial.println();
  Serial.printf("Sump ESP32: %s\n", sumpESP32Available ? "Available" : "Unavailable");
  Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.printf("Current Time: %02d:%02d:%02d\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  }
  
  Serial.println("======================================================\n");
}
