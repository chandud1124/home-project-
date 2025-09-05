const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const bodyParser = require('body-parser');
const ESP32Controller = require('./esp32-enhanced-routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dwcouaacpqipvvsxiygo.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4';

const supabase = createClient(supabaseUrl, supabaseKey);
let dbConnected = false;

// Test Supabase connection
supabase.from('test').select('*').limit(1).then(() => {
  dbConnected = true;
  console.log('Connected to Supabase');
}).catch(err => {
  console.error('Failed to connect to Supabase:', err);
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ 
  port: process.env.WS_PORT || 8083,
  host: '0.0.0.0' // Bind to all interfaces
});

// Store ESP32 connections
const esp32Connections = new Map();

wss.on('connection', (ws, req) => {
  console.log('Client connected to WebSocket:', req.socket.remoteAddress);

  // Send current system status to new frontend clients
  if (!ws.esp32_id) {
    console.log('📡 Sending current system status to frontend client');
    const currentStatus = {
      wifi_connected: true,
      battery_level: 85,
      temperature: 25,
      esp32_top_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'top_tank') ? 'online' : 'offline',
      esp32_sump_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'sump_tank') ? 'online' : 'offline',
      wifi_strength: -50,
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify({
      type: 'system_status',
      data: currentStatus
    }));
  }

  // Handle ESP32 WebSocket messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);

      switch (data.type) {
        case 'esp32_register':
          // Register ESP32 device with network information
          const clientIP = req.socket.remoteAddress || req.connection.remoteAddress;
          const deviceInfo = {
            esp32_id: data.esp32_id,
            mac_address: data.mac_address || 'Unknown',
            ip_address: clientIP,
            device_type: data.device_type || 'unknown',
            firmware_version: data.firmware_version || 'Unknown',
            registered_at: new Date()
          };

          esp32Connections.set(data.esp32_id, { ws, ...deviceInfo });
          ws.esp32_id = data.esp32_id;
          ws.deviceInfo = deviceInfo;

          // Store device information in database
          if (dbConnected) {
            try {
              const { error } = await supabase
                .from('esp32_devices')
                .upsert({
                  id: data.esp32_id,
                  ...deviceInfo,
                  last_seen: new Date().toISOString(),
                  status: 'online'
                }, {
                  onConflict: 'id'
                });

              if (error) {
                console.error('Error storing device info:', error);
              } else {
                console.log(`Device ${data.esp32_id} registered in Supabase`);
              }
            } catch (dbError) {
              console.error('Error storing device info:', dbError);
            }
          } else {
            console.log('Database not connected yet, skipping device storage');
          }

          console.log(`ESP32 ${data.esp32_id} registered from ${clientIP}`);
          console.log('Total ESP32 connections after registration:', esp32Connections.size);
          
          // Broadcast system status update to frontend
          broadcast({
            type: 'system_status',
            data: {
              wifi_connected: true,
              battery_level: 85,
              temperature: 25,
              esp32_top_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'top_tank') ? 'online' : 'offline',
              esp32_sump_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'sump_tank') ? 'online' : 'offline',
              wifi_strength: -50, // Default until first sensor data
              timestamp: new Date().toISOString()
            }
          });
          
          ws.send(JSON.stringify({
            type: 'registration_ack',
            esp32_id: data.esp32_id,
            timestamp: new Date().toISOString(),
            server_ip: req.socket.localAddress
          }));
          break;

        case 'sensor_data':
          // Handle sensor data from ESP32
          await handleSensorData(data.payload, ws);
          break;

        case 'motor_status':
          // Handle motor status from ESP32
          await handleMotorStatus(data.payload, ws);
          break;

        case 'motor_control':
          // Handle motor control from frontend
          await handleMotorControl(data, ws);
          break;

        case 'auto_mode_control':
          // Handle auto mode control from frontend
          console.log('Received auto_mode_control message from:', ws.esp32_id ? 'ESP32' : 'Frontend');
          await handleAutoModeControl(data, ws);
          break;

        case 'reset_manual':
          // Handle manual override reset from frontend
          await handleResetManual(data, ws);
          break;

        case 'alert':
          // Handle alert notifications from ESP32
          await handleAlertNotification(data, ws);
          break;

        case 'heartbeat':
          // Handle heartbeat from ESP32
          await handleHeartbeat(data, ws);
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    if (ws.esp32_id) {
      // Update device status to offline
      supabase
        .from('esp32_devices')
        .update({
          status: 'offline',
          last_seen: new Date().toISOString()
        })
        .eq('id', ws.esp32_id)
        .then(() => {})
        .catch(err => console.error('Error updating device status:', err));

      esp32Connections.delete(ws.esp32_id);
      console.log(`ESP32 ${ws.esp32_id} disconnected`);
    } else {
      console.log('Client disconnected from WebSocket');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle sensor data from ESP32 via WebSocket
const handleSensorData = async (payload, ws) => {
  const {
    tank_type,
    level_percentage,
    level_liters,
    sensor_health,
    esp32_id,
    battery_voltage,
    signal_strength,
    float_switch,
    motor_running,
    manual_override,
    auto_mode_enabled
  } = payload;

  if (dbConnected) {
    try {
      const { data, error } = await supabase
        .from('tank_readings')
        .insert({
          tank_type,
          level_percentage,
          level_liters,
          sensor_health,
          esp32_id,
          battery_voltage,
          signal_strength,
          float_switch,
          motor_running,
          manual_override,
          auto_mode_enabled,
          timestamp: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error storing tank reading:', error);
      } else {
        console.log(`Tank reading stored for ${tank_type}: ${level_percentage}%`);
      }

      const reading = {
        id: data?.[0]?.id,
        tank_type,
        level_percentage,
        level_liters,
        sensor_health,
        esp32_id,
        signal_strength,
        float_switch,
        motor_running,
        manual_override,
        auto_mode_enabled,
        timestamp: new Date().toISOString()
      };

      // Broadcast to frontend clients only (not ESP32)
      broadcast({ type: 'tank_reading', data: reading });

      // Send pong response to ESP32 to acknowledge heartbeat
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));

      // Also broadcast system status update to frontend only
      broadcast({
        type: 'system_status',
        data: {
          wifi_connected: true,
          battery_level: 85, // ESP32 doesn't have battery, use default
          temperature: 25,
          esp32_top_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'top_tank') ? 'online' : 'offline',
          esp32_sump_status: Array.from(esp32Connections.values()).some(conn => conn.deviceInfo?.device_type === 'sump_tank') ? 'online' : 'offline',
          wifi_strength: payload.signal_strength || -50,
          float_switch: payload.float_switch,
          motor_running: payload.motor_running,
          manual_override: payload.manual_override,
          timestamp: new Date().toISOString()
        }
      });

      // Send motor command to specific ESP32 device
      const motorCommand = await getMotorCommand(level_percentage, tank_type);
      if (motorCommand.command !== 'maintain') {
        broadcastToESP32(motorCommand.esp32_id, {
          type: 'motor_command',
          command: motorCommand,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error handling sensor data:', error);
    }
  } else {
    console.log('Database not connected yet, processing sensor data without storage');
    
    // Still broadcast the data even if database is not connected
    const reading = {
      tank_type,
      level_percentage,
      level_liters,
      sensor_health,
      esp32_id,
      signal_strength,
      float_switch,
      motor_running,
      manual_override,
      auto_mode_enabled,
      timestamp: new Date().toISOString()
    };

    // Broadcast to frontend clients only (not ESP32)
    broadcast({ type: 'tank_reading', data: reading });

    // Send pong response to ESP32 to acknowledge heartbeat
    ws.send(JSON.stringify({
      type: 'pong',
      timestamp: new Date().toISOString()
    }));
  }
};

// Handle motor status from ESP32 via WebSocket
const handleMotorStatus = async (payload, ws) => {
  const {
    esp32_id,
    motor_running,
    power_detected,
    current_draw,
    runtime_seconds
  } = payload;

  try {
    const { error } = await supabase
      .from('motor_events')
      .insert({
        event_type: motor_running ? 'motor_started' : 'motor_stopped',
        duration: runtime_seconds,
        esp32_id,
        motor_running,
        power_detected,
        current_draw,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing motor event:', error);
    } else {
      console.log(`Motor event stored: ${motor_running ? 'started' : 'stopped'} for ${esp32_id}`);
    }

    // Broadcast motor status to frontend only
    broadcast({
      type: 'motor_status',
      data: {
        esp32_id,
        motor_running,
        power_detected,
        current_draw,
        runtime: runtime_seconds,
        timestamp: new Date().toISOString()
      }
    });

    ws.send(JSON.stringify({
      type: 'status_ack',
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error handling motor status:', error);
  }
};

// Handle motor control from frontend
const handleMotorControl = async (data, ws) => {
  const { state } = data;
  console.log('Frontend motor control:', state ? 'START' : 'STOP');

  // Send to all connected ESP32 devices (or specific one if needed)
  esp32Connections.forEach((esp32Ws, esp32Id) => {
    if (esp32Ws.ws && esp32Ws.ws.readyState === WebSocket.OPEN) {
      esp32Ws.ws.send(JSON.stringify({
        type: 'motor_control',
        state: state,
        timestamp: new Date().toISOString()
      }));
    }
  });
};

// Handle auto mode control from frontend
const handleAutoModeControl = async (data, ws) => {
  const { enabled } = data;
  console.log('Frontend auto mode control:', enabled ? 'ENABLE' : 'DISABLE');
  console.log('Current ESP32 connections:', Array.from(esp32Connections.keys()));
  console.log('Total ESP32 connections count:', esp32Connections.size);

  // Send to all connected ESP32 devices
  let sentCount = 0;
  esp32Connections.forEach((esp32Ws, esp32Id) => {
    if (esp32Ws.ws && esp32Ws.ws.readyState === WebSocket.OPEN) {
      console.log('Sending auto_mode_control to ESP32:', esp32Id);
      esp32Ws.ws.send(JSON.stringify({
        type: 'auto_mode_control',
        enabled: enabled,
        timestamp: new Date().toISOString()
      }));
      sentCount++;
    } else {
      console.log('ESP32 connection not open for:', esp32Id, 'State:', esp32Ws.ws ? esp32Ws.ws.readyState : 'no ws');
    }
  });
  console.log('Sent auto_mode_control to', sentCount, 'ESP32 devices');
};

// Handle manual override reset from frontend
const handleResetManual = async (data, ws) => {
  console.log('Frontend manual override reset');

  // Send to all connected ESP32 devices
  esp32Connections.forEach((esp32Ws, esp32Id) => {
    if (esp32Ws.ws && esp32Ws.ws.readyState === WebSocket.OPEN) {
      esp32Ws.ws.send(JSON.stringify({
        type: 'reset_manual',
        timestamp: new Date().toISOString()
      }));
    }
  });
};

// Handle alert notifications from ESP32
const handleAlertNotification = async (data, ws) => {
  const {
    tank_type,
    esp32_id,
    alert_type,
    message,
    level_percentage,
    timestamp
  } = data;

  try {
    console.log(`🚨 Alert received from ${esp32_id}: ${alert_type} - ${message}`);

    // Store alert in database
    const alertDoc = {
      tank_type,
      esp32_id,
      alert_type,
      message,
      level_percentage,
      timestamp: new Date(timestamp || Date.now()).toISOString(),
      acknowledged: false
    };

    const { error } = await supabase
      .from('alerts')
      .insert(alertDoc);

    if (error) {
      console.error('Error storing system alert:', error);
    } else {
      console.log(`System alert stored: ${alert_type} for ${esp32_id}`);
    }

    // Broadcast alert to all frontend clients
    broadcast({
      type: 'system_alert',
      data: {
        id: alertDoc._id,
        tank_type,
        esp32_id,
        alert_type,
        message,
        level_percentage,
        timestamp: alertDoc.timestamp,
        acknowledged: false
      }
    });

    console.log(`🚨 Alert stored and broadcasted: ${alert_type}`);

  } catch (error) {
    console.error('Error handling alert notification:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process alert notification',
      timestamp: new Date().toISOString()
    }));
  }
};

// Handle heartbeat from ESP32
const handleHeartbeat = async (data, ws) => {
  const { esp32_id, timestamp } = data;

  try {
    console.log(`💓 Heartbeat received from ${esp32_id}`);

    // Update device last seen
    await supabase
      .from('esp32_devices')
      .update({
        last_seen: new Date(timestamp || Date.now()).toISOString(),
        status: 'online'
      })
      .eq('id', esp32_id);

    // Send pong response to ESP32 to acknowledge heartbeat
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'pong',
        esp32_id,
        timestamp: new Date().toISOString(),
        server_time: new Date().toISOString()
      }));
    }

    console.log(`💓 Heartbeat acknowledged for ${esp32_id}`);

  } catch (error) {
    console.error('Error handling heartbeat:', error);
  }
};

