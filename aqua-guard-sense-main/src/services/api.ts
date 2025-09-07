
import { createClient } from '@supabase/supabase-js'
import { mockApiService } from './mockApi'
import { TankReadingSchema, SystemAlertSchema, validateTankReading, validateSystemAlert } from '@/lib/schemas'
import { createCommunicationService } from './communication'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

// Export the supabase client for use in other services
export { supabase }

// Initialize enhanced communication service
const communicationService = createCommunicationService()

// Backend configuration (prefer explicit backend vars; no production host fallback to Supabase URL)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || import.meta.env.VITE_WS_URL || 'disabled'

// Cloud-only mode configuration
const CLOUD_ONLY_MODE = import.meta.env.VITE_CLOUD_ONLY_MODE === 'true' || WS_URL === 'disabled'

// Flag to use mock API when backend is not available
const USE_MOCK_API = false // Using real ESP32 data

// Add custom properties to WebSocket type
declare global {
  interface WebSocket {
    lastReconnectAttempt?: number;
  }
}

// WebSocket connection for real-time updates
let wsConnection: WebSocket | null = null
let lastReconnectAttempt = 0; // Track last reconnection attempt globally
const wsCallbacks: Map<string, (data: any) => void> = new Map()

// Cache for last known valid tank readings
const lastKnownTankReadings = {
  sump_tank: {
    level_percentage: 45, // Default value initially
    level_liters: 0,
    sensor_health: 'offline',
    motor_running: false,
    connection_state: 'disconnected',
    timestamp: new Date().toISOString()
  },
  top_tank: {
    level_percentage: 75, // Default value initially
    level_liters: 0,
    sensor_health: 'offline',
    connection_state: 'disconnected',
    timestamp: new Date().toISOString()
  }
}

import { debounce } from 'lodash';

// Debounce saving to localStorage to avoid excessive writes
const debouncedSaveToLocalStorage = debounce(() => {
  try {
    localStorage.setItem('lastKnownTankReadings', JSON.stringify(lastKnownTankReadings));
  } catch (storageError) {
    console.warn('Failed to store tank readings in localStorage:', storageError);
  }
}, 500);

