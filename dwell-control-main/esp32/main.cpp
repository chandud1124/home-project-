
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <EEPROM.h>
#include "config.h"

// Pin definitions
const int LED_BUILTIN_PIN = 2;
const int PIR_SENSOR_PIN = 16;
const int MANUAL_SWITCH_PINS[] = {14, 12, 13, 15}; // Manual override switches
const int RELAY_PINS[] = {2, 4, 5, 18}; // Relay control pins

// Variables
String deviceId = "";
String authToken = "";
WebSocketsClient webSocket;
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
bool pirState = false;
bool relayStates[4] = {false, false, false, false};
bool manualOverride[4] = {false, false, false, false};

void setup() {
  Serial.begin(115200);
  EEPROM.begin(512);
  
  // Initialize pins
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  pinMode(PIR_SENSOR_PIN, INPUT);
  
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    pinMode(MANUAL_SWITCH_PINS[i], INPUT_PULLUP);
    digitalWrite(RELAY_PINS[i], LOW);
  }
  
  // Load configuration from EEPROM
  loadConfiguration();
  
  // Connect to WiFi
  connectWiFi();
  
  // Register device with server
  registerDevice();
  
  // Connect to WebSocket
  connectWebSocket();
  
  Serial.println("ESP32 Classroom Automation Device Ready");
}

void loop() {
  webSocket.loop();
  
  // Check manual switches
  checkManualSwitches();
  
  // Read PIR sensor
  readPIRSensor();
  
  // Send heartbeat every 30 seconds
  if (millis() - lastHeartbeat > 30000) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  delay(100);
}

void connectWiFi() {
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
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC address: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("WiFi connection failed!");
    ESP.restart();
  }
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/devices/register");
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["name"] = DEVICE_NAME;
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = WiFi.macAddress();
  doc["location"] = DEVICE_LOCATION;
  doc["classroom"] = CLASSROOM_NAME;
  doc["firmware"] = FIRMWARE_VERSION;
  
  JsonArray switchesArray = doc.createNestedArray("switches");
  for (int i = 0; i < 4; i++) {
    JsonObject switchObj = switchesArray.createNestedObject();
    switchObj["id"] = "sw" + String(i + 1);
    switchObj["name"] = SWITCH_NAMES[i];
    switchObj["gpio"] = RELAY_PINS[i];
    switchObj["type"] = SWITCH_TYPES[i];
    switchObj["hasManualSwitch"] = true;
    switchObj["manualSwitchGpio"] = MANUAL_SWITCH_PINS[i];
  }
  
  if (HAS_PIR_SENSOR) {
    JsonObject pirObj = doc.createNestedObject("pirSensor");
    pirObj["id"] = "pir1";
    pirObj["name"] = "Motion Sensor";
    pirObj["gpio"] = PIR_SENSOR_PIN;
    pirObj["sensitivity"] = PIR_SENSITIVITY;
    pirObj["timeout"] = PIR_TIMEOUT;
    
    JsonArray linkedSwitches = pirObj.createNestedArray("linkedSwitches");
    for (int i = 0; i < 4; i++) {
      if (PIR_LINKED_SWITCHES[i]) {
        linkedSwitches.add("sw" + String(i + 1));
      }
    }
  }
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode == 200 || httpResponseCode == 201) {
    String response = http.getString();
    DynamicJsonDocument responseDoc(1024);
    deserializeJson(responseDoc, response);
    
    deviceId = responseDoc["data"]["id"].as<String>();
    authToken = responseDoc["token"].as<String>();
    
    // Save to EEPROM
    saveConfiguration();
    
    Serial.println("Device registered successfully!");
    Serial.println("Device ID: " + deviceId);
  } else {
    Serial.println("Device registration failed!");
    Serial.println("HTTP Response: " + String(httpResponseCode));
  }
  
  http.end();
}

void connectWebSocket() {
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  // Send authentication after connection
  webSocket.onEvent([](WStype_t type, uint8_t * payload, size_t length) {
    if (type == WStype_CONNECTED) {
      DynamicJsonDocument doc(256);
      doc["type"] = "auth";
      doc["deviceId"] = deviceId;
      doc["token"] = authToken;
      
      String message;
      serializeJson(doc, message);
      webSocket.sendTXT(message);
    }
  });
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected");
      break;
      
    case WStype_TEXT:
      handleWebSocketMessage((char*)payload);
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(String message) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, message);
  
  String type = doc["type"];
  
  if (type == "switch_toggle") {
    String switchId = doc["switchId"];
    bool state = doc["state"];
    int switchIndex = switchId.substring(2).toInt() - 1; // Extract number from "sw1", "sw2", etc.
    
    if (switchIndex >= 0 && switchIndex < 4) {
      toggleRelay(switchIndex, state);
      
      // Send confirmation
      sendSwitchStateUpdate(switchIndex);
    }
  }
  else if (type == "get_status") {
    sendDeviceStatus();
  }
  else if (type == "ota_update") {
    performOTAUpdate(doc["url"]);
  }
}

