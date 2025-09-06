# Deployment Guide

## Overview
This guide covers deploying the Aqua Guard Sense stack:
- Frontend (Vite/React) to Firebase Hosting
- Backend Express server (device + WebSocket) to your chosen host (e.g. Render, Fly.io, VPS)
- Supabase database & migrations
- ESP32 device provisioning & secrets

## 1. Prerequisites
- Node 18+
- Firebase CLI (`npm i -g firebase-tools`)
- Supabase CLI (`brew install supabase/tap/supabase` or via binary)
- GitHub repository access
- Device API keys & HMAC secrets generated

## 2. Environment Variables (Backend)
Create `backend/.env`:
```
PORT=3001
WS_PORT=8083
SUPABASE_URL=your_project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
HMAC_REQUIRED=false
HMAC_TIME_DRIFT_SECONDS=300
# Optional fallback map for quick provisioning (avoid in prod if using DB rows)
DEVICE_KEYS_JSON={"ESP32_SUMP_002":{"api_key":"sump_key","hmac_secret":"sump_secret"},"ESP32_TOP_002":{"api_key":"top_key","hmac_secret":"top_secret"}}
```

## 3. Supabase Migrations
From repo root:
```
supabase link --project-ref <ref>
supabase db push   # or 'supabase migration up' if using generated migrations
```
Confirm tables `tank_readings`, `motor_events`, `esp32_devices`, `alerts`, `system_status` exist.

## 4. Backend Deployment
### Option A: Render / Fly.io / Railway
- Set environment variables from section 2.
- Expose PORT (HTTP) and WS_PORT (WebSocket). If only one port allowed, unify by running WS on same Express server (future enhancement).
- Enable auto-redeploy on GitHub push.

### Option B: Self-hosted (PM2)
```
cd backend
npm install
node server.js
# Or
npx pm2 start server.js --name aqua-backend
```
Ensure firewall opens TCP 3001 and 8083.

## 5. Frontend Deployment (Firebase Hosting)
```
npm install
npm run build
firebase login
firebase init hosting   # if not initialized
firebase deploy --only hosting
```
Configure `public/` or `dist/` depending on `firebase.json` (already present). Update API base URL in frontend env: create `.env` in project root or use Vite env: `VITE_API_BASE=https://your-backend-domain`.

## 6. Device Provisioning Flow
1. Insert row into `esp32_devices`:
```
insert into esp32_devices (id, api_key, hmac_secret, is_active) values
('ESP32_SUMP_002','sump_key','sump_secret', true),
('ESP32_TOP_002','top_key','top_secret', true);
```
2. Copy `esp32/secrets.example.h` → `esp32/secrets.h` and fill keys.
3. Flash firmware.
4. Monitor logs (Arduino Serial Monitor) for successful POST 200s.

## 7. Enabling Strict HMAC
After both devices confirmed working with header signatures:
```
HMAC_REQUIRED=true
```
Redeploy backend. Watch for 401 errors (timestamp drift/time sync issues).

## 8. Time Sync (NTP)
Add in firmware (planned task) before first signed request:
```
configTime(0,0,"pool.ntp.org","time.nist.gov");
while(time(nullptr) < 1700000000){ delay(200); }
```
Then use `time(nullptr)` for UNIX seconds as timestamp.

## 9. Health Checks
```
curl https://your-backend/healthz
curl -H "x-device-id: ESP32_SUMP_002" -H "x-api-key: sump_key" https://your-backend/api/esp32/ping
```
When HMAC enabled:
```
TS=$(date +%s); BODY='{"test":"ping"}'; SIG=$(printf 'ESP32_SUMP_002%s%s' "$BODY" "$TS" | openssl dgst -sha256 -hmac sump_secret -hex | awk '{print $2}');
curl -X POST https://your-backend/api/esp32/heartbeat \
 -H "Content-Type: application/json" \
 -H "x-device-id: ESP32_SUMP_002" \
 -H "x-api-key: sump_key" \
 -H "x-timestamp: $TS" \
 -H "x-signature: $SIG" \
 -d '{"esp32_id":"ESP32_SUMP_002"}'
```

## 10. System Alert Test
```
curl -X POST https://your-backend/api/esp32/system-alert \
 -H "x-device-id: ESP32_SUMP_002" -H "x-api-key: sump_key" \
 -d '{"alert_type":"test","message":"hello"}'
```

## 11. Common Issues
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 invalid signature | Clock drift | Add NTP, verify timestamp | 
| 401 invalid credentials | Wrong api_key | Confirm DB row / fallback map |
| 500 Supabase error | Missing table | Run migrations |
| No WebSocket updates | WS port blocked | Open firewall / correct ws URL |

## 12. Rollback
- Revert Git commit and redeploy.
- For schema, use `supabase db reset` (DANGEROUS) or apply down migrations if tracked.

## 13. Next Enhancements
- Merge WS and HTTP on single port.
- Add JWT-based device onboarding token.
- Automatic device config push diffing.

---
End.
