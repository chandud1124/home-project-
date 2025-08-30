#!/usr/bin/env node

// Test script for ESP32 WebSocket communication
// Run with: node test_websocket.js

const WebSocket = require('ws');

const WS_URL = `ws://localhost:${process.env.WS_PORT || 8083}`;
const testESP32Id = 'ESP32_TEST_001';

console.log('Testing ESP32 WebSocket communication...');
console.log('Connecting to:', WS_URL);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');

  // Test 1: Register device
  console.log('\n📝 Test 1: Registering ESP32 device...');
  ws.send(JSON.stringify({
    type: 'esp32_register',
    esp32_id: testESP32Id,
    device_type: 'test_device'
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message);

    switch (message.type) {
      case 'registration_ack':
        console.log('✅ Device registration successful');

        // Test 2: Send sensor data
        setTimeout(() => {
          console.log('\n📊 Test 2: Sending sensor data...');
          ws.send(JSON.stringify({
            type: 'sensor_data',
            payload: {
              tank_type: 'main',
              level_percentage: 75.5,
              level_liters: 755,
              sensor_health: 'online',
              esp32_id: testESP32Id,
              battery_voltage: 3.7,
              signal_strength: -45
            }
          }));
        }, 1000);
        break;

      case 'motor_command':
        console.log('✅ Motor command received:', message.command);

        // Test 3: Send motor status
        setTimeout(() => {
          console.log('\n🔧 Test 3: Sending motor status...');
          ws.send(JSON.stringify({
            type: 'motor_status',
            payload: {
              esp32_id: testESP32Id,
              motor_running: true,
              power_detected: true,
              current_draw: 2.3,
              runtime_seconds: 3600
            }
          }));
        }, 1000);
        break;

      case 'status_ack':
        console.log('✅ Motor status acknowledged');

        // Test 4: Send heartbeat
        setTimeout(() => {
          console.log('\n💓 Test 4: Sending heartbeat...');
          ws.send(JSON.stringify({
            type: 'heartbeat',
            payload: {
              esp32_id: testESP32Id,
              battery_level: 85,
              wifi_strength: -45,
              uptime: 86400
            }
          }));
        }, 1000);
        break;

      case 'heartbeat_ack':
        console.log('✅ Heartbeat acknowledged');

        // Test complete
        setTimeout(() => {
          console.log('\n🎉 All tests completed successfully!');
          ws.close();
        }, 1000);
        break;

      case 'error':
        console.error('❌ Error received:', message.message);
        break;
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - closing connection');
  ws.close();
}, 30000);
