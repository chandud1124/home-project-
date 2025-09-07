# AquaGuard Hybrid Water Tank Monitoring System 🌊

## 🎯 Overview

A **smart water tank monitoring system** with **hybrid connectivity** that works both **online** and **offline**. The system automatically switches between backend connectivity for web monitoring and local ESP32-to-ESP32 communication when internet is unavailable.

### 🏗️ System Architecture

```
┌─────────────────┐    WiFi     ┌─────────────────┐
│   Top Tank      │◄──────────►│   Sump Tank     │
│   ESP32_TOP_002 │   Local     │   ESP32_SUMP_002│
└─────────┬───────┘             └─────────┬───────┘
          │                               │
          │        🌐 Internet            │
          └───────────┬───────────────────┘
                      ▼
              ┌───────────────┐
              │    Backend    │
              │ + Web Dashboard│
              └───────────────┘
```

## 📏 Tank Specifications

### **Top Tank (Water Storage)**
- **Shape**: Cylindrical
- **Dimensions**: Ø103cm × 120cm height
- **Capacity**: 1000 Liters
- **Sensor**: Ultrasonic (HC-SR04)
- **Function**: Monitor level, send motor commands

### **Sump Tank (Pump Source)**  
- **Shape**: Rectangular
- **Dimensions**: 230cm × 230cm × 250cm height
- **Capacity**: 1323 Liters (230×230×250÷1000)
- **Components**: Full control system with motor, sensors, safety features

## 🔄 Hybrid Operation Modes

### **Mode 1: Online (Backend Connected)**
✅ **Web dashboard monitoring**  
✅ **Data logging and analytics**  
✅ **Mobile app access**  
✅ **Remote notifications**  
✅ **Historical data**  

**Plus** local ESP32-to-ESP32 communication for reliability

### **Mode 2: Offline (Local Only)**  
✅ **Direct ESP32-to-ESP32 communication**  
✅ **All motor control functions work**  
✅ **LED indicators and alarms**  
✅ **Manual override switches**  
✅ **Complete system operation**  

**No** web dashboard (but system still functions perfectly)

## 🚀 Quick Setup Guide

### **Step 1: Hardware Setup**

#### Top Tank ESP32 Connections:
```
ESP32 Pin → Component
GPIO5     → Ultrasonic TRIG
GPIO18    → Ultrasonic ECHO  
GPIO2     → Status LED
3.3V      → Sensor VCC
GND       → Sensor GND
```

#### Sump Tank ESP32 Connections:
```
ESP32 Pin → Component
GPIO5     → Ultrasonic TRIG
GPIO18    → Ultrasonic ECHO
GPIO4     → Float Switch
GPIO13    → Motor Relay
GPIO14    → Buzzer
GPIO16    → Auto Mode LED
GPIO17    → Sump Full LED
GPIO21    → Sump Low LED
GPIO25    → Manual Motor Switch
GPIO26    → Mode Switch
```

### **Step 2: Software Configuration**

1. **Update WiFi Credentials** in both ESP32 codes:
```cpp
#define WIFI_SSID "YourWiFiNetwork"
#define WIFI_PASSWORD "YourWiFiPassword"
```

2. **Set IP Addresses**:
```cpp
// In Top Tank code
#define SUMP_ESP32_IP "192.168.1.101"  // Sump Tank's IP

// In both codes  
#define BACKEND_HOST "192.168.1.100"   // Your backend server IP
```

3. **Flash the codes** to respective ESP32 devices

### **Step 3: Backend Setup (Optional)**

If you want web dashboard functionality:

1. **Start backend server**:
```bash
cd backend
npm install
npm start
```

2. **Deploy frontend**:
```bash
npm install  
npm run build
npm run preview  # or deploy to Firebase
```

## 🎛️ System Operation

### **Automatic Motor Control**
- **Motor ON**: When Top Tank < 30%
- **Motor OFF**: When Top Tank > 90%
- **Safety**: Float switch prevents dry running

### **LED Indicators** (Sump Tank)
- **Auto Mode LED**: ON = Auto mode, OFF = Manual mode
- **Sump Low LED**: ON when level < 25%
- **Sump Full LED**: Blinks at 85%, Solid at 90%

