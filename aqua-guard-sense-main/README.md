# Aqua Guard Sense

A comprehensive IoT solution for monitoring and controlling water tank systems with ESP32 devices, featuring real-time monitoring, automated motor control, and AI-powered analytics.
## Tech Stack

React + Vite + TypeScript, TailwindCSS (shadcn/radix UI), Supabase (Postgres + Auth + Realtime potential), Firebase Hosting (static frontend delivery), Node/Express backend (real‑time WebSocket + REST), ESP32 firmware (sensor + motor control).
## Environments & Configuration

Frontend (Vite) expects a `.env.local` populated from `.env.example`.
Backend (Express in `backend/`) expects a `.env` based on `backend/.env.example`.

Key variables:
- SUPABASE_URL / VITE_SUPABASE_URL: Project base URL
- SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY: Public anon key (frontend safe)
- SUPABASE_SERVICE_ROLE_KEY: (Backend only) Never expose client side
- PORT / WS_PORT: HTTP + WebSocket ports (defaults 3001 / 8083)

## Deployment Overview

1. Supabase: Run migrations (`supabase db push` or CLI) to provision schema & policies.
2. Backend: Deploy on a VM / container (bind 0.0.0.0, ensure env vars set). Optionally behind a reverse proxy (Caddy / Nginx) with HTTPS.
3. Frontend: `npm run build` then `firebase deploy --only hosting` (uses `firebase.json`). Supply Vite env vars at build time.
4. Devices (ESP32): Point firmware to backend public host (NOT the Firebase hosting domain; Firebase only serves static assets). Use full URL: `http://your-backend-domain/api/esp32/...`.

## Firebase vs Supabase Roles

Firebase Hosting: Serves compiled SPA, optional CDN edge caching.
Supabase: Database, future auth, row-level security, (optional) realtime channels.
Express Backend: Device ingestion, motor logic, WebSocket broadcast; can be reduced if you migrate logic into Supabase edge functions.

## Security Hardening Checklist

- [ ] Rotate any leaked anon/service keys after removing hardcoded values
- [ ] Replace permissive RLS policies with principle-of-least-privilege (device row scoping)
- [ ] Add auth middleware for control endpoints (`motor`, `alerts`, `device` config)
- [ ] Enforce HTTPS externally; redirect HTTP
- [ ] Add rate limiting + basic request validation (Zod)

## Local Development Quick Start

```bash
pnpm install # or npm install
cp .env.example .env.local
cp backend/.env.example backend/.env
# Fill in Supabase project values
pnpm --filter water-tank-backend run dev & # if using workspaces; otherwise cd backend && npm run dev
npm run dev # root - starts Vite frontend on 8081
```

Backend will log Supabase connectivity status on startup. Visit http://localhost:8081.

## ESP32 Endpoint Summary

HTTP POST endpoints:
- /api/esp32/sensor-data
- /api/esp32/heartbeat
- /api/esp32/motor-status
- /api/esp32/register

