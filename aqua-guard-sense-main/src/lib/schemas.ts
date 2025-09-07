import { z } from 'zod';

// Tank Types
// FIXED: Removed variant tank types ('sump', 'top') - only standard naming allowed
export const TankTypeSchema = z.enum(['sump_tank', 'top_tank']);
export type TankType = z.infer<typeof TankTypeSchema>;

// Connection States
export const ConnectionStateSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'stable',
  'stale'
]);
export type ConnectionState = z.infer<typeof ConnectionStateSchema>;

// Alert Types
export const AlertTypeSchema = z.enum(['info', 'warning', 'error', 'success']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

// System Alert Schema
export const SystemAlertSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema,
  message: z.string(),
  resolved: z.boolean().default(false),
  timestamp: z.string().datetime(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  acknowledged: z.boolean().default(false),
  acknowledged_at: z.string().datetime().optional(),
  auto_expire_at: z.string().datetime().optional(),
});
export type SystemAlert = z.infer<typeof SystemAlertSchema>;

// Tank Reading Schema
export const TankReadingSchema = z.object({
  id: z.string(),
  tank_type: TankTypeSchema,
  level_percentage: z.number().min(0).max(100),
  level_liters: z.number().min(0),
  sensor_health: z.string().optional(),
  esp32_id: z.string().optional(),
  firmware_version: z.string().optional(),
  build_timestamp: z.string().optional(),
  signal_strength: z.number().min(-100).max(0).optional(),
  float_switch: z.boolean().optional(),
  motor_running: z.boolean().optional(),
  motor_status: z.string().optional(),
  manual_override: z.boolean().optional(),
  auto_mode_enabled: z.boolean().optional(),
  connection_state: ConnectionStateSchema.optional(),
  backend_responsive: z.boolean().optional(),
  battery_voltage: z.number().min(0).optional(),
  timestamp: z.string().datetime(),
});
export type TankReading = z.infer<typeof TankReadingSchema>;

// Motor Event Schema
export const MotorEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  duration: z.number().min(0).optional(),
  esp32_id: z.string().optional(),
  motor_running: z.boolean().optional(),
  power_detected: z.boolean().optional(),
  current_draw: z.number().min(0).optional(),
  timestamp: z.string().datetime(),
});
export type MotorEvent = z.infer<typeof MotorEventSchema>;

// System Status Schema
export const SystemStatusSchema = z.object({
  id: z.string(),
  wifi_connected: z.boolean(),
  battery_level: z.number().min(0).max(100),
  temperature: z.number(),
  esp32_top_status: z.string(),
  esp32_sump_status: z.string(),
  wifi_strength: z.number().min(-100).max(0).optional(),
  float_switch: z.boolean().optional(),
  motor_running: z.boolean().optional(),
  manual_override: z.boolean().optional(),
  connection_state: ConnectionStateSchema.optional(),
  backend_responsive: z.boolean().optional(),
  timestamp: z.string().datetime(),
});
export type SystemStatus = z.infer<typeof SystemStatusSchema>;

// Consumption Data Schema
export const ConsumptionDataSchema = z.object({
  date: z.string(),
  consumption: z.number().min(0),
  fills: z.number().min(0),
  motorStarts: z.number().min(0),
});
export type ConsumptionData = z.infer<typeof ConsumptionDataSchema>;

// AI Insight Types
export const AIInsightTypeSchema = z.enum(['prediction', 'anomaly', 'recommendation', 'maintenance']);
export type AIInsightType = z.infer<typeof AIInsightTypeSchema>;

export const AIInsightPrioritySchema = z.enum(['low', 'medium', 'high']);
export type AIInsightPriority = z.infer<typeof AIInsightPrioritySchema>;

// AI Insight Schema
export const AIInsightSchema = z.object({
  id: z.string(),
  type: AIInsightTypeSchema,
  title: z.string(),
  message: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
  priority: AIInsightPrioritySchema,
});
export type AIInsight = z.infer<typeof AIInsightSchema>;

