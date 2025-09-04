
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

// Local backend configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.0.108:3001'
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://192.168.0.108:8083'

// WebSocket connection for real-time updates
let wsConnection: WebSocket | null = null
const wsCallbacks: Map<string, (data: any) => void> = new Map()

export interface TankReading {
  id: string;
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  sensor_health?: string;
  esp32_id?: string;
  signal_strength?: number;
  float_switch?: boolean;
  motor_running?: boolean;
  manual_override?: boolean;
  auto_mode_enabled?: boolean;
  timestamp: string;
}

export interface MotorEvent {
  id: string;
  event_type: string;
  duration?: number;
  esp32_id?: string;
  motor_running?: boolean;
  power_detected?: boolean;
  current_draw?: number;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  type: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

export interface SystemStatus {
  id: string;
  wifi_connected: boolean;
  battery_level: number;
  temperature: number;
  esp32_top_status: string;
  esp32_sump_status: string;
  wifi_strength?: number;
  float_switch?: boolean;
  motor_running?: boolean;
  manual_override?: boolean;
  timestamp: string;
}

export interface ConsumptionData {
  date: string;
  consumption: number;
  fills: number;
  motorStarts: number;
}

export interface ESP32Device {
  id: string;
  mac_address: string;
  ip_address: string;
  device_type: string;
  firmware_version: string;
  status: string;
  is_connected: boolean;
  current_ip?: string;
  last_seen: string;
  registered_at: string;
  created_at: string;
}

class ApiService {
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    this.initializeWebSocket()
    // Register pong handler for testing WebSocket connection
    this.onWebSocketMessage('pong', (data) => {
      console.log('🔔 WebSocket pong received:', data)
    })
  }

  private initializeWebSocket() {
    try {
      console.log('🔌 Initializing WebSocket connection...')
      console.log('WebSocket URL:', WS_URL)

      // Validate WebSocket URL
      if (!WS_URL || !WS_URL.startsWith('ws')) {
        console.error('❌ Invalid WebSocket URL:', WS_URL)
        return
      }

      // Check if WebSocket is supported
      if (!window.WebSocket) {
        console.error('❌ WebSocket not supported by this browser')
        return
      }

      // Close existing connection if any
      if (wsConnection) {
        console.log('🔌 Closing existing WebSocket connection')
        wsConnection.close()
        wsConnection = null
      }

      console.log('🔌 Creating new WebSocket connection')
      wsConnection = new WebSocket(WS_URL)

      wsConnection.onopen = () => {
        console.log('WebSocket connected to local backend')
        // Send a test ping message
        this.sendWebSocketMessage({ type: 'ping', data: { timestamp: Date.now() } })
      }

      wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('📨 WebSocket message received:', message.type, message)

          // Call registered callbacks
          const callback = wsCallbacks.get(message.type)
          if (callback) {
            console.log('📨 Calling callback for:', message.type)
            callback(message.data)
          } else {
            console.log('📨 No callback registered for:', message.type)
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error)
        }
      }

