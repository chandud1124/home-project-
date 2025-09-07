# AquaGuard ESP32 Enhanced Setup Guide

## 📋 Overview
This guide covers the enhanced AquaGuard system with robust error handling, heartbeat monitoring, panic mode detection, and daily restart functionality.

## 🛠️ Hardware Setup

### Sump Tank ESP32 (ESP32_SumpTank_Enhanced.ino)
**Components:**
- ESP32 Dev Board
- HC-SR04 Ultrasonic Sensor
- Float Switch (Normally Open)
- Relay Module (for motor control)
- LEDs for status indication
- Buzzer for alerts
- Manual switches for override

**Wiring:**
```
Ultrasonic Sensor:
- TRIG → GPIO 5
- ECHO → GPIO 18
- VCC → 5V
- GND → GND

Float Switch:
- Signal → GPIO 4
- VCC → 3.3V
- GND → GND

Motor Relay:
- Control → GPIO 13
- VCC → 5V
- GND → GND

Status LEDs:
- Auto Mode LED → GPIO 16
- Sump Full LED → GPIO 17
- Sump Low LED → GPIO 21

Buzzer:
- Positive → GPIO 14
- Negative → GND

Manual Controls:
- Motor Switch → GPIO 25 (with pullup)
- Mode Switch → GPIO 26 (with pullup)
```

### Top Tank ESP32 (ESP32_TopTank_Enhanced.ino)
**Components:**
- ESP32 Dev Board
- HC-SR04 Ultrasonic Sensor
- Status LED (built-in)
- Buzzer for alerts
- Additional Alert LED

**Wiring:**
```
Ultrasonic Sensor:
- TRIG → GPIO 5
- ECHO → GPIO 18
- VCC → 5V
- GND → GND

Status Indicators:
- Status LED → GPIO 2 (built-in)
- Buzzer → GPIO 14
- Alert LED → GPIO 15
```

## 🔧 Configuration

### WiFi Credentials (Both ESP32s)
```cpp
#define WIFI_SSID "I am Not A Witch I am Your Wifi"
#define WIFI_PASSWORD "Whoareu@0000"
```

### IP Address Configuration
```cpp
// Backend Server
#define BACKEND_HOST "192.168.1.100"
#define BACKEND_PORT 3001

// ESP32 IP Addresses (update after first connection)
// Sump Tank ESP32: 192.168.1.101
// Top Tank ESP32: 192.168.1.102
```

### Tank Specifications
**Sump Tank (Rectangular):**
- Dimensions: 230cm × 230cm × 250cm
- Capacity: 1,322.5 Liters
- Volume Calculation: Length × Width × Height ÷ 1000

**Top Tank (Cylindrical):**
- Dimensions: Ø103cm × 120cm height
- Capacity: 1,000 Liters
- Volume Calculation: π × r² × height

## 🚀 Enhanced Features

### 1. Robust Heartbeat System
- **Frequency:** Every 30 seconds when backend available
- **Content:** Device status, water levels, motor state, system health
- **Authentication:** HMAC-SHA256 signatures for security
- **Error Handling:** Retry logic with exponential backoff

### 2. Smart Panic Mode Detection
**Triggers panic mode ONLY for:**
- Backend unresponsive for 5+ minutes
- Critical hardware failure (sensor malfunction)
- Motor stuck on for 30+ minutes
- Critical memory shortage (<10KB free)
- Sump ESP32 unreachable (Top Tank only)

**Does NOT restart for:**
- WiFi disconnections
- Temporary network issues
- Normal backend downtime

### 3. Daily Scheduled Restart
- **Time:** 2:00 AM every day
- **Safety:** Motor relay turned OFF before restart
- **Notification:** Reports scheduled restart to backend
- **Purpose:** Maintenance and memory cleanup

### 4. Motor Safety System
**Sump Tank ESP32:**
- Relay initialized to OFF immediately on startup
- Float switch safety verification
- Maximum runtime protection (30 minutes)
- Cooldown period between runs (5 minutes)
- Emergency stop on safety violations

**Top Tank ESP32:**
- Sends motor commands to Sump ESP32
- Motor logic: START < 30%, STOP > 90%
- No direct relay control for safety

### 5. WiFi Management
- **Auto-reconnection:** Up to 3 retry attempts
- **No restart on disconnection:** System continues locally
- **Signal monitoring:** RSSI tracking
- **Fallback mode:** Local operation when offline

## 📊 System Status Indicators

### Sump Tank ESP32 LEDs
- **Auto Mode LED (GPIO 16):** Solid = Auto, Off = Manual
- **Sump Low LED (GPIO 21):** On when level ≤ 25%
- **Sump Full LED (GPIO 17):** Blink at 85%, Solid at 90%

