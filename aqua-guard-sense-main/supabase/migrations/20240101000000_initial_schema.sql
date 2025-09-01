-- Create tank_readings table
CREATE TABLE IF NOT EXISTS tank_readings (
  id BIGSERIAL PRIMARY KEY,
  tank_type TEXT NOT NULL,
  level_percentage DECIMAL(5,2),
  level_liters DECIMAL(8,2),
  sensor_health TEXT DEFAULT 'good',
  esp32_id TEXT,
  battery_voltage DECIMAL(4,2),
  signal_strength INTEGER,
  float_switch BOOLEAN,
  motor_running BOOLEAN DEFAULT false,
  manual_override BOOLEAN DEFAULT false,
  auto_mode_enabled BOOLEAN DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create motor_events table
CREATE TABLE IF NOT EXISTS motor_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  duration INTEGER,
  power_detected BOOLEAN DEFAULT true,
  current_draw DECIMAL(5,2),
  runtime_seconds INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('warning', 'info', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  esp32_id TEXT,
  resolved BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_status table
CREATE TABLE IF NOT EXISTS system_status (
  id BIGSERIAL PRIMARY KEY,
  wifi_connected BOOLEAN DEFAULT true,
  temperature DECIMAL(4,1),
  uptime TEXT,
  esp32_top_status TEXT DEFAULT 'offline',
  esp32_sump_status TEXT DEFAULT 'offline',
  battery_level INTEGER DEFAULT 100,
  wifi_strength INTEGER DEFAULT -50,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create esp32_devices table
CREATE TABLE IF NOT EXISTS esp32_devices (
  id TEXT PRIMARY KEY,
  mac_address TEXT,
  ip_address INET,
  device_type TEXT,
  firmware_version TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tank_readings_timestamp ON tank_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tank_readings_tank_type ON tank_readings(tank_type);
CREATE INDEX IF NOT EXISTS idx_motor_events_timestamp ON motor_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_status_timestamp ON system_status(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_status ON esp32_devices(status);

-- Enable Row Level Security (RLS)
ALTER TABLE tank_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE motor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp32_devices ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on tank_readings" ON tank_readings FOR ALL USING (true);
CREATE POLICY "Allow all operations on motor_events" ON motor_events FOR ALL USING (true);
CREATE POLICY "Allow all operations on alerts" ON alerts FOR ALL USING (true);
CREATE POLICY "Allow all operations on system_status" ON system_status FOR ALL USING (true);
CREATE POLICY "Allow all operations on esp32_devices" ON esp32_devices FOR ALL USING (true);
