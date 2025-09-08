# 🗄️ AquaGuard Log Data Storage Architecture

## 📊 Multi-Layer Data Storage Strategy

Your AquaGuard system uses a **sophisticated multi-layer data storage approach** for comprehensive logging and analytics:

## 1. 🌐 Primary Cloud Database (Supabase PostgreSQL)

### Core Data Tables:

#### **`tank_readings`** - Water Level Logs
```sql
CREATE TABLE tank_readings (
  id BIGSERIAL PRIMARY KEY,
  tank_type TEXT NOT NULL,                 -- 'sump' or 'top'
  level_percentage DECIMAL(5,2),           -- Current water level %
  level_liters DECIMAL(8,2),               -- Current water volume in liters
  sensor_health TEXT DEFAULT 'good',       -- Sensor status
  esp32_id TEXT,                           -- Device identifier
  battery_voltage DECIMAL(4,2),            -- ESP32 battery level
  signal_strength INTEGER,                 -- WiFi signal strength
  float_switch BOOLEAN,                    -- Float switch status
  motor_running BOOLEAN DEFAULT false,     -- Motor status at time of reading
  manual_override BOOLEAN DEFAULT false,   -- Manual control active
  auto_mode_enabled BOOLEAN DEFAULT true,  -- Auto mode status
  timestamp TIMESTAMPTZ DEFAULT NOW()      -- Timestamp with timezone
);
```

#### **`motor_events`** - Motor Activity Logs
```sql
CREATE TABLE motor_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,                -- 'motor_started', 'motor_stopped'
  duration INTEGER,                        -- Runtime in seconds
  power_detected BOOLEAN DEFAULT true,     -- Power consumption detected
  current_draw DECIMAL(5,2),               -- Current draw in amps
  runtime_seconds INTEGER,                 -- Total runtime
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

#### **`alerts`** - System Alert Logs
```sql
CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,                      -- 'warning', 'info', 'error'
  title TEXT NOT NULL,                     -- Alert title
  message TEXT NOT NULL,                   -- Alert description
  severity TEXT DEFAULT 'medium',          -- 'low', 'medium', 'high', 'critical'
  esp32_id TEXT,                           -- Source device
  resolved BOOLEAN DEFAULT false,          -- Resolution status
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

