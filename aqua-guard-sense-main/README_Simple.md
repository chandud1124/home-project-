# AquaGuard Simple - ESP32 Water Tank Monitoring System

A simplified ESP32-based water tank monitoring system with **direct device communication** - **no internet required!**

## 🌟 System Overview

### Architecture
- **2 ESP32 Devices**: Top Tank (monitor only) + Sump Tank (full control)
- **Local WiFi Communication**: ESP32 ↔ ESP32 directly
- **No Backend Dependency**: Works completely offline
- **Web Interface**: Device configuration and monitoring

### How It Works
1. **Top Tank ESP32** monitors water level with ultrasonic sensor
2. When Top Tank < 30% → Sends "START" command to Sump Tank
3. When Top Tank > 90% → Sends "STOP" command to Sump Tank  
4. **Sump Tank ESP32** receives commands and controls motor with safety checks
5. **Web Interface** allows device configuration and real-time monitoring

## 📱 Web Interface Features

### Device Configuration
- **Separate cards** for Top Tank and Sump Tank
- **MAC & IP Address** entry for each device
- **Secret key generation** for secure communication
- **Connection testing** to verify device status

### Real-Time Monitoring  
- **Live water levels** for both tanks
- **Motor status** (running/stopped, auto/manual mode)
- **Safety indicators** (float switch status)
- **Visual level indicators** with color coding

## 🔧 Hardware Setup

### Top Tank ESP32 (Monitor Only)
**Components:**
- ESP32 Dev Board
- Ultrasonic sensor (HC-SR04 or AJ-SR04M)

**Connections:**
```
Ultrasonic Sensor:
- TRIG → GPIO 5
- ECHO → GPIO 18
- VCC → 5V
- GND → GND

Status LED:
- Built-in LED (GPIO 2)
```

### Sump Tank ESP32 (Full Control)
**Components:**
- ESP32 Dev Board  
- Ultrasonic sensor (HC-SR04 or AJ-SR04M)
- Float switch (normally open)
- Relay module (for motor control)
- LEDs (3x for indicators)
- Push buttons (2x for manual control)
- Buzzer (for alarm)

**Connections:**
```
Ultrasonic Sensor:
- TRIG → GPIO 5
- ECHO → GPIO 18
- VCC → 5V / GND → GND

Float Switch:
- One wire → GPIO 4
- Other wire → GND
- (Internal pull-up enabled)

Motor Relay:
- Signal → GPIO 13
- VCC → 3.3V / GND → GND

LEDs:
- Auto Mode LED → GPIO 16 (ON=Auto, OFF=Manual)
- Sump Full LED → GPIO 17 (Blinks at 85%, Solid at 90%)
- Sump Low LED → GPIO 21 (ON when <25%)
- Each LED: Anode → GPIO, Cathode → 220Ω resistor → GND

Manual Switches:
- Motor ON/OFF → GPIO 25 (other wire to GND, pull-up enabled)  
- Auto/Manual → GPIO 26 (other wire to GND, pull-up enabled)

Buzzer:
- Positive → GPIO 14
- Negative → GND
```

## 💻 Software Setup

### 1. Web Interface Deployment

**Firebase Hosting:**
```bash
npm install
npm run build
firebase deploy --only hosting
```

**Supabase Backend** (for device data storage):
```bash
# Device configurations stored in Supabase
# Real-time data sync (optional)
```

### 2. ESP32 Programming

**Step 1: Configure WiFi and Device Settings**

For **Top Tank ESP32**, update these in the code:
```cpp
#define WIFI_SSID "YourWiFiNetwork"
#define WIFI_PASSWORD "YourWiFiPassword"  
#define SUMP_ESP32_IP "192.168.1.101"  // Sump Tank IP
#define DEVICE_SECRET "your_generated_secret_key"
```

For **Sump Tank ESP32**, update these:
```cpp
#define WIFI_SSID "YourWiFiNetwork"
#define WIFI_PASSWORD "YourWiFiPassword"
#define DEVICE_SECRET "your_generated_secret_key"
```

**Step 2: Upload Code**
1. Open Arduino IDE
2. Install ESP32 board support and required libraries:
   - WiFi library (built-in)
   - ArduinoJson library
   - WebServer library (built-in)
3. Upload `ESP32_TopTank_Simple_Local.ino` to Top Tank ESP32
4. Upload `ESP32_SumpTank_Simple_Local.ino` to Sump Tank ESP32

**Step 3: Web Configuration**
1. Open the web interface
2. Enter MAC address and IP address for each ESP32  
3. Click "Generate Secret Key" for each device
4. Copy the secret key to your ESP32 code
5. Re-upload the ESP32 code with the secret keys
6. Click "Test Connection" to verify communication

