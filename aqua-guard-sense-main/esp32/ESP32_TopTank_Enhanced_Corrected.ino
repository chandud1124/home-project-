/*
 * AquaGuard - ESP32 Top Tank Monitor (Enhanced & Corrected)
 * Complete hybrid system with backend communication and local control
 * Fixed for ESP32 Arduino Core 3.3.0 compilation
 * 
 * Enhanced Features:
 * - Robust heartbeat system with backend health monitoring
 * - Smart restart logic (panic mode only, not WiFi disconnection)
 * - Daily automatic restart at 2:00 AM
 * - Emergency stop/reset command support
 * - Comprehensive error detection and recovery
 * - Hybrid connectivity (backend + local ESP32-to-ESP32)
 * - Fixed ESP32 3.3.0 watchdog compatibility
 * - Corrected string operations for Arduino compatibility
 * 
 * Hardware:
 * - Ultrasonic sensor (TRIG=5, ECHO=18)
 * - Status LED and buzzer for alerts
 * - Monitor-only device (no motor control, sends commands to sump)
 * 
 * Tank: Cylindrical Ø103cm × 120cm (1000L capacity)
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
#define DEVICE_ID "TOP_TANK"
#define DEVICE_NAME "Top Tank"

// ========== WIFI CONFIGURATION ==========
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ========== BACKEND CONFIGURATION ==========
#define BACKEND_HOST "192.168.0.108"  // Your backend server IP (actual computer IP)
#define BACKEND_PORT 3001
#define BACKEND_USE_HTTPS false
#define BACKEND_ENABLED true

// ========== SUMP ESP32 CONFIGURATION ==========
#define SUMP_ESP32_IP "192.168.0.184"  // Sump ESP32 IP for motor commands
#define SUMP_ESP32_PORT 80

// ========== AUTHENTICATION ==========
#define DEVICE_API_KEY "1cec808ab4d301c872af4134914447955c2e06987d6334cb3fbe365e606df9e7"
#define DEVICE_HMAC_SECRET "97cf9d3ebd75009d1b4377cf1b766ac8618e2bbb1d41ca7e918679568407b390"
// ========== HARDWARE PINS ==========
#define TRIG_PIN 5
#define ECHO_PIN 18
#define BUZZER_PIN 14
#define STATUS_LED_PIN 2
#define ALERT_LED_PIN 15

// ========== TANK CONFIGURATION ==========
#define TANK_HEIGHT_CM 120.0
#define TANK_RADIUS_CM 51.5
#define TANK_DIAMETER_CM 103.0
#define TANK_CAPACITY_LITERS 1000.0
#define SENSOR_OFFSET_CM 5.0

// ========== CONTROL LEVELS ==========
#define TOP_LOW_LEVEL 20.0
#define TOP_CRITICAL_LEVEL 10.0
#define MOTOR_START_LEVEL 30.0
#define MOTOR_STOP_LEVEL 90.0

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
#define MOTOR_COMMAND_TIMEOUT 5000    // 5 second timeout for motor commands

// ========== GLOBAL VARIABLES ==========
WebServer server(LOCAL_SERVER_PORT);

// System state
bool emergencyStopActive = false;
bool systemInPanic = false;
bool systemHealthy = true;
bool motorCommandSent = false;
String lastMotorCommand = "";
unsigned long lastMotorCommandTime = 0;

// Connection state
bool wifiConnected = false;
bool backendAvailable = false;
bool sumpEsp32Available = false;
unsigned long lastWifiConnect = 0;
unsigned long lastBackendCheck = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastSumpCheck = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastStatusReport = 0;
unsigned long bootTime = 0;
String lastError = "";
unsigned long errorCount = 0;

// Sensor data
float currentLevel = 0.0;
float currentPercentage = 0.0;
float currentVolume = 0.0;
unsigned long lastSensorRead = 0;

// Alert system
bool alertActive = false;
unsigned long lastAlertToggle = 0;
bool alertLedState = false;

// Timing variables
unsigned long previousMillis = 0;
unsigned long currentMillis = 0;

// ========== UTILITY FUNCTIONS ==========
String repeatString(String str, int count) {
  String result = "";
  for (int i = 0; i < count; i++) {
    result += str;
  }
  return result;
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n" + repeatString("=", 60));
  Serial.println("🌊 AquaGuard Top Tank Monitor (Enhanced) v2.0");
  Serial.println("📱 Device: " + String(DEVICE_ID));
  Serial.println(repeatString("=", 60));
  
  // Record boot time
  bootTime = millis();
  
  // Initialize pins
  initializePins();
  
  // Setup watchdog (must be early in setup for safety)
  setupWatchdog();
  
  // Initialize WiFi
  initializeWiFi();
  
  // Setup local web server for status and commands
  setupWebServer();
  
  // Initialize time (needed for daily restart)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  
  Serial.println("✅ Top Tank Monitor Ready - Enhanced Mode");
  Serial.println("🔍 Monitoring: Cylindrical tank, 1000L capacity");
  Serial.println("📡 Backend: " + String(BACKEND_HOST) + ":" + BACKEND_PORT);
  Serial.println("🎛️ Sump ESP32: " + String(SUMP_ESP32_IP) + ":" + SUMP_ESP32_PORT);
}

// ========== MAIN LOOP ==========
void loop() {
  currentMillis = millis();
  
  // Feed watchdog regularly
  esp_task_wdt_reset();
  
  // Handle web server requests
  server.handleClient();
  
  // Read sensor data
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensorData();
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
  
  // Update status LEDs and buzzer
  updateStatusIndicators();
  
  // Auto motor control commands to sump ESP32
  if (!systemInPanic && !emergencyStopActive) {
    autoMotorControl();
  }
  
  // Report system status periodically
  if (currentMillis - lastStatusReport >= STATUS_REPORT_INTERVAL) {
    reportSystemStatus();
    lastStatusReport = currentMillis;
  }
  
  // Check for daily restart
  checkDailyRestart();
  
  // Handle emergency conditions
  handleEmergencyConditions();
}

// ========== INITIALIZATION FUNCTIONS ==========
void initializePins() {
  // Sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Output pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(ALERT_LED_PIN, OUTPUT);
  
  // Initialize outputs to safe state
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(ALERT_LED_PIN, LOW);
  
  Serial.println("📌 All pins initialized safely");
}

void setupWatchdog() {
  // Fixed for ESP32 3.3.0 - use proper config structure
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
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n✅ WiFi Connected!");
    Serial.println("📶 IP Address: " + WiFi.localIP().toString());
    Serial.println("📶 Signal Strength: " + String(WiFi.RSSI()) + " dBm");
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    wifiConnected = false;
    Serial.println("\n❌ WiFi Connection Failed");
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}

void setupWebServer() {
  // Status endpoint
  server.on("/status", HTTP_GET, handleStatus);
  
  // Emergency stop endpoint
  server.on("/emergency-stop", HTTP_POST, handleEmergencyStop);
  
  // Emergency reset endpoint
  server.on("/emergency-reset", HTTP_POST, handleEmergencyReset);
  
  // Root page with system info
  server.on("/", HTTP_GET, handleRoot);
  
  server.begin();
  Serial.println("🌐 Web server started on port " + String(LOCAL_SERVER_PORT));
}

// ========== SENSOR FUNCTIONS ==========
void readSensorData() {
  // Trigger ultrasonic sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read echo time
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  
  if (duration > 0) {
    // Calculate distance in cm
    float distance = (duration * 0.034) / 2;
    
    // Validate sensor reading
    if (distance >= SENSOR_OFFSET_CM && distance <= (TANK_HEIGHT_CM + SENSOR_OFFSET_CM)) {
      currentLevel = TANK_HEIGHT_CM - (distance - SENSOR_OFFSET_CM);
      currentPercentage = (currentLevel / TANK_HEIGHT_CM) * 100.0;
      
      // Calculate volume for cylindrical tank
      currentVolume = (PI * TANK_RADIUS_CM * TANK_RADIUS_CM * currentLevel) / 1000.0; // liters
      
      // Ensure values are within valid ranges
      if (currentLevel < 0) currentLevel = 0;
      if (currentPercentage < 0) currentPercentage = 0;
      if (currentPercentage > 100) currentPercentage = 100;
      if (currentVolume < 0) currentVolume = 0;
      
      Serial.printf("📏 Sensor: %.1fcm | %.1f%% | %.1fL | Distance: %.1fcm\n", 
                    currentLevel, currentPercentage, currentVolume, distance);
    } else {
      Serial.printf("⚠️ Invalid sensor reading: %.1fcm (out of range)\n", distance);
      errorCount++;
    }
  } else {
    Serial.println("❌ Sensor timeout - no echo received");
    errorCount++;
  }
}

// ========== COMMUNICATION FUNCTIONS ==========
void maintainWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("📵 WiFi disconnected - attempting reconnection");
      wifiConnected = false;
      digitalWrite(STATUS_LED_PIN, LOW);
    }
    
    WiFi.reconnect();
    delay(1000);
    
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      Serial.println("✅ WiFi reconnected: " + WiFi.localIP().toString());
      digitalWrite(STATUS_LED_PIN, HIGH);
    }
  }
}

void checkBackendAvailability() {
  if (!wifiConnected) {
    backendAvailable = false;
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/health";
  
  if (http.begin(url)) {
    http.setTimeout(5000);
    int httpCode = http.GET();
    
    if (httpCode == 200) {
      if (!backendAvailable) {
        Serial.println("✅ Backend available");
        backendAvailable = true;
      }
    } else {
      if (backendAvailable) {
        Serial.printf("❌ Backend unavailable (HTTP %d)\n", httpCode);
        backendAvailable = false;
      }
    }
    http.end();
  }
}

void sendHeartbeat() {
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/heartbeat";
  
  if (http.begin(url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    // Create heartbeat payload
    DynamicJsonDocument doc(512);
    doc["device_id"] = DEVICE_ID;
    doc["device_type"] = "top_tank_monitor";
    doc["timestamp"] = millis();
    doc["uptime_ms"] = millis() - bootTime;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["level_percentage"] = currentPercentage;
    doc["water_level_cm"] = currentLevel;
    doc["volume_liters"] = currentVolume;
    doc["alert_active"] = alertActive;
    doc["emergency_stop_active"] = emergencyStopActive;
    doc["system_healthy"] = systemHealthy;
    doc["error_count"] = errorCount;
    
    String payload;
    serializeJson(doc, payload);
    
    int httpCode = http.POST(payload);
    if (httpCode == 200) {
      Serial.println("💓 Heartbeat sent successfully");
    } else {
      Serial.printf("❌ Heartbeat failed (HTTP %d)\n", httpCode);
    }
    http.end();
  }
}

String generateHMACSignature(String message) {
  // Create HMAC-SHA256 signature
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)DEVICE_HMAC_SECRET, strlen(DEVICE_HMAC_SECRET));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  // Convert to hex string
  String signature = "";
  for (int i = 0; i < 32; i++) {
    if (hmacResult[i] < 16) signature += "0";
    signature += String(hmacResult[i], HEX);
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
      
      if (!error && doc["commands"].is<JsonArray>()) {
        JsonArray commands = doc["commands"];
        
        for (JsonObject command : commands) {
          String commandId = command["id"] | "";
          String commandType = command["command_type"] | "";
          JsonObject payload = command["payload"];
          
          Serial.printf("📥 Processing command: %s (Type: %s)\n", commandId.c_str(), commandType.c_str());
          
          if (commandType == "emergency_stop") {
            processEmergencyStop(commandId, payload);
          } else if (commandType == "emergency_reset") {
            processEmergencyReset(commandId, payload);
          } else if (commandType == "system_restart") {
            processSystemRestart(commandId, payload);
          } else {
            Serial.printf("⚠️ Unknown command type: %s\n", commandType.c_str());
            acknowledgeCommand(commandId, "unknown_command_type");
          }
        }
      }
    } else if (httpCode != 404) { // 404 is normal (no commands)
      Serial.printf("❌ Command check failed (HTTP %d)\n", httpCode);
    }
    http.end();
  }
}

void processEmergencyStop(String commandId, JsonObject payload) {
  Serial.printf("🚨 EMERGENCY STOP COMMAND RECEIVED: %s\n", commandId.c_str());
  
  // Set emergency stop state
  emergencyStopActive = true;
  systemInPanic = true;
  Serial.println("🚨 SYSTEM IN EMERGENCY STATE");
  
  // Sound emergency buzzer pattern (5 quick beeps)
  for (int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  
  // Send emergency stop command to sump ESP32
  sendMotorCommand("EMERGENCY_STOP");
  
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
  
  // Send emergency reset command to sump ESP32
  sendMotorCommand("EMERGENCY_RESET");
  
  // Sound confirmation beep (2 short beeps)
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
  
  Serial.println("🔄 SYSTEM RESET COMPLETE");
  acknowledgeCommand(commandId, "emergency_reset_completed");
}

void processSystemRestart(String commandId, JsonObject payload) {
  Serial.printf("🔄 SYSTEM RESTART COMMAND RECEIVED: %s\n", commandId.c_str());
  
  // Get restart delay if provided
  int delay_ms = payload["delay_ms"] | 5000; // Default 5 second delay
  
  Serial.printf("⏰ System will restart in %d ms\n", delay_ms);
  acknowledgeCommand(commandId, "restart_scheduled");
  
  delay(delay_ms);
  ESP.restart();
}

void acknowledgeCommand(String commandId, String status) {
  if (!wifiConnected || !backendAvailable) {
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/esp32/commands/" + commandId + "/acknowledge";
  
  if (http.begin(url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    DynamicJsonDocument doc(256);
    doc["device_id"] = DEVICE_ID;
    doc["status"] = status;
    doc["timestamp"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    
    int httpCode = http.POST(payload);
    if (httpCode == 200) {
      Serial.printf("✅ Command acknowledged: %s (%s)\n", commandId.c_str(), status.c_str());
    } else {
      Serial.printf("❌ Acknowledge failed (HTTP %d)\n", httpCode);
    }
    http.end();
  }
}

// ========== MOTOR CONTROL FUNCTIONS ==========
void autoMotorControl() {
  if (currentPercentage <= MOTOR_START_LEVEL && lastMotorCommand != "START") {
    Serial.printf("🚰 Top tank low (%.1f%%) - Starting motor\n", currentPercentage);
    sendMotorCommand("START");
    lastMotorCommand = "START";
    lastMotorCommandTime = millis();
    motorCommandSent = true;
  } else if (currentPercentage >= MOTOR_STOP_LEVEL && lastMotorCommand != "STOP") {
    Serial.printf("🚰 Top tank full (%.1f%%) - Stopping motor\n", currentPercentage);
    sendMotorCommand("STOP");
    lastMotorCommand = "STOP";
    lastMotorCommandTime = millis();
    motorCommandSent = true;
  }
}

void sendMotorCommand(String command) {
  if (!wifiConnected) {
    Serial.println("❌ Cannot send motor command - WiFi not connected");
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + SUMP_ESP32_IP + ":" + SUMP_ESP32_PORT + "/motor";
  
  if (http.begin(url)) {
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(MOTOR_COMMAND_TIMEOUT);
    
    // Create proper command JSON for sump tank
    DynamicJsonDocument doc(256);
    
    // Convert commands to lowercase format expected by sump tank
    if (command == "START" || command == "start") {
      doc["command"] = "start";
    } else if (command == "STOP" || command == "stop") {
      doc["command"] = "stop";
    } else if (command == "EMERGENCY_STOP" || command == "emergency_stop") {
      doc["command"] = "emergency_stop";
    } else if (command == "EMERGENCY_RESET" || command == "emergency_reset") {
      doc["command"] = "emergency_reset";
    } else {
      String lowercaseCommand = command;
      lowercaseCommand.toLowerCase();
      doc["command"] = lowercaseCommand;
    }
    
    doc["device_id"] = DEVICE_ID;  // Must match what sump tank expects: "TOP_TANK"
    doc["source"] = "top_tank_monitor";
    doc["top_level_percentage"] = currentPercentage;
    doc["top_tank_level"] = currentLevel;
    doc["top_tank_volume"] = currentVolume;
    doc["timestamp"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    
    Serial.printf("📤 Sending to sump: %s\n", payload.c_str());
    
    int httpCode = http.POST(payload);
    if (httpCode == 200) {
      String response = http.getString();
      Serial.printf("✅ Motor command sent: %s (Response: %s)\n", command.c_str(), response.c_str());
      sumpEsp32Available = true;
    } else {
      Serial.printf("❌ Motor command failed (HTTP %d): %s\n", httpCode, command.c_str());
      sumpEsp32Available = false;
    }
    http.end();
  }
}

// ========== STATUS & ALERT FUNCTIONS ==========
void updateStatusIndicators() {
  // Update alert state
  if (currentPercentage <= TOP_CRITICAL_LEVEL) {
    if (!alertActive) {
      alertActive = true;
      Serial.println("🚨 CRITICAL WATER LEVEL ALERT ACTIVATED");
    }
  } else if (currentPercentage > TOP_LOW_LEVEL) {
    if (alertActive) {
      alertActive = false;
      Serial.println("✅ Water level alert cleared");
    }
  }
  
  // Handle alert LED flashing
  if (alertActive) {
    if (millis() - lastAlertToggle >= 500) { // Flash every 500ms
      alertLedState = !alertLedState;
      digitalWrite(ALERT_LED_PIN, alertLedState);
      lastAlertToggle = millis();
    }
  } else {
    digitalWrite(ALERT_LED_PIN, LOW);
  }
  
  // Status LED shows WiFi connection
  digitalWrite(STATUS_LED_PIN, wifiConnected ? HIGH : LOW);
}

void reportSystemStatus() {
  if (!wifiConnected || !backendAvailable) {
    return;
  }
  
  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/tanks";
  
  if (http.begin(url)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-api-key", DEVICE_API_KEY);
    
    // Create status report
    DynamicJsonDocument doc(1024);
    doc["device_id"] = DEVICE_ID;
    doc["device_type"] = "top_tank_monitor";
    doc["timestamp"] = millis();
    doc["level_percentage"] = currentPercentage;
    doc["water_level_cm"] = currentLevel;
    doc["volume_liters"] = currentVolume;
    doc["tank_capacity_liters"] = TANK_CAPACITY_LITERS;
    doc["alert_active"] = alertActive;
    doc["emergency_stop_active"] = emergencyStopActive;
    doc["system_healthy"] = systemHealthy;
    doc["wifi_connected"] = wifiConnected;
    doc["backend_available"] = backendAvailable;
    doc["sump_esp32_available"] = sumpEsp32Available;
    doc["last_motor_command"] = lastMotorCommand;
    doc["motor_command_sent"] = motorCommandSent;
    doc["uptime_ms"] = millis() - bootTime;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["error_count"] = errorCount;
    
    String payload;
    serializeJson(doc, payload);
    
    int httpCode = http.POST(payload);
    if (httpCode == 200) {
      Serial.println("📊 Status report sent successfully");
    } else {
      Serial.printf("❌ Status report failed (HTTP %d)\n", httpCode);
    }
    http.end();
  }
}

// ========== EMERGENCY & SAFETY FUNCTIONS ==========
void handleEmergencyConditions() {
  // Check for system panic conditions
  if (errorCount > 50) { // Too many sensor errors
    if (!systemInPanic) {
      systemInPanic = true;
      Serial.println("🚨 SYSTEM PANIC: Too many sensor errors");
    }
  }
  
  // Check system health
  systemHealthy = !systemInPanic && !emergencyStopActive && wifiConnected;
}

void checkDailyRestart() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    if (timeinfo.tm_hour == DAILY_RESTART_HOUR && timeinfo.tm_min == 0 && timeinfo.tm_sec < 10) {
      Serial.println("⏰ Daily restart time reached - restarting...");
      delay(2000);
      ESP.restart();
    }
  }
}

// ========== WEB SERVER HANDLERS ==========
void handleStatus() {
  DynamicJsonDocument doc(1024);
  doc["device_id"] = DEVICE_ID;
  doc["device_type"] = "top_tank_monitor";
  doc["uptime_ms"] = millis() - bootTime;
  doc["level_percentage"] = currentPercentage;
  doc["water_level_cm"] = currentLevel;
  doc["volume_liters"] = currentVolume;
  doc["alert_active"] = alertActive;
  doc["emergency_stop_active"] = emergencyStopActive;
  doc["system_healthy"] = systemHealthy;
  doc["wifi_connected"] = wifiConnected;
  doc["backend_available"] = backendAvailable;
  doc["sump_esp32_available"] = sumpEsp32Available;
  doc["last_motor_command"] = lastMotorCommand;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_rssi"] = WiFi.RSSI();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleEmergencyStop() {
  Serial.println("🚨 Web Emergency Stop Triggered");
  
  emergencyStopActive = true;
  systemInPanic = true;
  
  sendMotorCommand("EMERGENCY_STOP");
  
  server.send(200, "application/json", "{\"status\":\"emergency_stop_activated\"}");
}

void handleEmergencyReset() {
  Serial.println("🔄 Web Emergency Reset Triggered");
  
  if (emergencyStopActive) {
    emergencyStopActive = false;
    systemInPanic = false;
    
    sendMotorCommand("EMERGENCY_RESET");
    
    server.send(200, "application/json", "{\"status\":\"emergency_reset_completed\"}");
  } else {
    server.send(200, "application/json", "{\"status\":\"no_emergency_active\"}");
  }
}

void handleRoot() {
  String html = "<html><head><title>Top Tank Monitor</title></head><body>";
  html += "<h1>AquaGuard Top Tank Monitor</h1>";
  html += "<p><strong>Device ID:</strong> " + String(DEVICE_ID) + "</p>";
  html += "<p><strong>Water Level:</strong> " + String(currentPercentage, 1) + "% (" + String(currentLevel, 1) + " cm)</p>";
  html += "<p><strong>Volume:</strong> " + String(currentVolume, 1) + " L</p>";
  html += "<p><strong>WiFi:</strong> " + String(wifiConnected ? "Connected" : "Disconnected") + "</p>";
  html += "<p><strong>Backend:</strong> " + String(backendAvailable ? "Available" : "Unavailable") + "</p>";
  html += "<p><strong>Sump ESP32:</strong> " + String(sumpEsp32Available ? "Available" : "Unavailable") + "</p>";
  html += "<p><strong>Alert:</strong> " + String(alertActive ? "ACTIVE" : "Normal") + "</p>";
  html += "<p><strong>Emergency Stop:</strong> " + String(emergencyStopActive ? "ACTIVE" : "Normal") + "</p>";
  html += "<p><strong>Uptime:</strong> " + String((millis() - bootTime) / 1000) + " seconds</p>";
  html += "<p><a href='/status'>JSON Status</a></p>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}