### Top Tank ESP32 LEDs
- **Status LED (GPIO 2):**
  - Solid ON = All connections OK
  - Slow blink = WiFi OK, some issues
  - Fast blink = Panic mode
  - OFF = No WiFi
- **Alert LED (GPIO 15):** Water level alerts

### Buzzer Patterns
**Sump Tank:**
- 3 rings at 90% water level
- Continuous in panic mode

**Top Tank:**
- Rapid beeps = Critical level (≤10%)
- Slow beeps = Low level (≤20%)

## 🔍 Monitoring & Debugging

### Serial Monitor Output
Both ESP32s provide detailed status information:
- Water levels and volumes
- Motor states and commands
- Connection status (WiFi, Backend, Sump)
- System health metrics
- Error conditions and recovery

### Backend API Endpoints
```
POST /api/esp32/heartbeat - Device health monitoring
POST /api/esp32/sensor-data - Sensor readings
POST /api/esp32/panic - Panic mode reports
POST /api/esp32/scheduled-restart - Maintenance restarts
GET /api/esp32/ping - Connection health check
```

## 🛡️ Safety Features

### 1. Relay Safety
- Motor relay initialized to OFF on startup
- Float switch verification before motor start
- Emergency stop on sensor failures
- Watchdog timer protection

### 2. Error Recovery
- Automatic WiFi reconnection
- Backend fallback modes
- Local operation capability
- Graceful degradation

### 3. Panic Mode Protection
- Critical system monitoring
- Immediate safety actions
- Automatic restart only when necessary
- Error reporting to backend

## 📈 Performance Monitoring

### Memory Management
- Free heap monitoring
- Memory leak detection
- Panic on critical shortage

### Network Performance
- WiFi signal strength tracking
- Backend response time monitoring
- Connection retry statistics

### System Health
- Uptime tracking
- Watchdog timer supervision
- Error rate monitoring

## 🔧 Installation Steps

1. **Flash ESP32s:**
   ```bash
   # Flash Sump Tank ESP32
   arduino-cli compile --fqbn esp32:esp32:esp32dev ESP32_SumpTank_Enhanced.ino
   arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32dev ESP32_SumpTank_Enhanced.ino
   
   # Flash Top Tank ESP32
   arduino-cli compile --fqbn esp32:esp32:esp32dev ESP32_TopTank_Enhanced.ino
   arduino-cli upload -p /dev/ttyUSB1 --fqbn esp32:esp32:esp32dev ESP32_TopTank_Enhanced.ino
   ```

2. **Update IP Addresses:**
   - Note ESP32 IP addresses from serial monitor
   - Update SUMP_ESP32_IP in Top Tank code
   - Reflash Top Tank ESP32 if needed

3. **Verify Connections:**
   - Check WiFi connectivity
   - Verify backend communication
   - Test ESP32-to-ESP32 communication
   - Validate sensor readings

4. **Test Safety Features:**
   - Verify motor relay safety
   - Test float switch protection
   - Check panic mode triggers
   - Validate daily restart schedule

## 🚨 Troubleshooting

### Common Issues
1. **WiFi Connection Failed**
   - Check SSID and password
   - Verify network availability
   - Check signal strength

2. **Backend Communication Issues**
   - Verify backend server running
   - Check IP address and port
   - Validate API keys and secrets

3. **ESP32-to-ESP32 Communication Failed**
   - Check IP addresses
   - Verify both ESP32s on same network
   - Test HTTP endpoints individually

4. **Sensor Reading Errors**
   - Check ultrasonic sensor wiring
   - Verify power supply stability
   - Test sensor independently

### Recovery Procedures
1. **Soft Reset:** Press EN button on ESP32
2. **Factory Reset:** Flash firmware again
3. **Network Reset:** Change WiFi credentials and reflash
4. **Panic Recovery:** Check serial monitor for panic reasons

## 📝 Maintenance

### Daily Operations
- System automatically restarts at 2:00 AM
- Monitor serial output for errors
- Check water levels and motor operation

### Weekly Checks
- Verify all connections working
- Check sensor accuracy
- Review system logs

### Monthly Maintenance
- Update firmware if needed
- Check physical connections
- Clean sensors if necessary

---

## 🎯 Key Improvements Summary

✅ **WiFi credentials and IP addresses configured**
✅ **Robust heartbeat system with backend health monitoring**  
✅ **Smart panic mode - restarts only on critical failures**
✅ **Daily restart at 2:00 AM for maintenance**
✅ **Motor relay safety - always OFF during restart**
✅ **Enhanced error handling and recovery**
✅ **Comprehensive status monitoring and alerts**
✅ **Hybrid connectivity (backend + local control)**

The enhanced system now provides enterprise-grade reliability with intelligent error detection, safety-first motor control, and maintenance automation while maintaining local operation capability even during network issues.
