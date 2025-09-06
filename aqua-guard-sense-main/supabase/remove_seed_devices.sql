-- Remove seeded demo device credentials (use carefully in production!)
-- Run with: supabase db execute --file supabase/remove_seed_devices.sql

DELETE FROM esp32_devices WHERE id IN ('SUMP-001','TOP-001');

-- Verify
-- SELECT id FROM esp32_devices ORDER BY id;
