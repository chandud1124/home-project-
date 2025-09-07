const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const bodyParser = require('body-parser');
// Temporarily disable ESP32Controller due to syntax errors
// const ESP32Controller = require('./esp32-enhanced-routes');

const app = express();
const PORT = process.env.PORT || 3001;
const PROTOCOL_MIN_VERSION = parseInt(process.env.PROTOCOL_MIN_VERSION || '1', 10);
const PROTOCOL_MAX_VERSION = parseInt(process.env.PROTOCOL_MAX_VERSION || '1', 10);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Basic request logging (lightweight)
app.use((req, _res, next) => {
  if (process.env.LOG_LEVEL !== 'silent') {
    console.log(`[req] ${req.method} ${req.url}`);
  }
  next();
});

// Multi-key fallback map (optional) sources (lowest -> highest precedence):
// 1. backend/device_keys.json (NOT committed; create from device_keys.json.example)
// 2. DEVICE_KEYS_JSON environment variable (JSON string)
// These are only used if a device row isn't found in Supabase.
let fallbackDeviceMap = {};
// (1) Load JSON file if present
try {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, 'device_keys.json');
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      fallbackDeviceMap = { ...fallbackDeviceMap, ...parsed };
      console.log('[auth] Loaded device_keys.json entries:', Object.keys(parsed).length);
    }
  }
} catch (e) {
  console.warn('[auth] Unable to load device_keys.json:', e.message);
}
// (2) Merge DEVICE_KEYS_JSON env
try {
  if (process.env.DEVICE_KEYS_JSON) {
    const envParsed = JSON.parse(process.env.DEVICE_KEYS_JSON);
    if (envParsed && typeof envParsed === 'object') {
      fallbackDeviceMap = { ...fallbackDeviceMap, ...envParsed };
      console.log('[auth] Loaded DEVICE_KEYS_JSON entries:', Object.keys(envParsed).length);
    }
  }
} catch (e) {
  console.warn('[auth] Invalid DEVICE_KEYS_JSON, ignoring');
}
if (Object.keys(fallbackDeviceMap).length) {
  console.log('[auth] Total fallback device entries available:', Object.keys(fallbackDeviceMap).length);
} else {
  console.log('[auth] No fallback device entries loaded (DB lookups only).');
}

// Temporary device entries for testing
fallbackDeviceMap['TOP_TANK'] = {
  api_key: '1cec808ab4d301c872af4134914447955c2e06987d6334cb3fbe365e606df9e7',
  hmac_secret: 'top_secret_2024_hmac_key'
};
fallbackDeviceMap['SUMP_TANK'] = {
  api_key: 'ba18958c539f1a4b34c3642c22097aa25ce98068d01e1340892211e8e53c5f05',
  hmac_secret: 'sump_secret_2024_hmac_key'
};

// API Response cache for frequently requested data
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 2000; // 2 seconds for tank/alerts data

// Simple authentication cache to avoid repeated DB lookups  
const authCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Cache middleware for GET requests
const cacheResponse = (cacheDuration = RESPONSE_CACHE_TTL) => {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    
    const cacheKey = req.originalUrl;
    const cached = responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      console.log(`⚡ Cache hit for ${cacheKey}`);
      return res.json(cached.data);
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      // Cache the response
      responseCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      return originalJson.call(this, data);
    };
    
    next();
  };
};

console.log('[auth] Added temporary device entries for testing (TOP_TANK, SUMP_TANK)');