WebSocket (ws://host:WS_PORT):
- Registration message `{ type: 'esp32_register', esp32_id, ... }`
- Sensor updates `{ type: 'sensor_data', payload: { ... } }`

### Device Auth Headers (New)
All protected ESP32 POST endpoints now expect:
```
x-device-id: <DEVICE_ID>
x-api-key: <DEVICE_API_KEY>
// Optional when HMAC enabled (DEVICE_HMAC_REQUIRED=true)
x-signature: <hex sha256 hmac>
x-timestamp: <unix seconds>
```
Signature input = device_id + raw_json_body + timestamp.

### Quick Connectivity Test
`GET /api/esp32/ping` → `{ ok: true, ts: <ms> }`
`GET /healthz` → service + Supabase status.

### Minimal ESP32 HTTPS POST Snippet (Replace Edge Function approach)
```cpp
const char* BACKEND_HOST = "your-backend.example.com"; // Public backend host (no path)
const int BACKEND_PORT = 443; // 443 if using HTTPS
const char* SENSOR_PATH = "/api/esp32/sensor-data";

bool postJson(const String &path, const String &payload) {
   WiFiClientSecure client; client.setInsecure(); // or setCACert(...)
   HTTPClient https; String url = String("https://") + BACKEND_HOST + path;
   if (!https.begin(client, url)) return false;
   https.addHeader("Content-Type", "application/json");
   https.addHeader("x-device-id", DEVICE_ID);
   https.addHeader("x-api-key", DEVICE_API_KEY);
   // If HMAC enabled:
   // String ts = String(time(nullptr));
   // String sig = hmacSha256(String(DEVICE_ID) + payload + ts, DEVICE_HMAC_SECRET);
   // https.addHeader("x-timestamp", ts);
   // https.addHeader("x-signature", sig);
   int code = https.POST(payload);
   if (code > 0) Serial.printf("POST %s -> %d\n", path.c_str(), code);
   else Serial.printf("POST fail %s\n", https.errorToString(code).c_str());
   https.end(); return code == 200 || code == 201;
}
```

## Migration Path (Planned Improvements)

| Area | Current | Target |
| ---- | ------- | ------ |
| Secrets | Hardcoded fallback | Strict env only |
| RLS | Allow all | Scoped policies |
| Real-time | Custom WS | Optional Supabase realtime / SSE |
| Motor logic | In `server.js` | Isolated service + tests |
| Device auth | Table only | HMAC middleware enforced |

## Troubleshooting Device HTTP "connection refused"

1. Confirm backend process up (port 3001) and reachable from another LAN device.
2. Use LAN IP in firmware (NOT localhost / 127.0.0.1 / firebase domain).
3. Ensure firewall allows inbound port.
4. Print full URL in firmware before POST; verify matches backend.
5. If using HTTPS externally with a proxy, ensure proxy forwards to internal 3001.

## Next Steps

See SECURITY.md (to add) for refined RLS and auth guidelines. Open an issue to track each Tier 1 improvement from the audit section.

# 🚰 Aqua Guard Sense - Water Tank Monitoring System

A comprehensive IoT solution for monitoring and controlling water tank systems with ESP32 devices, featuring real-time monitoring, automated motor control, and AI-powered analytics.

## 🌟 Features

- **Real-time Monitoring**: Live water level tracking with ultrasonic sensors
- **Automated Motor Control**: Smart pump management with safety features
- **ESP32 Integration**: WiFi-connected devices for remote monitoring
- **AI Analytics**: Intelligent water usage patterns and predictions
- **PIN Security**: Secure authentication for critical operations
- **Responsive Dashboard**: Modern UI with real-time updates
- **Offline Operation**: ESP32 devices work without internet connectivity

## 🏗️ Architecture

### Backend (Supabase Edge Function)
- **Realtime (UI)**: Server-Sent Events (SSE) stream
- **Device Ingest**: HTTPS POST JSON wrapper
- **Command Queue**: In-memory per-device (enqueue / poll / acknowledge)
- **Security**: API key header + TLS root CA pinning (ESP32)
- **Future**: Optional persistence for commands

### Frontend (Firebase)
- **Hosting**: Fast, secure web hosting
- **CDN**: Global content delivery
- **SSL**: Automatic HTTPS certificates

### ESP32 Devices
- **Top Tank**: Water level monitoring
- **Sump Tank**: Motor control and dual-sensor verification
- **WiFi Communication**: Local network connectivity
- **Offline Operation**: Independent safety systems

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Supabase Account** (https://supabase.com)
3. **Firebase Account** (https://firebase.google.com)
4. **Arduino IDE** (for ESP32 programming)

### 1. Clone and Setup

```bash
git clone https://github.com/your-username/aqua-guard-sense.git
cd aqua-guard-sense
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Copy your project URL and anon key
3. Update `.env` file:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1/websocket
```

`VITE_WEBSOCKET_URL` is deprecated (SSE used instead).

4. Deploy Supabase functions:

```bash
npm run supabase:start
supabase db push
supabase functions deploy
```

### 3. Firebase Setup

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase (select Hosting):
```bash
firebase init hosting
```

4. Deploy frontend:
```bash
npm run deploy:frontend
```

### 4. ESP32 Setup

1. Open ESP32 firmware in Arduino IDE:
   - `esp32/ESP32_TopTank_Enhanced.ino` (for top tank)
   - `esp32/ESP32_SumpTank_Enhanced.ino` (for sump tank)

2. Update WiFi credentials in the firmware:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP = "YOUR_LOCAL_IP"; // Your computer's IP
```

3. Upload firmware to ESP32 devices

## 📱 Usage

### Web Dashboard

1. Open your deployed Firebase URL
2. Set a PIN for security (default: 1234)
3. Monitor real-time tank levels
4. Control motor operations
5. View AI insights and analytics

### ESP32 Operation

- **Top Tank ESP32**: Monitors water level with ultrasonic sensor
- **Sump Tank ESP32**: Controls motor with safety features
- **Offline Mode**: Devices continue operating without internet
- **Auto Mode**: Intelligent water level management

## 🔧 API Reference

### REST Endpoints

```typescript
// Get tank readings
GET /functions/v1/api/tanks

// Get motor events
GET /functions/v1/api/motor-events

// Get consumption data
GET /functions/v1/api/consumption/daily
GET /functions/v1/api/consumption/monthly

// Get alerts
GET /functions/v1/api/alerts

// Get system status
GET /functions/v1/api/system-status
```

### Command & Telemetry Flow
1. Device → Cloud: HTTPS POST `{ apikey, type, data, firmware_version, build_timestamp }`
2. Cloud → Browser: Broadcast via SSE
3. UI → Command: POST `{ type: "enqueue_command", target_device_id, command_type, payload }`
4. Device Poll: `GET /functions/v1/websocket?poll=1&device_id=ID`
5. Device Ack: POST `{ type: "acknowledge_command", device_id, command_id, status }`
6. Status rebroadcast (optional)

Current command types: `motor_start`, `motor_stop`.

## 🗄️ Database Schema

### Tables

- **tank_readings**: Sensor data from ESP32 devices
- **motor_events**: Motor start/stop events
- **alerts**: System alerts and notifications
- **system_status**: Overall system health
- **esp32_devices**: Registered ESP32 device information

## 🔒 Security Features

- **PIN Authentication**: Secure motor control operations
- **Session Management**: Temporary authentication sessions
- **Row Level Security**: Database-level access control
- **HTTPS Only**: Secure communication channels

## 🚨 Safety Features

- **Dry-Run Protection**: Prevents motor operation without water
- **Motor Timeouts**: Automatic shutdown after maximum runtime
- **Level Monitoring**: Continuous water level tracking
- **Emergency Stop**: Manual override capabilities

## 📊 Monitoring & Analytics

- **Real-time Dashboard**: Live system monitoring
- **Consumption Tracking**: Daily/monthly usage analysis
- **AI Predictions**: Tank empty time estimates
- **Alert System**: Automated notifications
- **Historical Data**: Long-term trend analysis

## 🛠️ Development

### Local Development

```bash
# Start Supabase locally
npm run supabase:start

# Start frontend development server
npm run dev

# Build for production
npm run build
```

### ESP32 Development

1. Install ESP32 board support in Arduino IDE
2. Install required libraries:
   - WiFi
   - (removed) WebSocketsClient (SSE now used)
   - ArduinoJson

3. Update firmware configuration
4. Upload to ESP32 devices

## 🚀 Deployment

### Automated Deployment

```bash
# Deploy everything
npm run deploy

# Deploy only frontend
npm run deploy:frontend

# Deploy only backend
npm run deploy:backend
```

### Manual Deployment

```bash
# Build and deploy frontend
npm run build
firebase deploy --only hosting

# Deploy Supabase functions
supabase functions deploy
```

## 📝 Configuration

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1/websocket
```
`VITE_WEBSOCKET_URL` deprecated.

### ESP32 Configuration

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_HOST = "your-project.supabase.co"; // host only
// HTTPS endpoint: https://<SUPABASE_HOST>/functions/v1/websocket
```
Firmware includes:
- Exponential backoff offline queue
- Root CA pinning (ISRG Root X1)
- Command polling + acknowledgements
- Metadata: `firmware_version`, `build_timestamp`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **ESP32 not connecting**: Check WiFi credentials and network connectivity
2. **WebSocket errors**: Verify Supabase function URLs and authentication
3. **Database errors**: Check Supabase project status and permissions
4. **Build failures**: Ensure all dependencies are installed

### Debug Mode

Enable debug logging in ESP32 firmware:
```cpp
#define DEBUG_MODE true
```

## 📞 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: ESP32_Integration_Guide.md
   - Additional: docs/DEPLOYMENT.md, docs/HEALTHCHECK.md

---

**Built with ❤️ for efficient water management**
   ```bash
   npm run dev
   ```
   - API Server: http://localhost:3001
   - SSE Stream: Edge function EventSource

### Frontend Setup
1. Navigate to frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Create a `.env` file with:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   VITE_WS_URL=ws://localhost:8083
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Frontend will run on http://localhost:8081

## Features

- **Real-time Tank Monitoring**: Monitor water levels in main tank and sump with ultrasonic sensors
- **ESP32 Integration**: Secure HTTPS POST + polling command queue
- **Motor Control**: Remote start/stop with safety interlocks and current monitoring
- **System Alerts**: Real-time notifications for system events and safety conditions
- **Historical Analytics**: Daily/monthly consumption tracking with MongoDB
- **Mobile Responsive**: Optimized for mobile devices with dark theme
- **SSE Communication**: Live data updates without page refresh
- **Cloud Database**: MongoDB for scalable data storage
- **Auto Motor Control**: Intelligent motor management based on tank levels
- **Battery Monitoring**: ESP32 battery level and WiFi signal strength tracking

## API Endpoints

### REST API (Port 3001)
- `GET /api/tanks` - Current tank levels
- `POST /api/motor/control` - Motor control
- `GET /api/alerts` - System alerts
- `GET /api/consumption` - Usage analytics

### Command Queue API (Edge Function)
- Enqueue: `POST /functions/v1/websocket` `{ type: "enqueue_command", target_device_id, command_type, payload }`
- Poll: `GET /functions/v1/websocket?poll=1&device_id=DEVICE_ID`
- Acknowledge: `POST /functions/v1/websocket` `{ type: "acknowledge_command", device_id, command_id, status }`

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Shadcn/ui components
- Recharts for data visualization
- WebSocket for real-time updates

### Backend
- Node.js with Express
- MongoDB database
- WebSocket server (ws library)
- RESTful API design
- ESP32 device management

### Hardware (ESP32)
- Ultrasonic sensors (HC-SR04)
- Current sensors (ACS712)
- Float switches
- Relay modules for motor control
- WiFi connectivity

## Testing

### Realtime Test
Use browser devtools Network tab to verify SSE stream and inspect command enqueue responses.

### ESP32 Integration
1. Follow the `esp32/ESP32_Integration_Guide.md` for hardware setup
2. Update WiFi credentials in ESP32 code
3. Upload the appropriate code to your ESP32 devices
4. Monitor real-time data in the web interface

## Configuration

### Environment Variables

**Backend (.env):**
```env
MONGODB_URI=mongodb://localhost:27017/aqua_guard
PORT=3001
WS_PORT=8083
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:8083
```

### Database Collections
- `tank_readings` - Sensor data from ESP32 devices
- `motor_events` - Motor control and status events
- `system_alerts` - System notifications and warnings
- `system_status` - Device connectivity and health status
