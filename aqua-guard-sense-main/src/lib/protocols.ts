import { z } from 'zod'

// Base message envelope
export const MessageEnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.string().datetime(),
  source: z.enum(['ui', 'backend', 'api', 'device']),
  target: z.enum(['ui', 'backend', 'api', 'device']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  ttl: z.number().min(0).optional(), // Time to live in seconds
  correlationId: z.string().optional(), // For request-response correlation
})

// UI to Backend messages
export const UIToBackendMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ui_command'),
    payload: z.object({
      action: z.enum(['start_motor', 'stop_motor', 'set_auto_mode', 'reset_alerts']),
      deviceId: z.string(),
      parameters: z.record(z.any()).optional(),
    }),
  }),
  z.object({
    type: z.literal('ui_query'),
    payload: z.object({
      queryType: z.enum(['system_status', 'tank_readings', 'alerts', 'metrics']),
      filters: z.record(z.any()).optional(),
    }),
  }),
  z.object({
    type: z.literal('ui_subscription'),
    payload: z.object({
      eventTypes: z.array(z.string()),
      filters: z.record(z.any()).optional(),
    }),
  }),
])

// Backend to UI messages
export const BackendToUIMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('backend_update'),
    payload: z.object({
      updateType: z.enum(['tank_reading', 'system_status', 'alert', 'metric']),
      data: z.any(),
    }),
  }),
  z.object({
    type: z.literal('backend_response'),
    payload: z.object({
      correlationId: z.string(),
      status: z.enum(['success', 'error', 'partial']),
      data: z.any().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('backend_notification'),
    payload: z.object({
      notificationType: z.enum(['info', 'warning', 'error', 'success']),
      title: z.string(),
      message: z.string(),
      actions: z.array(z.object({
        label: z.string(),
        action: z.string(),
      })).optional(),
    }),
  }),
])

// API to Backend messages
export const APIToBackendMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('api_sensor_data'),
    payload: z.object({
      deviceId: z.string(),
      sensorType: z.enum(['tank_level', 'motor_status', 'system_health']),
      data: z.any(),
      timestamp: z.string().datetime(),
    }),
  }),
  z.object({
    type: z.literal('api_command_ack'),
    payload: z.object({
      commandId: z.string(),
      status: z.enum(['received', 'processing', 'completed', 'failed']),
      result: z.any().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('api_heartbeat'),
    payload: z.object({
      deviceId: z.string(),
      status: z.enum(['online', 'offline', 'degraded']),
      metrics: z.record(z.number()).optional(),
    }),
  }),
])

// Device to API messages
export const DeviceToAPIMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device_sensor_reading'),
    payload: z.object({
      tankType: z.enum(['sump_tank', 'top_tank']),
      levelPercentage: z.number().min(0).max(100),
      levelLiters: z.number().min(0),
      sensorHealth: z.string(),
      motorRunning: z.boolean().optional(),
      timestamp: z.string().datetime(),
    }),
  }),
  z.object({
    type: z.literal('device_command_response'),
    payload: z.object({
      commandId: z.string(),
      status: z.enum(['success', 'error']),
      result: z.any().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('device_alert'),
    payload: z.object({
      alertType: z.enum(['critical', 'warning', 'info']),
      message: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      metadata: z.record(z.any()).optional(),
    }),
  }),
])

// Complete message schemas with envelope
export const CompleteMessageSchema = z.discriminatedUnion('source', [
  z.object({
    ...MessageEnvelopeSchema.shape,
    source: z.literal('ui'),
    data: UIToBackendMessageSchema,
  }),
  z.object({
    ...MessageEnvelopeSchema.shape,
    source: z.literal('backend'),
    data: BackendToUIMessageSchema,
  }),
  z.object({
    ...MessageEnvelopeSchema.shape,
    source: z.literal('api'),
    data: APIToBackendMessageSchema,
  }),
  z.object({
    ...MessageEnvelopeSchema.shape,
    source: z.literal('device'),
    data: DeviceToAPIMessageSchema,
  }),
])

// Message validation helpers
export function validateUIMessage(message: any) {
  return UIToBackendMessageSchema.parse(message)
}

export function validateBackendMessage(message: any) {
  return BackendToUIMessageSchema.parse(message)
}

export function validateAPIMessage(message: any) {
  return APIToBackendMessageSchema.parse(message)
}

export function validateDeviceMessage(message: any) {
  return DeviceToAPIMessageSchema.parse(message)
}

export function validateCompleteMessage(message: any) {
  return CompleteMessageSchema.parse(message)
}

// Message factory functions
export function createUIMessage(
  type: z.infer<typeof UIToBackendMessageSchema>['type'],
  payload: any,
  options: Partial<z.infer<typeof MessageEnvelopeSchema>> = {}
) {
  return {
    id: options.id || crypto.randomUUID(),
    type: 'ui_message',
    timestamp: new Date().toISOString(),
    source: 'ui' as const,
    ...options,
    data: { type, payload },
  }
}

export function createBackendMessage(
  type: z.infer<typeof BackendToUIMessageSchema>['type'],
  payload: any,
  options: Partial<z.infer<typeof MessageEnvelopeSchema>> = {}
) {
  return {
    id: options.id || crypto.randomUUID(),
    type: 'backend_message',
    timestamp: new Date().toISOString(),
    source: 'backend' as const,
    ...options,
    data: { type, payload },
  }
}

export function createAPIMessage(
  type: z.infer<typeof APIToBackendMessageSchema>['type'],
  payload: any,
  options: Partial<z.infer<typeof MessageEnvelopeSchema>> = {}
) {
  return {
    id: options.id || crypto.randomUUID(),
    type: 'api_message',
    timestamp: new Date().toISOString(),
    source: 'api' as const,
    ...options,
    data: { type, payload },
  }
}

export function createDeviceMessage(
  type: z.infer<typeof DeviceToAPIMessageSchema>['type'],
  payload: any,
  options: Partial<z.infer<typeof MessageEnvelopeSchema>> = {}
) {
  return {
    id: options.id || crypto.randomUUID(),
    type: 'device_message',
    timestamp: new Date().toISOString(),
    source: 'device' as const,
    ...options,
    data: { type, payload },
  }
}

// Communication protocol constants
export const PROTOCOL_VERSION = '1.0.0'
export const MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB
export const DEFAULT_TTL = 300 // 5 minutes
export const HEARTBEAT_INTERVAL = 30000 // 30 seconds

// Error types
export const CommunicationErrors = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export type CommunicationErrorType = typeof CommunicationErrors[keyof typeof CommunicationErrors]

// Export types
export type UIToBackendMessage = z.infer<typeof UIToBackendMessageSchema>
export type BackendToUIMessage = z.infer<typeof BackendToUIMessageSchema>
export type APIToBackendMessage = z.infer<typeof APIToBackendMessageSchema>
export type DeviceToAPIMessage = z.infer<typeof DeviceToAPIMessageSchema>
export type CompleteMessage = z.infer<typeof CompleteMessageSchema>
export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>