// Usage Pattern Schema
export const UsagePatternSchema = z.object({
  hourlyPattern: z.array(z.number().min(0)),
  weeklyPattern: z.array(z.number().min(0)),
  seasonalTrend: z.enum(['increasing', 'decreasing', 'stable']),
  averageDailyUsage: z.number().min(0),
  peakHours: z.array(z.number().min(0).max(23)),
});
export type UsagePattern = z.infer<typeof UsagePatternSchema>;

// System Data Schema (for frontend state)
export const SystemDataSchema = z.object({
  topTankLevel: z.number().min(0).max(100),
  sumpLevel: z.number().min(0).max(100),
  motorRunning: z.boolean(),
  alerts: z.array(SystemAlertSchema),
  lastUpdate: z.date(),
});
export type SystemData = z.infer<typeof SystemDataSchema>;

// ESP32 Status Schema
export const ESP32StatusSchema = z.object({
  connected: z.boolean(),
  batteryLevel: z.number().min(0).max(100),
  wifiStrength: z.number().min(-100).max(0),
  lastSeen: z.date(),
});
export type ESP32Status = z.infer<typeof ESP32StatusSchema>;

// System Status Data Schema (frontend)
export const SystemStatusDataSchema = z.object({
  wifiConnected: z.boolean(),
  batteryLevel: z.number().min(0).max(100),
  temperature: z.number(),
  uptime: z.string(),
  esp32Status: z.object({
    topTank: z.enum(['online', 'offline', 'error']),
    sump: z.enum(['online', 'offline', 'error']),
  }),
});
export type SystemStatusData = z.infer<typeof SystemStatusDataSchema>;

// WebSocket Message Types
export const WebSocketMessageTypeSchema = z.enum([
  'sensor_data',
  'motor_event',
  'system_alert',
  'command',
  'heartbeat',
  'ping',
  'pong'
]);
export type WebSocketMessageType = z.infer<typeof WebSocketMessageTypeSchema>;

// WebSocket Message Schema
export const WebSocketMessageSchema = z.object({
  type: WebSocketMessageTypeSchema,
  payload: z.any(),
  timestamp: z.string().datetime().optional(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Command Types
export const CommandTypeSchema = z.enum([
  'start_motor',
  'stop_motor',
  'set_auto_mode',
  'set_manual_mode',
  'reset_alerts',
  'reboot_device'
]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

// Device Command Schema
export const DeviceCommandSchema = z.object({
  id: z.string(),
  device_id: z.string(),
  command_type: CommandTypeSchema,
  payload: z.record(z.any()).optional(),
  status: z.enum(['pending', 'sent', 'acknowledged', 'failed']).default('pending'),
  created_at: z.string().datetime(),
  sent_at: z.string().datetime().optional(),
  acknowledged_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
});
export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;

// Validation helpers
export const validateTankReading = (data: unknown): TankReading => {
  return TankReadingSchema.parse(data);
};

export const validateSystemAlert = (data: unknown): SystemAlert => {
  return SystemAlertSchema.parse(data);
};

export const validateWebSocketMessage = (data: unknown): WebSocketMessage => {
  return WebSocketMessageSchema.parse(data);
};

export const validateDeviceCommand = (data: unknown): DeviceCommand => {
  return DeviceCommandSchema.parse(data);
};

// Export all schemas for easy access
export const schemas = {
  TankTypeSchema,
  ConnectionStateSchema,
  AlertTypeSchema,
  SystemAlertSchema,
  TankReadingSchema,
  MotorEventSchema,
  SystemStatusSchema,
  ConsumptionDataSchema,
  AIInsightTypeSchema,
  AIInsightPrioritySchema,
  AIInsightSchema,
  UsagePatternSchema,
  SystemDataSchema,
  ESP32StatusSchema,
  SystemStatusDataSchema,
  WebSocketMessageTypeSchema,
  WebSocketMessageSchema,
  CommandTypeSchema,
  DeviceCommandSchema,
};
