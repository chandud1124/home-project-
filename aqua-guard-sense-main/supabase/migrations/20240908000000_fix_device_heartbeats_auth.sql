-- Fix device_heartbeats RLS policies for ESP32 authentication
-- ESP32 devices use anon key to insert heartbeats and readings

-- Allow anonymous users to insert heartbeats (for ESP32 devices)
CREATE POLICY "Allow anon insert device_heartbeats"
ON device_heartbeats FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to read their own heartbeats (optional)
CREATE POLICY "Allow anon read device_heartbeats" 
ON device_heartbeats FOR SELECT
TO anon
USING (true);

-- Also ensure tank_readings table allows anon inserts (ESP32 sensor data)
CREATE POLICY "Allow anon insert tank_readings"
ON tank_readings FOR INSERT  
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon read tank_readings"
ON tank_readings FOR SELECT
TO anon  
USING (true);
