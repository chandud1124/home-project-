
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

## WebSocket Connection

Real-time updates are available at `ws://localhost:8083`

## Database

Uses SQLite database stored in `water_tank.db`