// Unified device auth with optional strict HMAC
const requireDeviceAuth = async (req, res, next) => {
  const crypto = require('crypto');
  const deviceId = req.header('x-device-id');
  const apiKey = req.header('x-api-key');
  const signature = req.header('x-signature');
  const ts = req.header('x-timestamp');
  const hmacRequired = (process.env.HMAC_REQUIRED || process.env.DEVICE_HMAC_REQUIRED || 'false').toLowerCase() === 'true';
  
  console.log(`🔐 Auth attempt - Device ID: "${deviceId}", API Key: "${apiKey ? apiKey.substring(0, 10) + '...' : 'missing'}"`);
  
  if (!deviceId || !apiKey) {
    console.log(`🔐 Auth failed - Missing headers: deviceId=${!!deviceId}, apiKey=${!!apiKey}`);
    return res.status(401).json({ error: 'Missing device auth headers' });
  }

  // Check cache first for performance
  const cacheKey = `${deviceId}:${apiKey}`;
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    req.device = { id: deviceId };
    console.log(`⚡ Auth success - Device: "${deviceId}" (cached)`);
    return next();
  }

  try {
    let device = null;
    // Check devices table first (where our seeded device is)
    let query = await supabase
      .from('devices')
      .select('device_id, api_key, hmac_secret, is_active')
      .eq('device_id', deviceId)
      .limit(1);
    if (query.error || !query.data || query.data.length === 0) {
      // fallback to esp32_devices table
      query = await supabase
        .from('esp32_devices')
        .select('id, api_key, hmac_secret, is_active')
        .eq('id', deviceId)
        .limit(1);
      if (!query.error && query.data && query.data.length > 0) {
        const d = query.data[0];
        device = { id: d.id, api_key: d.api_key, hmac_secret: d.hmac_secret, is_active: d.is_active !== false };
      }
    } else {
      // Found device in devices table
      const d = query.data[0];
      device = { id: d.device_id, api_key: d.api_key, hmac_secret: d.hmac_secret, is_active: d.is_active !== false };
    }
    if (!device && fallbackDeviceMap[deviceId]) {
      device = { id: deviceId, api_key: fallbackDeviceMap[deviceId].api_key, hmac_secret: fallbackDeviceMap[deviceId].hmac_secret, is_active: true };
      console.log(`🔄 Using fallback device entry for: "${deviceId}"`);
    }
    if (!device) {
      console.log(`❌ Device not found: "${deviceId}"`);
      return res.status(401).json({ error: 'Device not found' });
    }
    if (device.api_key !== apiKey) {
      console.log(`❌ API Key mismatch - Expected: "${device.api_key}", Got: "${apiKey}"`);
      return res.status(401).json({ error: 'Invalid device credentials' });
    }
    if (device.is_active === false) {
      console.log(`❌ Device inactive: "${deviceId}"`);
      return res.status(401).json({ error: 'Device inactive' });
    }
    if (hmacRequired) {
      if (!signature || !ts) {
        return res.status(401).json({ error: 'Missing signature/timestamp' });
      }
      const driftSec = parseInt(process.env.HMAC_TIME_DRIFT_SECONDS || '300', 10);
      const nowSec = Math.floor(Date.now() / 1000);
      const tsSec = parseInt(ts, 10);
      if (isNaN(tsSec) || Math.abs(nowSec - tsSec) > driftSec) {
        return res.status(401).json({ error: 'Timestamp drift too large' });
      }
      if (!device.hmac_secret) {
        return res.status(401).json({ error: 'HMAC required but device secret missing' });
      }
      const rawBody = JSON.stringify(req.body || {});
      const expected = crypto.createHmac('sha256', device.hmac_secret).update(deviceId + rawBody + ts).digest('hex');
      if (expected !== String(signature).toLowerCase()) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    req.device = { id: deviceId };
    
    // Cache successful authentication
    authCache.set(`${deviceId}:${apiKey}`, { 
      device: { id: deviceId }, 
      timestamp: Date.now() 
    });
    
    console.log(`✅ Auth success - Device: "${deviceId}" authenticated`);
    next();
  } catch (err) {
    console.error('[auth] error', err);
    return res.status(500).json({ error: 'Auth middleware error' });
  }
};

// Protocol version validation (expects protocol_version in body at any nesting depth: body.protocol_version OR body.payload.protocol_version OR body.data.protocol_version)
const validateProtocolVersion = (req, res, next) => {
  try {
    const b = req.body || {};
    const version = b.protocol_version || b?.payload?.protocol_version || b?.data?.protocol_version;
    if (version == null) {
      // Allow if min == 1 (initial rollout) else require presence
      if (PROTOCOL_MIN_VERSION > 1) {
        return res.status(400).json({ error: 'protocol_version missing' });
      }
      return next();
    }
    const vNum = parseInt(version, 10);
    if (isNaN(vNum)) {
      return res.status(400).json({ error: 'protocol_version not a number' });
    }
    if (vNum < PROTOCOL_MIN_VERSION) {
      return res.status(426).json({ error: 'protocol_version too low', min: PROTOCOL_MIN_VERSION, received: vNum });
    }
    if (vNum > PROTOCOL_MAX_VERSION) {
      return res.status(400).json({ error: 'protocol_version unsupported (future)', max: PROTOCOL_MAX_VERSION, received: vNum });
    }
    req.protocolVersion = vNum;
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'Protocol version validation error' });
  }
};

// Health endpoint
app.get('/healthz', async (_req, res) => {
  const status = { uptime: process.uptime(), supabase: dbConnected ? 'ok' : 'init', timestamp: new Date().toISOString() };
  res.json(status);
});

// Initialize Supabase client
// Configuration (prefer backend-specific env vars; fall back to Vite ones only if provided)
const supabaseUrl = process.env.SUPABASE_URL || 'https://dwcouaacpqipvvsxiygo.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
// Service role key (never expose to frontend). Only used for privileged operations if set.
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Fatal: Supabase configuration missing. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseKey);
let dbConnected = false;

// Test Supabase connectivity using a lightweight meta-query (tank_readings limited)
supabase.from('tank_readings').select('id').limit(1).then(() => {
  dbConnected = true;
  console.log('[startup] Supabase connectivity OK');
}).catch(err => {
  console.error('[startup] Supabase connectivity FAILED:', err.message);
});

// WebSocket server (will be created later for unified or dedicated mode)
let wss; // assigned in startup section
const esp32Connections = new Map();

function handleWebSocketConnection(ws, req) {
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
}

