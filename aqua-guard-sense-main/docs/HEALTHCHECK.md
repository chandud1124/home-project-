# Health & Troubleshooting

## Fast Checklist
1. Backend up: `curl -s https://your-backend/healthz`
2. Device auth (no HMAC):
```
curl -H "x-device-id: ESP32_SUMP_002" -H "x-api-key: sump_key" https://your-backend/api/esp32/ping
```
3. Device auth (HMAC enabled):
```
TS=$(date +%s); BODY='{"esp32_id":"ESP32_SUMP_002"}'; \
SIG=$(printf 'ESP32_SUMP_002%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac sump_secret -hex | awk '{print $2}'); \
curl -X POST https://your-backend/api/esp32/heartbeat \
 -H 'Content-Type: application/json' \
 -H 'x-device-id: ESP32_SUMP_002' \
 -H 'x-api-key: sump_key' \
 -H "x-timestamp: $TS" \
 -H "x-signature: $SIG" \
 -d "$BODY"
```
4. WebSocket reachable: `wscat -c ws://your-backend:8083`
5. Sensor ingest sample:
```
TS=$(date +%s); BODY='{"esp32_id":"ESP32_SUMP_002","tank_type":"sump_tank","level_percentage":42}'
SIG=$(printf 'ESP32_SUMP_002%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac sump_secret -hex | awk '{print $2}')
curl -X POST https://your-backend/api/esp32/sensor-data \
 -H 'Content-Type: application/json' \
 -H 'x-device-id: ESP32_SUMP_002' -H 'x-api-key: sump_key' \
 -H "x-timestamp: $TS" -H "x-signature: $SIG" \
 -d "$BODY"
```

## Common Failures
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| 401 Invalid signature | Time drift / wrong secret | Check NTP sync, confirm secret in DB | 
| 401 Invalid device credentials | Key mismatch | Verify DB row vs secrets.h | 
| 500 Device lookup failed | Supabase outage | Retry / check Supabase status | 
| Queue growth on device | Backend unreachable | Ping backend, check WiFi RSSI | 
| Sensor data not in DB | Wrong JSON shape | Compare with working payload example | 
| WebSocket no updates | Port blocked / service down | Test healthz, open firewall |

## Working Payload Example (Sensor)
```
{
  "esp32_id": "ESP32_SUMP_002",
  "tank_type": "sump_tank",
  "level_percentage": 52.4,
  "level_liters": 310,
  "sensor_health": "good",
  "motor_running": false,
  "auto_mode": true,
  "timestamp": 1736201123
}
```

## Timestamp Policy
- All signed requests use UNIX seconds (UTC).
- Allowed drift: 300s (configurable via HMAC_TIME_DRIFT_SECONDS).
- If drift errors occur: verify NTP and local WiFi stability.

## Device NTP Verification
Serial console should print a real epoch (>1700000000). If not:
- Ensure WiFi connected before `configTime` call.
- Add secondary servers: `configTime(0,0,"pool.ntp.org","time.nist.gov","time.google.com");`

## Resetting a Device Key
1. Update `esp32_devices` row with new api_key & hmac_secret.
2. Update `esp32/secrets.h` on device.
3. Reflash.
4. Invalidate old key (remove fallback map entry if used).

## Log Levels
Set `LOG_LEVEL=silent` to reduce noise; default logs basic request lines.

## Escalation Steps
1. Capture failing curl with `-v`.
2. Enable temporary debug logging in backend (add console.log inside auth middleware for raw headers).
3. Check Supabase service status.
4. Roll back recent commit.

---
End.
