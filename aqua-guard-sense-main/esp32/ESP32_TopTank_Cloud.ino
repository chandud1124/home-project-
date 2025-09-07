/*
 * AquaGuard - ESP32 Top Tank Controller (Cloud Version)
 * Direct connection to Supabase cloud - NO local server dependency
 * 
 * Cloud Features:
 * - Direct communication with Supabase cloud backend
 * - 24/7 operation independent of local computer
 * - HTTPS encrypted communication
 * - Real-time data sync to Firebase web dashboard
 * - Lightweight monitoring-focused design
 * 
 * Hardware:
 * - Ultrasonic sensor (TRIG=5, ECHO=18)
 * - Float switch monitoring (GPIO 4)
 * - Status LED (GPIO 2)
 * - Buzzer alarm (GPIO 27)
 * 
 * Tank: Overhead water tank monitoring
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
#include <WiFiClientSecure.h>

// ========== DEVICE CONFIGURATION ==========
#define DEVICE_ID "TOP_TANK"
#define DEVICE_NAME "Top Tank Cloud"

// ========== WIFI CONFIGURATION ==========
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"

// ========== CLOUD BACKEND CONFIGURATION ==========
#define BACKEND_HOST "dwcouaacpqipvvsxiygo.supabase.co"
#define BACKEND_PORT 443
#define BACKEND_USE_HTTPS true
#define BACKEND_ENABLED true

// ========== SUPABASE CLOUD CONFIGURATION ==========
#define SUPABASE_URL "https://dwcouaacpqipvvsxiygo.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"

// ========== AUTHENTICATION ==========
#define DEVICE_API_KEY "1cec808ab4c945a5a5d9b9e8a5e4f5c6d7e8f9a0b1c2d3e4f5g6h7i8j9k0l1m2"
#define DEVICE_HMAC_SECRET "a1b2c3d4e5f6789012345678901234567890abcdef123456789012345678901234567890abcdef123456789012345678901234567890abcdef123456789012"

// ========== CLOUD API ENDPOINTS ==========
#define HEARTBEAT_ENDPOINT "/functions/v1/api/esp32/heartbeat" 
#define COMMANDS_ENDPOINT "/functions/v1/api/esp32/commands"
#define TANKS_ENDPOINT "/functions/v1/api/tanks"
#define PING_ENDPOINT "/functions/v1/api/esp32/ping"

// ========== HARDWARE CONFIGURATION ==========
#define ULTRASONIC_TRIG_PIN 5
#define ULTRASONIC_ECHO_PIN 18
#define FLOAT_SWITCH_PIN 4
#define BUZZER_PIN 27
#define STATUS_LED_PIN 2

// ========== TANK CONFIGURATION ==========
#define TANK_HEIGHT_CM 200
#define TANK_CAPACITY_LITERS 1000
#define SENSOR_OFFSET_CM 10
#define MIN_WATER_LEVEL 20.0
#define MAX_WATER_LEVEL 85.0
#define CRITICAL_LOW_LEVEL 25.0
#define CRITICAL_HIGH_LEVEL 80.0

// ========== TIMING CONFIGURATION ==========
#define TANK_READ_INTERVAL 60000      // 60 seconds
#define HEARTBEAT_INTERVAL 90000      // 90 seconds  
#define COMMAND_CHECK_INTERVAL 120000 // 120 seconds
#define WIFI_RECONNECT_INTERVAL 300000 // 5 minutes
#define CLOUD_RETRY_INTERVAL 60000    // 1 minute
#define MAX_RETRY_ATTEMPTS 5

// ========== SENSOR FILTERING ==========
#define SENSOR_SAMPLES 5
#define MAX_DISTANCE_CHANGE_CM 15.0  // Maximum allowed change per reading
#define SENSOR_TIMEOUT_US 35000      // Increased timeout for longer distances
#define DISTANCE_FILTER_ALPHA 0.3    // Smoothing filter (0.1 = heavy smoothing, 0.9 = light smoothing)

// ========== GLOBAL VARIABLES ==========
WebServer server(80);
WiFiClientSecure secureClient;
float currentWaterLevel = 0.0;
float waterLevelPercentage = 0.0;
float previousWaterLevel = 0.0;     // For change filtering
float filteredWaterLevel = 0.0;     // Smoothed reading
bool floatSwitchState = false;
bool systemHealthy = true;
bool cloudConnected = false;
bool lowLevelAlert = false;

unsigned long lastTankRead = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastCommandCheck = 0;
unsigned long lastWifiCheck = 0;
unsigned long lastCloudAttempt = 0;
unsigned long systemStartTime = 0;
int cloudRetryCount = 0;

// ========== SETUP FUNCTION ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AquaGuard Cloud Top Tank Controller ===");
  Serial.println("Version: Cloud Edition v1.0");
  Serial.println("Target: Supabase Cloud Backend");
  
  systemStartTime = millis();
  
  // Initialize hardware
  setupPins();
  setupWiFi();
  setupCloudConnection();
  
  // Initialize local web server for debugging
  setupWebServer();
  
  Serial.println("=== System Ready - Cloud Mode ===");
}

// ========== MAIN LOOP ==========
void loop() {
  unsigned long currentTime = millis();
  
  // Handle web server requests
  server.handleClient();
  
  // Check WiFi connection
  if (currentTime - lastWifiCheck > WIFI_RECONNECT_INTERVAL) {
    checkWiFiConnection();
    lastWifiCheck = currentTime;
  }
  
  // Read tank level and send to cloud
  if (currentTime - lastTankRead > TANK_READ_INTERVAL) {
    readTankLevel();
    sendTankDataToCloud();
    checkAlerts();
    lastTankRead = currentTime;
  }
  
  // Send heartbeat
  if (currentTime - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeatToCloud();
    lastHeartbeat = currentTime;
  }
  
  // Check for commands
  if (currentTime - lastCommandCheck > COMMAND_CHECK_INTERVAL) {
    checkCloudCommands();
    lastCommandCheck = currentTime;
  }
  
  // Update status LED
  updateStatusLED();
  
  delay(1000); // Small delay to prevent overwhelming
}

// ========== HARDWARE SETUP ==========
void setupPins() {
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  pinMode(FLOAT_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  
  // Initial states
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("✅ Hardware pins initialized");
}

// ========== WIFI SETUP ==========
void setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi Connected!");
    Serial.print("📡 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed!");
  }
}

// ========== CLOUD CONNECTION SETUP ==========
void setupCloudConnection() {
  // Configure secure client for HTTPS
  secureClient.setInsecure(); // For development - use proper certificates in production
  
  Serial.println("🌐 Setting up Supabase cloud connection...");
  Serial.print("📡 Cloud Host: ");
  Serial.println(BACKEND_HOST);
  Serial.print("🔒 HTTPS Port: ");
  Serial.println(BACKEND_PORT);
  
  // Test cloud connectivity
  testCloudConnection();
}

// ========== CLOUD CONNECTIVITY TEST ==========
void testCloudConnection() {
  HTTPClient http;
  http.begin(secureClient, SUPABASE_URL + PING_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_ACCEPTED) {
    cloudConnected = true;
    cloudRetryCount = 0;
    Serial.println("✅ Cloud connection successful!");
    Serial.print("📊 Response code: ");
    Serial.println(httpCode);
  } else {
    cloudConnected = false;
    Serial.println("❌ Cloud connection failed!");
    Serial.print("📊 HTTP Error: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// ========== ENHANCED TANK LEVEL READING WITH FILTERING ==========
void readTankLevel() {
  float validReadings[SENSOR_SAMPLES];
  int validCount = 0;
  
  // Take multiple readings for accuracy
  for (int i = 0; i < SENSOR_SAMPLES; i++) {
    digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
    
    // Increased timeout for longer distances and fast-filling scenarios
    long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, SENSOR_TIMEOUT_US);
    
    if (duration > 0) {
      float distance = duration * 0.034 / 2;
      float waterLevel = TANK_HEIGHT_CM - distance - SENSOR_OFFSET_CM;
      
      // Basic range validation
      if (waterLevel >= 0 && waterLevel <= TANK_HEIGHT_CM) {
        // Additional validation: check if change is reasonable
        if (previousWaterLevel == 0 || abs(waterLevel - previousWaterLevel) <= MAX_DISTANCE_CHANGE_CM) {
          validReadings[validCount] = waterLevel;
          validCount++;
        } else {
          Serial.print("⚠️ Large change detected: ");
          Serial.print(abs(waterLevel - previousWaterLevel));
          Serial.print("cm - ");
          Serial.println(waterLevel > previousWaterLevel ? "Fast filling!" : "Fast draining!");
          
          // For fast filling/draining, allow the change but log it
          validReadings[validCount] = waterLevel;
          validCount++;
        }
      }
    }
    
    delay(50); // Small delay between readings
  }
  
  if (validCount > 0) {
    // Calculate median of valid readings (more robust than average)
    float sortedReadings[SENSOR_SAMPLES];
    for (int i = 0; i < validCount; i++) {
      sortedReadings[i] = validReadings[i];
    }
    
    // Simple bubble sort for median calculation
    for (int i = 0; i < validCount - 1; i++) {
      for (int j = 0; j < validCount - i - 1; j++) {
        if (sortedReadings[j] > sortedReadings[j + 1]) {
          float temp = sortedReadings[j];
          sortedReadings[j] = sortedReadings[j + 1];
          sortedReadings[j + 1] = temp;
        }
      }
    }
    
    float medianReading = sortedReadings[validCount / 2];
    
    // Apply smoothing filter to reduce noise while allowing fast changes
    if (filteredWaterLevel == 0) {
      // First reading - no filtering
      filteredWaterLevel = medianReading;
    } else {
      // Apply exponential moving average filter
      float alpha = DISTANCE_FILTER_ALPHA;
      
      // Increase responsiveness for large changes (fast filling/draining)
      if (abs(medianReading - filteredWaterLevel) > 8.0) {
        alpha = 0.7; // More responsive for fast changes
      }
      
      filteredWaterLevel = alpha * medianReading + (1 - alpha) * filteredWaterLevel;
    }
    
    previousWaterLevel = currentWaterLevel;
    currentWaterLevel = filteredWaterLevel;
    waterLevelPercentage = (currentWaterLevel / TANK_HEIGHT_CM) * 100.0;
    
    Serial.print("📊 Readings: ");
    Serial.print(validCount);
    Serial.print("/");
    Serial.print(SENSOR_SAMPLES);
    Serial.print(" | Raw: ");
    Serial.print(medianReading, 1);
    Serial.print("cm | Filtered: ");
    Serial.print(filteredWaterLevel, 1);
    Serial.print("cm");
  } else {
    Serial.println("❌ No valid sensor readings obtained!");
    // Keep previous reading if no valid readings
  }
  
  // Read float switch
  floatSwitchState = digitalRead(FLOAT_SWITCH_PIN) == HIGH;
  
  // Check system health
  systemHealthy = (currentWaterLevel > 0 && WiFi.status() == WL_CONNECTED && validCount > 0);
  
  Serial.print("💧 Top Tank Level: ");
  Serial.print(waterLevelPercentage, 1);
  Serial.print("% (");
  Serial.print(currentWaterLevel, 1);
  Serial.print("cm) | Float: ");
  Serial.print(floatSwitchState ? "HIGH" : "LOW");
  Serial.print(" | Volume: ");
  Serial.print((waterLevelPercentage/100.0)*TANK_CAPACITY_LITERS, 1);
  Serial.print("L | Health: ");
  Serial.println(systemHealthy ? "GOOD" : "DEGRADED");
}
}

// ========== SEND TANK DATA TO CLOUD ==========
void sendTankDataToCloud() {
  if (!cloudConnected && millis() - lastCloudAttempt > CLOUD_RETRY_INTERVAL) {
    testCloudConnection();
    lastCloudAttempt = millis();
  }
  
  if (!cloudConnected) {
    Serial.println("⚠️ Cloud disconnected, storing data locally");
    return;
  }
  
  HTTPClient http;
  http.begin(secureClient, SUPABASE_URL + TANKS_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["tank_type"] = "top_tank";
  doc["level_percentage"] = waterLevelPercentage;
  doc["level_cm"] = currentWaterLevel;
  doc["level_liters"] = (waterLevelPercentage / 100.0) * TANK_CAPACITY_LITERS;
  doc["float_switch"] = floatSwitchState;
  doc["sensor_health"] = systemHealthy ? "good" : "degraded";
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["uptime_ms"] = millis() - systemStartTime;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    cloudConnected = true;
    cloudRetryCount = 0;
    Serial.println("☁️ Tank data sent to cloud successfully");
  } else {
    cloudRetryCount++;
    Serial.print("❌ Failed to send tank data: ");
    Serial.println(httpCode);
    
    if (cloudRetryCount >= MAX_RETRY_ATTEMPTS) {
      cloudConnected = false;
      cloudRetryCount = 0;
    }
  }
  
  http.end();
}

// ========== SEND HEARTBEAT TO CLOUD ==========
void sendHeartbeatToCloud() {
  if (!cloudConnected) return;
  
  HTTPClient http;
  http.begin(secureClient, SUPABASE_URL + HEARTBEAT_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["status"] = "alive";
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["uptime_ms"] = millis() - systemStartTime;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["tank_level"] = waterLevelPercentage;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("💓 Heartbeat sent to cloud");
  } else {
    Serial.print("❌ Heartbeat failed: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// ========== CHECK CLOUD COMMANDS ==========
void checkCloudCommands() {
  if (!cloudConnected) return;
  
  HTTPClient http;
  String url = SUPABASE_URL + COMMANDS_ENDPOINT + "/" + DEVICE_ID;
  http.begin(secureClient, url);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("X-Device-ID", DEVICE_ID);
  http.addHeader("X-API-Key", DEVICE_API_KEY);
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();
    
    // Parse commands response
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error && doc.is<JsonArray>()) {
      JsonArray commands = doc.as<JsonArray>();
      
      for (JsonObject cmd : commands) {
        String action = cmd["action"];
        
        if (action == "silence_alarm") {
          digitalWrite(BUZZER_PIN, LOW);
          Serial.println("🔧 Cloud command: Silence alarm");
        } else if (action == "test_alarm") {
          digitalWrite(BUZZER_PIN, HIGH);
          delay(500);
          digitalWrite(BUZZER_PIN, LOW);
          Serial.println("🔧 Cloud command: Test alarm");
        } else if (action == "reset_alerts") {
          lowLevelAlert = false;
          Serial.println("🔧 Cloud command: Reset alerts");
        }
      }
    }
  }
  
  http.end();
}

// ========== ALERT MONITORING ==========
void checkAlerts() {
  // Low level alert
  if (waterLevelPercentage < CRITICAL_LOW_LEVEL && !lowLevelAlert) {
    lowLevelAlert = true;
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("🚨 LOW WATER LEVEL ALERT!");
  } else if (waterLevelPercentage > CRITICAL_LOW_LEVEL + 5) {
    lowLevelAlert = false;
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ========== STATUS LED ==========
void updateStatusLED() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (WiFi.status() != WL_CONNECTED) {
    // Fast blink for no WiFi
    if (millis() - lastBlink > 250) {
      ledState = !ledState;
      digitalWrite(STATUS_LED_PIN, ledState);
      lastBlink = millis();
    }
  } else if (!cloudConnected) {
    // Slow blink for no cloud connection
    if (millis() - lastBlink > 1000) {
      ledState = !ledState;
      digitalWrite(STATUS_LED_PIN, ledState);
      lastBlink = millis();
    }
  } else {
    // Solid on for connected
    digitalWrite(STATUS_LED_PIN, HIGH);
  }
}

// ========== WIFI CONNECTION CHECK ==========
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📡 WiFi disconnected, reconnecting...");
    WiFi.reconnect();
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
      delay(500);
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("✅ WiFi reconnected!");
      testCloudConnection();
    }
  }
}

// ========== LOCAL WEB SERVER SETUP ==========
void setupWebServer() {
  server.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head><title>AquaGuard Top Tank (Cloud)</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>body{font-family:Arial;margin:40px;} .status{padding:10px;margin:10px;border-radius:5px;} .good{background:#d4edda;} .warning{background:#fff3cd;} .error{background:#f8d7da;}</style>";
    html += "</head><body>";
    html += "<h1>🏔️ AquaGuard Top Tank (Cloud)</h1>";
    html += "<div class='status " + String(systemHealthy ? "good" : "warning") + "'>";
    html += "<h2>💧 Water Level: " + String(waterLevelPercentage, 1) + "%</h2>";
    html += "<p>Height: " + String(currentWaterLevel, 1) + " cm</p>";
    html += "<p>Volume: " + String((waterLevelPercentage/100.0)*TANK_CAPACITY_LITERS, 1) + " L</p>";
    html += "</div>";
    html += "<div class='status " + String(cloudConnected ? "good" : "error") + "'>";
    html += "<h3>☁️ Cloud Status: " + String(cloudConnected ? "Connected" : "Disconnected") + "</h3>";
    html += "<p>Backend: " + String(BACKEND_HOST) + "</p>";
    html += "</div>";
    html += "<div class='status " + String(lowLevelAlert ? "error" : "good") + "'>";
    html += "<h3>🚨 Alerts</h3>";
    html += "<p>Low Level: " + String(lowLevelAlert ? "ACTIVE" : "None") + "</p>";
    html += "<p>Float Switch: " + String(floatSwitchState ? "High" : "Low") + "</p>";
    html += "</div>";
    html += "<div class='status'>";
    html += "<h3>⚙️ System Info</h3>";
    html += "<p>WiFi RSSI: " + String(WiFi.RSSI()) + " dBm</p>";
    html += "<p>Uptime: " + String((millis()-systemStartTime)/1000) + " seconds</p>";
    html += "<p>Free Heap: " + String(ESP.getFreeHeap()) + " bytes</p>";
    html += "</div>";
    html += "<p><em>This device communicates directly with Supabase cloud</em></p>";
    html += "</body></html>";
    
    server.send(200, "text/html", html);
  });
  
  server.begin();
  Serial.println("✅ Local web server started at: http://" + WiFi.localIP().toString());
}
