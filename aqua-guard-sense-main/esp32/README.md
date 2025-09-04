# ESP32 Code Repository

This folder contains the ESP32 microcontroller code for the Aqua Guard Sense water tank monitoring system.

## 🚀 **PRODUCTION DEPLOYMENT STATUS**

✅ **Backend Services**: Deployed on Supabase  
✅ **Frontend**: Deployed on Firebase  
✅ **ESP32 Firmware**: Updated for production  
✅ **WebSocket**: Ready for real-time communication  

## 📡 **PRODUCTION CONFIGURATION**

The ESP32 firmware has been updated to connect to your production Supabase backend:

- **Supabase URL**: `dwcouaacpqipvvsxiygo.supabase.co`
- **WebSocket Path**: `/functions/v1/websocket`
- **Connection**: Secure WebSocket (WSS) on port 443
- **Authentication**: Supabase anon key included

## 🔧 **BEFORE UPLOADING TO ESP32**

### **1. Update WiFi Credentials**
Edit the following in your ESP32 code:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### **2. Update Device IDs (Optional)**
```cpp
const char* DEVICE_ID = "ESP32_TOP_001";    // For top tank
const char* DEVICE_ID = "ESP32_SUMP_001";  // For sump tank
```

### **3. Verify Hardware Connections**
- AJ-SR04M Ultrasonic Sensor: TRIG → GPIO 5, ECHO → GPIO 18
- Float Switch: GPIO 4 (sump tank only)
- Manual Button: GPIO 12 (sump tank only)
- Motor Relay: GPIO 13 (sump tank only)
- Buzzer: GPIO 14 (optional)
- LED: GPIO 15 (optional)

## 🧪 **TESTING PRODUCTION SETUP**

### **1. Upload Firmware**
1. Open the appropriate `.ino` file in Arduino IDE
2. Update WiFi credentials
3. Upload to your ESP32 board
4. Open Serial Monitor (115200 baud)

### **2. Monitor Connection**
You should see in Serial Monitor:
```
Connecting to WiFi...
WiFi connected! IP: 192.168.x.x
Connecting to Supabase WebSocket...
URL: wss://dwcouaacpqipvvsxiygo.supabase.co
Path: /functions/v1/websocket
WebSocket connected!
```

### **3. Check Web Dashboard**
1. Visit: https://aqua-guard-sense.web.app
2. Login with your PIN
3. You should see real-time data from your ESP32 devices

### **4. Verify Data Flow**
- Tank levels should update every 3 seconds
- Motor status should be visible
- Alerts should appear if water levels are critical

## 📁 Files Overview

### **ESP32_TopTank_Enhanced.ino**
- **Purpose**: Controls the top water tank monitoring
- **Sensors**: Ultrasonic sensor only
- **Features**:
  - WiFi/WebSocket communication
  - Single-sensor water level monitoring
  - Real-time data transmission to backend
  - Heartbeat monitoring

### **ESP32_SumpTank_Enhanced.ino**
- **Purpose**: Controls the sump tank and motor management
- **Sensors**: Ultrasonic sensor + Float switch (dual verification)
- **Features**:
  - WiFi/WebSocket communication
  - Dual-sensor verification system
  - Automatic motor control based on top tank levels
  - Manual override button
  - Alarm system with buzzer and LED
  - Motor safety timeouts

### **ESP32_Enhanced_Configuration.md**
- Detailed configuration guide for ESP32 setup
- Pin configurations and hardware requirements
- WiFi and communication settings

### **ESP32_Integration_Guide.md**
- Integration guide for connecting ESP32 devices
- Backend communication protocols
- Troubleshooting and debugging information

## 🔧 Hardware Requirements

### **Top Tank ESP32**
- ESP32 microcontroller
- HC-SR04 ultrasonic sensor
- WiFi connectivity

### **Sump Tank ESP32**
- ESP32 microcontroller
- HC-SR04 ultrasonic sensor
- Float switch sensor
- Physical push button (manual override)
- Relay module (motor control)
- Buzzer and LED (alarm system)

## 🔊 SR04M-2 Ultrasonic Sensor Setup

The ESP32 code has been enhanced with comprehensive SR04M-2 UART ultrasonic sensor support and debugging capabilities.

