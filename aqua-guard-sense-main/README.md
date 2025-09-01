
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

### Backend (Supabase)
- **Database**: PostgreSQL with real-time subscriptions
- **Edge Functions**: Serverless API endpoints
- **WebSocket**: Real-time communication with ESP32 devices
- **Authentication**: Row Level Security (RLS)

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
VITE_WEBSOCKET_URL=wss://your-project.supabase.co/functions/v1/websocket
```

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

### WebSocket Events

```typescript
// ESP32 Registration
{
  type: 'esp32_register',
  esp32_id: 'ESP32_TOP_001',
  device_type: 'top_tank'
}

// Sensor Data
{
  type: 'sensor_data',
  payload: {
    tank_type: 'top_tank',
    level_percentage: 75,
    level_liters: 750
  }
}

// Motor Control
{
  type: 'motor_control',
  esp32_id: 'ESP32_SUMP_001',
  state: true // true = start, false = stop
}
```

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
   - WebSocketsClient
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
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WEBSOCKET_URL=wss://your-project.supabase.co/functions/v1/websocket

# Optional: Local development
VITE_BACKEND_URL=http://localhost:3001
```

### ESP32 Configuration

Update these values in your ESP32 firmware:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP = "YOUR_LOCAL_IP_OR_SUPABASE_URL";
const int WEBSOCKET_PORT = 8083; // or Supabase port
```

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

---

**Built with ❤️ for efficient water management**
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