// Motor command logic
const getMotorCommand = async (currentLevel, tankType) => {
  try {
    // Get latest readings from both tanks
    const { data: topTankData } = await supabase
      .from('tank_readings')
      .select('*')
      .in('tank_type', ['top_tank', 'main'])
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: sumpTankData } = await supabase
      .from('tank_readings')
      .select('*')
      .in('tank_type', ['sump_tank', 'sump'])
      .order('timestamp', { ascending: false })
      .limit(1);

    const topTank = topTankData?.[0];
    const sumpTank = sumpTankData?.[0];

    const topLevel = topTank ? topTank.level_percentage : 50;
    const sumpLevel = sumpTank ? sumpTank.level_percentage : 50;

    console.log(`🔄 Motor logic check - Top: ${topLevel}%, Sump: ${sumpLevel}%, Current tank: ${tankType}`);

    // Auto mode logic based on tank type
    if (tankType === 'top_tank' || tankType === 'main') {
      // Top tank logic - start when low and sump has water
      if (topLevel < 20 && sumpLevel > 30) {
        console.log('🚀 Starting motor: Top tank low, sump has water');
        return { command: 'start', reason: 'auto_fill_low_top_tank', esp32_id: 'ESP32_SUMP_002' };
      }
      if (topLevel > 90 || sumpLevel < 20) {
        console.log('🛑 Stopping motor: Top tank full or sump low');
        return { command: 'stop', reason: 'safety_cutoff_top_tank', esp32_id: 'ESP32_SUMP_002' };
      }
    } else if (tankType === 'sump_tank' || tankType === 'sump') {
      // Sump tank logic - start when low and top has water
      if (sumpLevel < 20 && topLevel > 30) {
        console.log('🚀 Starting motor: Sump tank low, top has water');
        return { command: 'start', reason: 'auto_fill_low_sump_tank', esp32_id: 'ESP32_SUMP_002' };
      }
      if (sumpLevel > 90) {
        console.log('🛑 Stopping motor: Sump tank full');
        return { command: 'stop', reason: 'safety_cutoff_sump_full', esp32_id: 'ESP32_SUMP_002' };
      }
    }

    console.log('⏸️ Maintaining current motor state');
    return { command: 'maintain', reason: 'normal_operation' };
  } catch (error) {
    console.error('Error in getMotorCommand:', error);
    return { command: 'maintain', reason: 'error_in_logic' };
  }
};