### **SR04M-2 vs HC-SR04**
- **SR04M-2**: UART communication (digital serial)
- **HC-SR04**: GPIO trigger/echo (analog timing)
- **Compatibility**: SR04M-2 requires UART pins, not GPIO

### **Wiring SR04M-2 to ESP32**
```
ESP32 GPIO 17 (TX) → SR04M-2 RX (usually white/orange wire)
ESP32 GPIO 16 (RX) → SR04M-2 TX (usually green/blue wire)
ESP32 GND → SR04M-2 GND (usually black wire)
ESP32 5V → SR04M-2 VCC (usually red wire)
```

⚠️ **IMPORTANT**: SR04M-2 requires exactly **5V power supply**, not 3.3V!

### **Enhanced Debugging Features**
The code includes comprehensive testing and troubleshooting:

#### **1. Automatic Startup Tests**
- UART initialization verification
- Communication protocol testing
- Multiple command attempts (0x55, 0x01, ASCII)
- Baud rate auto-detection

#### **2. Real-time Monitoring**
- Every sensor reading logged with timestamps
- Response validation and error classification
- Distance calculation verification
- Hardware status indicators

#### **3. Troubleshooting Output**
```
🔧 Testing SR04M-2 UART Communication...
UART initialized: YES
📤 Sent measurement command (0x55)
📥 Available bytes: 9
📖 Bytes read: 9 | Data: 0xFF 0x0A 0x8C 0x00 0x00 0x00 0x00 0x00 0x6A
✅ Valid response! Distance: 270.0 cm
```

## ⚙️ Configuration

Before uploading the code:

1. **Update WiFi Credentials**:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **Set Backend Server IP**:
   ```cpp
   const char* websocket_server = "192.168.1.100"; // Your backend server IP
   ```

3. **Configure Tank Parameters**:
   - Tank height and sensor positioning
   - Motor control thresholds
   - Alarm settings

## 🚀 Setup Instructions

1. **Install Arduino IDE** with ESP32 board support
2. **Install Required Libraries**:
   - WiFi
   - WebSocketsClient
   - ArduinoJson
   - Preferences

3. **Configure Hardware Pins** (see individual .ino files for pin assignments)

4. **Upload Code** to respective ESP32 devices

5. **Power on and Monitor** serial output for connection status

## 📡 Communication Protocol

Both ESP32 devices communicate with the backend via:
- **Protocol**: WebSocket
- **Port**: 3001
- **Data Format**: JSON
- **Message Types**: heartbeat, sensor_data, motor_command, config_update

## 🔍 Monitoring

Monitor device status through:
- Serial output (Arduino IDE)
- Backend server logs
- Web interface dashboard
- WebSocket connection status

## 🛠️ Troubleshooting

### **SR04M-2 Sensor Issues**
If the sensor test fails during startup:

#### **1. No Response from Sensor**
- **Check Power**: Must be exactly 5V (not 3.3V)
- **Verify Wiring**: TX↔RX, RX↔TX, GND↔GND
- **Test Connections**: Use multimeter to verify continuity
- **Sensor Model**: Confirm it's SR04M-2 (UART), not HC-SR04 (GPIO)

#### **2. Invalid Response Format**
- **Wrong Baud Rate**: Code tests multiple rates (4800-115200)
- **Wrong Protocol**: Tests 0x55, 0x01, and ASCII commands
- **Sensor Damage**: Try different sensor if available

#### **3. Communication Errors**
- **UART Pins**: Ensure GPIO 16/17 are not used elsewhere
- **Serial Conflicts**: Check for other serial devices
- **Timing Issues**: Sensor may need more initialization time

### **General Troubleshooting**
- Check WiFi connectivity
- Verify WebSocket server is running
- Confirm IP addresses and ports
- Monitor sensor readings for accuracy
- Check hardware connections and pin assignments

### **Debug Commands**
Upload the code and monitor serial output for:
- ✅ Success indicators
- ❌ Error messages
- 📊 Data validation
- 🔧 Troubleshooting recommendations

## 📝 Notes

- Top tank: Single ultrasonic sensor monitoring
- Sump tank: Dual sensor verification + motor control
- Both devices use WiFi/WebSocket communication
- Backend server coordinates data exchange between devices
