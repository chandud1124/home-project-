import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/tank_reading.dart';
import '../models/motor_event.dart';
import '../models/system_alert.dart';

class ApiService {
  // Cloud configuration - using Supabase as primary backend
  static const String supabaseUrl = 'https://dwcouaacpqipvvsxiygo.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4';
  
  // Use cloud endpoints for production
  static const String baseUrl = supabaseUrl;
  static const String websocketUrl = 'wss://dwcouaacpqipvvsxiygo.supabase.co/functions/v1/websocket';
  
  // Test if cloud backend is reachable
  static Future<bool> testConnection() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/rest/v1/tank_readings?select=count'),
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': 'Bearer $supabaseAnonKey',
          'Content-Type': 'application/json',
        },
      ).timeout(const Duration(seconds: 10));
      
      return response.statusCode == 200;
    } catch (e) {
      print('Cloud backend connection test failed: $e');
      return false;
    }
  }
  
  // Get latest tank readings
  static Future<List<TankReading>> getTankReadings() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/tanks'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => TankReading.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load tank readings: ${response.statusCode}');
      }
    } catch (e) {
      print('Error fetching tank readings: $e');
      return [];
    }
  }

  // Get latest reading for specific tank
  static Future<TankReading?> getTankReading(String tankType) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/tanks/$tankType/latest'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return TankReading.fromJson(data);
      } else {
        return null;
      }
    } catch (e) {
      print('Error fetching $tankType tank reading: $e');
      return null;
    }
  }

  // Send motor event
  static Future<bool> sendMotorEvent(MotorEvent event) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/motor-events'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(event.toJson()),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Error sending motor event: $e');
      return false;
    }
  }

  // Get motor events
  static Future<List<MotorEvent>> getMotorEvents({int limit = 50}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/motor-events?limit=$limit'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => MotorEvent.fromJson(json)).toList();
      } else {
        return [];
      }
    } catch (e) {
      print('Error fetching motor events: $e');
      return [];
    }
  }

  // Get system alerts
  static Future<List<SystemAlert>> getSystemAlerts({bool activeOnly = false}) async {
    try {
      final queryParams = activeOnly ? '?active=true' : '';
      final response = await http.get(
        Uri.parse('$baseUrl/api/alerts$queryParams'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => SystemAlert.fromJson(json)).toList();
      } else {
        return [];
      }
    } catch (e) {
      print('Error fetching system alerts: $e');
      return [];
    }
  }

  // Send ESP32-style tank data (for testing)
  static Future<bool> sendTankData(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/esp32/tank-data'),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': data['device_id'] ?? 'SUMP_TANK',
        },
        body: json.encode(data),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Error sending tank data: $e');
      return false;
    }
  }
}
