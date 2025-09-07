-- Add missing columns to motor_events table
ALTER TABLE motor_events 
ADD COLUMN IF NOT EXISTS esp32_id TEXT,
ADD COLUMN IF NOT EXISTS motor_running BOOLEAN DEFAULT false;

-- Update existing motor_events rows to have a default esp32_id
UPDATE motor_events SET esp32_id = 'web_control' WHERE esp32_id IS NULL;
