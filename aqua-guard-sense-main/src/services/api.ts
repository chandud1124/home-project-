
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

// WebSocket connection for real-time updates
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'wss://your-project.supabase.co/functions/v1/websocket'
let wsConnection: WebSocket | null = null
const wsCallbacks: Map<string, (data: any) => void> = new Map()

export interface TankReading {
  id: number;
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  timestamp: string;
}

export interface MotorEvent {
  id: number;
  event_type: string;
  duration?: number;
  timestamp: string;
}

export interface SystemAlert {
  id: number;
  type: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

export interface SystemStatus {
  id: number;
  wifi_connected: boolean;
  battery_level: number;
  temperature: number;
  esp32_top_status: string;
  esp32_sump_status: string;
  timestamp: string;
}

export interface ConsumptionData {
  date: string;
  consumption: number;
  fills: number;
  motorStarts: number;
}

class ApiService {
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    this.initializeWebSocket()
  }

  private initializeWebSocket() {
    try {
      wsConnection = new WebSocket(WS_URL)

      wsConnection.onopen = () => {
        console.log('WebSocket connected to Supabase')
      }

      wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('WebSocket message received:', message.type)

          // Call registered callbacks
          const callback = wsCallbacks.get(message.type)
          if (callback) {
            callback(message.data)
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error)
        }
      }

      wsConnection.onclose = () => {
        console.log('WebSocket disconnected')
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000)
      }

      wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
    }
  }

  // Register callback for WebSocket messages
  onWebSocketMessage(type: string, callback: (data: any) => void) {
    wsCallbacks.set(type, callback)
  }

  // Send WebSocket message
  private sendWebSocketMessage(message: any) {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, message not sent:', message)
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const cacheKey = `${options?.method || 'GET'}_${endpoint}`;

    // If we already have a request in progress for this endpoint, return it
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey)!;
    }
    
    const requestPromise = this.makeRequest<T>(endpoint, options);
    
    // Cache the request promise
    this.requestQueue.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from cache after request completes
      this.requestQueue.delete(cacheKey);
    }
  }
  
  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Use Supabase functions instead of direct API calls
    const functionName = endpoint.replace('/', '')
    const { data, error } = await supabase.functions.invoke(`api/${functionName}`, {
      method: options?.method || 'GET',
      body: options?.body,
      headers: options?.headers
    })

    if (error) {
      throw new Error(`Supabase function error: ${error.message}`)
    }

    return data as T
  }

  // Tank data methods
  async getTanks(): Promise<TankReading[]> {
    try {
      const { data, error } = await supabase
        .from('tank_readings')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)

      if (error) throw error

      // Group by tank type and get latest reading
      const tanks: { [key: string]: TankReading } = {}
      data.forEach((reading: any) => {
        if (!tanks[reading.tank_type]) {
          tanks[reading.tank_type] = reading
        }
      })

      return Object.values(tanks)
    } catch (error) {
      console.error('Error fetching tanks:', error)
      return []
    }
  }

  async addTankReading(reading: Omit<TankReading, 'id' | 'timestamp'>): Promise<TankReading> {
    try {
      const { data, error } = await supabase
        .from('tank_readings')
        .insert([reading])
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Error adding tank reading:', error)
      throw error
    }
  }

  // Motor methods
  async controlMotor(action: 'start' | 'stop'): Promise<{ success: boolean; event: MotorEvent }> {
    try {
      const { data, error } = await supabase
        .from('motor_events')
        .insert([{
          event_type: action === 'start' ? 'motor_started' : 'motor_stopped',
          timestamp: new Date().toISOString()
        }])
        .select()

      if (error) throw error

      return {
        success: true,
        event: data[0]
      }
    } catch (error) {
      console.error('Error controlling motor:', error)
      throw error
    }
  }

  async getMotorEvents(): Promise<MotorEvent[]> {
    try {
      const { data, error } = await supabase
        .from('motor_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching motor events:', error)
      return []
    }
  }

  // Alert methods
  async getAlerts(): Promise<SystemAlert[]> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching alerts:', error)
      return []
    }
  }

  async addAlert(alert: Omit<SystemAlert, 'id' | 'resolved' | 'timestamp'>): Promise<SystemAlert> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert([{
          ...alert,
          resolved: false,
          timestamp: new Date().toISOString()
        }])
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Error adding alert:', error)
      throw error
    }
  }

  // System status methods
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const { data, error } = await supabase
        .from('system_status')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)

      if (error) throw error

      return data[0] || {
        id: 0,
        wifi_connected: true,
        battery_level: 100,
        temperature: 25,
        esp32_top_status: 'offline',
        esp32_sump_status: 'offline',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching system status:', error)
      return {
        id: 0,
        wifi_connected: true,
        battery_level: 100,
        temperature: 25,
        esp32_top_status: 'offline',
        esp32_sump_status: 'offline',
        timestamp: new Date().toISOString()
      }
    }
  }

  async updateSystemStatus(status: Omit<SystemStatus, 'id' | 'timestamp'>): Promise<SystemStatus> {
    try {
      const { data, error } = await supabase
        .from('system_status')
        .insert([{
          ...status,
          timestamp: new Date().toISOString()
        }])
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Error updating system status:', error)
      throw error
    }
  }

  // Consumption data
  async getConsumptionData(period: 'daily' | 'monthly' = 'daily'): Promise<ConsumptionData[]> {
    try {
      let query = supabase
        .from('tank_readings')
        .select('timestamp, level_liters, tank_type')

      if (period === 'daily') {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gte('timestamp', yesterday.toISOString())
      } else {
        const lastMonth = new Date()
        lastMonth.setDate(lastMonth.getDate() - 30)
        query = query.gte('timestamp', lastMonth.toISOString())
      }

      const { data, error } = await query
        .order('timestamp', { ascending: true })

      if (error) throw error

      // Process data for consumption calculation
      const consumptionData: ConsumptionData[] = []
      const dailyMap = new Map<string, any[]>()

      data.forEach((reading: any) => {
        const date = new Date(reading.timestamp).toDateString()
        if (!dailyMap.has(date)) {
          dailyMap.set(date, [])
        }
        dailyMap.get(date)!.push(reading)
      })

      dailyMap.forEach((readings, date) => {
        if (readings.length > 1) {
          const first = readings[0]
          const last = readings[readings.length - 1]
          const consumption = Math.max(0, first.level_liters - last.level_liters)
          consumptionData.push({
            date,
            consumption,
            fills: 0, // You can calculate this based on motor events
            motorStarts: 0 // You can calculate this based on motor events
          })
        }
      })

      return consumptionData
    } catch (error) {
      console.error('Error fetching consumption data:', error)
      return []
    }
  }

  // WebSocket methods for ESP32 communication
  sendESP32Command(esp32Id: string, command: string, data?: any) {
    this.sendWebSocketMessage({
      type: command,
      esp32_id: esp32Id,
      ...data
    })
  }

  registerESP32(esp32Id: string, deviceType: string) {
    this.sendWebSocketMessage({
      type: 'esp32_register',
      esp32_id: esp32Id,
      device_type: deviceType,
      firmware_version: '1.0.0'
    })
  }

  sendSensorData(sensorData: any) {
    this.sendWebSocketMessage({
      type: 'sensor_data',
      payload: sensorData
    })
  }

  sendMotorStatus(motorData: any) {
    this.sendWebSocketMessage({
      type: 'motor_status',
      payload: motorData
    })
  }
}

export const apiService = new ApiService();
