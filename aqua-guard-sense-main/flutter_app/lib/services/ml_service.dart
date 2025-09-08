import 'package:flutter/foundation.dart';
import 'dart:typed_data';
import 'dart:math' as math;
import '../models/tank_reading.dart';
import '../models/motor_event.dart';

class MLService {
  static final MLService _instance = MLService._internal();
  factory MLService() => _instance;
  MLService._internal();

  Interpreter? _anomalyDetectionModel;
  Interpreter? _consumptionPredictionModel;
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;

  // Initialize TensorFlow Lite models
  Future<void> initialize() async {
    try {
      // Load anomaly detection model
      await _loadAnomalyDetectionModel();
      
      // Load consumption prediction model
      await _loadConsumptionPredictionModel();
      
      _isInitialized = true;
      
      if (kDebugMode) {
        print('ML Service initialized successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error initializing ML Service: $e');
      }
    }
  }

  Future<void> _loadAnomalyDetectionModel() async {
    try {
      // In production, you would load your trained model from assets
      // For now, we'll simulate model loading
      if (kDebugMode) {
        print('Loading anomaly detection model...');
      }
      
      // Uncomment when you have actual model files:
      // _anomalyDetectionModel = await Interpreter.fromAsset('assets/models/anomaly_detection.tflite');
      
      if (kDebugMode) {
        print('Anomaly detection model loaded successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error loading anomaly detection model: $e');
      }
    }
  }

  Future<void> _loadConsumptionPredictionModel() async {
    try {
      // In production, you would load your trained model from assets
      if (kDebugMode) {
        print('Loading consumption prediction model...');
      }
      
      // Uncomment when you have actual model files:
      // _consumptionPredictionModel = await Interpreter.fromAsset('assets/models/consumption_prediction.tflite');
      
      if (kDebugMode) {
        print('Consumption prediction model loaded successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error loading consumption prediction model: $e');
      }
    }
  }

  // Detect anomalies in tank readings
  Future<AnomalyResult> detectAnomalies(List<TankReading> readings) async {
    if (!_isInitialized || readings.isEmpty) {
      return AnomalyResult(isAnomaly: false, confidence: 0.0, type: AnomalyType.none);
    }

    try {
      // Prepare input data
      final inputData = _prepareAnomalyInputData(readings);
      
      // Run inference (simulated for now)
      final result = await _runAnomalyDetection(inputData);
      
      return result;
    } catch (e) {
      if (kDebugMode) {
        print('Error detecting anomalies: $e');
      }
      return AnomalyResult(isAnomaly: false, confidence: 0.0, type: AnomalyType.none);
    }
  }

  // Predict water consumption patterns
  Future<ConsumptionPrediction> predictConsumption(List<TankReading> historicalData) async {
    if (!_isInitialized || historicalData.isEmpty) {
      return ConsumptionPrediction(
        nextHourConsumption: 0.0,
        dailyConsumption: 0.0,
        weeklyTrend: ConsumptionTrend.stable,
        confidence: 0.0,
      );
    }

    try {
      // Prepare input data
      final inputData = _prepareConsumptionInputData(historicalData);
      
      // Run inference (simulated for now)
      final prediction = await _runConsumptionPrediction(inputData);
      
      return prediction;
    } catch (e) {
      if (kDebugMode) {
        print('Error predicting consumption: $e');
      }
      return ConsumptionPrediction(
        nextHourConsumption: 0.0,
        dailyConsumption: 0.0,
        weeklyTrend: ConsumptionTrend.stable,
        confidence: 0.0,
      );
    }
  }

  // Analyze motor efficiency patterns
  Future<MotorEfficiencyAnalysis> analyzeMotorEfficiency(List<MotorEvent> motorEvents, List<TankReading> tankReadings) async {
    if (motorEvents.isEmpty || tankReadings.isEmpty) {
      return MotorEfficiencyAnalysis(
        efficiency: 0.0,
        energyUsage: 0.0,
        recommendedMaintenance: false,
        insights: [],
      );
    }

    try {
      // Calculate motor efficiency metrics
      final efficiency = _calculateMotorEfficiency(motorEvents, tankReadings);
      final energyUsage = _estimateEnergyUsage(motorEvents);
      final maintenanceNeeded = _assessMaintenanceNeeds(motorEvents);
      final insights = _generateMotorInsights(motorEvents, tankReadings);

      return MotorEfficiencyAnalysis(
        efficiency: efficiency,
        energyUsage: energyUsage,
        recommendedMaintenance: maintenanceNeeded,
        insights: insights,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Error analyzing motor efficiency: $e');
      }
      return MotorEfficiencyAnalysis(
        efficiency: 0.0,
        energyUsage: 0.0,
        recommendedMaintenance: false,
        insights: [],
      );
    }
  }

