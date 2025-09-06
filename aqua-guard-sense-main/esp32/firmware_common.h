#pragma once
// Shared firmware configuration (endpoints & helpers)
// Include this AFTER secrets.h in each sketch if secrets are needed here.

// ----------------------------------------------------------------------------
// Protocol Versioning
// Increment this when you make any backward-incompatible change to payload
// structure, field naming, signing procedure, or required headers.
// Backend can branch logic or reject unsupported versions.
#ifndef FW_PROTOCOL_VERSION
#define FW_PROTOCOL_VERSION 1
#endif

// Minimum protocol version the backend currently expects (optionally embed or
// enforce in-device if you want firmware self-checks). Left as comment for now.
// #define FW_MIN_SUPPORTED_PROTOCOL 1

// ----------------------------------------------------------------------------
// Logging Macro
// Define FW_ENABLE_VERBOSE_LOG (e.g. via build flag or near the top of sketch)
// to enable FW_LOG(level, message). Levels are simple strings for now to avoid
// pulling in more dependencies; can evolve to ints or enum later.
#ifdef FW_ENABLE_VERBOSE_LOG
  #define FW_LOG(level, msg) do { \
    Serial.print("["); Serial.print(level); Serial.print("] "); Serial.println(msg); \
  } while(0)
#else
  #define FW_LOG(level, msg) do { } while(0)
#endif

// Backend endpoint paths (match Supabase Edge Functions)
static const char* FW_PATH_SENSOR_DATA = "/functions/v1/api/sensor-data";
static const char* FW_PATH_MOTOR_STATUS = "/functions/v1/api/motor-status";
static const char* FW_PATH_HEARTBEAT    = "/functions/v1/api/heartbeat";
static const char* FW_PATH_SYSTEM_ALERT = "/functions/v1/api/system-alert";

// Utility: build URL (sketch provides BACKEND_HOST, BACKEND_PORT, BACKEND_USE_TLS)
inline String fwBuildUrl(const char* host, uint16_t port, bool useTls, const char* path){
  String scheme = useTls ? "https://" : "http://";
  return scheme + String(host) + ":" + String(port) + String(path);
}

// ----------------------------------------------------------------------------
// Helper: append a common protocol_version field to a JSON String (assumes
// string ends just before the final closing brace). Usage pattern:
//   String json = "{" ... "}"; then fwInjectProtocolVersion(json);
// For more controlled construction prefer adding explicitly in sketches.
inline void fwInjectProtocolVersion(String &json){
  if(json.endsWith("}")){
    // Insert before final brace. Naive approach; ensure json was just closed.
    json.remove(json.length()-1); // remove trailing }
    if(json.indexOf(':') != -1) json += ","; // if not empty object add comma
    json += "\"protocol_version\":" + String(FW_PROTOCOL_VERSION) + "}";
  }
}