#### **`device_heartbeats`** - Connection Logs
```sql
CREATE TABLE device_heartbeats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,                 -- ESP32 device ID
  heartbeat_type TEXT NOT NULL DEFAULT 'ping', -- 'ping' or 'pong'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',             -- Additional device info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### **`system_status`** - System Health Logs
```sql
CREATE TABLE system_status (
  id BIGSERIAL PRIMARY KEY,
  wifi_connected BOOLEAN DEFAULT true,     -- WiFi connectivity
  temperature DECIMAL(4,1),                -- System temperature
  uptime TEXT,                             -- System uptime
  esp32_top_status TEXT DEFAULT 'offline', -- Top tank device status
  esp32_sump_status TEXT DEFAULT 'offline', -- Sump tank device status
  battery_level INTEGER DEFAULT 100,       -- Battery percentage
  wifi_strength INTEGER DEFAULT -50,       -- WiFi signal strength (dBm)
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. 💾 Local SQLite Database (Backend Cache)

### Backend Local Storage (`backend/water_tank.db`):
```sql
-- Simplified schema for local caching
CREATE TABLE tank_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tank_type TEXT NOT NULL,
  level_percentage REAL NOT NULL,
  level_liters REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE motor_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  duration INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE motor_power_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  power_detected BOOLEAN,
  current_draw REAL,
  voltage REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 3. 🧠 ML Data Storage (Browser-Based)

### TensorFlow.js Model Storage:
- **IndexedDB**: Browser storage for ML models and training data
- **Local Storage**: ML preferences and configuration
- **Session Storage**: Temporary prediction cache

```typescript
// ML service data persistence
class AquaGuardMLService {
  private async saveModel(modelName: string, model: tf.LayersModel) {
    // Save to browser IndexedDB
    await model.save(`indexeddb://aquaguard-${modelName}`);
  }
  
  private saveTrainingData(data: WaterUsagePattern[]) {
    // Store in browser local storage for continuous learning
    localStorage.setItem('aquaguard-training-data', JSON.stringify(data));
  }
}
```

## 4. 📱 PWA Offline Storage (Service Worker)

### Service Worker Caching Strategy:
```javascript
// API data caching for offline access
const API_CACHE_PATTERNS = [
  /\/api\/tanks/,           // Tank readings cache
  /\/api\/motor-events/,    // Motor events cache  
  /\/api\/consumption/,     // Usage data cache
  /\/api\/system\/status/   // System status cache
];

// Offline data storage
self.addEventListener('fetch', event => {
  if (isAPICall(event.request)) {
    event.respondWith(
      // Network-first with fallback to cache
      fetch(event.request)
        .then(response => {
          // Cache successful responses
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => {
          // Return cached data if network fails
          return cache.match(event.request);
        })
    );
  }
});
```

## 📈 Data Retention & Management

### 🕒 Retention Policies:

#### **Supabase Cloud (Long-term storage)**:
- **Tank Readings**: 2+ years of historical data
- **Motor Events**: 1+ year of motor activity logs
- **Alerts**: 6 months of alert history
- **Device Heartbeats**: 7 days (auto-cleanup function)
- **System Status**: 3 months of health logs

#### **Local SQLite (Short-term cache)**:
- **Recent Data**: Last 30 days for offline access
- **Active Sessions**: Current day's detailed logs
- **Sync Buffer**: Unsent data during connection issues

#### **Browser Storage (ML & PWA)**:
- **ML Models**: Persistent until manually cleared
- **Training Data**: Rolling 90-day window
- **Cache**: 30 days with LRU eviction
- **Offline Data**: 7 days of API responses

## 🔄 Data Synchronization Flow

### Real-time Data Pipeline:
```
ESP32 Devices → Backend Server → Supabase Cloud
                      ↓
              Local SQLite Cache
                      ↓
              Frontend API Calls → Browser Cache
                      ↓
              ML Service Training → IndexedDB Models
                      ↓
              PWA Service Worker → Offline Cache
```

### Sync Mechanisms:
1. **ESP32 → Backend**: WebSocket/HTTP every 30 seconds
2. **Backend → Supabase**: Real-time replication
3. **Frontend → Backend**: API calls every 15 seconds  
4. **ML Training**: Continuous learning from new data
5. **PWA Sync**: Background sync when online

## 📊 Data Analytics & Processing

### Historical Data Analysis:
- **Usage Patterns**: Daily/weekly/monthly consumption trends
- **Efficiency Metrics**: Motor runtime vs. water delivered ratios
- **Predictive Analytics**: ML-powered forecasting using historical logs
- **Anomaly Detection**: Pattern recognition from time-series data

### ML Data Processing:
```typescript
// Example: Processing historical data for ML training
interface WaterUsagePattern {
  timestamp: string;
  level_percentage: number;      // From tank_readings
  consumption_rate: number;      // Calculated from level changes
  motor_runtime: number;         // From motor_events
  hour_of_day: number;          // Derived feature
  day_of_week: number;          // Derived feature
  season: number;               // Derived feature
}
```

## 🔒 Data Security & Backup

### Security Measures:
- **Row Level Security (RLS)** on all Supabase tables
- **Encrypted connections** (HTTPS/WSS) for all data transmission
- **Local data encryption** for sensitive cached information
- **API key authentication** for device registration

### Backup Strategy:
- **Supabase**: Automatic daily backups to cloud storage
- **Local SQLite**: Periodic backup to Supabase for redundancy
- **Browser Storage**: Export/import functionality for ML models
- **ESP32 Data**: Buffered locally during connection issues

## 📱 Mobile-Specific Storage

### PWA Data Management:
- **Offline Queue**: Store user actions when offline
- **Push Notification Logs**: Track delivery and interaction
- **Settings Sync**: User preferences across devices
- **Installation Analytics**: PWA usage metrics

## 🎯 Data Usage Examples

### How Your System Uses Stored Data:

1. **Real-time Dashboard**: Latest tank_readings + system_status
2. **Historical Charts**: Aggregated tank_readings over time periods
3. **AI Insights**: ML analysis of motor_events + consumption patterns  
4. **Predictive Alerts**: Pattern recognition from historical logs
5. **Efficiency Reports**: Motor runtime vs. water level correlations
6. **Offline Functionality**: Cached data from service worker storage

This multi-layer approach ensures:
- ✅ **High Availability**: Data accessible even when components are offline
- ✅ **Scalability**: Cloud storage handles unlimited historical data
- ✅ **Performance**: Local caching provides instant access
- ✅ **Intelligence**: ML models continuously learn from stored patterns
- ✅ **Reliability**: Multiple backup layers prevent data loss

Your AquaGuard system stores **every drop of data** across multiple storage layers to provide intelligent, reliable water management! 🚰📊✨
