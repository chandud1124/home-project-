// If using Deno, ensure you run with --unstable and internet access, or install types with:
// deno cache https://deno.land/std@0.168.0/http/server.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Content-Type': 'text/event-stream',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Store active SSE connections
const connections = new Map()

// Removed in-memory command queues; now using Supabase table 'device_commands'
let commandCounter = 0

async function enqueueCommand(deviceId: string, type: string, payload: any) {
  const cmd = {
    id: `${Date.now()}-${commandCounter++}`,
    device_id: deviceId,
    type,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    ttl: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
    acknowledged: false
  }
  const { error } = await supabase.from('device_commands').insert(cmd)
  if (error) {
    console.error('Error enqueuing command:', error)
    throw error
  }
  return cmd
}

async function pollCommands(deviceId: string, max = 10) {
  const { data, error } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', deviceId)
    .eq('acknowledged', false)
    .gt('ttl', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(max)
  if (error) {
    console.error('Error polling commands:', error)
    return []
  }
  return data || []
}

async function acknowledgeCommand(deviceId: string, commandId: string) {
  const { error } = await supabase
    .from('device_commands')
    .update({ acknowledged: true })
    .eq('device_id', deviceId)
    .eq('id', commandId)
  if (error) {
    console.error('Error acknowledging command:', error)
    return false
  }
  return true
}

serve(async (req) => {
  console.log('Request received:', req.method, req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check for Server-Sent Events request
  const accept = req.headers.get('accept')
  if (accept && accept.includes('text/event-stream')) {
    console.log('SSE connection requested')
    
    // Create SSE response
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const data = JSON.stringify({
          type: 'connected',
          message: 'SSE connection established',
          timestamp: new Date().toISOString()
        })
        controller.enqueue(`data: ${data}\n\n`)
        
        // Store the controller for later use
        const connectionId = Date.now().toString()
        connections.set(connectionId, controller)
        
        // Send a ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          try {
            const pingData = JSON.stringify({
              type: 'ping',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(`data: ${pingData}\n\n`)
          } catch (error) {
            console.error('Error sending ping:', error)
            clearInterval(pingInterval)
            connections.delete(connectionId)
          }
        }, 30000)
        
        // Clean up on connection close
        req.signal.addEventListener('abort', () => {
          clearInterval(pingInterval)
          connections.delete(connectionId)
          controller.close()
        })
      },
      cancel() {
        console.log('SSE connection cancelled')
      }
    })
    
    return new Response(stream, {
      headers: corsHeaders
    })
  }
  
  // Metrics endpoint (GET with query param: metrics=1)
  if (req.method === 'GET' && url.searchParams.get('metrics') === '1') {
    try {
      // Get command queue metrics
      const { data: commands, error: cmdError } = await supabase
        .from('device_commands')
        .select('device_id, created_at, acknowledged')
        .gt('ttl', new Date().toISOString())
      
      if (cmdError) throw cmdError
      
      const queueDepth = commands?.length || 0
      const pendingCommands = commands?.filter(c => !c.acknowledged).length || 0
      
      // Calculate enqueue rate (commands per hour in last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const recentCommands = commands?.filter(c => c.created_at > oneDayAgo).length || 0
      const enqueueRate = recentCommands / 24 // per hour
      
      // Get heartbeat data for device connectivity
      const { data: heartbeats, error: hbError } = await supabase
        .from('device_heartbeats')
        .select('device_id, timestamp, heartbeat_type')
        .gt('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('timestamp', { ascending: false })
      
      if (hbError) console.error('Error fetching heartbeats:', hbError)
      
      // Calculate device connectivity status
      const deviceConnectivity = {}
      const heartbeatGroups = heartbeats?.reduce((acc, hb) => {
        if (!acc[hb.device_id]) acc[hb.device_id] = []
        acc[hb.device_id].push(hb)
        return acc
      }, {} as Record<string, typeof heartbeats>)
      
      for (const [deviceId, hbList] of Object.entries(heartbeatGroups || {})) {
        const latestHeartbeat = hbList[0]
        const timeSinceLastHeartbeat = Date.now() - new Date(latestHeartbeat.timestamp).getTime()
        const isOnline = timeSinceLastHeartbeat < 2 * 60 * 1000 // 2 minutes threshold
        
        deviceConnectivity[deviceId] = {
          status: isOnline ? 'online' : 'offline',
          last_heartbeat: latestHeartbeat.timestamp,
          time_since_heartbeat_ms: timeSinceLastHeartbeat,
          heartbeat_type: latestHeartbeat.heartbeat_type
        }
      }
      
      // Device latency (simplified - time since last command)
      const deviceLatencies = {}
      const deviceGroups = commands?.reduce((acc, cmd) => {
        if (!acc[cmd.device_id]) acc[cmd.device_id] = []
        acc[cmd.device_id].push(cmd)
        return acc
      }, {} as Record<string, typeof commands>)
      
      for (const [deviceId, cmds] of Object.entries(deviceGroups || {})) {
        const latest = cmds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        deviceLatencies[deviceId] = Date.now() - new Date(latest.created_at).getTime()
      }
      
      return new Response(JSON.stringify({
        queue_depth: queueDepth,
        pending_commands: pendingCommands,
        enqueue_rate_per_hour: enqueueRate,
        device_latencies_ms: deviceLatencies,
        device_connectivity: deviceConnectivity,
        timestamp: new Date().toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
      console.error('Error fetching metrics:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }
  
  // Command polling endpoint (GET with query param: device_id)
  if (req.method === 'GET' && url.searchParams.get('poll') === '1') {
    const deviceId = url.searchParams.get('device_id')
    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'device_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    try {
      const cmds = await pollCommands(deviceId)
      return new Response(JSON.stringify({ commands: cmds, count: cmds.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
      console.error('Error polling commands:', error)
      return new Response(JSON.stringify({ error: 'Failed to poll commands' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // Handle regular HTTP POST requests (broadcast / enqueue / acknowledge)
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      console.log('Received message:', body.type)
      
      // Check authentication - support both global and per-device auth
      const messageApiKey = body.apikey || body.api_key
      const deviceId = body.device_id || body.deviceId
      const hmacSignature = body.hmac_signature || body.signature
      const timestamp = body.timestamp

      let isAuthenticated = false
      let authenticatedDeviceId = null

      // Try global API key authentication (for backward compatibility)
      const expectedGlobalApiKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (messageApiKey && messageApiKey === expectedGlobalApiKey) {
        isAuthenticated = true
      }

      // Try per-device authentication with HMAC
      if (!isAuthenticated && deviceId && hmacSignature && timestamp) {
        try {
          // Verify device exists and is active
          const { data: device, error: deviceError } = await supabase
            .from('devices')
            .select('api_key, hmac_secret, is_active')
            .eq('device_id', deviceId)
            .eq('is_active', true)
            .single()

          if (!deviceError && device) {
            // Verify API key matches
            if (messageApiKey && messageApiKey === device.api_key) {
              // Verify HMAC signature
              const payload = JSON.stringify(body.data || body)
              const message = deviceId + payload + timestamp

              const cryptoKey = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(device.hmac_secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
              )

              const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
              const expectedSignature = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')

              if (expectedSignature === hmacSignature.toLowerCase()) {
                isAuthenticated = true
                authenticatedDeviceId = deviceId

                // Update last seen timestamp
                await supabase
                  .from('devices')
                  .update({ last_seen: new Date().toISOString() })
                  .eq('device_id', deviceId)
              }
            }
          }
        } catch (error) {
          console.error('HMAC verification error:', error)
        }
      }

      if (!isAuthenticated) {
        return new Response(JSON.stringify({
          error: 'Authentication failed'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Special command: enqueue_command -> expects target_device_id & command_type & payload
      if (body.type === 'enqueue_command') {
        const deviceId = body.target_device_id || body.device_id
        const commandType = body.command_type || body.command || 'generic'
        if (!deviceId) {
          return new Response(JSON.stringify({ error: 'target_device_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        try {
          const cmd = await enqueueCommand(deviceId, commandType, body.payload || body.data || {})
          return new Response(JSON.stringify({ success: true, enqueued: cmd }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (error) {
          console.error('Error enqueuing command:', error)
          return new Response(JSON.stringify({ error: 'Failed to enqueue command' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // Special command: acknowledge_alert -> mark alert as acknowledged
      if (body.type === 'acknowledge_alert') {
        const alertId = body.alert_id
        if (!alertId) {
          return new Response(JSON.stringify({ error: 'alert_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        try {
          const { error } = await supabase
            .from('alerts')
            .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
            .eq('id', alertId)
          if (error) throw error
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (error) {
          console.error('Error acknowledging alert:', error)
          return new Response(JSON.stringify({ error: 'Failed to acknowledge alert' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // Special command: heartbeat -> record device heartbeat
      if (body.type === 'heartbeat') {
        const deviceId = body.device_id || body.deviceId
        const heartbeatType = body.heartbeat_type || body.heartbeatType || 'pong'
        if (!deviceId) {
          return new Response(JSON.stringify({ error: 'device_id required for heartbeat' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        try {
          const { error } = await supabase
            .from('device_heartbeats')
            .insert({
              device_id: deviceId,
              heartbeat_type: heartbeatType,
              timestamp: new Date().toISOString(),
              metadata: body.metadata || {}
            })
          if (error) throw error
          
          // Also broadcast heartbeat to SSE connections for real-time monitoring
          const heartbeatData = JSON.stringify({
            type: 'device_heartbeat',
            data: {
              device_id: deviceId,
              heartbeat_type: heartbeatType,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          })
          for (const controller of connections.values()) {
            try { controller.enqueue(`data: ${heartbeatData}\n\n`) } catch (error) { console.error('Error broadcasting heartbeat:', error) }
          }
          
          return new Response(JSON.stringify({ success: true, message: 'Heartbeat recorded' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (error) {
          console.error('Error recording heartbeat:', error)
          return new Response(JSON.stringify({ error: 'Failed to record heartbeat' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // Default: broadcast message to all SSE connections
      const messageData = JSON.stringify({
        type: body.type,
        data: body.data || body,
        timestamp: new Date().toISOString()
      })
      for (const controller of connections.values()) {
        try { controller.enqueue(`data: ${messageData}\n\n`) } catch (error) { console.error('Error broadcasting message:', error) }
      }
      return new Response(JSON.stringify({ success: true, message: 'Message broadcasted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
      console.error('Error processing request:', error)
      return new Response(JSON.stringify({
        error: 'Invalid request'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
  
  return new Response(JSON.stringify({ 
    message: 'WebSocket/SSE endpoint - use POST for messages or GET with Accept: text/event-stream for SSE', 
    timestamp: new Date().toISOString() 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