// Heartbeat check to mark devices as stale if no data is received
setInterval(() => {
  const now = Date.now();
  let changed = false;

  const checkStale = (tank: 'sump_tank' | 'top_tank') => {
    const lastTimestamp = new Date(lastKnownTankReadings[tank].timestamp).getTime();
    if (now - lastTimestamp > 30000 && lastKnownTankReadings[tank].connection_state === 'connected') {
      console.log(`Marking ${tank} as stale, no data for 30s`);
      lastKnownTankReadings[tank].connection_state = 'stale';
      lastKnownTankReadings[tank].sensor_health = 'warning';
      changed = true;
    }
  };

  checkStale('sump_tank');
  checkStale('top_tank');

  if (changed) {
    debouncedSaveToLocalStorage();
    // Notify listeners that data has changed
    const callback = wsCallbacks.get('tank_reading');
    if (callback) {
      callback(lastKnownTankReadings);
    }
  }
}, 10000); // Check every 10 seconds

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
  connection_state?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
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
  connection_state?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable';
  backend_responsive?: boolean;
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
    // Load last known tank readings from localStorage if available
    try {
      const savedReadings = localStorage.getItem('lastKnownTankReadings');
      if (savedReadings) {
        const parsed = JSON.parse(savedReadings);
        Object.assign(lastKnownTankReadings, parsed);
        console.log('📊 Loaded cached tank readings:', lastKnownTankReadings);
      }
    } catch (error) {
      console.warn('Failed to load cached tank readings:', error);
    }
    
    this.initializeWebSocket()
    // Register pong handler for testing WebSocket connection
    this.onWebSocketMessage('pong', (data) => {
      console.log('🔔 WebSocket pong received:', data)
    })
  }

  private initializeWebSocket() {
    try {
      // Skip WebSocket initialization in cloud-only mode
      if (CLOUD_ONLY_MODE) {
        console.log('🌐 WebSocket disabled - using cloud-only mode with Supabase real-time')
        return
      }

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
      
      // Record current connection attempt time for reconnection throttling
      const connectionAttemptTime = Date.now();
      
      // Track reconnection attempts to implement exponential backoff
      let reconnectionAttempts = 0;

      console.log('🔌 Creating new WebSocket connection')
      wsConnection = new WebSocket(WS_URL)

      wsConnection.onopen = () => {
        console.log('WebSocket connected to local backend')
        
        // Reset the reconnection attempts counter on successful connection
        reconnectionAttempts = 0;
        
        // Maintain ESP32 status during reconnection
        // Instead of marking ESP32 as offline immediately on WebSocket reconnect,
        // we'll maintain the last known state for a few seconds
        
        // Send a test ping message
        this.sendWebSocketMessage({ type: 'ping', data: { timestamp: Date.now() } })
        
        // Request system status immediately after connection
        this.sendWebSocketMessage({ 
          type: 'request_system_status', 
          data: { timestamp: Date.now() } 
        })
      }

      wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // Skip excessive logging for performance - only log once every 5 messages
          // This reduces console overhead which can slow down the UI
          if (Math.random() < 0.2) {
            console.log('📨 WebSocket message received:', message.type)
          }

          // Save tank readings to cache when received
          if (message.type === 'tank_reading' && message.data) {
            const tankData = message.data;
            let changed = false;
            
            // Store in the appropriate cache based on tank type
            if (tankData.tank_type === 'sump_tank') {  // FIXED: removed 'sump' variant - only standard naming
              console.log('📊 Caching sump tank reading:', tankData.level_percentage);
              lastKnownTankReadings.sump_tank = {
                ...lastKnownTankReadings.sump_tank,
                level_percentage: tankData.level_percentage,
                level_liters: tankData.level_liters,
                sensor_health: tankData.sensor_health || 'good',
                motor_running: tankData.motor_running !== undefined ? tankData.motor_running : lastKnownTankReadings.sump_tank.motor_running,
                connection_state: 'connected',
                timestamp: tankData.timestamp || new Date().toISOString()
              };
              changed = true;
            } else if (tankData.tank_type === 'top_tank' || tankData.tank_type === 'top') {
              console.log('📊 Caching top tank reading:', tankData.level_percentage);
              lastKnownTankReadings.top_tank = {
                ...lastKnownTankReadings.top_tank,
                level_percentage: tankData.level_percentage,
                level_liters: tankData.level_liters,
                sensor_health: tankData.sensor_health || 'good',
                connection_state: 'connected',
                timestamp: tankData.timestamp || new Date().toISOString()
              };
              changed = true;
            }
            
            if (changed) {
              debouncedSaveToLocalStorage();
            }
          }

          // Also handle system_status messages for ESP32 connection tracking
          if (message.type === 'system_status' && message.data) {
            const statusData = message.data;
            let changed = false;
            
            // Update the ESP32 status in our cache
            if (statusData.esp32_sump_status) {
              const newState = statusData.esp32_sump_status === 'online' ? 'connected' : 'disconnected';
              if (lastKnownTankReadings.sump_tank.connection_state !== newState) {
                lastKnownTankReadings.sump_tank.connection_state = newState;
                lastKnownTankReadings.sump_tank.sensor_health = newState === 'connected' ? 'good' : 'offline';
                changed = true;
              }
            }
            
            if (statusData.esp32_top_status) {
              const newState = statusData.esp32_top_status === 'online' ? 'connected' : 'disconnected';
              if (lastKnownTankReadings.top_tank.connection_state !== newState) {
                lastKnownTankReadings.top_tank.connection_state = newState;
                lastKnownTankReadings.top_tank.sensor_health = newState === 'connected' ? 'good' : 'offline';
                changed = true;
              }
            }
            
            if (changed) {
              debouncedSaveToLocalStorage();
            }
          }
          
          // Also handle sensor_data messages which contain detailed ESP32 information
          if (message.type === 'sensor_data' && message.data && message.data.payload) {
            const sensorData = message.data.payload;
            let changed = false;
            
            if (sensorData.tank_type === 'sump_tank') {  // FIXED: removed 'sump' variant - only standard naming
              lastKnownTankReadings.sump_tank.motor_running = sensorData.motor_running !== undefined ? sensorData.motor_running : lastKnownTankReadings.sump_tank.motor_running;
              lastKnownTankReadings.sump_tank.connection_state = sensorData.connection_state || 'connected';
              lastKnownTankReadings.sump_tank.sensor_health = sensorData.sensor_health || 'good';
              changed = true;
            } else if (sensorData.tank_type === 'top_tank') {  // FIXED: removed 'top' variant - only standard naming
              lastKnownTankReadings.top_tank.connection_state = sensorData.connection_state || 'connected';
              lastKnownTankReadings.top_tank.sensor_health = sensorData.sensor_health || 'good';
              changed = true;
            }
            
            if (changed) {
              debouncedSaveToLocalStorage();
            }
          }
          
          // Call registered callbacks efficiently - use requestAnimationFrame to 
          // ensure UI updates are synchronized with the browser's rendering cycle
          const callback = wsCallbacks.get(message.type)
          if (callback) {
            // Use requestAnimationFrame for UI related updates
            requestAnimationFrame(() => {
              try {
                callback(message.data)
              } catch (callbackError) {
                console.error('❌ Error in WebSocket callback:', callbackError)
              }
            })
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error)
        }
      }

      // Use global lastReconnectAttempt variable
      const now = Date.now();
      
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

        // Clear the connection reference
        wsConnection = null
        
        // Important: Don't immediately mark ESP32 devices as disconnected on WebSocket close
        // They may still be sending data to the backend even if our frontend WebSocket is disconnected
        // Instead, we'll maintain the last known status for some time
        
        // Set connection_state to 'reconnecting' but don't change sensor_health yet
        // This shows the device as temporarily disconnected in the UI without losing sensor data
        lastKnownTankReadings.sump_tank.connection_state = 'reconnecting';
        lastKnownTankReadings.top_tank.connection_state = 'reconnecting';
        
        // Persist this transitional state
        try {
          localStorage.setItem('lastKnownTankReadings', JSON.stringify(lastKnownTankReadings));
        } catch (storageError) {
          console.warn('Failed to store tank readings in localStorage:', storageError);
        }
        
        // Calculate reconnection delay with exponential backoff (1s, 2s, 4s, 8s, etc.)
        // But cap at 30 seconds maximum
        reconnectionAttempts++;
        const reconnectDelay = Math.min(
          1000 * Math.pow(2, reconnectionAttempts - 1), 
          30000
        );
        
        // Only reconnect if it's been at least 3 seconds since the last attempt
        // This prevents excessive reconnection attempts during development with HMR
        if (now - lastReconnectAttempt > 3000) {
          console.log(`🔄 Scheduling WebSocket reconnection in ${reconnectDelay/1000} seconds...`)
          setTimeout(() => {
            console.log('🔄 Attempting WebSocket reconnection...')
            lastReconnectAttempt = Date.now();
            this.initializeWebSocket()
          }, reconnectDelay)
        } else {
          console.log('🔄 Skipping reconnection - too soon since last attempt')
        }
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

  // Manual WebSocket reconnection
  reconnectWebSocket() {
    console.log('🔄 Manual WebSocket reconnection requested')
    
    // Don't mark ESP32 as offline during manual reconnection
    // This prevents UI flicker when reconnecting
    const preserveStatus = true;
    
    if (wsConnection) {
      wsConnection.close()
      wsConnection = null
    }
    
    // Only update sensor_health if this isn't a manual reconnection
    if (!preserveStatus) {
      // Mark sensors as temporarily offline during reconnection
      lastKnownTankReadings.sump_tank.sensor_health = 'offline';
      lastKnownTankReadings.top_tank.sensor_health = 'offline';
    }
    
    setTimeout(() => this.initializeWebSocket(), 1000)
  }

  // Check WebSocket connection status
  isWebSocketConnected(): boolean {
    return wsConnection && wsConnection.readyState === WebSocket.OPEN
  }

  // Get detailed connection status
  getConnectionStatus(): { connected: boolean; readyState: number; url: string | null } {
    return {
      connected: this.isWebSocketConnected(),
      readyState: wsConnection ? wsConnection.readyState : -1,
      url: wsConnection ? wsConnection.url : null
    }
  }

  // Register callback for WebSocket messages
  onWebSocketMessage(type: string, callback: (data: any) => void) {
    const existingCallback = wsCallbacks.get(type);

    const newCallback = (data: any) => {
      if (existingCallback) {
        existingCallback(data);
      }
      callback(data);

      // For motor_status messages, also update our cached tank readings
      if (type === 'motor_status' && data && data.motor_running !== undefined) {
        console.log('Updating cached motor status from motor_status message:', data.motor_running);
        lastKnownTankReadings.sump_tank.motor_running = data.motor_running;
        
        // Store in localStorage for persistence
        try {
          localStorage.setItem('lastKnownTankReadings', JSON.stringify(lastKnownTankReadings));
        } catch (storageError) {
          console.warn('Failed to store motor status in localStorage:', storageError);
        }
      }
    };
    
    // Store the combined callback
    wsCallbacks.set(type, newCallback);
    
    // Return unsubscribe function
    return () => {
      wsCallbacks.set(type, existingCallback || (() => {})); // Restore original or empty
    };
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
    console.log('🔧 getTanks called, USE_MOCK_API:', USE_MOCK_API);
    console.log('🔧 BACKEND_URL:', BACKEND_URL);
    
    if (USE_MOCK_API) {
      return mockApiService.getTanks();
    }
    
    try {
      console.log('📡 Fetching from:', `${BACKEND_URL}/api/tanks`);
      const response = await fetch(`${BACKEND_URL}/api/tanks`)
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      console.log('📡 Raw API response:', data);

      // Transform the data to match our interface
      const transformedData = data.map((reading: any) => ({
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
      
      console.log('📡 Transformed data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('Error fetching tanks:', error)
      
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getTanks();
      }
      
      // If we have cached tank readings, return those instead of an empty array
      console.log('📊 Using last known tank readings due to API error:', lastKnownTankReadings);
      
      // Check if WebSocket is connected
      const wsConnected = this.isWebSocketConnected();
      const now = new Date();
      
      // Calculate time elapsed since last tank reading update
      const sumpLastUpdated = new Date(lastKnownTankReadings.sump_tank.timestamp || new Date());
      const topLastUpdated = new Date(lastKnownTankReadings.top_tank.timestamp || new Date());
      const sumpElapsedSeconds = (now.getTime() - sumpLastUpdated.getTime()) / 1000;
      const topElapsedSeconds = (now.getTime() - topLastUpdated.getTime()) / 1000;
      
      // If readings are over 5 minutes old, mark as stale
      const sumpIsStale = sumpElapsedSeconds > 300;
      const topIsStale = topElapsedSeconds > 300;
      
      // Determine actual connection states based on WebSocket status and data freshness
      const sumpConnectionState = !wsConnected ? 'disconnected' as const : 
                                 sumpIsStale ? 'stale' as const : 
                                 (lastKnownTankReadings.sump_tank.connection_state || 'disconnected') as 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
                                 
      const topConnectionState = !wsConnected ? 'disconnected' as const : 
                               topIsStale ? 'stale' as const : 
                               (lastKnownTankReadings.top_tank.connection_state || 'disconnected') as 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
      
      // Determine sensor health based on connection state
      const sumpSensorHealth = (sumpConnectionState === 'disconnected' || sumpConnectionState === 'stale') ? 
                               'offline' : lastKnownTankReadings.sump_tank.sensor_health;
                               
      const topSensorHealth = (topConnectionState === 'disconnected' || topConnectionState === 'stale') ? 
                             'offline' : lastKnownTankReadings.top_tank.sensor_health;
      
      // Convert our cached readings to the expected format
      return [
        {
          id: 'cached-sump',
          tank_type: 'sump_tank',
          level_percentage: lastKnownTankReadings.sump_tank.level_percentage,
          level_liters: lastKnownTankReadings.sump_tank.level_liters,
          sensor_health: sumpSensorHealth,
          motor_running: lastKnownTankReadings.sump_tank.motor_running,
          connection_state: sumpConnectionState,
          timestamp: lastKnownTankReadings.sump_tank.timestamp
        },
        {
          id: 'cached-top',
          tank_type: 'top_tank',
          level_percentage: lastKnownTankReadings.top_tank.level_percentage,
          level_liters: lastKnownTankReadings.top_tank.level_liters,
          sensor_health: topSensorHealth,
          connection_state: topConnectionState,
          timestamp: lastKnownTankReadings.top_tank.timestamp
        }
      ];
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
    if (USE_MOCK_API) {
      return mockApiService.controlMotor(action);
    }
    
    try {
      console.log(`🎛️ Sending motor ${action} command to backend...`);
      
      // Also make HTTP request to backend
      const response = await fetch(`${BACKEND_URL}/api/motor/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action,
          manual: true 
        })
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Motor control HTTP error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('🎛️ Backend response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Motor control command failed')
      }

      // Send WebSocket message for motor control (after successful HTTP request)
      this.sendWebSocketMessage({
        type: 'motor_control',
        state: action === 'start',
        manual: true
      })

      // Create a mock event since backend doesn't return event data yet
      const mockEvent: MotorEvent = {
        id: data.command?.id || `motor_${Date.now()}`,
        event_type: action === 'start' ? 'start' : 'stop',
        duration: 0,
        esp32_id: data.command?.device_id || 'ESP32_SUMP_002',
        motor_running: action === 'start',
        power_detected: action === 'start',
        current_draw: action === 'start' ? 5.2 : 0,
        timestamp: data.command?.created_at || new Date().toISOString()
      }

      console.log('✅ Motor control command sent successfully:', mockEvent);
      return {
        success: true,
        event: mockEvent
      }
    } catch (error) {
      console.error('❌ Error controlling motor:', error)
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.controlMotor(action);
      }
      throw error
    }
  }

  async getMotorEvents(): Promise<MotorEvent[]> {
    if (USE_MOCK_API) {
      return mockApiService.getMotorEvents();
    }
    
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
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getMotorEvents();
      }
      return []
    }
  }

  // Motor settings methods
  async getMotorSettings(): Promise<{
    auto_start_level: number;
    auto_stop_level: number;
    max_runtime_minutes: number;
    min_off_time_minutes: number;
  }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/motor/settings`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.settings;
    } catch (error) {
      console.error('Error fetching motor settings:', error);
      // Return default settings on error
      return {
        auto_start_level: 20,
        auto_stop_level: 80,
        max_runtime_minutes: 60,
        min_off_time_minutes: 15
      };
    }
  }

  async updateMotorSettings(settings: {
    auto_start_level: number;
    auto_stop_level: number;
    max_runtime_minutes: number;
    min_off_time_minutes: number;
  }): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/motor/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: data.success };
    } catch (error) {
      console.error('Error updating motor settings:', error);
      throw error;
    }
  }

  // Alert methods
  async getAlerts(): Promise<SystemAlert[]> {
    if (USE_MOCK_API) {
      return mockApiService.getAlerts();
    }
    
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
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getAlerts();
      }
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
    if (USE_MOCK_API) {
      return mockApiService.getSystemStatus();
    }
    
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
        connection_state: data.connection_state || 'disconnected',
        backend_responsive: true,
        timestamp: data.timestamp || new Date().toISOString()
      }
    } catch (error) {
      console.error('Error fetching system status:', error)
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getSystemStatus();
      }
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

  // Get last known tank readings (works even when offline)
  getLastKnownTankReadings(tankType?: 'sump_tank' | 'top_tank' | 'sump' | 'top'): any {
    // If tank type is specified, return only that tank's reading
    if (tankType) {
      // Map variant names to our stored keys
      const mappedType = tankType === 'sump' ? 'sump_tank' : 
                          tankType === 'top' ? 'top_tank' : 
                          tankType;
      
      // Return the reading for the requested tank type
      return mappedType === 'top_tank' ? 
        lastKnownTankReadings.top_tank : 
        lastKnownTankReadings.sump_tank;
    }
    
    // Otherwise return all tank readings
    return lastKnownTankReadings;
  }
  
  // Consumption data
  async getConsumptionData(period: 'daily' | 'monthly' = 'daily'): Promise<ConsumptionData[]> {
    if (USE_MOCK_API) {
      return mockApiService.getConsumptionData(period);
    }
    
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
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getConsumptionData(period);
      }
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
    if (USE_MOCK_API) {
      return mockApiService.getESP32Devices();
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/esp32/devices`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return data.devices || []
    } catch (error) {
      console.error('Error fetching ESP32 devices:', error)
      if (USE_MOCK_API) {
        console.log('Falling back to mock data');
        return mockApiService.getESP32Devices();
      }
      return []
    }
  }

  // Auto mode control
  async setAutoMode(enabled: boolean): Promise<void> {
    if (USE_MOCK_API) {
      return mockApiService.setAutoMode(enabled);
    }
    
    this.sendWebSocketMessage({
      type: 'auto_mode_control',
      enabled: enabled
    })
  }

  // Manual override reset
  async resetManualOverride(): Promise<void> {
    if (USE_MOCK_API) {
      return mockApiService.resetManualOverride();
    }

    this.sendWebSocketMessage({
      type: 'reset_manual'
    })
  }

  // Enhanced communication methods using the new service
  async sendDeviceCommandEnhanced(deviceId: string, command: any) {
    try {
      await communicationService.sendDeviceCommand(deviceId, command)
      console.log('📤 Device command sent via enhanced service:', command)
    } catch (error) {
      console.error('❌ Failed to send device command:', error)
      throw error
    }
  }

  getConnectionState() {
    return communicationService.getConnectionState()
  }

  async makeValidatedApiCall<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<T> {
    return communicationService.apiCall<T>(endpoint, options, retries)
  }

  // Alert acknowledgement
  async acknowledgeAlert(alertId: string): Promise<void> {
    if (USE_MOCK_API) {
      return mockApiService.acknowledgeAlert(alertId);
    }

    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
