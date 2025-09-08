import 'package:json_annotation/json_annotation.dart';

part 'motor_event.g.dart';

@JsonSerializable()
class MotorEvent {
  final int id;
  @JsonKey(name: 'event_type')
  final String eventType;
  final int? duration;
  @JsonKey(name: 'power_detected')
  final bool? powerDetected;
  @JsonKey(name: 'current_draw')
  final double? currentDraw;
  @JsonKey(name: 'runtime_seconds')
  final int? runtimeSeconds;
  final DateTime timestamp;
  
  // Additional fields for backward compatibility
  final String? deviceId;
  final String? actionType;
  final String? operatingMode;
  final String? triggerType;
  
  MotorEvent({
    required this.id,
    String? eventType,
    this.duration,
    this.powerDetected,
    this.currentDraw,
    this.runtimeSeconds,
    required this.timestamp,
    this.deviceId,
    this.actionType,
    this.operatingMode,
    this.triggerType,
  }) : eventType = eventType ?? actionType ?? 'unknown';
  
  // Named constructor for provider compatibility
  MotorEvent.fromAction({
    required this.id,
    required String deviceId,
    required String action,
    required String mode,
    required String trigger,
    required this.timestamp,
    this.duration,
    this.powerDetected,
    this.currentDraw,
    this.runtimeSeconds,
  }) : eventType = action,
       deviceId = deviceId,
       actionType = action,
       operatingMode = mode,
       triggerType = trigger;
  
  factory MotorEvent.fromJson(Map<String, dynamic> json) => 
      _$MotorEventFromJson(json);
  Map<String, dynamic> toJson() => _$MotorEventToJson(this);
  
  // Helper getters
  bool get isStartEvent => eventType.toLowerCase().contains('start');
  bool get isStopEvent => eventType.toLowerCase().contains('stop');
  
  String get displayEventType {
    if (isStartEvent) return 'Motor Started';
    if (isStopEvent) return 'Motor Stopped';
    return eventType;
  }
  
  String get formattedDuration {
    if (duration == null) return 'N/A';
    final minutes = duration! ~/ 60;
    final seconds = duration! % 60;
    return '${minutes}m ${seconds}s';
  }
  
  String get formattedCurrentDraw {
    if (currentDraw == null) return 'N/A';
    return '${currentDraw!.toStringAsFixed(1)}A';
  }
  
  // Expected getters for backward compatibility
  String get action => actionType ?? (isStartEvent ? 'start' : 'stop');
  String get mode => operatingMode ?? 'auto'; // Default mode
  String get trigger => triggerType ?? 'automatic'; // Default trigger
}