void toggleRelay(int relayIndex, bool state) {
  relayStates[relayIndex] = state;
  digitalWrite(RELAY_PINS[relayIndex], state ? HIGH : LOW);
  
  Serial.println("Relay " + String(relayIndex + 1) + " turned " + (state ? "ON" : "OFF"));
  
  // Log activity to server
  logActivity(relayIndex, state ? "on" : "off", "remote");
}

void checkManualSwitches() {
  for (int i = 0; i < 4; i++) {
    bool currentState = !digitalRead(MANUAL_SWITCH_PINS[i]); // Inverted because of pull-up
    
    if (currentState != manualOverride[i]) {
      manualOverride[i] = currentState;
      
      if (currentState) {
        // Manual switch pressed - toggle relay
        relayStates[i] = !relayStates[i];
        digitalWrite(RELAY_PINS[i], relayStates[i] ? HIGH : LOW);
        
        // Send update to server
        sendSwitchStateUpdate(i);
        logActivity(i, relayStates[i] ? "on" : "off", "manual");
        
        Serial.println("Manual switch " + String(i + 1) + " pressed - Relay " + (relayStates[i] ? "ON" : "OFF"));
      }
    }
  }
}

void readPIRSensor() {
  if (!HAS_PIR_SENSOR) return;
  
  if (millis() - lastSensorRead > 1000) { // Read every second
    bool currentPirState = digitalRead(PIR_SENSOR_PIN);
    
    if (currentPirState != pirState) {
      pirState = currentPirState;
      
      if (pirState) {
        Serial.println("Motion detected!");
        
        // Turn on linked switches
        for (int i = 0; i < 4; i++) {
          if (PIR_LINKED_SWITCHES[i] && !relayStates[i]) {
            toggleRelay(i, true);
            sendSwitchStateUpdate(i);
          }
        }
        
        // Send PIR event to server
        sendPIREvent(true);
      } else {
        Serial.println("Motion stopped");
        sendPIREvent(false);
      }
    }
    
    lastSensorRead = millis();
  }
}

void sendSwitchStateUpdate(int switchIndex) {
  DynamicJsonDocument doc(256);
  doc["type"] = "switch_update";
  doc["deviceId"] = deviceId;
  doc["switchId"] = "sw" + String(switchIndex + 1);
  doc["state"] = relayStates[switchIndex];
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void sendPIREvent(bool motion) {
  DynamicJsonDocument doc(256);
  doc["type"] = "pir_event";
  doc["deviceId"] = deviceId;
  doc["motion"] = motion;
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void sendHeartbeat() {
  DynamicJsonDocument doc(512);
  doc["type"] = "heartbeat";
  doc["deviceId"] = deviceId;
  doc["uptime"] = millis();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["wifiSignal"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  
  JsonArray switchStates = doc.createNestedArray("switches");
  for (int i = 0; i < 4; i++) {
    JsonObject switchObj = switchStates.createNestedObject();
    switchObj["id"] = "sw" + String(i + 1);
    switchObj["state"] = relayStates[i];
  }
  
  if (HAS_PIR_SENSOR) {
    doc["pirActive"] = pirState;
  }
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void sendDeviceStatus() {
  DynamicJsonDocument doc(512);
  doc["type"] = "device_status";
  doc["deviceId"] = deviceId;
  doc["status"] = "online";
  doc["uptime"] = formatUptime(millis());
  doc["signalStrength"] = map(WiFi.RSSI(), -100, -50, 0, 100);
  doc["firmware"] = FIRMWARE_VERSION;
  doc["freeHeap"] = ESP.getFreeHeap();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void logActivity(int switchIndex, String action, String triggeredBy) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/activities");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + authToken);
  
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["switchId"] = "sw" + String(switchIndex + 1);
  doc["action"] = action;
  doc["triggeredBy"] = triggeredBy;
  doc["timestamp"] = millis();
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode != 200 && httpResponseCode != 201) {
    Serial.println("Failed to log activity: " + String(httpResponseCode));
  }
  
  http.end();
}

void saveConfiguration() {
  EEPROM.writeString(0, deviceId);
  EEPROM.writeString(64, authToken);
  EEPROM.commit();
}

void loadConfiguration() {
  deviceId = EEPROM.readString(0);
  authToken = EEPROM.readString(64);
  
  if (deviceId.length() == 0) {
    deviceId = WiFi.macAddress();
    deviceId.replace(":", "");
  }
}

String formatUptime(unsigned long uptime) {
  unsigned long seconds = uptime / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  unsigned long days = hours / 24;
  
  return String(days) + "d " + String(hours % 24) + "h " + String(minutes % 60) + "m";
}

void performOTAUpdate(String updateUrl) {
  Serial.println("Starting OTA update from: " + updateUrl);
  // OTA implementation would go here
  // This is a placeholder for the actual OTA update code
}
