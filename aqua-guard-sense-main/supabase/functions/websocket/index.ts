// If using Deno, ensure you run with --unstable and internet access, or install types with:
// deno cache https://deno.land/std@0.168.0/http/server.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Store active WebSocket connections
const connections = new Map()

serve(async (req) => {
  console.log('Request received:', req.method, req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check for WebSocket upgrade - try multiple ways
  const upgrade = req.headers.get('upgrade')
  const connection = req.headers.get('connection')
  const secWebSocketKey = req.headers.get('sec-websocket-key')

  console.log('Upgrade header:', upgrade)
  console.log('Connection header:', connection)
  console.log('Sec-WebSocket-Key header:', secWebSocketKey ? 'present' : 'missing')

  // Check if this is a WebSocket upgrade request
  const isWebSocketUpgrade = (upgrade && upgrade.toLowerCase() === 'websocket') ||
                            (connection && connection.toLowerCase().includes('upgrade')) ||
                            secWebSocketKey

  if (isWebSocketUpgrade) {
    console.log('WebSocket upgrade detected')
    try {
      const { socket, response } = Deno.upgradeWebSocket(req)
      console.log('WebSocket upgraded successfully')

      // Handle WebSocket connection
      socket.onopen = () => {
        console.log('WebSocket connection opened')
      }

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Received WebSocket message:', data.type)

          // Initialize Supabase client with service role key for WebSocket operations
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

          switch (data.type) {
            case 'ping':
              // Respond to ping with pong
              socket.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now(), server_time: new Date().toISOString() } }))
              break
            case 'esp32_register':
              await handleESP32Registration(supabaseClient, socket, data)
              break
            case 'sensor_data':
              await handleSensorData(supabaseClient, socket, data)
              break
            case 'motor_status':
              await handleMotorStatus(supabaseClient, socket, data)
              break
            case 'motor_control':
              await handleMotorControl(supabaseClient, socket, data)
              break
            case 'auto_mode_control':
              await handleAutoModeControl(supabaseClient, socket, data)
              break
            case 'reset_manual':
              await handleResetManual(supabaseClient, socket, data)
              break
            default:
              console.log('Unknown message type:', data.type)
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error)
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString()
          }))
        }
      }

      socket.onclose = () => {
        console.log('WebSocket connection closed')
        // Remove from connections map
        for (const [id, conn] of connections.entries()) {
          if (conn.socket === socket) {
            connections.delete(id)
            break
          }
        }
      }

      socket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      return response
    } catch (error) {
      console.error('WebSocket upgrade failed:', error)
      return new Response(JSON.stringify({ error: 'WebSocket upgrade failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  console.log('Not a WebSocket request, returning error')
  return new Response(JSON.stringify({ error: 'WebSocket upgrade required' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})

async function handleESP32Registration(supabaseClient, socket, data) {
  const deviceInfo = {
    id: data.esp32_id,
    device_type: data.device_type || 'unknown',
    firmware_version: data.firmware_version || 'Unknown',
    status: 'online',
    last_seen: new Date().toISOString()
  }

  // Store device info in database
  const { error } = await supabaseClient
    .from('esp32_devices')
    .upsert(deviceInfo, { onConflict: 'id' })

  if (error) {
    console.error('Error storing device info:', error)
    return
  }

  // Store connection
  connections.set(data.esp32_id, {
    socket,
    deviceInfo,
    connectedAt: new Date()
  })

  console.log(`ESP32 ${data.esp32_id} registered`)

  // Send registration acknowledgment
  socket.send(JSON.stringify({
    type: 'registration_ack',
    esp32_id: data.esp32_id,
    timestamp: new Date().toISOString()
  }))

  // Broadcast system status update
  broadcastSystemStatus(supabaseClient)
}

async function handleSensorData(supabaseClient, socket, data) {
  const payload = data.payload

  const sensorData = {
    tank_type: payload.tank_type,
    level_percentage: payload.level_percentage,
    level_liters: payload.level_liters,
    sensor_health: payload.sensor_health || 'good',
    esp32_id: payload.esp32_id,
    battery_voltage: payload.battery_voltage,
    signal_strength: payload.signal_strength,
    float_switch: payload.float_switch,
    motor_running: payload.motor_running,
    manual_override: payload.manual_override,
    auto_mode_enabled: payload.auto_mode_enabled,
    timestamp: new Date().toISOString()
  }

  // Store sensor data
  const { data: result, error } = await supabaseClient
    .from('tank_readings')
    .insert(sensorData)
    .select()

  if (error) {
    console.error('Error storing sensor data:', error)
    return
  }

  console.log(`Sensor data stored for ${payload.tank_type}: ${payload.level_percentage}%`)

  // Broadcast to all connected clients
  broadcastToAll({
    type: 'sensor_data',
    data: result[0]
  })

  // Send motor command if needed
  const motorCommand = getMotorCommand(payload.level_percentage, payload.tank_type)
  if (motorCommand.command !== 'maintain') {
    socket.send(JSON.stringify({
      type: 'motor_command',
      command: motorCommand
    }))
  }
}

async function handleMotorStatus(supabaseClient, socket, data) {
  const payload = data.payload

  const motorData = {
    event_type: payload.motor_running ? 'status_running' : 'status_stopped',
    power_detected: payload.power_detected,
    current_draw: payload.current_draw,
    runtime_seconds: payload.runtime_seconds,
    timestamp: new Date().toISOString()
  }

  // Store motor status
  const { error } = await supabaseClient
    .from('motor_events')
    .insert(motorData)

  if (error) {
    console.error('Error storing motor status:', error)
    return
  }

  // Broadcast motor status
  broadcastToAll({
    type: 'motor_status',
    data: {
      isRunning: payload.motor_running,
      powerDetected: payload.power_detected,
      currentDraw: payload.current_draw,
      runtime: payload.runtime_seconds,
      timestamp: new Date().toISOString()
    }
  })
}

async function handleMotorControl(supabaseClient, socket, data) {
  const motorState = data.state
  const esp32Id = data.esp32_id

  // Find the target ESP32 connection
  const connection = connections.get(esp32Id)
  if (!connection) {
    socket.send(JSON.stringify({
      type: 'motor_control_error',
      error: 'esp32_not_connected',
      message: 'Target ESP32 device is not connected'
    }))
    return
  }

  // Forward motor control command to ESP32
  connection.socket.send(JSON.stringify({
    type: 'motor_control',
    state: motorState,
    timestamp: new Date().toISOString()
  }))

  console.log(`Motor control forwarded to ESP32 ${esp32Id}: ${motorState ? 'START' : 'STOP'}`)
}

async function handleAutoModeControl(supabaseClient, socket, data) {
  const enabled = data.enabled
  const esp32Id = data.esp32_id

  // Find the target ESP32 connection
  const connection = connections.get(esp32Id)
  if (!connection) {
    socket.send(JSON.stringify({
      type: 'auto_mode_error',
      error: 'esp32_not_connected',
      message: 'Target ESP32 device is not connected'
    }))
    return
  }

  // Forward auto mode control command to ESP32
  connection.socket.send(JSON.stringify({
    type: 'auto_mode_control',
    enabled: enabled,
    timestamp: new Date().toISOString()
  }))

  console.log(`Auto mode control forwarded to ESP32 ${esp32Id}: ${enabled ? 'ENABLED' : 'DISABLED'}`)
}

async function handleResetManual(supabaseClient, socket, data) {
  const esp32Id = data.esp32_id

  // Find the target ESP32 connection
  const connection = connections.get(esp32Id)
  if (!connection) {
    socket.send(JSON.stringify({
      type: 'reset_manual_error',
      error: 'esp32_not_connected',
      message: 'Target ESP32 device is not connected'
    }))
    return
  }

  // Forward reset manual command to ESP32
  connection.socket.send(JSON.stringify({
    type: 'reset_manual',
    timestamp: new Date().toISOString()
  }))

  console.log(`Manual override reset forwarded to ESP32 ${esp32Id}`)
}

function getMotorCommand(topTankLevel, sumpLevel) {
  // Auto mode logic
  if (topTankLevel < 20 && sumpLevel > 30) {
    return { command: 'start', reason: 'auto_fill_low_tank' }
  }
  if (topTankLevel > 90 || sumpLevel < 20) {
    return { command: 'stop', reason: 'safety_cutoff' }
  }
  return { command: 'maintain', reason: 'normal_operation' }
}

async function broadcastSystemStatus(supabaseClient) {
  // Get current system status
  const { data: devices } = await supabaseClient
    .from('esp32_devices')
    .select('device_type, status')
    .eq('status', 'online')

  const topOnline = devices.some(d => d.device_type === 'top_tank')
  const sumpOnline = devices.some(d => d.device_type === 'sump')

  const systemStatus = {
    type: 'system_status',
    data: {
      wifi_connected: true,
      battery_level: 85,
      temperature: 25,
      esp32_top_status: topOnline ? 'online' : 'offline',
      esp32_sump_status: sumpOnline ? 'online' : 'offline',
      wifi_strength: -50,
      timestamp: new Date().toISOString()
    }
  }

  broadcastToAll(systemStatus)
}

function broadcastToAll(message) {
  for (const connection of connections.values()) {
    try {
      connection.socket.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error broadcasting to connection:', error)
    }
  }
}
