import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtimeInserts() {
  console.log('🧪 Testing real-time subscriptions by inserting test data...');
  
  try {
    // Test 1: Insert tank reading (simulating ESP32 data) - using correct schema
    console.log('📊 Inserting test tank reading...');
    const { data: tankData, error: tankError } = await supabase
      .from('tank_readings')
      .insert({
        esp32_id: 'SUMP_TANK',
        tank_type: 'sump_tank',
        level_percentage: 75.5,
        level_liters: 995.5,
        sensor_health: 'good',
        battery_voltage: 12.0,
        signal_strength: -45,
        float_switch: true,
        motor_running: false,
        manual_override: false,
        auto_mode_enabled: true
      })
      .select();
    
    if (tankError) {
      console.error('❌ Error inserting tank reading:', tankError);
    } else {
      console.log('✅ Tank reading inserted successfully:', tankData[0]);
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Insert device heartbeat - using correct schema
    console.log('💓 Inserting test device heartbeat...');
    const { data: heartbeatData, error: heartbeatError } = await supabase
      .from('device_heartbeats')
      .insert({
        device_id: 'TOP_TANK',
        heartbeat_type: 'ping',
        metadata: {
          status: 'online',
          device_status: 'connected',
          level_percentage: 85.2,
          motor_running: true,
          auto_mode: true,
          connection_state: 'connected',
          free_heap: 156000,
          wifi_rssi: -38,
          uptime_seconds: 3600,
          signal_strength: -38
        }
      })
      .select();
    
    if (heartbeatError) {
      console.error('❌ Error inserting heartbeat:', heartbeatError);
    } else {
      console.log('✅ Heartbeat inserted successfully:', heartbeatData[0]);
    }
    
    console.log('🧪 Test complete. Check backend terminal for real-time events.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRealtimeInserts().then(() => {
  console.log('✅ Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