// Broadcast to all connected clients except ESP32 devices
const broadcast = (data) => {
  console.log('📡 Broadcasting message:', data.type, 'to frontend clients');
  let sentCount = 0;
  wss.clients.forEach((client) => {
    // Don't send data messages to ESP32 devices
    if (client.readyState === WebSocket.OPEN && !client.esp32_id) {
      client.send(JSON.stringify(data));
      sentCount++;
      console.log('📡 Sent to frontend client');
    }
  });
  console.log(`📡 Broadcast complete: sent to ${sentCount} clients`);
};

// Broadcast control messages only to ESP32 devices
const broadcastToESP32 = (esp32_id, data) => {
  const targetESP32 = esp32Connections.get(esp32_id);
  if (targetESP32 && targetESP32.ws && targetESP32.ws.readyState === WebSocket.OPEN) {
    targetESP32.ws.send(JSON.stringify(data));
  }
};

// Initialize ESP32 controller
const esp32Controller = new ESP32Controller(supabase, broadcast);

// ESP32 API Routes - Enhanced
app.post('/api/esp32/sensor-data', (req, res) => esp32Controller.handleSensorData(req, res));
app.post('/api/esp32/motor-status', (req, res) => esp32Controller.handleMotorStatus(req, res));
app.post('/api/esp32/heartbeat', (req, res) => esp32Controller.handleHeartbeat(req, res));
app.post('/api/esp32/esp-now-message', (req, res) => esp32Controller.handleESPNowMessage(req, res));
app.post('/api/esp32/config/:esp32_id', (req, res) => esp32Controller.updateDeviceConfig(req, res));
app.post('/api/esp32/sync-events', (req, res) => esp32Controller.syncDeviceEvents(req, res));
app.get('/api/esp32/device-status', (req, res) => esp32Controller.getDeviceStatus(req, res));

