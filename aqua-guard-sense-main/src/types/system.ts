
import {
  SystemAlert,
  SystemAlertSchema,
  TankReading,
  TankReadingSchema,
  MotorEvent,
  MotorEventSchema,
  SystemStatus,
  SystemStatusSchema,
  ConsumptionData,
  ConsumptionDataSchema,
  AIInsight,
  AIInsightSchema,
  UsagePattern,
  UsagePatternSchema,
  SystemData,
  SystemDataSchema,
  ESP32Status,
  ESP32StatusSchema,
  SystemStatusData,
  SystemStatusDataSchema,
} from '@/lib/schemas';

// Re-export all types from schemas for backward compatibility
export type {
  SystemAlert,
  TankReading,
  MotorEvent,
  SystemStatus,
  ConsumptionData,
  AIInsight,
  UsagePattern,
  SystemData,
  ESP32Status,
  SystemStatusData,
};

// Re-export schemas for validation
export {
  SystemAlertSchema,
  TankReadingSchema,
  MotorEventSchema,
  SystemStatusSchema,
  ConsumptionDataSchema,
  AIInsightSchema,
  UsagePatternSchema,
  SystemDataSchema,
  ESP32StatusSchema,
  SystemStatusDataSchema,
};
