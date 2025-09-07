import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  TankReadingSchema,
  SystemAlertSchema,
  WebSocketMessageSchema,
  DeviceCommandSchema,
  validateTankReading,
  validateSystemAlert,
  validateWebSocketMessage,
  validateDeviceCommand
} from '@/lib/schemas'
import { supabase } from '@/services/api'

export interface CommunicationConfig {
  supabase: SupabaseClient
  backendUrl: string
  wsUrl: string
  maxRetries: number
  retryDelay: number
  connectionTimeout: number
}

export interface ConnectionState {
  isOnline: boolean
  lastHeartbeat: Date
  reconnectAttempts: number
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline'
}

export interface MessageHandler {
  onMessage: (message: any) => void
  onError: (error: Error) => void
  onConnectionStateChange: (state: ConnectionState) => void
}

export class EnhancedCommunicationService {
  private supabase: SupabaseClient
  private config: CommunicationConfig
  private eventSource: EventSource | null = null
  private webSocket: WebSocket | null = null
  private messageHandlers: Map<string, MessageHandler> = new Map()
  private connectionState: ConnectionState = {
    isOnline: false,
    lastHeartbeat: new Date(),
    reconnectAttempts: 0,
    connectionQuality: 'offline'
  }
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(config: CommunicationConfig) {
    this.config = config
    this.supabase = config.supabase
    this.initializeHeartbeat()
  }

  // Initialize heartbeat monitoring
  private initializeHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.checkConnectionHealth()
    }, 30000) // Check every 30 seconds
  }

  // Enhanced connection health monitoring
  private async checkConnectionHealth() {
    try {
      const startTime = Date.now()
      const { error } = await this.supabase.from('device_heartbeats').select('count').limit(1)
      const responseTime = Date.now() - startTime

      if (error) {
        this.updateConnectionState({
          ...this.connectionState,
          isOnline: false,
          connectionQuality: 'offline'
        })
        return
      }

      // Determine connection quality based on response time
      let quality: ConnectionState['connectionQuality'] = 'excellent'
      if (responseTime > 1000) quality = 'poor'
      else if (responseTime > 500) quality = 'good'

      this.updateConnectionState({
        ...this.connectionState,
        isOnline: true,
        lastHeartbeat: new Date(),
        connectionQuality: quality
      })
    } catch (error) {
      this.updateConnectionState({
        ...this.connectionState,
        isOnline: false,
        connectionQuality: 'offline'
      })
    }
  }

  // Update connection state and notify handlers
  private updateConnectionState(newState: ConnectionState) {
    const previousState = { ...this.connectionState }
    this.connectionState = newState

    // Notify all handlers if state changed
    if (previousState.isOnline !== newState.isOnline ||
        previousState.connectionQuality !== newState.connectionQuality) {
      this.messageHandlers.forEach(handler => {
        handler.onConnectionStateChange(newState)
      })
    }
  }

  // Enhanced WebSocket connection with automatic reconnection
  async connectWebSocket(): Promise<void> {
    // Skip WebSocket connection in cloud-only mode
    if (this.config.wsUrl === 'disabled' || import.meta.env.VITE_CLOUD_ONLY_MODE === 'true') {
      console.log('🌐 WebSocket disabled - using cloud-only mode with Supabase real-time')
      this.updateConnectionState({
        ...this.connectionState,
        isOnline: true,
        reconnectAttempts: 0
      })
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        this.webSocket = new WebSocket(this.config.wsUrl)

        this.webSocket.onopen = () => {
          console.log('🔗 WebSocket connected')
          this.updateConnectionState({
            ...this.connectionState,
            isOnline: true,
            reconnectAttempts: 0
          })
          resolve()
        }

        this.webSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleIncomingMessage(data)
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error)
          }
        }

        this.webSocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          this.handleConnectionError()
          reject(error)
        }

        this.webSocket.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason)
          this.updateConnectionState({
            ...this.connectionState,
            isOnline: false
          })
        }

        // Set connection timeout
        setTimeout(() => {
          if (!this.connectionState.isOnline) {
            reject(new Error('Connection timeout'))
          }
        }, this.config.connectionTimeout)

      } catch (error) {
        reject(error)
      }
    })
  }

  // Handle incoming messages with validation
  private handleIncomingMessage(rawMessage: any) {
    try {
      // Validate the message structure
      const message = validateWebSocketMessage(rawMessage)

      // Route to appropriate handler
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler.onMessage(message)
      } else {
        console.warn('⚠️ No handler for message type:', message.type)
      }
    } catch (validationError) {
      console.error('❌ Invalid message format:', validationError)
      // Notify error handlers
      this.messageHandlers.forEach(handler => {
        handler.onError(validationError as Error)
      })
    }
  }

  // Handle connection errors with exponential backoff
  private handleConnectionError() {
    this.updateConnectionState({
      ...this.connectionState,
      isOnline: false,
      reconnectAttempts: this.connectionState.reconnectAttempts + 1
    })

    if (this.connectionState.reconnectAttempts < this.config.maxRetries) {
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, this.connectionState.reconnectAttempts),
        30000 // Max 30 seconds
      )

      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.connectionState.reconnectAttempts})`)

      setTimeout(() => {
        this.connectWebSocket().catch(error => {
          console.error('❌ Reconnection failed:', error)
        })
      }, delay)
    }
  }

  // Register message handlers
  registerHandler(messageType: string, handler: MessageHandler) {
    this.messageHandlers.set(messageType, handler)
  }

  // Unregister message handlers
  unregisterHandler(messageType: string) {
    this.messageHandlers.delete(messageType)
  }

  // Enhanced API call with retry logic
  async apiCall<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = this.config.maxRetries
  ): Promise<T> {
    const url = `${this.config.backendUrl}${endpoint}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data
      } catch (error) {
        console.error(`❌ API call failed (attempt ${attempt + 1}/${retries + 1}):`, error)

        if (attempt === retries) {
          throw error
        }

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error('API call failed after all retries')
  }

  // Send validated device command
  async sendDeviceCommand(deviceId: string, command: any): Promise<void> {
    try {
      // Validate command structure
      const validatedCommand = validateDeviceCommand({
        ...command,
        device_id: deviceId
      })

      await this.apiCall('/functions/v1/websocket', {
        method: 'POST',
        body: JSON.stringify({
          type: 'enqueue_command',
          target_device_id: deviceId,
          command_type: validatedCommand.command_type,
          payload: validatedCommand.payload
        })
      })

      console.log('📤 Device command sent:', validatedCommand)
    } catch (error) {
      console.error('❌ Failed to send device command:', error)
      throw error
    }
  }

  // Get current connection state
  getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  // Disconnect and cleanup
  disconnect() {
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts.clear()

    this.updateConnectionState({
      ...this.connectionState,
      isOnline: false,
      connectionQuality: 'offline'
    })
  }
}

// Factory function to create configured service
export function createCommunicationService(): EnhancedCommunicationService {
  const config: CommunicationConfig = {
    supabase: supabase,
    backendUrl: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
    wsUrl: import.meta.env.VITE_WEBSOCKET_URL || import.meta.env.VITE_WS_URL || 'disabled',
    maxRetries: 5,
    retryDelay: 1000,
    connectionTimeout: 10000
  }

  console.log('🌐 Communication Service Config:', {
    cloudOnlyMode: import.meta.env.VITE_CLOUD_ONLY_MODE === 'true',
    websocketUrl: config.wsUrl,
    backendUrl: config.backendUrl
  })

  return new EnhancedCommunicationService(config)
}