  // Prepare input data for anomaly detection
  Float32List _prepareAnomalyInputData(List<TankReading> readings) {
    // Take last 24 readings for analysis
    final recentReadings = readings.take(24).toList();
    final inputSize = recentReadings.length * 4; // 4 features per reading
    final input = Float32List(inputSize);
    
    for (int i = 0; i < recentReadings.length; i++) {
      final reading = recentReadings[i];
      final baseIndex = i * 4;
      
      // Normalize values (0-1 range)
      input[baseIndex] = reading.waterLevel / 200.0; // Assuming max 200cm
      input[baseIndex + 1] = reading.temperature / 50.0; // Assuming max 50°C
      input[baseIndex + 2] = (reading.phLevel - 6.0) / 2.0; // pH 6-8 normalized to 0-1
      input[baseIndex + 3] = reading.tdsLevel / 1000.0; // Assuming max 1000 ppm
    }
    
    return input;
  }

  // Prepare input data for consumption prediction
  Float32List _prepareConsumptionInputData(List<TankReading> readings) {
    // Calculate consumption between readings
    final consumptionData = <double>[];
    
    for (int i = 1; i < readings.length && i <= 24; i++) {
      final current = readings[i];
      final previous = readings[i - 1];
      
      // Calculate consumption as water level decrease
      final consumption = (previous.waterLevel - current.waterLevel).clamp(0.0, double.infinity);
      consumptionData.add(consumption);
    }
    
    // Pad with zeros if needed
    while (consumptionData.length < 24) {
      consumptionData.add(0.0);
    }
    
    return Float32List.fromList(consumptionData);
  }

  // Simulate anomaly detection (replace with actual model inference)
  Future<AnomalyResult> _runAnomalyDetection(Float32List inputData) async {
    // Simulate processing delay
    await Future.delayed(const Duration(milliseconds: 100));
    
    // Simple rule-based anomaly detection for demonstration
    double anomalyScore = 0.0;
    AnomalyType type = AnomalyType.none;
    
    // Check for rapid water level changes
    for (int i = 4; i < inputData.length; i += 4) {
      final currentLevel = inputData[i];
      final previousLevel = inputData[i - 4];
      final levelChange = (currentLevel - previousLevel).abs();
      
      if (levelChange > 0.3) { // 30% change threshold
        anomalyScore = 0.85;
        type = AnomalyType.rapidLevelChange;
        break;
      }
    }
    
    // Check for temperature anomalies
    for (int i = 1; i < inputData.length; i += 4) {
      final temp = inputData[i] * 50.0; // Denormalize
      if (temp > 35.0 || temp < 5.0) {
        anomalyScore = Math.max(anomalyScore, 0.75);
        type = type == AnomalyType.none ? AnomalyType.temperatureAnomaly : type;
      }
    }
    
    // Check for pH anomalies
    for (int i = 2; i < inputData.length; i += 4) {
      final ph = inputData[i] * 2.0 + 6.0; // Denormalize
      if (ph > 8.5 || ph < 6.0) {
        anomalyScore = Math.max(anomalyScore, 0.70);
        type = type == AnomalyType.none ? AnomalyType.qualityAnomaly : type;
      }
    }
    
    return AnomalyResult(
      isAnomaly: anomalyScore > 0.6,
      confidence: anomalyScore,
      type: type,
    );
  }

  // Simulate consumption prediction (replace with actual model inference)
  Future<ConsumptionPrediction> _runConsumptionPrediction(Float32List inputData) async {
    // Simulate processing delay
    await Future.delayed(const Duration(milliseconds: 150));
    
    // Calculate average consumption rate
    double totalConsumption = 0.0;
    int nonZeroCount = 0;
    
    for (double value in inputData) {
      if (value > 0) {
        totalConsumption += value;
        nonZeroCount++;
      }
    }
    
    final avgConsumption = nonZeroCount > 0 ? totalConsumption / nonZeroCount : 5.0;
    
    // Predict next hour consumption (with some variation)
    final nextHourConsumption = avgConsumption * (0.8 + (DateTime.now().hour % 5) * 0.1);
    
    // Predict daily consumption
    final dailyConsumption = avgConsumption * 24 * 0.8; // Account for usage patterns
    
    // Determine trend
    final recentAvg = inputData.take(6).fold(0.0, (sum, val) => sum + val) / 6;
    final olderAvg = inputData.skip(12).take(6).fold(0.0, (sum, val) => sum + val) / 6;
    
    ConsumptionTrend trend;
    if (recentAvg > olderAvg * 1.1) {
      trend = ConsumptionTrend.increasing;
    } else if (recentAvg < olderAvg * 0.9) {
      trend = ConsumptionTrend.decreasing;
    } else {
      trend = ConsumptionTrend.stable;
    }
    
    return ConsumptionPrediction(
      nextHourConsumption: nextHourConsumption * 10, // Convert to liters
      dailyConsumption: dailyConsumption * 10,
      weeklyTrend: trend,
      confidence: 0.82,
    );
  }

