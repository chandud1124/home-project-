-- Seed sample device for testing
INSERT INTO devices (device_id, device_name, api_key, hmac_secret, is_active)
VALUES (
    'ESP32_SUMP_002',
    'Sump Tank Controller',
    'dev_sump_002_key_2024',
    'sump_secret_2024_hmac_key',
    true
)
ON CONFLICT (device_id) DO NOTHING;