// ESP32 Device Configuration Routes
app.post('/api/esp32/devices', async (req, res) => {
  try {
    const deviceConfig = req.body;
    const { data, error } = await supabase
      .from('esp32_devices')
      .insert({
        ...deviceConfig,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        status: 'configured'
      })
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({
        success: true,
        deviceId: data?.[0]?.id,
        message: 'Device configuration saved successfully'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ESP32 Device Registration Endpoint
app.post('/api/esp32/register', async (req, res) => {
  try {
    const { esp32_id, mac_address, device_type, ip_address, firmware_version } = req.body;

    // Check for duplicate MAC address (only if MAC is provided and not 'Unknown')
    if (mac_address && mac_address !== 'Unknown') {
      const { data: existingDevices, error: checkError } = await supabase
        .from('esp32_devices')
        .select('id')
        .eq('mac_address', mac_address)
        .neq('id', esp32_id);

      if (checkError) {
        return res.status(500).json({ error: checkError.message });
      }

      if (existingDevices && existingDevices.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'MAC address already registered to another device'
        });
      }
    }

    // Update or insert device registration
    const { error } = await supabase
      .from('esp32_devices')
      .upsert({
        id: esp32_id,
        mac_address,
        ip_address,
        device_type,
        firmware_version,
        registered_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        status: 'online'
      }, {
        onConflict: 'id'
      });

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({
        success: true,
        message: 'Device registered successfully',
        device_id: esp32_id
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/esp32/devices', async (req, res) => {
  try {
    const { data: devices, error } = await supabase
      .from('esp32_devices')
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      // Enhance with real-time connection status
      const enhancedDevices = devices.map(device => {
        const connection = esp32Connections.get(device.id);
        return {
          ...device,
          is_connected: !!connection,
          current_ip: connection?.ip_address || device.ip_address,
          last_seen: connection ? new Date().toISOString() : device.last_seen,
          status: connection ? 'online' : (device.status || 'offline')
        };
      });

      res.json({ success: true, devices: enhancedDevices });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/esp32/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { error } = await supabase
      .from('esp32_devices')
      .update({
        ...updates,
        last_updated: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({ success: true, message: 'Device configuration updated successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/esp32/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('esp32_devices')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({ success: true, message: 'Device configuration deleted successfully' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes

// Get current tank levels
app.get('/api/tanks', async (req, res) => {
  try {
    // Get the latest reading for each tank type
    const { data: topTankData, error: topError } = await supabase
      .from('tank_readings')
      .select('*')
      .eq('tank_type', 'top_tank')
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: sumpTankData, error: sumpError } = await supabase
      .from('tank_readings')
      .select('*')
      .eq('tank_type', 'sump_tank')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (topError || sumpError) {
      res.status(500).json({ error: 'Database query error' });
    } else {
      const tanks = [];
      if (topTankData && topTankData.length > 0) tanks.push(topTankData[0]);
      if (sumpTankData && sumpTankData.length > 0) tanks.push(sumpTankData[0]);
      res.json(tanks);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add tank reading
app.post('/api/tanks/reading', async (req, res) => {
  const { tank_type, level_percentage, level_liters } = req.body;
  try {
    const { data, error } = await supabase
      .from('tank_readings')
      .insert({
        tank_type,
        level_percentage,
        level_liters,
        timestamp: new Date().toISOString()
      })
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      const reading = data[0];
      broadcast({ type: 'tank_reading', data: reading });
      res.json(reading);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Motor control
app.post('/api/motor/control', async (req, res) => {
  const { action } = req.body;
  try {
    const { data, error } = await supabase
      .from('motor_events')
      .insert({
        event_type: action === 'start' ? 'motor_started' : 'motor_stopped',
        esp32_id: 'web_control',
        motor_running: action === 'start',
        timestamp: new Date().toISOString()
      })
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      const event = {
        id: data[0].id,
        event_type: action,
        timestamp: new Date().toISOString()
      };
      broadcast({ type: 'motor_event', data: event });
      res.json({ success: true, event });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get motor events
app.get('/api/motor/events', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('motor_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json(events);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get system alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      res.json(alerts);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add system alert
app.post('/api/alerts', async (req, res) => {
  const { type, message } = req.body;
  try {
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        type,
        title: message,
        message,
        resolved: false,
        timestamp: new Date().toISOString()
      })
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      const alert = data[0];
      broadcast({ type: 'system_alert', data: alert });
      res.json(alert);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update system status
app.post('/api/system/status', async (req, res) => {
  const { wifi_connected, battery_level, temperature, esp32_top_status, esp32_sump_status } = req.body;
  try {
    const { data, error } = await supabase
      .from('system_status')
      .insert({
        wifi_connected,
        battery_level,
        temperature,
        esp32_top_status,
        esp32_sump_status,
        timestamp: new Date().toISOString()
      })
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
    } else {
      const status = data[0];
      broadcast({ type: 'system_status', data: status });
      res.json(status);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest system status
app.get('/api/system/status', async (req, res) => {
  try {
    const { data: status, error } = await supabase
      .from('system_status')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      res.status(500).json({ error: error.message });
    } else if (status && status.length > 0) {
      res.json(status[0]);
    } else {
      // Return default status when no data exists
      res.json({
        id: 1,
        wifi_connected: false,
        battery_level: 0,
        temperature: 0,
        esp32_top_status: 'offline',
        esp32_sump_status: 'offline',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get consumption data for charts
app.get('/api/consumption', async (req, res) => {
  const { period = 'daily' } = req.query;
  try {
    if (period === 'daily') {
      // Get tank readings for consumption calculation
      const tankReadings = await db.collection('tank_readings').aggregate([
        { $match: { tank_type: 'top_tank', timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          readings: { $push: { level_liters: "$level_liters", timestamp: "$timestamp" } },
          avg_level: { $avg: "$level_percentage" },
          readings_count: { $sum: 1 }
        }},
        { $sort: { _id: -1 } }
      ]).toArray();

      // Get motor events for the same period
      const motorEvents = await db.collection('motor_events').aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          motor_starts: { $sum: { $cond: [{ $eq: ["$event_type", "motor_started"] }, 1, 0] } },
          fills: { $sum: { $cond: [{ $eq: ["$event_type", "tank_fill_complete"] }, 1, 0] } }
        }}
      ]).toArray();

      // Combine tank and motor data
      const consumptionData = tankReadings.map(tankDay => {
        const motorDay = motorEvents.find(me => me._id === tankDay._id) || { motor_starts: 0, fills: 0 };

        // Calculate consumption from tank level changes
        let consumption = 0;
        if (tankDay.readings.length > 1) {
          const sortedReadings = tankDay.readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const firstReading = sortedReadings[0].level_liters;
          const lastReading = sortedReadings[sortedReadings.length - 1].level_liters;
          consumption = Math.max(0, firstReading - lastReading);
        }

        return {
          date: tankDay._id,
          consumption: Math.round(consumption),
          fills: motorDay.fills || 0,
          motorStarts: motorDay.motor_starts || 0
        };
      });

      res.json(consumptionData);
    } else {
      // Monthly data
      const monthlyData = await db.collection('tank_readings').aggregate([
        { $match: { tank_type: 'top_tank', timestamp: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
          readings: { $push: { level_liters: "$level_liters", timestamp: "$timestamp" } },
          avg_level: { $avg: "$level_percentage" },
          readings_count: { $sum: 1 }
        }},
        { $sort: { _id: -1 } }
      ]).toArray();

      const monthlyConsumption = monthlyData.map(month => {
        let consumption = 0;
        if (month.readings.length > 1) {
          const sortedReadings = month.readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const firstReading = sortedReadings[0].level_liters;
          const lastReading = sortedReadings[sortedReadings.length - 1].level_liters;
          consumption = Math.max(0, firstReading - lastReading);
        }

        return {
          date: month._id,
          consumption: Math.round(consumption),
          fills: 0, // Monthly fills calculation would be more complex
          motorStarts: 0 // Monthly motor starts calculation would be more complex
        };
      });

      res.json(monthlyConsumption);
    }
  } catch (err) {
    console.error('Error fetching consumption data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await db.collection('notifications')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(id) },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('notifications').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced ESP32 routes
app.post('/api/esp32/sensor-data', (req, res) => esp32Controller.handleSensorData(req, res));
app.post('/api/esp32/heartbeat', (req, res) => esp32Controller.handleHeartbeat(req, res));
app.post('/api/esp32/esp-now-message', (req, res) => esp32Controller.handleESPNowMessage(req, res));
app.post('/api/esp32/config/:esp32_id', (req, res) => esp32Controller.updateDeviceConfig(req, res));
app.post('/api/esp32/sync-events', (req, res) => esp32Controller.syncDeviceEvents(req, res));
app.get('/api/esp32/device-status', (req, res) => esp32Controller.getDeviceStatus(req, res));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${process.env.WS_PORT || 8083}`);
  console.log(`Enhanced ESP32 endpoints available at /api/esp32/`);
});
