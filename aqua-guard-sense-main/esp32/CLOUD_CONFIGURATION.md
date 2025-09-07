# ESP32 Cloud Configuration Guide

## 🚨 CURRENT STATUS
Your ESP32 devices are configured for LOCAL backend but need CLOUD configuration to work independently.

## 📍 Current Configuration (LOCAL)
```cpp
#define BACKEND_HOST "192.168.0.108"  // Local IP
#define BACKEND_PORT 3001
#define BACKEND_USE_HTTPS false
```

## ☁️ Required Cloud Configuration
```cpp
#define BACKEND_HOST "dwcouaacpqipvvsxiygo.supabase.co"
#define BACKEND_PORT 443
#define BACKEND_USE_HTTPS true
#define SUPABASE_URL "https://dwcouaacpqipvvsxiygo.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"
```

## 🌐 Cloud Communication Architecture

```
ESP32 Devices → Supabase Cloud → Firebase Web App
     ↓              ↓                    ↓
  SUMP_TANK    ← Direct API →      Live Dashboard
  TOP_TANK     ← HTTPS POST →      Real-time Data
```

## ✅ When Configured for Cloud:

### 1. **Independence from Local System**
- ESP32 communicates directly with Supabase cloud
- No dependency on your local computer/server
- Works 24/7 regardless of local system status

### 2. **Data Flow**
```
ESP32 → HTTPS POST → Supabase Database → Web Dashboard
  ↓         ↓              ↓                ↓
Sensors → Cloud API → Real-time DB → Live Updates
```

### 3. **Real-time Updates**
- ESP32 sends sensor data every 30 seconds
- Supabase stores data in cloud database
- Firebase web app shows live updates
- Works from anywhere with internet

## 🔧 Required Changes

### SUMP_TANK ESP32:
```cpp
// Change these lines in ESP32_SumpTank_Enhanced.ino:
#define BACKEND_HOST "dwcouaacpqipvvsxiygo.supabase.co"
#define BACKEND_PORT 443
#define BACKEND_USE_HTTPS true

// Add Supabase configuration:
#define SUPABASE_URL "https://dwcouaacpqipvvsxiygo.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4"

// Update API endpoints:
String sensorEndpoint = "/functions/v1/api/tanks";
String heartbeatEndpoint = "/functions/v1/api/heartbeat";
```

### TOP_TANK ESP32:
Same configuration as SUMP_TANK with:
```cpp
#define DEVICE_ID "TOP_TANK"
#define DEVICE_NAME "Top Tank"
```

## 📊 Monitoring Options

### 1. Web Dashboard
- **URL**: https://aqua-guard-sense.web.app/
- **Shows**: Tank levels, device status, alerts
- **Access**: Anywhere with internet

### 2. Supabase Admin
- **URL**: https://supabase.com/dashboard/project/dwcouaacpqipvvsxiygo
- **Shows**: Database records, API logs, authentication
- **Access**: Admin-level monitoring

### 3. Real-time Status
- Device online/offline status
- Last data received timestamp  
- Tank water levels (%)
- Motor status (on/off)
- Alerts and warnings

## 🚀 Benefits of Cloud Configuration

✅ **24/7 Operation**: Works without local computer
✅ **Remote Access**: Monitor from anywhere
✅ **Data Persistence**: All data stored in cloud
✅ **Scalability**: Can add more ESP32 devices
✅ **Reliability**: Supabase cloud infrastructure
✅ **Security**: Encrypted HTTPS communication