function bindWebSocketHandlers(serverInstance) {
  serverInstance.on('connection', (ws, req) => handleWebSocketConnection(ws, req));
}

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
        // Only use fields that exist in current schema
        // esp32_id,  // Column doesn't exist yet
        // motor_running,  // Column doesn't exist yet
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
      .in('tank_type', ['top_tank'])  // FIXED: removed 'main' - only standard naming
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: sumpTankData } = await supabase
      .from('tank_readings')
      .select('*')
      .in('tank_type', ['sump_tank'])  // FIXED: removed 'sump' - only standard naming
      .order('timestamp', { ascending: false })
      .limit(1);

    const topTank = topTankData?.[0];
    const sumpTank = sumpTankData?.[0];

    const topLevel = topTank ? topTank.level_percentage : 50;
    const sumpLevel = sumpTank ? sumpTank.level_percentage : 50;

    console.log(`🔄 Motor logic check - Top: ${topLevel}%, Sump: ${sumpLevel}%, Current tank: ${tankType}`);

    // Auto mode logic based on tank type
    if (tankType === 'top_tank') {  // FIXED: removed 'main' variant - only standard naming
      // Top tank logic - start when low and sump has water
      if (topLevel < 20 && sumpLevel > 30) {
        console.log('🚀 Starting motor: Top tank low, sump has water');
        return { command: 'start', reason: 'auto_fill_low_top_tank', esp32_id: 'SUMP_TANK' };
      }
      if (topLevel > 90 || sumpLevel < 20) {
        console.log('🛑 Stopping motor: Top tank full or sump low');
        return { command: 'stop', reason: 'safety_cutoff_top_tank', esp32_id: 'SUMP_TANK' };
      }
    } else if (tankType === 'sump_tank') {  // FIXED: removed 'sump' variant - only standard naming
      // Sump tank logic - start when low and top has water
      if (sumpLevel < 20 && topLevel > 30) {
        console.log('🚀 Starting motor: Sump tank low, top has water');
        return { command: 'start', reason: 'auto_fill_low_sump_tank', esp32_id: 'SUMP_TANK' };
      }
      if (sumpLevel > 90) {
        console.log('🛑 Stopping motor: Sump tank full');
        return { command: 'stop', reason: 'safety_cutoff_sump_full', esp32_id: 'SUMP_TANK' };
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
  
  // Get the active WebSocket server instance
  const activeWss = wssInstance || wsServer;
  
  if (!activeWss || !activeWss.clients) {
    console.warn('📡 No active WebSocket server or clients available');
    return;
  }
  
  activeWss.clients.forEach((client) => {
    // Don't send data messages to ESP32 devices
    if (client.readyState === WebSocket.OPEN && !client.esp32_id) {
      try {
        client.send(JSON.stringify(data));
        sentCount++;
        console.log('📡 Sent to frontend client');
      } catch (err) {
        console.warn('📡 Failed to send to client:', err.message);
      }
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

// Initialize ESP32 fallback handlers (ESP32Controller disabled due to syntax issues)
const esp32Controller = {
  handleSensorData: async (req, res) => {
    try {
      const { esp32_id, tank_type, level_percentage, level_liters, motor_running, auto_mode, float_switch, sensor_health, connection_state, signal_strength, timestamp } = req.body;
      
      // Create a safe timestamp - ignore ESP32 timestamp and use server time
      const serverTimestamp = new Date().toISOString();
      
      const sensorData = {
        esp32_id,
        tank_type,
        level_percentage: parseFloat(level_percentage) || 0,
        level_liters: parseFloat(level_liters) || 0,
        motor_running: Boolean(motor_running),
        float_switch: Boolean(float_switch),
        sensor_health: sensor_health || 'online',
        timestamp: serverTimestamp
      };
      
      const { data, error } = await supabase
        .from('tank_readings')
        .insert(sensorData)
        .select()
        .single();
      
      if (error) {
        console.error('Sensor data storage error:', error);
        return res.status(500).json({ error: error.message });
      }
      
      console.log(`📊 Sensor data stored: ${tank_type} ${level_percentage}%`);
      
      // Broadcast to frontend with auto_mode, connection_state, and signal_strength included for display
      broadcast({ 
        type: 'sensor_data', 
        data: {
          ...data,
          auto_mode: Boolean(auto_mode), // Include for frontend display even if not stored
          connection_state: connection_state || 'connected', // Include connection status
          signal_strength: signal_strength || null // Include signal strength
        }
      });
      
      res.json({ success: true, reading: data });
    } catch (err) {
      console.error('Sensor data handler error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
  
  handleHeartbeat: async (req, res) => {
    try {
      const { device_id, status, level_percentage, motor_running, auto_mode, uptime_seconds, free_heap, wifi_rssi, timestamp } = req.body;
      
      console.log(`💓 Heartbeat from ${device_id}: ${status || 'alive'}`);
      
      // Always return success first to prevent ESP32 panic
      res.json({
        success: true,
        status: 'ok',
        server_time: new Date().toISOString()
      });
      
      // Store heartbeat data asynchronously
      if (device_id) {
        const heartbeatData = {
          esp32_id: device_id,
          status: status || 'alive',
          level_percentage: parseFloat(level_percentage) || null,
          motor_running: Boolean(motor_running),
          uptime_seconds: parseInt(uptime_seconds) || null,
          free_heap: parseInt(free_heap) || null,
          wifi_rssi: parseInt(wifi_rssi) || null,
          timestamp: new Date().toISOString() // Always use server timestamp
        };
        
        const { error } = await supabase
          .from('system_status')
          .insert(heartbeatData);
        
        if (error) {
          console.warn(`Heartbeat storage warning: ${error.message}`);
        } else {
          console.log(`💓 Heartbeat stored for ${device_id}`);
          
          broadcast({ 
            type: 'heartbeat', 
            data: { 
              esp32_id: device_id, 
              status: 'alive', 
              level_percentage: parseFloat(level_percentage) || null,
              motor_running: Boolean(motor_running),
              auto_mode: Boolean(auto_mode), // Include for frontend display
              timestamp: new Date().toISOString() // Use server timestamp for consistency
            }
          });
        }
      }
    } catch (err) {
      console.error('Heartbeat handler error:', err);
      // Still return success to prevent ESP32 panic
      if (!res.headersSent) {
        res.json({
          success: true,
          status: 'ok',
          server_time: new Date().toISOString(),
          error: 'storage_failed'
        });
      }
    }
  },
  
  handlePing: (req, res) => {
    res.json({ ok: true, ts: Date.now() });
  },
  
  handleMotorStatus: async (req, res) => {
    try {
      const { esp32_id, motor_running, power_detected, current_draw, runtime_seconds } = req.body;
      console.log(`🔌 Motor status from ${esp32_id}: ${motor_running ? 'ON' : 'OFF'}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  handlePanic: async (req, res) => {
    try {
      const { device_id, panic_reason } = req.body;
      console.error(`🚨 ESP32 PANIC: ${device_id} - ${panic_reason}`);
      res.json({ success: true, acknowledged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  
  handleScheduledRestart: async (req, res) => {
    try {
      const { device_id, restart_type } = req.body;
      console.log(`🔄 ESP32 RESTART: ${device_id} - ${restart_type}`);
      res.json({ success: true, acknowledged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};

// ESP32 API Routes - Enhanced
// ========== ESP32 ROUTES ==========
app.post('/api/esp32/sensor-data', requireDeviceAuth, validateProtocolVersion, (req, res) => {
  // Track ESP32 activity for sensor data
  const deviceId = req.header('x-device-id');
  if (deviceId) {
    trackEsp32Activity(deviceId);
  }
  return esp32Controller.handleSensorData(req, res);
});
app.post('/api/esp32/motor-status', requireDeviceAuth, validateProtocolVersion, (req, res) => esp32Controller.handleMotorStatus(req, res));
app.post('/api/esp32/heartbeat', requireDeviceAuth, validateProtocolVersion, (req, res) => {
  // Track ESP32 activity for heartbeats
  const deviceId = req.header('x-device-id');
  if (deviceId) {
    trackEsp32Activity(deviceId);
  }
  return esp32Controller.handleHeartbeat(req, res);
});
app.post('/api/esp32/panic', requireDeviceAuth, (req, res) => esp32Controller.handlePanic(req, res));
app.post('/api/esp32/scheduled-restart', requireDeviceAuth, (req, res) => esp32Controller.handleScheduledRestart(req, res));
app.get('/api/esp32/ping', (req, res) => esp32Controller.handlePing(req, res));
app.post('/api/esp32/esp-now-message', requireDeviceAuth, (req, res) => esp32Controller.handleESPNowMessage(req, res));
app.post('/api/esp32/config/:esp32_id', requireDeviceAuth, (req, res) => esp32Controller.updateDeviceConfig(req, res));
app.post('/api/esp32/sync-events', requireDeviceAuth, (req, res) => esp32Controller.syncDeviceEvents(req, res));
app.get('/api/esp32/status', (req, res) => esp32Controller.getDeviceStatus(req, res));
app.get('/api/esp32/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Health check endpoint for ESP32 backend availability check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    service: 'aqua-guard-backend',
    version: '1.0.0'
  });
});

// Simple heartbeat endpoint since ESP32Controller is disabled
app.post('/api/esp32/heartbeat', requireDeviceAuth, async (req, res) => {
  try {
    const {
      device_id,
      device_type,
      timestamp,
      uptime_ms,
      wifi_rssi,
      free_heap,
      level_percentage,
      water_level_cm,
      volume_liters,
      alert_active,
      emergency_stop_active,
      system_healthy,
      error_count
    } = req.body;

    // Track ESP32 activity
    trackEsp32Activity(device_id);

    // Update device heartbeat in database
    const { error } = await supabase
      .from('device_status')
      .upsert({
        device_id,
        device_type: device_type || 'esp32',
        last_seen: new Date().toISOString(),
        wifi_connected: true, // If sending heartbeat, WiFi is connected
        system_healthy: system_healthy !== undefined ? system_healthy : true,
        alert_active: alert_active || false,
        emergency_stop_active: emergency_stop_active || false,
        uptime_ms: uptime_ms || 0,
        free_heap: free_heap || 0,
        wifi_rssi: wifi_rssi || 0,
        error_count: error_count || 0,
        metadata: {
          level_percentage,
          water_level_cm,
          volume_liters,
          last_heartbeat: timestamp || Date.now()
        }
      }, {
        onConflict: 'device_id'
      });

    if (error) {
      console.error('[heartbeat] Database error:', error);
      return res.status(500).json({ error: 'Database update failed' });
    }

    console.log(`[heartbeat] ${device_id} - ${level_percentage}% (heap: ${free_heap})`);
    res.json({ 
      success: true, 
      message: 'Heartbeat received',
      server_time: Date.now()
    });

  } catch (err) {
    console.error('[heartbeat] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ESP32 Commands endpoint - for manual motor control
app.get('/api/esp32/commands/:device_id', requireDeviceAuth, async (req, res) => {
  const { device_id } = req.params;
  
  try {
    // Get pending commands for this device
    const { data: commands, error } = await supabase
      .from('device_commands')
      .select('*')
      .eq('device_id', device_id)
      .eq('acknowledged', false)
      .gte('ttl', new Date().toISOString())
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching commands:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`📋 Commands for ${device_id}:`, commands?.length || 0);
    res.json({ success: true, commands: commands || [] });
    
  } catch (err) {
    console.error('Commands endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ESP32 Command acknowledgment endpoint
app.post('/api/esp32/commands/:command_id/ack', requireDeviceAuth, async (req, res) => {
  const { command_id } = req.params;
  const { status } = req.body;
  
  try {
    // Mark command as acknowledged
    const { data, error } = await supabase
      .from('device_commands')
      .update({ acknowledged: true })
      .eq('id', command_id)
      .select();
    
    if (error) {
      console.error('Error acknowledging command:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`✅ Command ${command_id} acknowledged with status: ${status}`);
    res.json({ success: true, acknowledged: true });
    
  } catch (err) {
    console.error('Command ack error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ESP32 Command acknowledgment endpoint (alias for /ack)
app.post('/api/esp32/commands/:command_id/acknowledge', requireDeviceAuth, async (req, res) => {
  const { command_id } = req.params;
  const { status } = req.body;
  
  try {
    // Mark command as acknowledged
    const { data, error } = await supabase
      .from('device_commands')
      .update({ acknowledged: true })
      .eq('id', command_id)
      .select();
    
    if (error) {
      console.error('Error acknowledging command:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`✅ Command ${command_id} acknowledged with status: ${status}`);
    res.json({ success: true, acknowledged: true });
    
  } catch (err) {
    console.error('Command acknowledge error:', err);
    res.status(500).json({ error: err.message });
  }
});
// New system alert endpoint (devices send alert_type, message, level_percentage, tank_type)
app.post('/api/esp32/system-alert', requireDeviceAuth, validateProtocolVersion, async (req, res) => {
  try {
    const { alert_type, message, level_percentage, tank_type, esp32_id } = req.body;
    if (!alert_type || !message) {
      return res.status(400).json({ error: 'Missing alert_type or message' });
    }
    const alertRecord = {
      tank_type: tank_type || 'unknown',
      esp32_id: esp32_id || req.device.id,
      alert_type,
      message,
      level_percentage: level_percentage ?? null,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    const { error } = await supabase.from('alerts').insert(alertRecord);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    broadcast({ type: 'system_alert', data: alertRecord });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to store alert' });
  }
});

// Compatibility single ingest endpoint (for legacy firmware expecting unified function)
app.post('/api/esp32/ingest', requireDeviceAuth, async (req, res) => {
  const { type, data, payload } = req.body || {};
  const body = data || payload || req.body;
  try {
    switch (type) {
      case 'sensor_data':
        return esp32Controller.handleSensorData({ body }, res);
      case 'heartbeat':
        return esp32Controller.handleHeartbeat({ body }, res);
      case 'motor_status':
        return esp32Controller.handleMotorStatus({ body }, res);
      default:
        return res.status(400).json({ error: 'Unknown ingest type' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Ingest failed' });
  }
});

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

    // Generate API key and HMAC secret for the device
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    const hmacSecret = crypto.randomBytes(32).toString('hex');

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
      console.error('[esp32-register] Database error:', error);
      return res.status(500).json({ error: error.message });
    } else {
      // Save the generated API key and HMAC secret to the devices table
      // Use service role key to bypass RLS for device registration
      const serviceSupabase = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { error: deviceError } = await serviceSupabase
        .from('devices')
        .upsert({
          device_id: esp32_id,
          device_name: `${device_type} - ${esp32_id}`,
          device_type: device_type || 'esp32',
          api_key: apiKey,
          hmac_secret: hmacSecret,
          is_active: true,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'device_id'
        });

      if (deviceError) {
        console.error('Error saving device auth:', deviceError);
        return res.status(500).json({ error: deviceError.message });
      } else {
        console.log(`Device auth saved for ${esp32_id}`);
      }

      res.json({
        success: true,
        message: 'Device registered successfully',
        device_id: esp32_id,
        api_key: apiKey,
        hmac_secret: hmacSecret
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
      // Enhance with real-time connection status and API keys
      const enhancedDevices = await Promise.all(devices.map(async (device) => {
        const connection = esp32Connections.get(device.id);

        // Fetch API keys from devices table
        const { data: deviceAuth } = await supabase
          .from('devices')
          .select('api_key, hmac_secret')
          .eq('device_id', device.id)
          .single();

        return {
          ...device,
          is_connected: !!connection,
          current_ip: connection?.ip_address || device.ip_address,
          last_seen: connection ? new Date().toISOString() : device.last_seen,
          status: connection ? 'online' : (device.status || 'offline'),
          api_key: deviceAuth?.api_key || '',
          hmac_secret: deviceAuth?.hmac_secret || ''
        };
      }));

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
app.get('/api/tanks', cacheResponse(3000), async (req, res) => {
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
      console.error('[tanks] Database error:', topError || sumpError);
      return res.status(500).json({ error: 'Database query error' });
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

// ESP32 Status Report - Main endpoint for ESP32 to send status updates
app.post('/api/tanks', requireDeviceAuth, async (req, res) => {
  try {
    const {
      device_id,
      device_type,
      level_percentage,
      water_level_cm,
      volume_liters,
      tank_capacity_liters,
      alert_active,
      emergency_stop_active,
      system_healthy,
      wifi_connected,
      backend_available,
      sump_esp32_available,
      last_motor_command,
      motor_command_sent,
      uptime_ms,
      free_heap,
      wifi_rssi,
      error_count,
      motor_running,
      auto_mode,
      float_switch,
      system_panic
    } = req.body;

    // Track ESP32 activity
    trackEsp32Activity(device_id);

    // Determine tank type from device type
    let tank_type;
    if (device_type === 'top_tank_monitor') {
      tank_type = 'top_tank';
    } else if (device_type === 'sump_tank_controller' || device_type === 'sump_tank') {
      tank_type = 'sump_tank';
    } else {
      tank_type = device_type;
    }

    // Insert tank reading
    const { data: reading, error: readingError } = await supabase
      .from('tank_readings')
      .insert({
        esp32_id: device_id,  // Use esp32_id instead of device_id to match schema
        tank_type,
        level_percentage: level_percentage || 0,
        level_liters: volume_liters || 0,
        motor_running: motor_running || false,
        auto_mode_enabled: auto_mode || false,
        float_switch: float_switch || false,
        timestamp: new Date().toISOString()
      })
      .select();

    if (readingError) {
      console.log('[tanks] Tank reading error:', readingError);
      return res.status(500).json({ error: 'Failed to store tank reading' });
    }

    console.log(`✅ Tank reading stored: ${device_id} - ${tank_type} ${level_percentage}%`);

    // Broadcast the tank data to WebSocket clients
    if (reading && reading.length > 0) {
      broadcast({
        type: 'tank_data',
        data: {
          device_id,
          tank_type,
          level_percentage,
          volume_liters,
          timestamp: new Date().toISOString(),
          ...reading[0]
        }
      });
    }

    res.json({ 
      success: true, 
      message: 'Tank data stored successfully',
      data: reading 
    });

  } catch (err) {
    console.error('[tanks] Error processing tank data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Motor control
app.post('/api/motor/control', async (req, res) => {
  const { action, device_id } = req.body;
  const targetDeviceId = device_id || 'SUMP_TANK'; // Default to sump ESP32
  
  try {
    // Create command for the ESP32
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = {
      id: commandId,
      device_id: targetDeviceId,
      type: 'motor_control',
      payload: {
        action: action, // 'start' or 'stop'
        manual: true,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      retry_count: 0,
      ttl: new Date(Date.now() + 3600000).toISOString(), // 1 hour TTL
      acknowledged: false
    };
    
    // Store command in device_commands table for ESP32 to pick up
    const { data: commandData, error: commandError } = await supabase
      .from('device_commands')
      .insert(command)
      .select();
      
    if (commandError) {
      console.error('Error creating device command:', commandError);
      return res.status(500).json({ error: 'Failed to create command: ' + commandError.message });
    }
    
    console.log(`🎛️ Manual motor control sent: ${action.toUpperCase()} for ${targetDeviceId}`);
    
    // Try to log the event in motor_events (but don't fail if this fails)
    let eventData = null;
    try {
      const { data: motorEvent, error: eventError } = await supabase
        .from('motor_events')
        .insert({
          event_type: action === 'start' ? 'motor_started' : 'motor_stopped',
          // Only include fields that exist in the current schema
          power_detected: action === 'start',
          current_draw: action === 'start' ? 5.2 : 0.0,
          timestamp: new Date().toISOString()
        })
        .select();

      if (eventError) {
        console.warn('Error logging motor event:', eventError);
      } else {
        eventData = motorEvent ? motorEvent[0] : null;
      }
    } catch (motorEventErr) {
      console.warn('Motor event logging failed:', motorEventErr);
    }
    
    // Broadcast to frontend - command was successful even if logging failed
    const event = {
      id: commandId,
      event_type: action,
      device_id: targetDeviceId,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'motor_control_sent', data: event });
    
    res.json({ success: true, command: commandData[0], event: eventData });
    
  } catch (err) {
    console.error('Motor control error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Emergency stop endpoint - highest priority command
app.post('/api/motor/emergency-stop', async (req, res) => {
  const { device_id } = req.body;
  const targetDeviceId = device_id || 'SUMP_TANK'; // Default to sump ESP32
  
  try {
    // Create high-priority emergency stop command
    const commandId = `emg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = {
      id: commandId,
      device_id: targetDeviceId,
      type: 'emergency_stop',
      payload: {
        action: 'stop',
        emergency: true,
        priority: 'high',
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      retry_count: 0,
      ttl: new Date(Date.now() + 3600000).toISOString(), // 1 hour TTL
      acknowledged: false
    };
    
    // Store emergency command in device_commands table
    const { data: commandData, error: commandError } = await supabase
      .from('device_commands')
      .insert(command)
      .select();
      
    if (commandError) {
      console.error('Error creating emergency stop command:', commandError);
      return res.status(500).json({ error: 'Failed to create emergency stop: ' + commandError.message });
    }
    
    console.log(`🚨 EMERGENCY STOP command sent for ${targetDeviceId}`);
    
    // Broadcast to frontend immediately
    const event = {
      id: commandId,
      event_type: 'emergency_stop',
      device_id: targetDeviceId,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'emergency_stop_sent', data: event });
    
    res.json({ success: true, command: commandData[0], emergency: true });
    
  } catch (err) {
    console.error('Emergency stop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Emergency reset endpoint - clear emergency stop state
app.post('/api/motor/emergency-reset', async (req, res) => {
  const { device_id } = req.body;
  const targetDeviceId = device_id || 'SUMP_TANK'; // Default to sump ESP32
  
  try {
    // Create emergency reset command
    const commandId = `rst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = {
      id: commandId,
      device_id: targetDeviceId,
      type: 'emergency_reset',
      payload: {
        action: 'reset',
        emergency_reset: true,
        priority: 'high',
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      retry_count: 0,
      ttl: new Date(Date.now() + 3600000).toISOString(), // 1 hour TTL
      acknowledged: false
    };
    
    // Store reset command in device_commands table
    const { data: commandData, error: commandError } = await supabase
      .from('device_commands')
      .insert(command)
      .select();
      
    if (commandError) {
      console.error('Error creating emergency reset command:', commandError);
      return res.status(500).json({ error: 'Failed to create emergency reset: ' + commandError.message });
    }
    
    console.log(`🔄 EMERGENCY RESET command sent for ${targetDeviceId}`);
    
    // Broadcast to frontend immediately
    const event = {
      id: commandId,
      event_type: 'emergency_reset',
      device_id: targetDeviceId,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'emergency_reset_sent', data: event });
    
    res.json({ success: true, command: commandData[0], emergency_reset: true });
    
  } catch (err) {
    console.error('Emergency reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get motor events
app.get('/api/motor/events', cacheResponse(10000), async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('motor_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[motor-events] Database error:', error);
      return res.status(500).json({ error: error.message });
    } else {
      res.json(events);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Motor settings API
app.get('/api/motor/settings', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('motor_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Motor settings fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Return default settings if none exist
    const defaultSettings = {
      auto_start_level: 20,
      auto_stop_level: 80,
      max_runtime_minutes: 60,
      min_off_time_minutes: 15
    };

    res.json({ 
      success: true, 
      settings: settings && settings.length > 0 ? settings[0] : defaultSettings 
    });
  } catch (err) {
    console.error('Motor settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/motor/settings', async (req, res) => {
  const { auto_start_level, auto_stop_level, max_runtime_minutes, min_off_time_minutes } = req.body;
  
  try {
    const settingsData = {
      auto_start_level: parseInt(auto_start_level) || 20,
      auto_stop_level: parseInt(auto_stop_level) || 80,
      max_runtime_minutes: parseInt(max_runtime_minutes) || 60,
      min_off_time_minutes: parseInt(min_off_time_minutes) || 15,
      updated_at: new Date().toISOString()
    };
    
    // Upsert settings (insert or update)
    const { data, error } = await supabase
      .from('motor_settings')
      .upsert(settingsData, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('Motor settings save error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('🔧 Motor settings updated:', settingsData);
    
    // Broadcast settings update to connected clients
    broadcast({ 
      type: 'motor_settings_updated', 
      data: settingsData 
    });
    
    res.json({ success: true, settings: data[0] });
    
  } catch (err) {
    console.error('Motor settings save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get system alerts
app.get('/api/alerts', cacheResponse(5000), async (req, res) => {
  try {
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[alerts] Database error:', error);
      return res.status(500).json({ error: error.message });
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

// Track recent ESP32 activity via HTTP requests
const esp32Activity = new Map();

// Helper function to track ESP32 activity
const trackEsp32Activity = (deviceId) => {
  console.log(`🔍 Tracking activity for device: "${deviceId}"`);
  esp32Activity.set(deviceId, Date.now());
  console.log(`🔍 Current tracked devices: [${Array.from(esp32Activity.keys()).join(', ')}]`);
};

// Get latest system status
app.get('/api/system/status', async (req, res) => {
  try {
    // Check for ESP32 status using multiple approaches
    let esp32_top_status = 'offline';
    let esp32_sump_status = 'offline';

    // First, check recent HTTP activity (within last 5 minutes)
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const topTankActivity = esp32Activity.get('TOP_TANK');
    const sumpTankActivity = esp32Activity.get('SUMP_TANK');
    
    if (topTankActivity && topTankActivity > fiveMinutesAgo) {
      esp32_top_status = 'online';
    }
    if (sumpTankActivity && sumpTankActivity > fiveMinutesAgo) {
      esp32_sump_status = 'online';
    }

    // Fallback: Try database query for device status
    if (esp32_top_status === 'offline' || esp32_sump_status === 'offline') {
      try {
        const { data: devices, error } = await supabase
          .from('esp32_devices')
          .select('id, device_type, status, last_seen')
          .order('last_seen', { ascending: false });

        if (!error && devices) {
          const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
          
          const topTankDevice = devices.find(d => d.device_type === 'top_tank');
          const sumpTankDevice = devices.find(d => d.device_type === 'sump_tank');
          
          if (esp32_top_status === 'offline' && topTankDevice && new Date(topTankDevice.last_seen) > tenMinutesAgo) {
            esp32_top_status = 'online';
          }
          if (esp32_sump_status === 'offline' && sumpTankDevice && new Date(sumpTankDevice.last_seen) > tenMinutesAgo) {
            esp32_sump_status = 'online';
          }
        }
      } catch (dbError) {
        console.log('Database query failed for device status check');
      }
    }

    // Final fallback: Check active WebSocket connections
    if (esp32_top_status === 'offline' || esp32_sump_status === 'offline') {
      const topTankOnline = Array.from(esp32Connections.values()).some(conn => 
        conn.deviceInfo?.device_type === 'top_tank' && conn.ws && conn.ws.readyState === 1);
      const sumpTankOnline = Array.from(esp32Connections.values()).some(conn => 
        conn.deviceInfo?.device_type === 'sump_tank' && conn.ws && conn.ws.readyState === 1);
      
      if (esp32_top_status === 'offline' && topTankOnline) esp32_top_status = 'online';
      if (esp32_sump_status === 'offline' && sumpTankOnline) esp32_sump_status = 'online';
    }

    console.log(`📊 System Status Check - TOP_TANK: ${esp32_top_status}, SUMP_TANK: ${esp32_sump_status}`);
    console.log(`📊 Recent activity - TOP_TANK: ${topTankActivity ? new Date(topTankActivity).toLocaleTimeString() : 'none'}, SUMP_TANK: ${sumpTankActivity ? new Date(sumpTankActivity).toLocaleTimeString() : 'none'}`);
    console.log(`📊 Active WebSocket connections: ${esp32Connections.size}`);
    
    // Return current system status
    const systemStatus = {
      id: 1,
      wifi_connected: esp32_top_status === 'online' || esp32_sump_status === 'online',
      battery_level: 85,
      temperature: 25,
      esp32_top_status,
      esp32_sump_status,
      timestamp: new Date().toISOString()
    };

    res.json(systemStatus);
  } catch (err) {
    console.error('Error getting system status:', err);
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

// (Duplicate ESP32 route block removed above; using authenticated versions)

// --- Server Startup (Unified WS Option) ---
const desiredWSPort = process.env.WS_PORT || process.env.PORT || 8083;
const unifiedMode = !process.env.WS_PORT || String(desiredWSPort) === String(PORT);
let wssInstance = null;
let wsServer = null; // Declare globally for dedicated mode

const startServer = () => {
  const httpServer = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} ${unifiedMode ? '(unified WS)' : ''}`);
    console.log('Enhanced ESP32 endpoints available at /api/esp32/');
    if (unifiedMode) {
      const WebSocketLib = require('ws');
      wssInstance = new WebSocketLib.Server({ server: httpServer });
      bindWebSocketHandlers(wssInstance);
      console.log(`[ws] WebSocket attached to HTTP server on :${PORT}`);
    } else {
      console.log(`[ws] Dedicated WebSocket server expected on :${desiredWSPort}`);
    }
  }).on('error', (err) => {
    console.error('[server] Failed to start server:', err.message);
    process.exit(1);
  });
};

// Extract existing handler binding logic if not already modular
function bindWebSocketHandlers(server) {
  // If handlers already attached (idempotent guard)
  if (server.__handlers_bound) return;
  server.__handlers_bound = true;
  server.on('connection', (ws, req) => {
    handleWebSocketConnection(ws, req);
  });
}

// If earlier code already created a wss (dedicated mode), leave it; otherwise start unified.
startServer();

// Start dedicated WebSocket server if WS_PORT is specified and different from HTTP port
if (!unifiedMode && desiredWSPort !== PORT) {
  const WebSocketLib = require('ws');
  wsServer = new WebSocketLib.Server({ port: desiredWSPort });
  bindWebSocketHandlers(wsServer);
  console.log(`[ws] Dedicated WebSocket server started on :${desiredWSPort}`);
}
