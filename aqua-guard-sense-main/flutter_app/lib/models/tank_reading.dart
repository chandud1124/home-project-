import 'package:json_annotation/json_annotation.dart';

part 'tank_reading.g.dart';

@JsonSerializable()
class TankReading {
  final int id;
  @JsonKey(name: 'tank_type')
  final String tankType;
  @JsonKey(name: 'level_percentage')
  final double levelPercentage;
  @JsonKey(name: 'level_liters')
  final double levelLiters;
  @JsonKey(name: 'sensor_health')
  final String? sensorHealth;
  @JsonKey(name: 'esp32_id')
  final String? esp32Id;
  @JsonKey(name: 'battery_voltage')
  final double? batteryVoltage;
  @JsonKey(name: 'signal_strength')
  final int? signalStrength;
  @JsonKey(name: 'float_switch')
  final bool? floatSwitch;
  @JsonKey(name: 'motor_running')
  final bool motorRunning;
  @JsonKey(name: 'manual_override')
  final bool? manualOverride;
  @JsonKey(name: 'auto_mode_enabled')
  final bool? autoModeEnabled;
  final DateTime timestamp;
  
  TankReading({
    required this.id,
    required this.tankType,
    required this.levelPercentage,
    required this.levelLiters,
    this.sensorHealth,
    this.esp32Id,
    this.batteryVoltage,
    this.signalStrength,
    this.floatSwitch,
    required this.motorRunning,
    this.manualOverride,
    this.autoModeEnabled,
    required this.timestamp,
  });
  
  factory TankReading.fromJson(Map<String, dynamic> json) => 
      _$TankReadingFromJson(json);
  Map<String, dynamic> toJson() => _$TankReadingToJson(this);
  
  // Helper getters
  bool get isSumpTank => tankType.toLowerCase().contains('sump');
  bool get isTopTank => tankType.toLowerCase().contains('top');
  bool get isHealthy => sensorHealth?.toLowerCase() == 'good';
  bool get isOnline => esp32Id != null && esp32Id!.isNotEmpty;
  
  String get displayName => isSumpTank ? 'Sump Tank' : 'Top Tank';
  
  double get capacityLiters {
    if (isSumpTank) return 1322.5; // Sump tank capacity
    if (isTopTank) return 1000.0;  // Top tank capacity
    return 1000.0; // Default
  }
  
  // Expected getters for backward compatibility
  double get waterLevel => levelPercentage;
  double get temperature => 25.0; // Default temperature
  double get phLevel => 7.0; // Default pH level
  double get tdsLevel => 300.0; // Default TDS level
}
