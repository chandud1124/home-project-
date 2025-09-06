import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, accept-encoding, accept-language, cache-control, connection, host, pragma, referer, sec-fetch-dest, sec-fetch-mode, sec-fetch-site, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const pathname = url.pathname
    console.log(`Full URL: ${req.url}`)
    console.log(`Pathname: ${pathname}`)
    
    // Extract path after /functions/v1/api
    const apiPrefix = '/functions/v1/api'
    let path = '/'
    if (pathname.startsWith(apiPrefix)) {
      const remaining = pathname.substring(apiPrefix.length)
      path = remaining || '/'
    }
    
    console.log(`Extracted path: ${path}`)
    console.log(`Request: ${req.method} ${path}`)

    // Route handling
    if (path.includes('/sensor-data')) {
      return await handleSensorData(supabaseClient, req)
    } else if (path.includes('/motor-status')) {
      return await handleMotorStatus(supabaseClient, req)
    } else if (path.includes('/heartbeat')) {
      return await handleHeartbeat(supabaseClient, req)
    } else if (path.includes('/system-alert')) {
      return await handleSystemAlert(supabaseClient, req)
    } else if (pathname.includes('/tanks')) {
      return await handleTanks(supabaseClient, req)
    } else if (pathname.includes('/motor-events')) {
      return await handleMotorEvents(supabaseClient, req)
    } else if (pathname.includes('/consumption/daily')) {
      return await handleConsumption(supabaseClient, req, 'daily')
    } else if (pathname.includes('/consumption/monthly')) {
      return await handleConsumption(supabaseClient, req, 'monthly')
    } else if (pathname.includes('/alerts')) {
      return await handleAlerts(supabaseClient, req)
    } else if (pathname.includes('/system-status')) {
      return await handleSystemStatus(supabaseClient, req)
    } else {
      return new Response(JSON.stringify({ message: 'API is working', endpoints: ['/sensor-data', '/motor-status', '/heartbeat', '/system-alert', '/tanks', '/motor-events', '/alerts', '/system-status', '/consumption/daily', '/consumption/monthly'], pathname: pathname }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Handle tank data
async function handleTanks(supabaseClient, req) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseClient
      .from('tank_readings')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) throw error

    // Group by tank type and get latest reading
    const tanks = {}
    data.forEach(reading => {
      if (!tanks[reading.tank_type]) {
        tanks[reading.tank_type] = reading
      }
    })

    return new Response(JSON.stringify(Object.values(tanks)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle motor events
async function handleMotorEvents(supabaseClient, req) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseClient
      .from('motor_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('motor_events')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify(data[0]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle consumption data
async function handleConsumption(supabaseClient, req, period) {
  if (req.method === 'GET') {
    let query = supabaseClient
      .from('tank_readings')
      .select('timestamp, level_liters, tank_type')

    if (period === 'daily') {
      // Get last 24 hours
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      query = query.gte('timestamp', yesterday.toISOString())
    } else if (period === 'monthly') {
      // Get last 30 days
      const lastMonth = new Date()
      lastMonth.setDate(lastMonth.getDate() - 30)
      query = query.gte('timestamp', lastMonth.toISOString())
    }

    const { data, error } = await query
      .order('timestamp', { ascending: true })

    if (error) throw error

    // Process data for consumption calculation
    const consumptionData: Array<{date: string, consumption: number, timestamp: string}> = []
    const dailyMap = new Map()

    data.forEach(reading => {
      const date = new Date(reading.timestamp).toDateString()
      if (!dailyMap.has(date)) {
        dailyMap.set(date, [])
      }
      dailyMap.get(date).push(reading)
    })

    dailyMap.forEach((readings, date) => {
      if (readings.length > 1) {
        const first = readings[0]
        const last = readings[readings.length - 1]
        const consumption = Math.max(0, first.level_liters - last.level_liters)
        consumptionData.push({
          date,
          consumption,
          timestamp: last.timestamp
        })
      }
    })

    return new Response(JSON.stringify(consumptionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle alerts
async function handleAlerts(supabaseClient, req) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseClient
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('alerts')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify(data[0]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle system status
async function handleSystemStatus(supabaseClient, req) {
  if (req.method === 'GET') {
    // Get latest system status
    const { data, error } = await supabaseClient
      .from('system_status')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)

    if (error) throw error

    const status = data[0] || {
      wifi_connected: true,
      temperature: 25,
      uptime: '0d 0h 0m',
      esp32_top_status: 'offline',
      esp32_sump_status: 'offline',
      battery_level: 100
    }

    return new Response(JSON.stringify(status), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('system_status')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify(data[0]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle ESP32 sensor data
async function handleSensorData(supabaseClient, req) {
  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('tank_readings')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle ESP32 motor status
async function handleMotorStatus(supabaseClient, req) {
  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('motor_events')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle ESP32 heartbeat
async function handleHeartbeat(supabaseClient, req) {
  if (req.method === 'POST') {
    const body = await req.json()
    // Update device last seen
    const { error } = await supabaseClient
      .from('esp32_devices')
      .update({ last_seen: new Date().toISOString(), status: 'online' })
      .eq('id', body.esp32_id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Handle ESP32 system alert
async function handleSystemAlert(supabaseClient, req) {
  if (req.method === 'POST') {
    const body = await req.json()
    const { data, error } = await supabaseClient
      .from('alerts')
      .insert([body])
      .select()

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