  // Calculate motor efficiency
  double _calculateMotorEfficiency(List<MotorEvent> motorEvents, List<TankReading> tankReadings) {
    // Simple efficiency calculation based on runtime vs water pumped
    final runEvents = motorEvents.where((e) => e.action == 'start').length;
    final totalRuntime = _calculateTotalRuntime(motorEvents);
    
    if (totalRuntime.inMinutes == 0) return 0.0;
    
    // Estimate water pumped (simplified)
    final waterPumped = runEvents * 150.0; // Assume 150L per cycle average
    final efficiencyRate = waterPumped / (totalRuntime.inHours + 1);
    
    return (efficiencyRate / 200.0 * 100).clamp(0.0, 100.0); // Normalize to percentage
  }

  // Estimate energy usage
  double _estimateEnergyUsage(List<MotorEvent> motorEvents) {
    final totalRuntime = _calculateTotalRuntime(motorEvents);
    // Assume 1.5 kW motor
    return totalRuntime.inHours * 1.5;
  }

  // Assess maintenance needs
  bool _assessMaintenanceNeeds(List<MotorEvent> motorEvents) {
    final totalRuntime = _calculateTotalRuntime(motorEvents);
    final runCycles = motorEvents.where((e) => e.action == 'start').length;
    
    // Simple maintenance indicators
    return totalRuntime.inHours > 100 || runCycles > 50;
  }

  // Generate motor insights
  List<String> _generateMotorInsights(List<MotorEvent> motorEvents, List<TankReading> tankReadings) {
    final insights = <String>[];
    
    final totalRuntime = _calculateTotalRuntime(motorEvents);
    final runCycles = motorEvents.where((e) => e.action == 'start').length;
    final autoEvents = motorEvents.where((e) => e.mode == 'auto').length;
    
    if (totalRuntime.inHours > 8) {
      insights.add('High motor usage detected. Consider checking for leaks.');
    }
    
    if (runCycles > 20) {
      insights.add('Frequent motor cycles detected. Tank levels may be unstable.');
    }
    
    if (autoEvents < motorEvents.length * 0.7) {
      insights.add('Consider using auto mode more often for better efficiency.');
    }
    
    if (insights.isEmpty) {
      insights.add('Motor operating within normal parameters.');
    }
    
    return insights;
  }

  // Helper method to calculate total runtime
  Duration _calculateTotalRuntime(List<MotorEvent> events) {
    Duration totalRuntime = Duration.zero;
    DateTime? lastStartTime;
    
    for (final event in events.reversed) {
      if (event.action == 'start') {
        lastStartTime = event.timestamp;
      } else if (event.action == 'stop' && lastStartTime != null) {
        totalRuntime += event.timestamp.difference(lastStartTime);
        lastStartTime = null;
      }
    }
    
    return totalRuntime;
  }

  // Clean up resources
  void dispose() {
    _anomalyDetectionModel?.close();
    _consumptionPredictionModel?.close();
    _isInitialized = false;
  }
}

// Data classes for ML results
class AnomalyResult {
  final bool isAnomaly;
  final double confidence;
  final AnomalyType type;
  
  AnomalyResult({
    required this.isAnomaly,
    required this.confidence,
    required this.type,
  });
}

class ConsumptionPrediction {
  final double nextHourConsumption;
  final double dailyConsumption;
  final ConsumptionTrend weeklyTrend;
  final double confidence;
  
  ConsumptionPrediction({
    required this.nextHourConsumption,
    required this.dailyConsumption,
    required this.weeklyTrend,
    required this.confidence,
  });
}

class MotorEfficiencyAnalysis {
  final double efficiency;
  final double energyUsage;
  final bool recommendedMaintenance;
  final List<String> insights;
  
  MotorEfficiencyAnalysis({
    required this.efficiency,
    required this.energyUsage,
    required this.recommendedMaintenance,
    required this.insights,
  });
}

enum AnomalyType {
  none,
  rapidLevelChange,
  temperatureAnomaly,
  qualityAnomaly,
  sensorMalfunction,
}

enum ConsumptionTrend {
  increasing,
  decreasing,
  stable,
}