## 🚦 System Operation

### Automatic Mode (Default)
- **Top Tank < 30%** → Motor START command sent to Sump Tank
- **Top Tank > 90%** → Motor STOP command sent to Sump Tank
- **Sump Tank** verifies safety conditions:
  - Float switch must detect water
  - Sump level must be > 75% to start motor
  - Motor stops if sump < 25% (safety)

### Manual Mode
- Switch Mode button on Sump Tank to toggle Auto/Manual
- Motor ON/OFF button works in any mode for emergency control
- Auto Mode LED indicates current mode

### Safety Features
- **Float switch verification** before motor start
- **Buzzer alarm** at 90% sump level (3 rings)
- **Emergency stop** if sump level too low
- **Manual override** available at all times

### LED Indicators
- **Auto Mode LED** (GPIO 16): ON = Auto, OFF = Manual
- **Sump Low LED** (GPIO 21): ON when level < 25%
- **Sump Full LED** (GPIO 17): 
  - OFF: Level < 85%
  - BLINKING: Level 85-89%
  - SOLID ON: Level ≥ 90%

## 🔗 Communication Protocol

### Top Tank → Sump Tank Commands
```json
POST http://SUMP_IP/motor_control
Authorization: [SECRET_KEY]
{
  "device_id": "ESP32_TOP_002",
  "command": "start|stop", 
  "top_tank_level": 25.5,
  "timestamp": 1234567890,
  "reason": "top_tank_low|top_tank_full"
}
```

### Response from Sump Tank
```json
{
  "status": "ok",
  "sump_level": 67.3,
  "motor_running": true,
  "float_switch": true,
  "auto_mode": true
}
```

### Status Monitoring
```
GET http://DEVICE_IP/status
Authorization: [SECRET_KEY]
```

## 📊 Monitoring Dashboard

### Top Tank Display
- **Water Level**: Large percentage display with color coding
- **Status**: Motor command being sent (START/STOP/Normal)
- **Connection**: Live indicator when device is responding

### Sump Tank Display  
- **Water Level**: Percentage with safety level indicators
- **Motor Status**: Running/Stopped with mode indication
- **Float Switch**: Water presence verification
- **Level Warnings**: Visual indicators for low/high/critical levels

### System Status
- **Device Connectivity**: Online/Offline status for each ESP32
- **Communication**: Last update timestamps
- **Network**: WiFi signal strength and connection quality

## 🚀 Deployment Guide

### Prerequisites
- Firebase account for hosting
- Supabase account for backend (optional)
- Local WiFi network
- 2x ESP32 devices with sensors

### Step-by-Step Deployment

1. **Setup Web Interface**
   ```bash
   git clone [repository]
   cd aqua-guard-sense-main
   npm install
   firebase init hosting
   npm run build
   firebase deploy
   ```

2. **Configure ESP32 Devices**
   - Flash firmware to both ESP32s
   - Connect to web interface
   - Add device MAC/IP addresses  
   - Generate and apply secret keys
   - Test connections

3. **Hardware Installation**
   - Install sensors in tanks
   - Mount ESP32s in weatherproof enclosures
   - Connect relays and safety switches
   - Test all connections

4. **System Testing**
   - Verify water level readings
   - Test motor control commands
   - Confirm safety features (float switch, buzzer)
   - Test manual overrides

## ⚡ Key Advantages

✅ **No Internet Required** - Works on local WiFi only  
✅ **Simple Setup** - Just 2 ESP32s with basic sensors  
✅ **Reliable Communication** - Direct device-to-device  
✅ **Safety First** - Multiple safety checks and manual overrides  
✅ **Real-Time Monitoring** - Live status via web interface  
✅ **Easy Configuration** - Web-based device management  
✅ **Offline Operation** - Continues working without web interface  

## 🔧 Troubleshooting

### Common Issues

**ESP32 not connecting to WiFi:**
- Check SSID and password in code
- Verify WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)
- Check signal strength near installation location

**Devices not communicating:**
- Verify both ESP32s are on same WiFi network
- Check IP addresses are correct
- Ensure secret keys match between devices
- Test with ping command: `ping [device_ip]`

**Motor not responding:**
- Check relay connections and power supply
- Verify float switch is working
- Test in manual mode first
- Check buzzer/LED indicators for status

**Web interface not updating:**
- Check device IP addresses in configuration
- Verify devices are online and responding
- Check browser console for errors
- Ensure CORS is properly configured

### Status Codes
- **Green Status**: Device online and responding
- **Yellow Status**: WiFi connected, device not responding  
- **Red Status**: WiFi disconnected or unreachable

This system provides a robust, offline-capable water tank monitoring solution perfect for residential or commercial applications where internet connectivity is unreliable or unnecessary.
