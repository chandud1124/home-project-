# ESP32 Cloud Firmware - Upload Guide

## 📁 **Cloud Firmware Files Created**

### 1. **ESP32_SumpTank_Cloud.ino**
- **Device**: Sump Tank Controller
- **Purpose**: Motor control + water level monitoring
- **Cloud Backend**: Direct Supabase connection
- **Features**: Motor relay control, float switch safety, manual overrides

### 2. **ESP32_TopTank_Cloud.ino** 
- **Device**: Top Tank Monitor
- **Purpose**: Water level monitoring + alerts
- **Cloud Backend**: Direct Supabase connection
- **Features**: Level monitoring, low water alerts, status reporting

## ☁️ **Cloud Configuration Features**

### **Direct Supabase Communication**
```cpp
#define BACKEND_HOST "dwcouaacpqipvvsxiygo.supabase.co"
#define BACKEND_PORT 443
#define BACKEND_USE_HTTPS true
#define SUPABASE_URL "https://dwcouaacpqipvvsxiygo.supabase.co"
```

### **API Endpoints**
- Sensor Data: `/functions/v1/api/esp32/sensor-data`
- Heartbeat: `/functions/v1/api/esp32/heartbeat`
- Commands: `/functions/v1/api/esp32/commands`
- Tank Data: `/functions/v1/api/tanks`

### **Authentication Headers**
- Authorization: Bearer token (Supabase anon key)
- X-Device-ID: Device identifier
- X-API-Key: Device-specific API key

## 🔧 **How to Upload to ESP32**

### **1. Arduino IDE Setup**
1. Open Arduino IDE
2. Install ESP32 board package
3. Install required libraries:
   - WiFi
   - HTTPClient
   - ArduinoJson
   - WebServer

### **2. Upload SUMP_TANK**
1. Open `ESP32_SumpTank_Cloud.ino`
2. Select Board: "ESP32 Dev Module"
3. Select correct COM port
4. Click Upload
5. Monitor Serial output for connection status

### **3. Upload TOP_TANK**
1. Open `ESP32_TopTank_Cloud.ino`
2. Select Board: "ESP32 Dev Module"
3. Select correct COM port  
4. Click Upload
5. Monitor Serial output for connection status

## 📊 **Expected Serial Output**

### **Successful Connection:**
```
=== AquaGuard Cloud Sump Tank Controller ===
Version: Cloud Edition v1.0
Target: Supabase Cloud Backend
✅ Hardware pins initialized
✅ WiFi Connected!
📡 IP Address: 192.168.0.XXX
🌐 Setting up Supabase cloud connection...
✅ Cloud connection successful!
📊 Response code: 200
✅ Local web server started at: http://192.168.0.XXX
=== System Ready - Cloud Mode ===
```

### **Data Transmission:**
```
💧 Water Level: 45.2% (113cm) | Float: LOW | Motor: OFF
☁️ Sensor data sent to cloud successfully
💓 Heartbeat sent to cloud
```

## 🌐 **Monitoring Options**

### **1. Web Dashboard (Primary)**
- **URL**: https://aqua-guard-sense.web.app/
- **Shows**: Real-time tank levels, device status
- **Updates**: Every 30-60 seconds

### **2. Local ESP32 Web Interface**
- **SUMP_TANK**: http://192.168.0.XXX (check serial monitor for IP)
- **TOP_TANK**: http://192.168.0.XXY (check serial monitor for IP)
- **Shows**: Local device status and cloud connection

### **3. Supabase Admin Dashboard**
- **URL**: https://supabase.com/dashboard/project/dwcouaacpqipvvsxiygo
- **Shows**: Raw database records, API logs
- **Access**: Backend administration

## 🔍 **Status LED Indicators**

### **SUMP_TANK & TOP_TANK LED Patterns:**
- **Solid ON**: Connected to WiFi and Supabase cloud
- **Slow Blink (1s)**: WiFi connected, cloud disconnected
- **Fast Blink (250ms)**: WiFi disconnected
- **OFF**: System error or power issue

## ⚠️ **Troubleshooting**

### **Cloud Connection Issues:**
1. Check WiFi credentials in code
2. Verify Supabase URL and API key
3. Check router firewall settings
4. Monitor serial output for HTTP error codes

### **Data Not Appearing in Dashboard:**
1. Verify device authentication (API keys)
2. Check Supabase database tables
3. Confirm Firebase deployment is current
4. Monitor network connectivity

### **Common HTTP Error Codes:**
- **200**: Success
- **401**: Authentication failed (check API keys)
- **404**: Endpoint not found (check Supabase functions)
- **500**: Server error (check Supabase logs)

## 📈 **Data Flow Verification**

### **Complete Cloud Pipeline:**
```
ESP32 → Supabase Database → Firebase Web App
  ↓         ↓                    ↓
30s      Real-time           Live Dashboard
Timer    Database            Updates
```

### **Expected Data in Dashboard:**
- Tank water levels (% and cm)
- Device online/offline status
- Last update timestamps
- Motor status (sump tank)
- Alert conditions
- Historical data graphs

## 🚀 **Post-Upload Checklist**

✅ **Both ESP32s programmed with cloud firmware**  
✅ **Serial monitor shows cloud connection success**  
✅ **Status LEDs solid ON (connected)**  
✅ **Data appearing in web dashboard**  
✅ **Heartbeats being received**  
✅ **Local web interfaces accessible**  

Once uploaded, your ESP32 devices will operate completely independently of your local computer, communicating directly with the Supabase cloud backend and updating the Firebase web dashboard in real-time!
