
# Water Tank Monitoring System - Backend

## Setup Instructions

1. Install Node.js and npm
2. Navigate to the backend folder
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Tank Management
- `GET /api/tanks` - Get current tank levels
- `POST /api/tanks/reading` - Add new tank reading

### Motor Control
- `POST /api/motor/control` - Control motor (start/stop)
- `GET /api/motor/events` - Get motor event history

### System Monitoring
- `GET /api/alerts` - Get system alerts
- `POST /api/alerts` - Add new alert
- `GET /api/system/status` - Get system status
- `POST /api/system/status` - Update system status

### Analytics
- `GET /api/consumption?period=daily|monthly` - Get consumption data

## Real-time Transport (Updated)

Legacy WebSocket server replaced by Supabase Edge Function using:
- **SSE (Server-Sent Events)** for browser realtime downstream
- **HTTPS POST** for telemetry & command enqueue
- **Polling Endpoint** for device command retrieval

Command Queue Endpoints (Edge Function `websocket`):
1. Enqueue command:
```
POST /functions/v1/websocket
{ "type": "enqueue_command", "target_device_id": "SUMP_TANK_1", "command_type": "motor_start", "payload": {"requested_by":"ui"} }
```
2. Poll commands:
```
GET /functions/v1/websocket?poll=1&device_id=SUMP_TANK_1
```
3. Acknowledge command:
```
POST /functions/v1/websocket
{ "type": "acknowledge_command", "device_id": "SUMP_TANK_1", "command_id": "<uuid>", "status": "success" }
```

Telemetry POST Wrapper:
```json
{
   "apikey": "<anon key>",
   "type": "sensor_data|motor_status|system_alert|ping",
   "data": {"...": "..."},
   "firmware_version": "2.1.0",
   "build_timestamp": "2025-09-06T00:00:00Z"
}
```

## Database

Uses SQLite database stored in `water_tank.db`
