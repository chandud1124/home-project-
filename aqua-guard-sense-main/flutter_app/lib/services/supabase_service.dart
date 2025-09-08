import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';
import '../models/tank_reading.dart';
import '../models/motor_event.dart';
import '../models/system_alert.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();
  
  SupabaseClient get client => Supabase.instance.client;
  
  // Initialize Supabase connection
  static Future<void> initialize() async {
    try {
      await Supabase.initialize(
        url: const String.fromEnvironment('SUPABASE_URL'),
        anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
      );
      if (kDebugMode) {
        print('Supabase initialized successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error initializing Supabase: $e');
      }
      throw Exception('Failed to initialize Supabase: $e');
    }
  }
  
  // Authentication (if needed for device-specific access)
  Future<bool> signInAnonymously() async {
    try {
      final response = await client.auth.signInAnonymously();
      return response.user != null;
    } catch (e) {
      if (kDebugMode) {
        print('Anonymous sign in error: $e');
      }
      return false;
    }
  }
  
  // Tank readings streams and operations
  Stream<List<TankReading>> getTankReadingsStream({String? deviceId}) {
    var query = client
        .from('tank_readings')
        .select('*')
        .order('timestamp', ascending: false);
    
    if (deviceId != null) {
      query = query.eq('device_id', deviceId);
    }
    
    return query
        .asStream()
        .map((data) => data
            .map((json) => TankReading.fromJson(json))
            .toList());
  }
  
  Future<List<TankReading>> getLatestTankReadings({
    String? deviceId,
    int limit = 50,
  }) async {
    try {
      var query = client
          .from('tank_readings')
          .select('*')
          .order('timestamp', ascending: false)
          .limit(limit);
      
      if (deviceId != null) {
        query = query.eq('device_id', deviceId);
      }
      
      final data = await query;
      return data.map((json) => TankReading.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching tank readings: $e');
      }
      return [];
    }
  }
  
  Future<TankReading?> getLatestReading(String deviceId) async {
    try {
      final data = await client
          .from('tank_readings')
          .select('*')
          .eq('device_id', deviceId)
          .order('timestamp', ascending: false)
          .limit(1)
          .single();
      
      return TankReading.fromJson(data);
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching latest reading for $deviceId: $e');
      }
      return null;
    }
  }
  
  Future<bool> insertTankReading(TankReading reading) async {
    try {
      await client
          .from('tank_readings')
          .insert(reading.toJson());
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('Error inserting tank reading: $e');
      }
      return false;
    }
  }
  
  // Motor events streams and operations
  Stream<List<MotorEvent>> getMotorEventsStream({String? deviceId}) {
    var query = client
        .from('motor_events')
        .select('*')
        .order('timestamp', ascending: false);
    
    if (deviceId != null) {
      query = query.eq('device_id', deviceId);
    }
    
    return query
        .asStream()
        .map((data) => data
            .map((json) => MotorEvent.fromJson(json))
            .toList());
  }
  
  Future<List<MotorEvent>> getMotorEvents({
    String? deviceId,
    int limit = 100,
  }) async {
    try {
      var query = client
          .from('motor_events')
          .select('*')
          .order('timestamp', ascending: false)
          .limit(limit);
      
      if (deviceId != null) {
        query = query.eq('device_id', deviceId);
      }
      
      final data = await query;
      return data.map((json) => MotorEvent.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching motor events: $e');
      }
      return [];
    }
  }
  
  Future<bool> insertMotorEvent(MotorEvent event) async {
    try {
      await client
          .from('motor_events')
          .insert(event.toJson());
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('Error inserting motor event: $e');
      }
      return false;
    }
  }
  
  // System alerts streams and operations
  Stream<List<SystemAlert>> getActiveAlertsStream() {
    return client
        .from('system_alerts')
        .select('*')
        .eq('resolved', false)
        .order('timestamp', ascending: false)
        .asStream()
        .map((data) => data
            .map((json) => SystemAlert.fromJson(json))
            .toList());
  }
  
  Future<List<SystemAlert>> getAlerts({
    bool? resolved,
    String? severity,
    int limit = 50,
  }) async {
    try {
      var query = client
          .from('system_alerts')
          .select('*')
          .order('timestamp', ascending: false)
          .limit(limit);
      
      if (resolved != null) {
        query = query.eq('resolved', resolved);
      }
      
      if (severity != null) {
        query = query.eq('severity', severity);
      }
      
      final data = await query;
      return data.map((json) => SystemAlert.fromJson(json)).toList();
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching alerts: $e');
      }
      return [];
    }
  }
  
  Future<bool> resolveAlert(int alertId) async {
    try {
      await client
          .from('system_alerts')
          .update({'resolved': true, 'resolved_at': DateTime.now().toIso8601String()})
          .eq('id', alertId);
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('Error resolving alert: $e');
      }
      return false;
    }
  }
  
  Future<bool> createAlert({
    required String type,
    required String title,
    required String message,
    String? severity,
    String? esp32Id,
  }) async {
    try {
      await client
          .from('system_alerts')
          .insert({
            'type': type,
            'title': title,
            'message': message,
            'severity': severity ?? 'medium',
            'esp32_id': esp32Id,
            'resolved': false,
            'timestamp': DateTime.now().toIso8601String(),
          });
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('Error creating alert: $e');
      }
      return false;
    }
  }
  
  // Device status operations
  Future<Map<String, dynamic>?> getDeviceStatus(String deviceId) async {
    try {
      final data = await client
          .from('device_status')
          .select('*')
          .eq('device_id', deviceId)
          .single();
      
      return data;
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching device status: $e');
      }
      return null;
    }
  }
  
  Future<Map<String, bool>> getAllDevicesStatus() async {
    try {
      final data = await client
          .from('device_status')
          .select('device_id, is_online');
      
      final Map<String, bool> deviceStatus = {};
      for (final item in data) {
        deviceStatus[item['device_id']] = item['is_online'] ?? false;
      }
      
      return deviceStatus;
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching all device status: $e');
      }
      return {};
    }
  }
  
  // Real-time subscriptions
  RealtimeChannel subscribeToTankReadings({
    String? deviceId,
    required Function(List<TankReading>) onData,
  }) {
    final channel = client
        .channel('tank_readings_${deviceId ?? 'all'}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'tank_readings',
          filter: deviceId != null 
              ? PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'device_id', value: deviceId)
              : null,
          callback: (payload) async {
            // Fetch updated data and call onData
            final readings = await getLatestTankReadings(deviceId: deviceId);
            onData(readings);
          },
        )
        .subscribe();
    
    return channel;
  }
  
  RealtimeChannel subscribeToAlerts({
    required Function(List<SystemAlert>) onData,
  }) {
    final channel = client
        .channel('system_alerts')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'system_alerts',
          callback: (payload) async {
            // Fetch updated alerts and call onData
            final alerts = await getAlerts(resolved: false);
            onData(alerts);
          },
        )
        .subscribe();
    
    return channel;
  }
  
  // Clean up resources
  void dispose() {
    client.removeAllChannels();
  }
}
