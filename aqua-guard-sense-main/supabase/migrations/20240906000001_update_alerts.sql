-- Add resolution and auto-expire fields to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS auto_expire_at TIMESTAMPTZ;

-- Update existing alerts to have auto_expire_at for low severity
UPDATE alerts SET auto_expire_at = timestamp + INTERVAL '1 hour' WHERE severity = 'low' AND auto_expire_at IS NULL;

-- Function to auto-expire low severity alerts
CREATE OR REPLACE FUNCTION auto_expire_alerts()
RETURNS void AS $$
BEGIN
  UPDATE alerts SET resolved = true WHERE severity = 'low' AND auto_expire_at < NOW() AND resolved = false;
END;
$$ LANGUAGE plpgsql;
