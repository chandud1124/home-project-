// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tank_reading.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TankReading _$TankReadingFromJson(Map<String, dynamic> json) => TankReading(
  id: (json['id'] as num).toInt(),
  tankType: json['tank_type'] as String,
  levelPercentage: (json['level_percentage'] as num).toDouble(),
  levelLiters: (json['level_liters'] as num).toDouble(),
  sensorHealth: json['sensor_health'] as String?,
  esp32Id: json['esp32_id'] as String?,
  batteryVoltage: (json['battery_voltage'] as num?)?.toDouble(),
  signalStrength: (json['signal_strength'] as num?)?.toInt(),
  floatSwitch: json['float_switch'] as bool?,
  motorRunning: json['motor_running'] as bool,
  manualOverride: json['manual_override'] as bool?,
  autoModeEnabled: json['auto_mode_enabled'] as bool?,
  timestamp: DateTime.parse(json['timestamp'] as String),
);

Map<String, dynamic> _$TankReadingToJson(TankReading instance) =>
    <String, dynamic>{
      'id': instance.id,
      'tank_type': instance.tankType,
      'level_percentage': instance.levelPercentage,
      'level_liters': instance.levelLiters,
      'sensor_health': instance.sensorHealth,
      'esp32_id': instance.esp32Id,
      'battery_voltage': instance.batteryVoltage,
      'signal_strength': instance.signalStrength,
      'float_switch': instance.floatSwitch,
      'motor_running': instance.motorRunning,
      'manual_override': instance.manualOverride,
      'auto_mode_enabled': instance.autoModeEnabled,
      'timestamp': instance.timestamp.toIso8601String(),
    };
