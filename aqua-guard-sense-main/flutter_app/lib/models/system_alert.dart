import 'package:json_annotation/json_annotation.dart';

part 'system_alert.g.dart';

@JsonSerializable()
class SystemAlert {
  final int id;
  final String type;
  final String title;
  final String message;
  final String? severity;
  @JsonKey(name: 'esp32_id')
  final String? esp32Id;
  final bool resolved;
  final DateTime timestamp;
  
  SystemAlert({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    this.severity,
    this.esp32Id,
    required this.resolved,
    required this.timestamp,
  });
  
  factory SystemAlert.fromJson(Map<String, dynamic> json) => 
      _$SystemAlertFromJson(json);
  Map<String, dynamic> toJson() => _$SystemAlertToJson(this);
  
  // Helper getters
  AlertSeverity get severityLevel {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return AlertSeverity.critical;
      case 'high':
        return AlertSeverity.high;
      case 'medium':
        return AlertSeverity.medium;
      case 'low':
        return AlertSeverity.low;
      default:
        return AlertSeverity.medium;
    }
  }
  
  AlertType get alertType {
    switch (type.toLowerCase()) {
      case 'error':
        return AlertType.error;
      case 'warning':
        return AlertType.warning;
      case 'info':
        return AlertType.info;
      default:
        return AlertType.info;
    }
  }
  
  String get deviceName {
    if (esp32Id?.toLowerCase().contains('sump') == true) return 'Sump Tank Device';
    if (esp32Id?.toLowerCase().contains('top') == true) return 'Top Tank Device';
    return 'System';
  }
}

enum AlertType {
  error,
  warning,
  info,
}

enum AlertSeverity {
  critical,
  high,
  medium,
  low,
}
