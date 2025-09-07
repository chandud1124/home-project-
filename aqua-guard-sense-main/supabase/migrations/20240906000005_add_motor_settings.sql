-- Create motor_settings table for storing motor control configuration
CREATE TABLE IF NOT EXISTS motor_settings (
  id SERIAL PRIMARY KEY,
  auto_start_level INTEGER NOT NULL DEFAULT 20,
  auto_stop_level INTEGER NOT NULL DEFAULT 80,
  max_runtime_minutes INTEGER NOT NULL DEFAULT 60,
  min_off_time_minutes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE motor_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow all operations on motor_settings" ON motor_settings FOR ALL USING (true);

-- Insert default settings
INSERT INTO motor_settings (auto_start_level, auto_stop_level, max_runtime_minutes, min_off_time_minutes)
VALUES (20, 80, 60, 15)
ON CONFLICT DO NOTHING;
