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
PROTOCOL_MIN_VERSION=1
PROTOCOL_MAX_VERSION=1
```

## 3. Supabase Migrations
From repo root:
```
supabase link --project-ref <ref>
supabase db push   # or 'supabase migration up' if using generated migrations
```
Confirm tables `tank_readings`, `motor_events`, `esp32_devices`, `alerts`, `system_status` exist.

### 3.1 Seed Device Credentials (Preferred)
Instead of using the fallback `DEVICE_KEYS_JSON`, seed devices directly:
```
supabase db execute --file supabase/seed_devices.sql
```
Edit `supabase/seed_devices.sql` first to replace placeholders (`REPLACE_API_KEY_*`).
Verify:
```
supabase db execute --file <(echo 'select id, is_active, (hmac_secret is not null) has_hmac from esp32_devices order by id;')
```

Once rows exist and devices connect, remove or keep `DEVICE_KEYS_JSON` commented out in `.env` / `backend/.env`.

## 4. Backend Deployment
### Option A: Render / Fly.io / Railway
- Set environment variables from section 2.
- Unified Mode: Leave WS_PORT unset OR set WS_PORT=PORT to have WebSocket attach to the same HTTP server.
- Dedicated Mode: Set WS_PORT to a different value (default 8083) to run a separate listener.
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
1. Edit `supabase/seed_devices.sql` with real keys.
2. Execute seeding (Section 3.1) or run manual INSERT statements.
3. Copy `esp32/secrets.example.h` → `esp32/secrets.h` and fill matching keys & HMAC secrets.
4. Flash firmware (both Top & Sump).
5. Monitor serial logs for 200 responses and correct timestamps.

## 7. Enabling Strict HMAC
After both devices confirmed working with header signatures:
```
HMAC_REQUIRED=true
```
Redeploy backend. Watch for 401 errors (timestamp drift/time sync issues).

## 7.1 Protocol Version Range
The backend enforces `protocol_version` (if provided) against an allowed range:
```
PROTOCOL_MIN_VERSION (default 1)
PROTOCOL_MAX_VERSION (default 1)
```
Firmware includes `protocol_version` in payloads. If `protocol_version` is missing while `PROTOCOL_MIN_VERSION>1`, requests are rejected (400). Lower versions return HTTP 426 with JSON `{ error:"protocol_version too low", min: <min>, received: <v> }`. Higher future versions return 400 with `{ error:"protocol_version unsupported (future)", max: <max>, received:<v> }`.
Increase `PROTOCOL_MAX_VERSION` only after backend gains compatibility with the newer firmware schema. Raise `PROTOCOL_MIN_VERSION` when dropping legacy fields.

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

## 14. (Optional) CI Failure Notifications
Add a simple webhook notifier by setting `WEBHOOK_URL` (Slack/Discord/etc.) and extending the GitHub Action to invoke `scripts/notify.js` on failure. Example payload includes repo, commit, and failing job. This helps catch accidental reactivation of `DEVICE_KEYS_JSON` or leaked secrets early.

---
End.
