# 🚀 Quick Setup Guide - AquaGuard Simple

## 📋 What You Need

### Hardware
- 2x ESP32 Dev Boards
- 2x Ultrasonic Sensors (HC-SR04 or AJ-SR04M)
- 1x Float Switch (for Sump Tank)
- 1x Relay Module (for Motor Control)
- 3x LEDs + resistors (220Ω)
- 2x Push Buttons
- 1x Buzzer
- Jumper wires and breadboard

### Software
- Arduino IDE with ESP32 support
- Firebase account (for hosting)
- Supabase account (optional, for data storage)

## ⚡ 15-Minute Setup

### Step 1: Hardware Connections (10 minutes)

**Top Tank ESP32:**
```
Ultrasonic Sensor:
TRIG → GPIO 5
ECHO → GPIO 18
VCC → 5V, GND → GND
```

**Sump Tank ESP32:**
```
Ultrasonic Sensor: TRIG → GPIO 5, ECHO → GPIO 18
Float Switch: One wire → GPIO 4, Other → GND
Motor Relay: Signal → GPIO 13
Auto LED → GPIO 16, Full LED → GPIO 17, Low LED → GPIO 21
Motor Button → GPIO 25, Mode Button → GPIO 26
Buzzer → GPIO 14
All with appropriate pull-ups and resistors
```

### Step 2: Upload ESP32 Code (3 minutes)

1. **Install Libraries in Arduino IDE:**
   - ArduinoJson (by Benoit Blanchon)
   - WebServer (built-in with ESP32)

2. **Update Configuration:**
   ```cpp
   // In both ESP32 codes, update:
   #define WIFI_SSID "YourWiFiName"
   #define WIFI_PASSWORD "YourWiFiPassword"
   #define SUMP_ESP32_IP "192.168.1.101"  // (Top Tank code only)
   ```

3. **Upload:**
   - Upload `ESP32_TopTank_Simple_Local.ino` to Top Tank ESP32
   - Upload `ESP32_SumpTank_Simple_Local.ino` to Sump Tank ESP32

### Step 3: Web Interface Setup (2 minutes)

1. **Deploy to Firebase:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

2. **Configure Devices:**
   - Open your deployed web interface
   - Add MAC addresses and IP addresses for both ESP32s
   - Generate secret keys
   - Copy secret keys to ESP32 code and re-upload
   - Test connections

## 🎯 How It Works

```
┌─────────────┐    WiFi Commands    ┌─────────────┐
│  Top Tank   │ ──────────────────► │ Sump Tank   │
│    ESP32    │                     │    ESP32    │
│             │ ◄────────────────── │             │
│ • Ultrasonic│    Status Response  │ • Ultrasonic│
│ • Monitor   │                     │ • Motor     │
│   Only      │                     │ • Safety    │
└─────────────┘                     └─────────────┘
```

**Logic:**
- Top Tank < 30% → Send "START" to Sump Tank
- Top Tank > 90% → Send "STOP" to Sump Tank  
- Sump Tank checks safety (float switch, levels) before acting

## 📱 Using the System

### Web Interface
1. **Green Status** = Device online ✅
2. **Generate Secret Key** for each device 🔑
3. **Test Connection** to verify communication 🔗
4. **Monitor** real-time levels and motor status 📊

### Physical Controls (Sump Tank)
- **Motor Button**: Manual ON/OFF (any mode)
- **Mode Button**: Switch between AUTO/MANUAL
- **LEDs**: Auto mode, Low level, High level indicators  
- **Buzzer**: 3 rings when sump reaches 90% (overflow warning)

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| ESP32 won't connect to WiFi | Check 2.4GHz network, verify credentials |
| Devices can't communicate | Ensure same network, correct IP addresses |
| Motor doesn't start | Check float switch, try manual mode |
| Web interface shows offline | Verify ESP32 IP addresses in config |

## 📞 Support

**Serial Monitor Messages:**
- `✅ WiFi Connected!` - Good to go
- `📤 Motor command sent: START` - Top Tank sending command
- `📥 Command from Top Tank: START` - Sump Tank received command
- `🔌 AUTO Motor ON` - Motor started automatically
- `🔊 ALARM Ring X/3` - Overflow warning

**Need Help?** Check the full README_Simple.md for detailed information.

---

🌊 **Your water monitoring system is ready!** The ESP32s will now communicate directly over WiFi to control your water pump automatically. No internet required! 🌊
