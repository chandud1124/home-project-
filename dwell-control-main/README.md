
# Dwell Control - IoT Building Management System

A modern IoT building management system that enables device control, scheduling, and monitoring through a web interface. Built with React, Node.js, and ESP32 devices communicating via REST API.

## � Features

### Device Management
- Real-time device control through REST API
- Device status monitoring
- Manual switch override support
- Power consumption tracking
- Device grouping and organization

### User Management
- Role-based access control
- User authentication and authorization
- Password reset functionality
- User activity logging

### Scheduling
- Automated device control scheduling
- Holiday scheduling
- Custom recurring schedules
- Schedule override options

### Security
- Motion detection support
- Security alerts and notifications
- Activity logging and monitoring
- Secure API communication

### Interface
- Modern, responsive web interface
- Real-time status updates
- Dark/Light theme support
- Mobile-friendly design

## 🔧 Technology Stack

### Frontend
- React with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Radix UI components
- React Query for data fetching
- React Router for navigation

### Backend
- Node.js with Express
- MongoDB for data storage
- JWT authentication
- Socket.IO for real-time updates
- REST API for device communication

### IoT Device
- ESP32 microcontroller
- REST API client
- Manual switch support
- Motion sensor integration
- Power monitoring

## 🚀 Quick Start Guide

### 1. First-Time Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/chandugowdad1124-svg/iot-project.git
   cd iot-project
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

   Create `.env` file in backend directory:
   ```env
   NODE_ENV=development
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/dwell-control
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=7d

   # Email Configuration (For password reset)
   EMAIL_SERVICE=gmail
   EMAIL_USERNAME=your-email@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   EMAIL_FROM=your-email@gmail.com
   ```

   **Important**: For EMAIL_PASSWORD, you need to:
   - Enable 2-Step Verification in Google Account
   - Generate App Password: Google Account → Security → App passwords
   - Use the generated 16-character password

3. **Frontend Setup**
   ```bash
   cd ..  # Return to project root
   npm install
   ```

   Create `.env` file in root directory:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

## � Security Features

1. **API Security**
   - JWT authentication
   - Rate limiting
   - CORS protection
   - Input validation

2. **Device Security**
   - Secure device registration
   - Command validation
   - Activity logging

3. **User Security**
   - Password hashing
   - Role-based access
   - Session management

## 📱 Mobile Support

The web interface is fully responsive and works on:
- Desktop browsers
- Mobile browsers
- Tablets
- Progressive Web App (PWA) support

## 🛠 Troubleshooting

1. **Device Connection Issues**
   - Check WiFi connectivity
   - Verify server address in config
   - Check device logs

2. **Backend Issues**
   - Verify MongoDB connection
   - Check environment variables
   - Review server logs

3. **Frontend Issues**
   - Clear browser cache
   - Check console for errors
   - Verify API endpoint configuration

## �📡 API Endpoints

### Device API
- `POST /api/device-api/:deviceId/status` - Update device status
- `GET /api/device-api/:deviceId/commands` - Get pending commands
- `POST /api/device-api/:deviceId/command` - Send command to device

### User Management
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Device Management
- `GET /api/devices` - List all devices
- `POST /api/devices` - Add new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device

### Scheduling
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### 2. Starting the Application

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm start
   ```

3. **Start Frontend** (in a new terminal)
   ```bash
   # In project root
   npm run dev
   ```

4. Access the application at `http://localhost:5173`

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

## 👥 Initial System Configuration

1. **First Admin User**
   - Register at `http://localhost:5173/register`
   - First registered user becomes admin automatically
   - Use admin account to manage users and permissions

2. **User Roles and Permissions**
   - **Admin**: Full system access
   - **Faculty**: Device control and scheduling
   - **Security**: Monitor alerts and access
   - **User**: Basic device control

3. **Device Setup**
   - Add devices through admin panel
   - Configure GPIO pins and features
   - Group devices into zones
   - Set up master switches

4. **Scheduling**
   - Create recurring schedules
   - Set up holiday calendar
   - Configure automated rules

## ⚙️ Configuration Details

### Frontend Environment (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### Backend Environment (.env)
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/dwell-control
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com
```

## 🔧 ESP32 Setup

### Hardware Configuration
1. **Basic Setup**
   - Connect relay modules to GPIO pins
   - Wire manual switches (optional)
   - Connect PIR sensors (optional)
   - Power up ESP32

2. **Wiring Guide**
   - Follow `esp32/wiring_guide.md` for detailed instructions
   - Use appropriate resistors and safety components
   - Ensure proper power supply

### Software Configuration
1. **Install Required Libraries**
   ```bash
   # Using PlatformIO
   pio lib install
   # Or check libraries.txt for Arduino IDE
   ```

2. **Configure WiFi and API**
   ```cpp
   // In config.h
   const char* ssid = "your-wifi-ssid";
   const char* password = "your-wifi-password";
   const char* api_host = "192.168.1.100"; // Backend IP
   const int api_port = 3001;
   ```

3. **Upload Firmware**
   - Use PlatformIO or Arduino IDE
   - Follow `esp32/setup_instructions.md`

## 🛠️ Troubleshooting

### Common Issues

1. **MongoDB Connection**
   - Ensure MongoDB is running
   - Check connection string
   - Verify network access

2. **Email Service**
   - Confirm Gmail 2FA is enabled
   - Verify App Password
   - Check email service logs

3. **ESP32 Connection**
   - Verify WiFi credentials
   - Check API endpoint configuration
   - Monitor serial output for errors

4. **Authentication Issues**
   - Check JWT token expiration
   - Verify user credentials
   - Clear browser cache if needed

## 📝 Development Notes

- Run `npm run dev` for development with hot-reload
- Use `npm run build` for production build
- Backend logs are in `backend/logs/`
- Check `esp32/libraries.txt` for required ESP32 libraries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

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
