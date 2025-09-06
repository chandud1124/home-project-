-- Create device_heartbeats table for tracking device connectivity
CREATE TABLE IF NOT EXISTS device_heartbeats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    heartbeat_type TEXT NOT NULL DEFAULT 'ping', -- 'ping' or 'pong'
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id_timestamp
ON device_heartbeats(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_timestamp
ON device_heartbeats(timestamp DESC);

-- Add RLS policies
ALTER TABLE device_heartbeats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read heartbeats
CREATE POLICY "Allow authenticated read access to device_heartbeats"
ON device_heartbeats FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert heartbeats
CREATE POLICY "Allow service role to insert device_heartbeats"
ON device_heartbeats FOR INSERT
TO service_role
WITH CHECK (true);

-- Function to clean up old heartbeats (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_heartbeats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM device_heartbeats
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$;
