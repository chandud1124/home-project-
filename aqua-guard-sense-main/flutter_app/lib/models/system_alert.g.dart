// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_alert.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SystemAlert _$SystemAlertFromJson(Map<String, dynamic> json) => SystemAlert(
  id: (json['id'] as num).toInt(),
  type: json['type'] as String,
  title: json['title'] as String,
  message: json['message'] as String,
  severity: json['severity'] as String?,
  esp32Id: json['esp32_id'] as String?,
  resolved: json['resolved'] as bool,
  timestamp: DateTime.parse(json['timestamp'] as String),
);

Map<String, dynamic> _$SystemAlertToJson(SystemAlert instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'title': instance.title,
      'message': instance.message,
      'severity': instance.severity,
      'esp32_id': instance.esp32Id,
      'resolved': instance.resolved,
      'timestamp': instance.timestamp.toIso8601String(),
    };
