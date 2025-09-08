import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/tank_reading.dart';
import '../models/motor_event.dart';
import '../models/system_alert.dart';
import '../services/supabase_service.dart';
import '../services/api_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class TankDataProvider with ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();
  
  // Tank readings data
  List<TankReading> _sumpTankReadings = [];
  List<TankReading> _topTankReadings = [];
  TankReading? _latestSumpReading;
  TankReading? _latestTopReading;
  
  // Loading states
  bool _isLoadingSumpData = false;
  bool _isLoadingTopData = false;
  
  // Real-time subscriptions
  RealtimeChannel? _sumpSubscription;
  RealtimeChannel? _topSubscription;
  
  // Getters
  List<TankReading> get sumpTankReadings => _sumpTankReadings;
  List<TankReading> get topTankReadings => _topTankReadings;
  TankReading? get latestSumpReading => _latestSumpReading;
  TankReading? get latestTopReading => _latestTopReading;
  bool get isLoadingSumpData => _isLoadingSumpData;
  bool get isLoadingTopData => _isLoadingTopData;
  
  // Device IDs (should match your ESP32 device configurations)
  static const String sumpDeviceId = 'ESP32-SUMP-01';
  static const String topDeviceId = 'ESP32-TOP-01';
  
  // Initialize data and subscriptions
  Future<void> initialize() async {
    await _loadInitialData();
    _setupRealtimeSubscriptions();
  }
  
  Future<void> _loadInitialData() async {
    _isLoadingSumpData = true;
    _isLoadingTopData = true;
    notifyListeners();
    
    try {
      // Load sump tank data
      final sumpReadings = await _supabaseService.getLatestTankReadings(
        deviceId: sumpDeviceId,
        limit: 100,
      );
      _sumpTankReadings = sumpReadings;
      _latestSumpReading = sumpReadings.isNotEmpty ? sumpReadings.first : null;
      
      // Load top tank data
      final topReadings = await _supabaseService.getLatestTankReadings(
        deviceId: topDeviceId,
        limit: 100,
      );
      _topTankReadings = topReadings;
      _latestTopReading = topReadings.isNotEmpty ? topReadings.first : null;
      
    } catch (e) {
      debugPrint('Error loading initial tank data: $e');
    } finally {
      _isLoadingSumpData = false;
      _isLoadingTopData = false;
      notifyListeners();
    }
  }
  
  void _setupRealtimeSubscriptions() {
    // Subscribe to sump tank readings
    _sumpSubscription = _supabaseService.subscribeToTankReadings(
      deviceId: sumpDeviceId,
      onData: (readings) {
        _sumpTankReadings = readings;
        _latestSumpReading = readings.isNotEmpty ? readings.first : null;
        notifyListeners();
      },
    );
    
    // Subscribe to top tank readings
    _topSubscription = _supabaseService.subscribeToTankReadings(
      deviceId: topDeviceId,
      onData: (readings) {
        _topTankReadings = readings;
        _latestTopReading = readings.isNotEmpty ? readings.first : null;
        notifyListeners();
      },
    );
  }
  
  // Get historical data for charts
  List<TankReading> getSumpReadingsForPeriod(Duration period) {
    final cutoff = DateTime.now().subtract(period);
    return _sumpTankReadings
        .where((reading) => reading.timestamp.isAfter(cutoff))
        .toList();
  }
  
  List<TankReading> getTopReadingsForPeriod(Duration period) {
    final cutoff = DateTime.now().subtract(period);
    return _topTankReadings
        .where((reading) => reading.timestamp.isAfter(cutoff))
        .toList();
  }
  
  // Calculate water level percentages
  double getSumpWaterLevelPercentage() {
    if (_latestSumpReading == null) return 0.0;
    
    // Assuming tank height is 200cm and sensor at bottom
    const double tankHeight = 200.0;
    final double waterLevel = _latestSumpReading!.waterLevel;
    
    return (waterLevel / tankHeight * 100).clamp(0.0, 100.0);
  }
  
  double getTopWaterLevelPercentage() {
    if (_latestTopReading == null) return 0.0;
    
    // Assuming tank height is 150cm for top tank
    const double tankHeight = 150.0;
    final double waterLevel = _latestTopReading!.waterLevel;
    
    return (waterLevel / tankHeight * 100).clamp(0.0, 100.0);
  }
  
  // Get tank status based on water level
  TankStatus getSumpTankStatus() {
    final percentage = getSumpWaterLevelPercentage();
    if (percentage < 10) return TankStatus.critical;
    if (percentage < 25) return TankStatus.low;
    if (percentage < 75) return TankStatus.normal;
    return TankStatus.full;
  }
  
  TankStatus getTopTankStatus() {
    final percentage = getTopWaterLevelPercentage();
    if (percentage < 10) return TankStatus.critical;
    if (percentage < 25) return TankStatus.low;
    if (percentage < 75) return TankStatus.normal;
    return TankStatus.full;
  }
  
  // Get device connection status
  bool get isSumpDeviceOnline {
    if (_latestSumpReading == null) return false;
    final timeDiff = DateTime.now().difference(_latestSumpReading!.timestamp);
    return timeDiff.inMinutes < 5; // Consider offline if no data for 5 minutes
  }
  
  bool get isTopDeviceOnline {
    if (_latestTopReading == null) return false;
    final timeDiff = DateTime.now().difference(_latestTopReading!.timestamp);
    return timeDiff.inMinutes < 5; // Consider offline if no data for 5 minutes
  }
  
  // Refresh data manually
  Future<void> refreshData() async {
    await _loadInitialData();
  }
  
  // Test local backend connectivity
  Future<bool> testBackendConnection() async {
    return await ApiService.testConnection();
  }
  
  // Load data from local backend (for development/testing)
  Future<void> loadFromLocalBackend() async {
    try {
      final readings = await ApiService.getTankReadings();
      
      // Separate readings by tank type
      _sumpTankReadings = readings.where((r) => r.isSumpTank).toList();
      _topTankReadings = readings.where((r) => r.isTopTank).toList();
      
      // Update latest readings
      _latestSumpReading = _sumpTankReadings.isNotEmpty ? _sumpTankReadings.first : null;
      _latestTopReading = _topTankReadings.isNotEmpty ? _topTankReadings.first : null;
      
      notifyListeners();
    } catch (e) {
      print('Error loading from local backend: $e');
    }
  }
  
  // Send test data to local backend
  Future<bool> sendTestData() async {
    final sumpData = {
      'device_id': 'SUMP_TANK',
      'level_percentage': 75.5,
      'level_liters': 998.8,
      'sensor_health': 'good',
      'battery_voltage': 4.1,
      'signal_strength': -65,
      'float_switch': false,
      'motor_running': false,
    };
    
    final topData = {
      'device_id': 'TOP_TANK', 
      'level_percentage': 45.0,
      'level_liters': 450.0,
      'sensor_health': 'good',
      'battery_voltage': 3.9,
      'signal_strength': -72,
      'float_switch': true,
      'motor_running': false,
    };
    
    final sumpSuccess = await ApiService.sendTankData(sumpData);
    final topSuccess = await ApiService.sendTankData(topData);
    
    if (sumpSuccess && topSuccess) {
      await loadFromLocalBackend(); // Refresh data after sending
    }
    
    return sumpSuccess && topSuccess;
  }
  
  @override
  void dispose() {
    _sumpSubscription?.unsubscribe();
    _topSubscription?.unsubscribe();
    super.dispose();
  }
}

