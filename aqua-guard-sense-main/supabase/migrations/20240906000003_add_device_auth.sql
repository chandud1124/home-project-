-- Create devices table for per-device authentication
CREATE TABLE IF NOT EXISTS devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE,
    device_name TEXT,
    device_type TEXT DEFAULT 'esp32',
    api_key TEXT NOT NULL UNIQUE,
    hmac_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient device lookups
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(api_key);

-- Add RLS policies
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read devices
CREATE POLICY "Allow authenticated read access to devices"
ON devices FOR SELECT
TO authenticated
USING (true);

-- Allow service role to manage devices
CREATE POLICY "Allow service role full access to devices"
ON devices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to generate HMAC signature
CREATE OR REPLACE FUNCTION generate_hmac_signature(
    device_id TEXT,
    payload TEXT,
    timestamp TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    secret TEXT;
    message TEXT;
    signature TEXT;
BEGIN
    -- Get the HMAC secret for the device
    SELECT hmac_secret INTO secret FROM devices WHERE devices.device_id = generate_hmac_signature.device_id;

    IF secret IS NULL THEN
        RAISE EXCEPTION 'Device not found or inactive';
    END IF;

    -- Create message to sign: device_id + payload + timestamp
    message := device_id || payload || timestamp;

    -- Generate HMAC-SHA256 signature
    signature := encode(hmac(message, secret, 'sha256'), 'hex');

    RETURN signature;
END;
$$;

-- Function to verify HMAC signature
CREATE OR REPLACE FUNCTION verify_hmac_signature(
    device_id TEXT,
    payload TEXT,
    timestamp TEXT,
    signature TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    expected_signature TEXT;
BEGIN
    -- Generate expected signature
    expected_signature := generate_hmac_signature(device_id, payload, timestamp);

    -- Compare with provided signature (case-insensitive)
    RETURN expected_signature = lower(signature);
END;
$$;
