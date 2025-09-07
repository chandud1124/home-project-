const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function registerDevices() {
  const devices = [
    {
      device_id: 'ESP32_SUMP_002',
      device_name: 'Sump Tank Controller',
      api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4',
      hmac_secret: 'c2858fe0513830bfe988a46e8162d9ef6fec933758156a901a41012afde8bb5b7fa1cee9e677cbe72aa0e84a4b4c72aabf8f33ad1d989ba4b69ca9e1b1e1e0c2',
      device_type: 'sump_tank',
      is_active: true
    },
    {
      device_id: 'ESP32_TOP_002',
      device_name: 'Top Tank Monitor',
      api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6InRvcF90YW5rIiwiaWF0IjoxNzU2NzI4ODkwLCJleHAiOjIwNzIzMDQ4OTB9.TopTankMonitor2024SecureKey',
      hmac_secret: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      device_type: 'top_tank',
      is_active: true
    }
  ];

  for (const device of devices) {
    const { data, error } = await supabase
      .from('devices')
      .upsert(device, { onConflict: 'device_id' });

    if (error) {
      console.error(`Error registering device ${device.device_id}:`, error);
    } else {
      console.log(`✅ Device ${device.device_id} registered successfully:`, data);
    }
  }
}

registerDevices();