class MotorControlProvider with ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();
  
  List<MotorEvent> _motorEvents = [];
  bool _isMotorRunning = false;
  bool _isAutoMode = true;
  bool _isLoadingEvents = false;
  
  // Real-time subscription
  RealtimeChannel? _motorEventsSubscription;
  
  // Getters
  List<MotorEvent> get motorEvents => _motorEvents;
  bool get isMotorRunning => _isMotorRunning;
  bool get isAutoMode => _isAutoMode;
  bool get isLoadingEvents => _isLoadingEvents;
  
  Future<void> initialize() async {
    await _loadMotorEvents();
    _setupMotorEventsSubscription();
  }
  
  Future<void> _loadMotorEvents() async {
    _isLoadingEvents = true;
    notifyListeners();
    
    try {
      final events = await _supabaseService.getMotorEvents(limit: 50);
      _motorEvents = events;
      
      // Determine current motor status from latest event
      if (events.isNotEmpty) {
        final latestEvent = events.first;
        _isMotorRunning = latestEvent.action == 'start';
        _isAutoMode = latestEvent.mode == 'auto';
      }
    } catch (e) {
      debugPrint('Error loading motor events: $e');
    } finally {
      _isLoadingEvents = false;
      notifyListeners();
    }
  }
  
  void _setupMotorEventsSubscription() {
    _motorEventsSubscription = _supabaseService.getMotorEventsStream().listen(
      (events) {
        _motorEvents = events;
        
        if (events.isNotEmpty) {
          final latestEvent = events.first;
          _isMotorRunning = latestEvent.action == 'start';
          _isAutoMode = latestEvent.mode == 'auto';
        }
        
        notifyListeners();
      },
    ) as RealtimeChannel?;
  }
  
  // Motor control actions
  Future<bool> startMotor({bool isAutoMode = false}) async {
    try {
      final event = MotorEvent.fromAction(
        id: 0, // Will be auto-generated by database
        deviceId: TankDataProvider.sumpDeviceId,
        action: 'start',
        mode: isAutoMode ? 'auto' : 'manual',
        trigger: isAutoMode ? 'sensor' : 'user',
        timestamp: DateTime.now(),
      );
      
      final success = await _supabaseService.insertMotorEvent(event);
      
      if (success) {
        _isMotorRunning = true;
        _isAutoMode = isAutoMode;
        notifyListeners();
      }
      
      return success;
    } catch (e) {
      debugPrint('Error starting motor: $e');
      return false;
    }
  }
  
  Future<bool> stopMotor({bool isAutoMode = false}) async {
    try {
      final event = MotorEvent.fromAction(
        id: 0, // Will be auto-generated by database
        deviceId: TankDataProvider.sumpDeviceId,
        action: 'stop',
        mode: isAutoMode ? 'auto' : 'manual',
        trigger: isAutoMode ? 'sensor' : 'user',
        timestamp: DateTime.now(),
      );
      
      final success = await _supabaseService.insertMotorEvent(event);
      
      if (success) {
        _isMotorRunning = false;
        _isAutoMode = isAutoMode;
        notifyListeners();
      }
      
      return success;
    } catch (e) {
      debugPrint('Error stopping motor: $e');
      return false;
    }
  }
  
  Future<bool> toggleAutoMode(bool autoMode) async {
    try {
      final event = MotorEvent.fromAction(
        id: 0,
        deviceId: TankDataProvider.sumpDeviceId,
        action: 'mode_change',
        mode: autoMode ? 'auto' : 'manual',
        trigger: 'user',
        timestamp: DateTime.now(),
      );
      
      final success = await _supabaseService.insertMotorEvent(event);
      
      if (success) {
        _isAutoMode = autoMode;
        notifyListeners();
      }
      
      return success;
    } catch (e) {
      debugPrint('Error toggling auto mode: $e');
      return false;
    }
  }
  
  // Get motor runtime statistics
  Duration getMotorRuntimeToday() {
    final today = DateTime.now();
    final startOfDay = DateTime(today.year, today.month, today.day);
    
    final todayEvents = _motorEvents
        .where((event) => event.timestamp.isAfter(startOfDay))
        .toList();
    
    Duration totalRuntime = Duration.zero;
    DateTime? lastStartTime;
    
    // Calculate runtime from events (newest to oldest)
    for (final event in todayEvents.reversed) {
      if (event.action == 'start') {
        lastStartTime = event.timestamp;
      } else if (event.action == 'stop' && lastStartTime != null) {
        totalRuntime += event.timestamp.difference(lastStartTime);
        lastStartTime = null;
      }
    }
    
    // If motor is currently running, add time since last start
    if (_isMotorRunning && lastStartTime != null) {
      totalRuntime += DateTime.now().difference(lastStartTime);
    }
    
    return totalRuntime;
  }
  
  @override
  void dispose() {
    _motorEventsSubscription?.unsubscribe();
    super.dispose();
  }
}

