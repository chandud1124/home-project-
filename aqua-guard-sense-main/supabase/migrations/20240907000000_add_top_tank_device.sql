-- Add ESP32_TOP_001 device for authentication
INSERT INTO devices (device_id, device_name, api_key, hmac_secret, is_active)
VALUES (
    'ESP32_TOP_001',
    'Top Tank Controller',
    'dev_top_001_key_2024',
    'top_secret_2024_hmac_key',
    true
)
ON CONFLICT (device_id) DO NOTHING;

-- Also ensure device exists in esp32_devices table for backward compatibility  
INSERT INTO esp32_devices (id, device_type, status)
VALUES (
    'ESP32_TOP_001',
    'top_tank',
    'online'
)
ON CONFLICT (id) DO NOTHING;
