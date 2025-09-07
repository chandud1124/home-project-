-- Migration: Standardize Tank Types for Consistency
-- Purpose: Enforce consistent tank naming across the entire system
-- FIXED: Added constraints to prevent data inconsistency issues

-- Update existing data to standard format
-- FIXED: Convert any 'main' tank_type values to standard 'top_tank'
UPDATE tank_readings SET tank_type = 'top_tank' WHERE tank_type IN ('top', 'main');

-- FIXED: Convert any 'sump' tank_type values to standard 'sump_tank'  
UPDATE tank_readings SET tank_type = 'sump_tank' WHERE tank_type = 'sump';

-- Add constraint to enforce only standard tank types
-- FIXED: Prevent future data inconsistency by restricting allowed values
ALTER TABLE tank_readings ADD CONSTRAINT check_tank_type 
  CHECK (tank_type IN ('top_tank', 'sump_tank'));

-- Update alerts table to use standard tank types
-- FIXED: Standardize alert tank_type references if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='tank_type') THEN
    UPDATE alerts SET tank_type = 'top_tank' WHERE tank_type IN ('top', 'main');
    UPDATE alerts SET tank_type = 'sump_tank' WHERE tank_type = 'sump';
    ALTER TABLE alerts ADD CONSTRAINT check_alerts_tank_type 
      CHECK (tank_type IN ('top_tank', 'sump_tank'));
  END IF;
END
$$;

-- Update esp32_devices table to use standard device IDs
-- FIXED: Update device registration data to use standard naming
UPDATE esp32_devices SET id = 'TOP_TANK' WHERE id IN ('ESP32_TOP_001', 'esp32-top-01');
UPDATE esp32_devices SET id = 'SUMP_TANK' WHERE id IN ('ESP32_SUMP_002', 'esp32-sump-01');

-- Add comment documenting the standard
COMMENT ON COLUMN tank_readings.tank_type IS 'Standard tank types: top_tank, sump_tank only';
