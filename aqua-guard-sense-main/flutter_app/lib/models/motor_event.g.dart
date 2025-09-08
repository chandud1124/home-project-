// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'motor_event.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MotorEvent _$MotorEventFromJson(Map<String, dynamic> json) => MotorEvent(
  id: (json['id'] as num).toInt(),
  eventType: json['event_type'] as String?,
  duration: (json['duration'] as num?)?.toInt(),
  powerDetected: json['power_detected'] as bool?,
  currentDraw: (json['current_draw'] as num?)?.toDouble(),
  runtimeSeconds: (json['runtime_seconds'] as num?)?.toInt(),
  timestamp: DateTime.parse(json['timestamp'] as String),
  deviceId: json['deviceId'] as String?,
  actionType: json['actionType'] as String?,
  operatingMode: json['operatingMode'] as String?,
  triggerType: json['triggerType'] as String?,
);

Map<String, dynamic> _$MotorEventToJson(MotorEvent instance) =>
    <String, dynamic>{
      'id': instance.id,
      'event_type': instance.eventType,
      'duration': instance.duration,
      'power_detected': instance.powerDetected,
      'current_draw': instance.currentDraw,
      'runtime_seconds': instance.runtimeSeconds,
      'timestamp': instance.timestamp.toIso8601String(),
      'deviceId': instance.deviceId,
      'actionType': instance.actionType,
      'operatingMode': instance.operatingMode,
      'triggerType': instance.triggerType,
    };
