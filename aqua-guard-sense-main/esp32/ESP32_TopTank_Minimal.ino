/*
 * Aqua Guard Sense - Top Tank Minimal Firmware
 * Purpose: Simple periodic top tank sensor POST + heartbeat with HMAC.
 * Replace WIFI_SSID, WIFI_PASSWORD, BACKEND_HOST, and fill secrets.h.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include "secrets.h"
#include "firmware_common.h"

// ---- User Config ----
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_HOST = "dwcouaacpqipvvsxiygo.supabase.co"; // Supabase project URL
const uint16_t BACKEND_PORT = 443;
const bool BACKEND_USE_TLS = true; // true for Supabase
#define DEVICE_ID "ESP32_TOP_002"
#define FIRMWARE_VERSION "M1"
#define BUILD_TIMESTAMP __DATE__ " " __TIME__

float readTopLevelPercent() { return 70.0 + (millis()/1000)%5; }
float readTopLevelLiters() { return readTopLevelPercent() * 10.0; }

String generateHMAC(const String &body, const String &timestamp) {
  String data = String(DEVICE_ID) + body + timestamp;
  unsigned char hmac[32];
  mbedtls_md_context_t ctx; mbedtls_md_init(&ctx);
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (mbedtls_md_setup(&ctx, info, 1) != 0) { mbedtls_md_free(&ctx); return String(); }
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)DEVICE_HMAC_SECRET, strlen(DEVICE_HMAC_SECRET));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)data.c_str(), data.length());
  mbedtls_md_hmac_finish(&ctx, hmac); mbedtls_md_free(&ctx);
  char hex[65]; for (int i=0;i<32;i++) sprintf(hex + i*2, "%02x", hmac[i]); hex[64]='\0';
  return String(hex);
}

bool postJSON(const String &json, const char* path, const String &ts, const String &sig) {
  WiFiClient *clientPtr = nullptr;
  WiFiClientSecure secureClient;
  if (BACKEND_USE_TLS) { secureClient.setInsecure(); clientPtr = &secureClient; } else { clientPtr = new WiFiClient(); }
  HTTPClient http;
  String url = String(BACKEND_USE_TLS ? "https://" : "http://") + BACKEND_HOST + ":" + BACKEND_PORT + path;
  bool begun = BACKEND_USE_TLS ? http.begin(secureClient, url) : http.begin(url);
  if (!begun) { Serial.println("HTTP begin failed"); if(!BACKEND_USE_TLS) delete clientPtr; return false; }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-api-key", DEVICE_API_KEY);
  http.addHeader("x-timestamp", ts);
  http.addHeader("x-signature", sig);
  int code = http.POST(json);
  Serial.print("POST "); Serial.print(path); Serial.print(" -> "); Serial.println(code);
  if (code != 200) Serial.println(http.getString());
  http.end(); if(!BACKEND_USE_TLS) delete clientPtr; return code==200;
}

void sendSensorData() {
  StaticJsonDocument<256> payload;
  payload["tank_type"] = "top_tank";
  payload["level_percentage"] = readTopLevelPercent();
  payload["level_liters"] = readTopLevelLiters();
  payload["esp32_id"] = DEVICE_ID;
  payload["firmware_version"] = FIRMWARE_VERSION;
  payload["build_timestamp"] = BUILD_TIMESTAMP;
  payload["protocol_version"] = FW_PROTOCOL_VERSION;

  StaticJsonDocument<256> wrap;
  wrap["type"] = "sensor_data";
  wrap["device_id"] = DEVICE_ID;
  wrap["data"] = payload;
  wrap["protocol_version"] = FW_PROTOCOL_VERSION;
  String body; serializeJson(wrap, body);
  String ts = String(millis()/1000);
  String sig = generateHMAC(body, ts);
  postJSON(body, FW_PATH_SENSOR_DATA, ts, sig);
}

void sendHeartbeat() {
  StaticJsonDocument<128> hb;
  hb["esp32_id"] = DEVICE_ID;
  hb["protocol_version"] = FW_PROTOCOL_VERSION;
  String body; serializeJson(hb, body);
  String ts = String(millis()/1000);
  String sig = generateHMAC(body, ts);
  postJSON(body, FW_PATH_HEARTBEAT, ts, sig);
}

unsigned long lastSensor=0, lastHeartbeat=0;

void setup(){
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi connecting");
  while(WiFi.status()!=WL_CONNECTED){ delay(500); Serial.print('.'); }
  Serial.println(); Serial.print("WiFi OK IP="); Serial.println(WiFi.localIP());
}

void loop(){
  unsigned long now=millis();
  if(now-lastSensor>30000){ lastSensor=now; sendSensorData(); }
  if(now-lastHeartbeat>60000){ lastHeartbeat=now; sendHeartbeat(); }
  delay(50);
}
