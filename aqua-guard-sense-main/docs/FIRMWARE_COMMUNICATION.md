# Firmware Communication Protocol

## Overview
Both ESP32 devices (Sump & Top) communicate with the backend over HTTPS/HTTP using signed JSON POST requests plus optional WebSocket downstream (frontend only). No direct Supabase writes occur from firmware anymore.

## Endpoints
| Purpose        | Method | Path                       | Auth | HMAC | Notes |
|----------------|--------|----------------------------|------|------|-------|
| Sensor data    | POST   | /api/esp32/sensor-data     | Yes  | Optional* | Includes level %, liters, status flags |
| Motor status   | POST   | /api/esp32/motor-status    | Yes  | Optional* | Reports running/stopped, overrides |
| Heartbeat      | POST   | /api/esp32/heartbeat       | Yes  | Optional* | Lightweight liveness ping |
| System alert   | POST   | /api/esp32/system-alert    | Yes  | Optional* | Alert type + message |
| Ping (diag)    | GET    | /api/esp32/ping            | No   | No   | Simple health JSON |

*HMAC required when backend sets `HMAC_REQUIRED=true`.

## Required Headers
```
x-device-id: <DEVICE_ID>
x-api-key: <API_KEY>
# When HMAC required/enabled on device build:
x-timestamp: <UNIX_SECONDS>
x-signature: <HMAC_SHA256_HEX>
```

Signature formula:
```
hex( HMAC_SHA256( DEVICE_HMAC_SECRET, DEVICE_ID + <raw_json_body> + <timestamp> ) )
```
All lowercase hex.

## Time Sync
- Uses NTP (pool.ntp.org, time.nist.gov) before first signed request.
- If NTP fails, firmware can fall back to `millis()` derived timestamp (NOT valid when HMAC enforced).

## Retry & Offline Queue (Sump)
- Failed POSTs are queued with exponential backoff (base 5s, capped 5m, max attempts 8).
- Dropped oldest when full (capacity 20).

## Secrets Handling
File: `esp32/secrets.h` (ignored by git).
```
#define DEVICE_API_KEY "..."
#define DEVICE_HMAC_SECRET "..."
```
Top firmware historically used `HMAC_SECRET`; compatibility macro provided in `secrets.example.h`:
```
#define HMAC_SECRET DEVICE_HMAC_SECRET
```

## Build Checklist
1. Update `BACKEND_HOST`, `BACKEND_PORT`, `BACKEND_USE_TLS`.
2. Create `secrets.h` from template with real credentials.
3. Verify device row exists in `esp32_devices` (id, api_key, hmac_secret).
4. Flash firmware; monitor serial for `HTTP: POST status 200`.
5. Enable backend `HMAC_REQUIRED=true` after both devices post successfully.

### Shared Header
`esp32/firmware_common.h` centralizes endpoint path constants (`FW_PATH_*`) and a URL builder helper. Both sketches include it to avoid duplication and drift.

### Protocol Versioning
Each payload now includes a `protocol_version` integer at multiple levels (payload + wrapper) for forward compatibility. Current constant:
```
#define FW_PROTOCOL_VERSION 1
```
Increment when changing:
- JSON field names (rename/remove) that the backend depends on
- Signing algorithm or input concatenation pattern
- Required headers / auth semantics

Backend can branch behavior or reject unsupported versions early. Devices may later enforce a `FW_MIN_SUPPORTED_PROTOCOL` via compile-time check.

Backend environment variables controlling acceptance window:
```
PROTOCOL_MIN_VERSION=1
PROTOCOL_MAX_VERSION=1
```
Responses:
- If version < min → HTTP 426 `{ error: "protocol_version too low", min, received }`
- If version > max → HTTP 400 `{ error: "protocol_version unsupported (future)", max, received }`
- If missing and `PROTOCOL_MIN_VERSION>1` → HTTP 400 `protocol_version missing`

### Logging Macro
`firmware_common.h` provides a lightweight conditional logging macro:
```
#define FW_ENABLE_VERBOSE_LOG // (define before including header to enable)
FW_LOG("INFO", "Sensor read complete");
```
When `FW_ENABLE_VERBOSE_LOG` is not defined the calls compile out (zero runtime cost). Levels are free-form strings for now; future enhancement could map to numeric severity codes.

## Error Handling Codes
- 401 Invalid credentials / signature / timestamp drift.
- 200 Success.
- 500 Backend or DB failure (retry queued).

## Future Enhancements (Optional)
- Mutual TLS (client cert) for device auth layer 2.
- Batch compression (CBOR) to reduce payload size.
- Signed configuration updates via backend → device.

---
End.