      wsConnection.onclose = (event) => {
        console.log('WebSocket disconnected')
        console.log('Close code:', event.code)
        console.log('Close reason:', event.reason)
        console.log('Was clean close:', event.wasClean)

        // Common WebSocket close codes
        const closeCodeMessages: { [key: number]: string } = {
          1000: 'Normal closure',
          1001: 'Going away',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1004: 'Reserved',
          1005: 'No status received',
          1006: 'Abnormal closure',
          1007: 'Invalid frame payload data',
          1008: 'Policy violation',
          1009: 'Message too big',
          1010: 'Missing extension',
          1011: 'Internal error',
          1012: 'Service restart',
          1013: 'Try again later',
          1014: 'Bad gateway',
          1015: 'TLS handshake'
        }

        if (closeCodeMessages[event.code]) {
          console.log('Close code meaning:', closeCodeMessages[event.code])
        } else {
          console.log('Unknown close code')
        }

        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000)
      }

      wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error)
        // Log more details about the error
        console.error('WebSocket URL:', WS_URL)

        // Enhanced error logging
        if (error && typeof error === 'object') {
          console.error('Error type:', error.constructor.name)
          if ('message' in error) {
            console.error('Error message:', (error as any).message)
          }
          if ('code' in error) {
            console.error('Error code:', (error as any).code)
          }
          if ('target' in error) {
            console.error('Error target:', (error as any).target)
          }
          // Log all available properties of the error object
          console.error('Error object properties:', Object.keys(error))
          console.error('Full error object:', error)
        }

        // Check WebSocket ready state
        if (wsConnection) {
          const readyState = wsConnection.readyState
          const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
          console.error('WebSocket ready state:', readyState, `(${stateNames[readyState] || 'UNKNOWN'})`)
        }

        // Check network connectivity
        console.error('Network online:', navigator.onLine)
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
    }
  }

  // Test WebSocket connection
  testWebSocketConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const testWs = new WebSocket(WS_URL)
      const timeout = setTimeout(() => {
        testWs.close()
        console.error('WebSocket test timeout')
        resolve(false)
      }, 10000) // 10 second timeout

      testWs.onopen = () => {
        console.log('✅ WebSocket test connection successful')
        clearTimeout(timeout)
        testWs.close()
        resolve(true)
      }

      testWs.onerror = (error) => {
        console.error('❌ WebSocket test connection failed:', error)
        clearTimeout(timeout)
        resolve(false)
      }

      testWs.onclose = (event) => {
        console.log('WebSocket test connection closed:', event.code, event.reason)
        clearTimeout(timeout)
        if (!event.wasClean) {
          resolve(false)
        }
      }
    })
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
    const method = (options?.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') || 'GET'
    
    // Convert headers to the expected format
    let headers: Record<string, string> | undefined
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        headers = {}
        options.headers.forEach((value, key) => {
          headers![key] = value
        })
      } else if (Array.isArray(options.headers)) {
        headers = {}
        options.headers.forEach(([key, value]) => {
          headers![key] = value
        })
      } else {
        headers = options.headers as Record<string, string>
      }
    }
    
    const { data, error } = await supabase.functions.invoke(`api/${functionName}`, {
      method: method,
      body: options?.body,
      headers: headers
    })

    if (error) {
      throw new Error(`Supabase function error: ${error.message}`)
    }

    return data as T
  }

  // Tank data methods
  async getTanks(): Promise<TankReading[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tanks`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // Transform the data to match our interface
      return data.map((reading: any) => ({
        id: reading._id || reading.id || '1',
        tank_type: reading.tank_type,
        level_percentage: reading.level_percentage,
        level_liters: reading.level_liters,
        sensor_health: reading.sensor_health,
        esp32_id: reading.esp32_id,
        signal_strength: reading.signal_strength,
        float_switch: reading.float_switch,
        motor_running: reading.motor_running,
        manual_override: reading.manual_override,
        auto_mode_enabled: reading.auto_mode_enabled,
        timestamp: reading.timestamp
      }))
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
      // Send WebSocket message for motor control
      this.sendWebSocketMessage({
        type: 'motor_control',
        state: action === 'start'
      })

      // Also make HTTP request to backend
      const response = await fetch(`${BACKEND_URL}/api/motor/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      return {
        success: true,
        event: {
          id: data.event._id || data.event.id || '1',
          event_type: data.event.event_type,
          duration: data.event.duration,
          esp32_id: data.event.esp32_id,
          motor_running: data.event.motor_running,
          power_detected: data.event.power_detected,
          current_draw: data.event.current_draw,
          timestamp: data.event.timestamp
        }
      }
    } catch (error) {
      console.error('Error controlling motor:', error)
      throw error
    }
  }

  async getMotorEvents(): Promise<MotorEvent[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/motor/events`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // Transform the data to match our interface
      return data.map((event: any) => ({
        id: event._id || event.id || '1',
        event_type: event.event_type,
        duration: event.duration,
        esp32_id: event.esp32_id,
        motor_running: event.motor_running,
        power_detected: event.power_detected,
        current_draw: event.current_draw,
        timestamp: event.timestamp
      }))
    } catch (error) {
      console.error('Error fetching motor events:', error)
      return []
    }
  }

  // Alert methods
  async getAlerts(): Promise<SystemAlert[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // Transform the data to match our interface
      return data.map((alert: any) => ({
        id: alert._id || alert.id || '1',
        type: alert.type,
        message: alert.message,
        resolved: alert.resolved,
        timestamp: alert.timestamp
      }))
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
      const response = await fetch(`${BACKEND_URL}/api/system/status`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // Transform the data to match our interface
      return {
        id: data._id || data.id || '1',
        wifi_connected: data.wifi_connected || false,
        battery_level: data.battery_level || 0,
        temperature: data.temperature || 25,
        esp32_top_status: data.esp32_top_status || 'offline',
        esp32_sump_status: data.esp32_sump_status || 'offline',
        wifi_strength: data.wifi_strength || 0,
        float_switch: data.float_switch || false,
        motor_running: data.motor_running || false,
        manual_override: data.manual_override || false,
        timestamp: data.timestamp || new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching system status:', error)
      return {
        id: '1',
        wifi_connected: false,
        battery_level: 0,
        temperature: 25,
        esp32_top_status: 'offline',
        esp32_sump_status: 'offline',
        wifi_strength: 0,
        float_switch: false,
        motor_running: false,
        manual_override: false,
        timestamp: new Date().toISOString()
      }
    }
  }

  async updateSystemStatus(status: Omit<SystemStatus, 'id' | 'timestamp'>): Promise<SystemStatus> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/system/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(status)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return {
        id: data._id || data.id || '1',
        wifi_connected: data.wifi_connected,
        battery_level: data.battery_level,
        temperature: data.temperature,
        esp32_top_status: data.esp32_top_status,
        esp32_sump_status: data.esp32_sump_status,
        wifi_strength: data.wifi_strength,
        float_switch: data.float_switch,
        motor_running: data.motor_running,
        manual_override: data.manual_override,
        timestamp: data.timestamp
      }
    } catch (error) {
      console.error('Error updating system status:', error)
      throw error
    }
  }

  // Consumption data
  async getConsumptionData(period: 'daily' | 'monthly' = 'daily'): Promise<ConsumptionData[]> {
    try {
      // For now, use tank readings to calculate consumption
      // In a real implementation, you'd have a dedicated consumption endpoint
      const response = await fetch(`${BACKEND_URL}/api/tanks`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

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

  // ESP32 Device methods
  async getESP32Devices(): Promise<ESP32Device[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/esp32/devices`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return data.devices || []
    } catch (error) {
      console.error('Error fetching ESP32 devices:', error)
      return []
    }
  }

  // Auto mode control
  async setAutoMode(enabled: boolean): Promise<void> {
    this.sendWebSocketMessage({
      type: 'auto_mode_control',
      enabled: enabled
    })
  }

  // Manual override reset
  async resetManualOverride(): Promise<void> {
    this.sendWebSocketMessage({
      type: 'reset_manual'
    })
  }
}

export const apiService = new ApiService();
