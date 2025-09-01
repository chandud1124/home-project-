import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/api', '')

    console.log(`Request: ${req.method} ${path}`)

    // Route handling
    switch (path) {
      case '/tanks':
        return await handleTanks(supabaseClient, req)
      case '/motor-events':
        return await handleMotorEvents(supabaseClient, req)
      case '/consumption/daily':
        return await handleConsumption(supabaseClient, req, 'daily')
      case '/consumption/monthly':
        return await handleConsumption(supabaseClient, req, 'monthly')
      case '/alerts':
        return await handleAlerts(supabaseClient, req)
      case '/system-status':
        return await handleSystemStatus(supabaseClient, req)
      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
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
    const consumptionData = []
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
