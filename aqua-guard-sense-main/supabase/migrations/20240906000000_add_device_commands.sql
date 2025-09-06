-- Create device_commands table for durable command queue
CREATE TABLE IF NOT EXISTS device_commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  ttl TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'), -- Default 1 hour TTL
  acknowledged BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_commands_device_id ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_ttl ON device_commands(ttl);
CREATE INDEX IF NOT EXISTS idx_device_commands_acknowledged ON device_commands(acknowledged);

-- Enable RLS
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow all operations on device_commands" ON device_commands FOR ALL USING (true);

-- Function to clean up expired commands
CREATE OR REPLACE FUNCTION cleanup_expired_commands()
RETURNS void AS $$
BEGIN
  DELETE FROM device_commands WHERE ttl < NOW() OR acknowledged = true;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger to auto-cleanup on insert (or run periodically)
-- CREATE TRIGGER cleanup_on_insert AFTER INSERT ON device_commands EXECUTE FUNCTION cleanup_expired_commands();
