const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const bodyParser = require('body-parser');
const ESP32Controller = require('./esp32-enhanced-routes');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize MongoDB client
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
let db;

client.connect().then(() => {
  db = client.db();
  console.log('Connected to MongoDB');
});

// MongoDB collections will be created automatically on first insert

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
          try {
            await db.collection('esp32_devices').updateOne(
              { id: data.esp32_id },
              {
                $set: {
                  ...deviceInfo,
                  last_seen: new Date(),
                  status: 'online'
                },
                $setOnInsert: {
                  created_at: new Date()
                }
              },
              { upsert: true }
            );
          } catch (dbError) {
            console.error('Error storing device info:', dbError);
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
              esp32_top_status: data.device_type === 'top_tank' ? 'online' : 'offline',
              esp32_sump_status: data.device_type === 'sump_tank' ? 'online' : 'offline',
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
      db.collection('esp32_devices').updateOne(
        { id: ws.esp32_id },
        { 
          $set: { 
            status: 'offline',
            last_seen: new Date()
          } 
        }
      ).catch(err => console.error('Error updating device status:', err));
      
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

  try {
    const result = await db.collection('tank_readings').insertOne({
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
      timestamp: new Date()
    });

    const reading = {
      id: result.insertedId,
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

    // Also broadcast system status update to frontend only
    broadcast({
      type: 'system_status',
      data: {
        wifi_connected: true,
        battery_level: 85, // ESP32 doesn't have battery, use default
        temperature: 25,
        esp32_top_status: payload.esp32_id.includes('TOP') ? 'online' : 'offline',
        esp32_sump_status: payload.esp32_id.includes('SUMP') ? 'online' : 'offline',
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
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process sensor data',
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
    await db.collection('motor_events').insertOne({
      event_type: motor_running ? 'motor_started' : 'motor_stopped',
      duration: runtime_seconds,
      esp32_id,
      motor_running,
      power_detected,
      current_draw,
      timestamp: new Date()
    });

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

// Motor command logic
const getMotorCommand = async (currentLevel, tankType) => {
  try {
    // Get latest readings from both tanks
    const [topTank] = await db.collection('tank_readings')
      .find({ tank_type: 'main' })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    const [sumpTank] = await db.collection('tank_readings')
      .find({ tank_type: 'sump' })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    const topLevel = topTank ? topTank.level_percentage : 50;
    const sumpLevel = sumpTank ? sumpTank.level_percentage : 50;

    // Auto mode logic based on tank type
    if (tankType === 'main') {
      // Main tank logic
      if (topLevel < 20 && sumpLevel > 30) {
        return { command: 'start', reason: 'auto_fill_low_main_tank', esp32_id: 'ESP32_SUMP_001' };
      }
      if (topLevel > 90 || sumpLevel < 20) {
        return { command: 'stop', reason: 'safety_cutoff_main_tank', esp32_id: 'ESP32_SUMP_001' };
      }
    } else if (tankType === 'sump') {
      // Sump tank logic
      if (sumpLevel < 20 && topLevel > 30) {
        return { command: 'start', reason: 'auto_fill_low_sump_tank', esp32_id: 'ESP32_SUMP_001' };
      }
      if (sumpLevel > 90) {
        return { command: 'stop', reason: 'safety_cutoff_sump_full', esp32_id: 'ESP32_SUMP_001' };
      }
    }

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
const esp32Controller = new ESP32Controller(db, broadcast);

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
    const result = await db.collection('esp32_devices').insertOne({
      ...deviceConfig,
      createdAt: new Date(),
      lastUpdated: new Date(),
      status: 'configured'
    });
    res.json({ 
      success: true, 
      deviceId: result.insertedId,
      message: 'Device configuration saved successfully'
    });
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
      const existingDevice = await db.collection('esp32_devices').findOne({ 
        mac_address: mac_address,
        id: { $ne: esp32_id } // Exclude current device
      });
      
      if (existingDevice) {
        return res.status(409).json({ 
          success: false, 
          error: 'MAC address already registered to another device' 
        });
      }
    }
    
    // Update or insert device registration
    const result = await db.collection('esp32_devices').updateOne(
      { id: esp32_id },
      {
        $set: {
          id: esp32_id,
          mac_address,
          ip_address,
          device_type,
          firmware_version,
          registered_at: new Date(),
          last_seen: new Date(),
          status: 'online'
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({ 
      success: true, 
      message: 'Device registered successfully',
      device_id: esp32_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/esp32/devices', async (req, res) => {
  try {
    const devices = await db.collection('esp32_devices').find({}).toArray();

    // Enhance with real-time connection status
    const enhancedDevices = devices.map(device => {
      const connection = esp32Connections.get(device.id);
      return {
        ...device,
        is_connected: !!connection,
        current_ip: connection?.ip_address || device.ip_address,
        last_seen: connection ? new Date() : device.last_seen,
        status: connection ? 'online' : (device.status || 'offline')
      };
    });

    res.json({ success: true, devices: enhancedDevices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/esp32/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await db.collection('esp32_devices').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...updates, 
          lastUpdated: new Date() 
        } 
      }
    );
    res.json({ success: true, message: 'Device configuration updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/esp32/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('esp32_devices').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Device configuration deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes

// Get current tank levels
app.get('/api/tanks', async (req, res) => {
  try {
    const tanks = await db.collection('tank_readings').aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$tank_type",
          doc: { $first: "$$ROOT" }
        }
      }
    ]).toArray();
    res.json(tanks.map(t => t.doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add tank reading
app.post('/api/tanks/reading', async (req, res) => {
  const { tank_type, level_percentage, level_liters } = req.body;
  try {
    const result = await db.collection('tank_readings').insertOne({
      tank_type,
      level_percentage,
      level_liters,
      timestamp: new Date()
    });
    const reading = {
      _id: result.insertedId,
      tank_type,
      level_percentage,
      level_liters,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'tank_reading', data: reading });
    res.json(reading);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Motor control
app.post('/api/motor/control', async (req, res) => {
  const { action } = req.body;
  try {
    const result = await db.collection('motor_events').insertOne({
      event_type: action === 'start' ? 'motor_started' : 'motor_stopped',
      esp32_id: 'web_control',
      motor_running: action === 'start',
      timestamp: new Date()
    });
    const event = {
      _id: result.insertedId,
      event_type: action,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'motor_event', data: event });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get motor events
app.get('/api/motor/events', async (req, res) => {
  try {
    const events = await db.collection('motor_events').find({}).sort({ timestamp: -1 }).limit(50).toArray();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get system alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await db.collection('system_alerts').find({}).sort({ timestamp: -1 }).limit(20).toArray();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add system alert
app.post('/api/alerts', async (req, res) => {
  const { type, message } = req.body;
  try {
    const result = await db.collection('system_alerts').insertOne({
      type,
      message,
      resolved: false,
      timestamp: new Date()
    });
    const alert = {
      _id: result.insertedId,
      type,
      message,
      resolved: false,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'system_alert', data: alert });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update system status
app.post('/api/system/status', async (req, res) => {
  const { wifi_connected, battery_level, temperature, esp32_top_status, esp32_sump_status } = req.body;
  try {
    const result = await db.collection('system_status').insertOne({
      wifi_connected,
      battery_level,
      temperature,
      esp32_top_status,
      esp32_sump_status,
      timestamp: new Date()
    });
    const status = {
      _id: result.insertedId,
      wifi_connected,
      battery_level,
      temperature,
      esp32_top_status,
      esp32_sump_status,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'system_status', data: status });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest system status
app.get('/api/system/status', async (req, res) => {
  try {
    const status = await db.collection('system_status').find({}).sort({ timestamp: -1 }).limit(1).toArray();
    if (status[0]) {
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