class AlertsProvider with ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();
  
  List<SystemAlert> _activeAlerts = [];
  List<SystemAlert> _allAlerts = [];
  bool _isLoadingAlerts = false;
  
  // Real-time subscription
  RealtimeChannel? _alertsSubscription;
  
  // Getters
  List<SystemAlert> get activeAlerts => _activeAlerts;
  List<SystemAlert> get allAlerts => _allAlerts;
  bool get isLoadingAlerts => _isLoadingAlerts;
  
  int get criticalAlertsCount => 
      _activeAlerts.where((alert) => alert.severityLevel == AlertSeverity.critical).length;
  
  int get highAlertsCount => 
      _activeAlerts.where((alert) => alert.severityLevel == AlertSeverity.high).length;
  
  Future<void> initialize() async {
    await _loadAlerts();
    _setupAlertsSubscription();
  }
  
  Future<void> _loadAlerts() async {
    _isLoadingAlerts = true;
    notifyListeners();
    
    try {
      // Load active alerts
      final activeAlerts = await _supabaseService.getAlerts(resolved: false);
      _activeAlerts = activeAlerts;
      
      // Load all recent alerts
      final allAlerts = await _supabaseService.getAlerts(limit: 100);
      _allAlerts = allAlerts;
      
    } catch (e) {
      debugPrint('Error loading alerts: $e');
    } finally {
      _isLoadingAlerts = false;
      notifyListeners();
    }
  }
  
  void _setupAlertsSubscription() {
    _alertsSubscription = _supabaseService.subscribeToAlerts(
      onData: (alerts) {
        _activeAlerts = alerts;
        notifyListeners();
      },
    );
  }
  
  Future<bool> resolveAlert(int alertId) async {
    try {
      final success = await _supabaseService.resolveAlert(alertId);
      
      if (success) {
        _activeAlerts.removeWhere((alert) => alert.id == alertId);
        notifyListeners();
      }
      
      return success;
    } catch (e) {
      debugPrint('Error resolving alert: $e');
      return false;
    }
  }
  
  Future<bool> createAlert({
    required String type,
    required String title,
    required String message,
    String? severity,
    String? deviceId,
  }) async {
    try {
      return await _supabaseService.createAlert(
        type: type,
        title: title,
        message: message,
        severity: severity,
        esp32Id: deviceId,
      );
    } catch (e) {
      debugPrint('Error creating alert: $e');
      return false;
    }
  }
  
  @override
  void dispose() {
    _alertsSubscription?.unsubscribe();
    super.dispose();
  }
}

enum TankStatus {
  critical,
  low,
  normal,
  full,
}