### **Buzzer Alarm** (Sump Tank)  
- **Triggers**: At 90% level
- **Pattern**: 3 rings to prevent overflow

### **Manual Override**
- **Motor Switch**: Force motor ON/OFF in any mode
- **Mode Switch**: Toggle between Auto/Manual modes

## 🔧 Volume Calculations

### Top Tank (Cylindrical):
```
Volume (L) = π × r² × height × (level% / 100)
Volume (L) = π × 51.5² × 120 × (level% / 100) ÷ 1000
Max Volume = 1000L
```

### Sump Tank (Rectangular):
```
Volume (L) = length × width × height × (level% / 100)
Volume (L) = 230 × 230 × 250 × (level% / 100) ÷ 1000  
Max Volume = 1323L
```

## 📱 Mobile & Web Interface

### **Features**
- **Device Registration**: Add ESP32s via MAC/IP
- **Secret Key Generation**: Secure device authentication
- **Live Monitoring**: Real-time water levels
- **Tank Status**: Visual indicators for both tanks
- **Connection Testing**: Verify device connectivity

### **Access Methods**
- **Local Network**: `http://[frontend-ip]`
- **Mobile Browser**: Responsive design for phones
- **PWA Support**: Install as mobile app
- **Offline Capable**: Works without internet

## 🛠️ Troubleshooting

### **System Won't Start**
1. Check power connections
2. Verify WiFi credentials
3. Confirm IP address settings
4. Check serial monitor output

### **Backend Not Connecting**
1. System automatically falls back to local mode
2. Check backend server is running
3. Verify firewall settings
4. Test with: `http://[backend-ip]:3001/api/esp32/ping`

### **Motor Not Working**
1. Check float switch (safety feature)
2. Verify relay connections
3. Test manual override switches
4. Check motor power supply

### **Sensors Reading Incorrect**
1. Clean ultrasonic sensor faces
2. Check sensor mounting height
3. Verify TRIG/ECHO pin connections
4. Adjust `SENSOR_OFFSET_CM` if needed

## 🔐 Security Features

- **Device Authentication**: Secret keys for each ESP32
- **Local Network Only**: No external internet exposure required
- **HMAC Signatures**: Optional message signing
- **API Key Protection**: Backend endpoint security

## 📊 System Status Indicators

### **Top Tank ESP32**
- **LED Solid**: WiFi + Sump connected
- **LED Slow Blink**: WiFi OK, Sump disconnected  
- **LED Fast Blink**: No WiFi connection

### **Backend Status**
- **Available**: Data sent to web dashboard
- **Unavailable**: Local operation only
- **Auto-Recovery**: Checks availability every 60 seconds

## 🎯 Benefits of Hybrid System

### **Reliability**
- System works even if internet/backend fails
- Local control always available
- No single point of failure

### **Flexibility** 
- Web monitoring when connected
- Offline operation when needed
- Easy switching between modes

### **Cost Effective**
- Optional backend setup
- Works without cloud subscriptions
- Local network communication

## 📋 Bill of Materials

### **Electronics**
- 2× ESP32 Development Boards
- 2× HC-SR04 Ultrasonic Sensors  
- 1× Float Switch
- 1× Relay Module (10A)
- 1× Buzzer (5V)
- 3× LEDs + Resistors
- 2× Push Button Switches
- Jumper wires, breadboard/PCB

### **Estimated Cost**: ~$40-50 USD

## 🚀 Future Enhancements

- [ ] Solar power support
- [ ] SMS notifications
- [ ] Water quality sensors
- [ ] Multiple tank support
- [ ] Mobile app (native)
- [ ] Voice alerts
- [ ] Energy monitoring

---

## 💡 **Ready to Deploy!**

Your **AquaGuard Hybrid System** is now configured for:
- ✅ **Accurate tank dimensions** (Cylinder 1000L + Rectangle 1323L)
- ✅ **Hybrid connectivity** (Backend + Local fallback)
- ✅ **Mobile compatibility** (Responsive web interface)
- ✅ **Offline operation** (Complete local functionality)

**Upload the ESP32 codes and start monitoring your water tanks!** 🌊

---

*For support, check the troubleshooting section or refer to individual component documentation.*
