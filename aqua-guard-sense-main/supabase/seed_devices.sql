-- Seed (idempotent) device credentials.
-- Replace the placeholder API keys and HMAC secrets before running in production.
-- Run with: supabase db execute --file supabase/seed_devices.sql

INSERT INTO esp32_devices (id, api_key, hmac_secret, is_active, status, last_seen)
VALUES
  ('SUMP-001', 'REPLACE_API_KEY_SUMP', 'REPLACE_HMAC_SECRET_SUMP', true, 'provisioned', now()),
  ('TOP-001', 'REPLACE_API_KEY_TOP', 'REPLACE_HMAC_SECRET_TOP', true, 'provisioned', now())
ON CONFLICT (id) DO UPDATE SET
  api_key = EXCLUDED.api_key,
  hmac_secret = EXCLUDED.hmac_secret,
  is_active = true,
  status = 'provisioned',
  last_seen = now();

-- Verification query (optional):
-- SELECT id, api_key, (hmac_secret IS NOT NULL) AS has_hmac, is_active FROM esp32_devices ORDER BY id;
