 # ESP32 Standalone Code - Quick Setup Guide

## 📁 File: `ESP32_Standalone.ino`

This is a **complete, ready-to-use ESP32 code** that combines all the features from your water tank monitoring system. It's designed to be easy to configure and upload.

## ⚙️ Quick Configuration (3 Steps)

### Step 1: Update WiFi Settings
```cpp
// Line 22-23: Update your WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### Step 2: Update Server IP
```cpp
// Line 26: Update your backend server IP
const char* SERVER_IP = "192.168.1.100";  // ← Your computer's IP
```

### Step 3: Choose Device Type
```cpp
// Line 29: Choose your device type
const char* DEVICE_TYPE = "sump_tank";  // "top_tank" or "sump_tank"
```

## 🔧 Hardware Setup

### For TOP TANK (monitoring only):
- ✅ HC-SR04 Ultrasonic Sensor (GPIO 5, 18)
- ❌ No float switch needed
- ❌ No motor relay needed
- ❌ No manual button needed

### For SUMP TANK (full control):
- ✅ HC-SR04 Ultrasonic Sensor (GPIO 5, 18)
- ✅ Float Switch (GPIO 4) - optional but recommended
- ✅ Manual Button (GPIO 12) - optional
- ✅ Motor Relay (GPIO 13) - for pump control
- ✅ Buzzer (GPIO 14) - optional
- ✅ LED (GPIO 15) - optional

## 🚀 Upload Instructions

1. **Open Arduino IDE**
2. **File → Open** → Navigate to `esp32/ESP32_Standalone.ino`
3. **Tools → Board → ESP32 Dev Module**
4. **Tools → Port → Select your ESP32 port**
5. **Update configuration** (WiFi, IP, device type)
6. **Upload** (Ctrl+U)

## 📊 Features Included

### ✅ Always Available:
- WiFi connectivity
- WebSocket communication
- Ultrasonic water level monitoring
- Real-time data transmission
- Heartbeat monitoring

### 🔧 Optional Features (enable by hardware):
- Dual-sensor verification (ultrasonic + float switch)
- Manual motor control button
- Automatic motor control
- Safety timeouts
- Visual/audio alerts

## 🔍 Testing Your Setup

After upload, open **Serial Monitor** and look for:

```
=== Aqua Guard Sense ESP32 Starting ===
Connecting to WiFi: YOUR_WIFI_NAME
✅ WiFi connected!
IP Address: 192.168.1.xxx
Connecting to WebSocket: ws://192.168.1.100:3001
✅ WebSocket connected
📡 Device registered with server
💓 Heartbeat sent
📊 Sensor data sent - Level: XX%
```

## 🛠️ Troubleshooting

### WiFi Issues:
- Check SSID and password
- Ensure ESP32 and computer are on same network
- Try different WiFi channel

### WebSocket Issues:
- Verify server IP address
- Check if backend server is running
- Confirm port 3001 is not blocked by firewall

### Sensor Issues:
- Check ultrasonic sensor wiring (5V, GND, Trig, Echo)
- Verify GPIO pins match configuration
- Test sensor with basic ultrasonic example first

## 📋 Pin Reference

| Component | GPIO Pin | Purpose |
|-----------|----------|---------|
| Ultrasonic Trig | 5 | Trigger pulse |
| Ultrasonic Echo | 18 | Echo receiver |
| Float Switch | 4 | Water level backup |
| Manual Button | 12 | Manual override |
| Motor Relay | 13 | Pump control |
| Buzzer | 14 | Audio alerts |
| LED | 15 | Visual indicators |

## 🎯 Device Types

### Top Tank Mode:
- Monitors water level only
- Sends data to backend
- No motor control

### Sump Tank Mode:
- Monitors water level
- Controls pump motor
- Auto/manual operation
- Safety features

## 🔄 Communication Protocol

- **Protocol**: WebSocket over WiFi
- **Data Format**: JSON messages
- **Update Rate**: Sensor data every 3 seconds
- **Heartbeat**: Every 10 seconds
- **Auto-reconnect**: Every 5 seconds if disconnected

## 💡 Pro Tips

1. **Test WiFi first** with a simple WiFi scan example
2. **Use external power** for relay if controlling high-power pumps
3. **Add capacitors** across relay contacts for noise reduction
4. **Monitor Serial output** for debugging
5. **Start simple** - test ultrasonic sensor before adding motor control

## 📞 Support

If you encounter issues:
1. Check Serial Monitor output
2. Verify all connections
3. Test with minimal configuration first
4. Ensure backend server is running

This standalone code is your **complete ESP32 solution** - just configure and upload! 🚀
