
# IoT Home Automation System

A full-stack IoT home automation system that connects ESP32 devices via REST API to a web-based dashboard for controlling electrical switches through relay modules.

## 🏗️ Architecture

This system consists of three main components:
- **Frontend**: React + TypeScript + Tailwind CSS dashboard
- **Backend**: Node.js + Express + MongoDB + Socket.io (to be implemented)
- **ESP32 Firmware**: Arduino framework with HTTP client & WebSocket

## 🚀 Features

### Dashboard Features
- **Device Management**: Register and configure ESP32 devices
- **Switch Control**: Toggle relays via web interface or manual switches
- **PIR Sensor Integration**: Motion-based automation
- **Real-time Updates**: Bidirectional communication between web and ESP32
- **Scheduling**: Calendar-based automation
- **User Management**: Role-based access (Admin/User)

### ESP32 Integration
- Dynamic GPIO configuration
- Manual switch support with bidirectional control
- PIR sensor integration
- EEPROM state persistence
- OTA updates support
- Wi-Fi connection with fallback

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- MongoDB 4.4+
- Arduino IDE or PlatformIO for ESP32

### Frontend Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd iot-automation

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Configure environment variables (see .env.example)
# Start development server
npm run dev
```

### Backend Setup (To be implemented)
```bash
cd backend/
npm install
cp .env.example .env

# Configure MongoDB URI and other settings in .env
# Start backend server
npm run dev
```

### Environment Variables

#### Frontend (.env.local)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_WEBSOCKET_URL=ws://localhost:3001
VITE_APP_NAME=IoT Home Automation
```

#### Backend (.env)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/iot-automation
JWT_SECRET=your-jwt-secret-key
CORS_ORIGIN=http://localhost:5173
WEBSOCKET_PORT=3001
```

## 🔧 ESP32 Configuration

### Hardware Setup
1. Connect relay modules to configured GPIO pins
2. Connect manual switches (optional)
3. Connect PIR sensors (optional)
4. Power the ESP32

### Firmware Configuration
```cpp
// WiFi Configuration
const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";

// Backend API Configuration
const char* backend_host = "192.168.1.100"; // Your backend server IP
const int backend_port = 3001;
```

### Device Registration
1. Flash the ESP32 firmware
2. ESP32 will connect to WiFi and print its MAC address
3. In the admin dashboard, add a new device using the MAC address
4. Configure GPIO pins for switches and PIR sensors
5. ESP32 will automatically fetch its configuration on next boot

## 🌐 Deployment Options

### Local Network (Recommended for IoT)
1. **Raspberry Pi**: Deploy both frontend and backend
2. **Local PC/Server**: Run as Docker containers
3. **Router with OpenWrt**: Host lightweight version

### Cloud Deployment
1. **Frontend**: Vercel, Netlify, or any static hosting
2. **Backend**: Railway, Render, DigitalOcean, AWS EC2
3. **Database**: MongoDB Atlas or self-hosted

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🔐 Security Considerations

- Change default JWT secrets
- Use HTTPS in production
- Configure MongoDB authentication
- Set up proper CORS policies
- Use environment variables for sensitive data
- Regular security updates

## 📡 API Documentation

### ESP32 Endpoints
- `GET /api/device/config/:mac` - Get device configuration
- `POST /api/device/status` - Update device status
- `POST /api/switch/toggle` - Toggle switch state
- `GET /api/schedule/:deviceId` - Get scheduled tasks

### Dashboard API
- `POST /api/auth/login` - User authentication
- `GET /api/devices` - List all devices
- `POST /api/devices` - Register new device
- `PUT /api/devices/:id/gpio` - Configure GPIO pins

## 🛠️ Development

### Project Structure
```
├── src/
│   ├── components/          # React components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── backend/                # Backend server (to be created)
├── esp32-firmware/         # ESP32 Arduino code (to be created)
└── docs/                   # Documentation
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the documentation
- Review existing issues on GitHub
- Create a new issue with detailed information

## 📄 License

MIT License - see LICENSE file for details
