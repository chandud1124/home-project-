
# Aqua Guard Sense - Water Tank Monitoring System

A comprehensive IoT water tank monitoring and control system with real-time data visualization, motor control capabilities, and ESP32 integration.

## Project Structure

```
├── frontend/          # React frontend application
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node.js backend API
│   ├── server.js
│   ├── esp32-routes.js
│   ├── package.json
│   └── test_websocket.js
├── esp32/             # ESP32 microcontroller code
│   ├── ESP32_TopTank_Enhanced.ino
│   ├── ESP32_SumpTank_Enhanced.ino
│   ├── ESP32_Enhanced_Configuration.md
│   ├── ESP32_Integration_Guide.md
│   └── README.md
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 16+
- MongoDB (local or cloud instance)
- ESP32 development board (optional)

### Backend Setup
1. Navigate to backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Create a `.env` file with:
   ```env
   MONGODB_URI=mongodb://localhost:27017/aqua_guard
   PORT=3001
   WS_PORT=8083
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```
   - API Server: http://localhost:3001
   - WebSocket Server: ws://localhost:8083

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
- **ESP32 Integration**: Direct WebSocket communication with ESP32 devices for real-time data
- **Motor Control**: Remote start/stop with safety interlocks and current monitoring
- **System Alerts**: Real-time notifications for system events and safety conditions
- **Historical Analytics**: Daily/monthly consumption tracking with MongoDB
- **Mobile Responsive**: Optimized for mobile devices with dark theme
- **WebSocket Communication**: Live data updates without page refresh
- **Cloud Database**: MongoDB for scalable data storage
- **Auto Motor Control**: Intelligent motor management based on tank levels
- **Battery Monitoring**: ESP32 battery level and WiFi signal strength tracking

## API Endpoints

### REST API (Port 3001)
- `GET /api/tanks` - Current tank levels
- `POST /api/motor/control` - Motor control
- `GET /api/alerts` - System alerts
- `GET /api/consumption` - Usage analytics

### WebSocket API (Port 8083)
- Real-time ESP32 communication
- Live data broadcasting to frontend
- Motor command transmission
- Device registration and heartbeat

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

### WebSocket Communication Test
Test the ESP32 WebSocket communication:
```bash
cd backend
node test_websocket.js
```

This will test:
- Device registration
- Sensor data transmission
- Motor status updates
- Heartbeat communication

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
