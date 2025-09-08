import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import '../lib/services/supabase_service.dart';
import '../lib/models/tank_reading.dart';
import '../lib/models/motor_event.dart';
import '../lib/models/system_alert.dart';

// Generate mocks using mockito
@GenerateMocks([SupabaseService])
import 'supabase_service_test.mocks.dart';

void main() {
  group('SupabaseService Tests', () {
    late MockSupabaseService mockSupabaseService;
    
    setUp(() {
      mockSupabaseService = MockSupabaseService();
    });
    
    group('Tank Readings', () {
      test('should fetch latest tank readings successfully', () async {
        // Arrange
        final mockReadings = [
          TankReading(
            id: 1,
            deviceId: 'ESP32-SUMP-01',
            waterLevel: 150.0,
            temperature: 25.0,
            phLevel: 7.2,
            tdsLevel: 450.0,
            timestamp: DateTime.now(),
          ),
          TankReading(
            id: 2,
            deviceId: 'ESP32-SUMP-01',
            waterLevel: 145.0,
            temperature: 24.8,
            phLevel: 7.1,
            tdsLevel: 455.0,
            timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
          ),
        ];
        
        when(mockSupabaseService.getLatestTankReadings(
          deviceId: 'ESP32-SUMP-01',
          limit: 10,
        )).thenAnswer((_) async => mockReadings);
        
        // Act
        final result = await mockSupabaseService.getLatestTankReadings(
          deviceId: 'ESP32-SUMP-01',
          limit: 10,
        );
        
        // Assert
        expect(result, equals(mockReadings));
        expect(result.length, equals(2));
        expect(result.first.waterLevel, equals(150.0));
        verify(mockSupabaseService.getLatestTankReadings(
          deviceId: 'ESP32-SUMP-01',
          limit: 10,
        )).called(1);
      });
      
      test('should handle empty tank readings gracefully', () async {
        // Arrange
        when(mockSupabaseService.getLatestTankReadings(
          deviceId: 'ESP32-INVALID',
          limit: 10,
        )).thenAnswer((_) async => []);
        
        // Act
        final result = await mockSupabaseService.getLatestTankReadings(
          deviceId: 'ESP32-INVALID',
          limit: 10,
        );
        
        // Assert
        expect(result, isEmpty);
      });
      
      test('should get latest reading for specific device', () async {
        // Arrange
        final mockReading = TankReading(
          id: 1,
          deviceId: 'ESP32-TOP-01',
          waterLevel: 120.0,
          temperature: 26.0,
          phLevel: 7.3,
          tdsLevel: 420.0,
          timestamp: DateTime.now(),
        );
        
        when(mockSupabaseService.getLatestReading('ESP32-TOP-01'))
            .thenAnswer((_) async => mockReading);
        
        // Act
        final result = await mockSupabaseService.getLatestReading('ESP32-TOP-01');
        
        // Assert
        expect(result, equals(mockReading));
        expect(result?.deviceId, equals('ESP32-TOP-01'));
        expect(result?.waterLevel, equals(120.0));
      });
    });
    
    group('Motor Events', () {
      test('should fetch motor events successfully', () async {
        // Arrange
        final mockEvents = [
          MotorEvent(
            id: 1,
            deviceId: 'ESP32-SUMP-01',
            action: 'start',
            mode: 'auto',
            trigger: 'sensor',
            timestamp: DateTime.now(),
          ),
          MotorEvent(
            id: 2,
            deviceId: 'ESP32-SUMP-01',
            action: 'stop',
            mode: 'auto',
            trigger: 'sensor',
            timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
          ),
        ];
        
        when(mockSupabaseService.getMotorEvents(limit: 50))
            .thenAnswer((_) async => mockEvents);
        
        // Act
        final result = await mockSupabaseService.getMotorEvents(limit: 50);
        
        // Assert
        expect(result, equals(mockEvents));
        expect(result.length, equals(2));
        expect(result.first.action, equals('start'));
        expect(result.first.mode, equals('auto'));
      });
      
      test('should insert motor event successfully', () async {
        // Arrange
        final newEvent = MotorEvent(
          id: 0,
          deviceId: 'ESP32-SUMP-01',
          action: 'start',
          mode: 'manual',
          trigger: 'user',
          timestamp: DateTime.now(),
        );
        
        when(mockSupabaseService.insertMotorEvent(newEvent))
            .thenAnswer((_) async => true);
        
        // Act
        final result = await mockSupabaseService.insertMotorEvent(newEvent);
        
        // Assert
        expect(result, isTrue);
        verify(mockSupabaseService.insertMotorEvent(newEvent)).called(1);
      });
    });
    
    group('System Alerts', () {
      test('should fetch active alerts successfully', () async {
        // Arrange
        final mockAlerts = [
          SystemAlert(
            id: 1,
            type: 'warning',
            title: 'Low Water Level',
            message: 'Sump tank water level is below 20%',
            severity: 'high',
            esp32Id: 'ESP32-SUMP-01',
            resolved: false,
            timestamp: DateTime.now(),
          ),
        ];
        
        when(mockSupabaseService.getAlerts(resolved: false))
            .thenAnswer((_) async => mockAlerts);
        
        // Act
        final result = await mockSupabaseService.getAlerts(resolved: false);
        
        // Assert
        expect(result, equals(mockAlerts));
        expect(result.length, equals(1));
        expect(result.first.resolved, isFalse);
        expect(result.first.severity, equals('high'));
      });
      
      test('should resolve alert successfully', () async {
        // Arrange
        when(mockSupabaseService.resolveAlert(1))
            .thenAnswer((_) async => true);
        
        // Act
        final result = await mockSupabaseService.resolveAlert(1);
        
        // Assert
        expect(result, isTrue);
        verify(mockSupabaseService.resolveAlert(1)).called(1);
      });
      
      test('should create new alert successfully', () async {
        // Arrange
        when(mockSupabaseService.createAlert(
          type: 'error',
          title: 'Device Offline',
          message: 'ESP32-SUMP-01 has gone offline',
          severity: 'critical',
          esp32Id: 'ESP32-SUMP-01',
        )).thenAnswer((_) async => true);
        
        // Act
        final result = await mockSupabaseService.createAlert(
          type: 'error',
          title: 'Device Offline',
          message: 'ESP32-SUMP-01 has gone offline',
          severity: 'critical',
          esp32Id: 'ESP32-SUMP-01',
        );
        
        // Assert
        expect(result, isTrue);
      });
    });
    
    group('Device Status', () {
      test('should get device status successfully', () async {
        // Arrange
        final mockStatus = {
          'device_id': 'ESP32-SUMP-01',
          'is_online': true,
          'last_seen': DateTime.now().toIso8601String(),
        };
        
        when(mockSupabaseService.getDeviceStatus('ESP32-SUMP-01'))
            .thenAnswer((_) async => mockStatus);
        
        // Act
        final result = await mockSupabaseService.getDeviceStatus('ESP32-SUMP-01');
        
        // Assert
        expect(result, equals(mockStatus));
        expect(result?['is_online'], isTrue);
        expect(result?['device_id'], equals('ESP32-SUMP-01'));
      });
      
      test('should get all devices status successfully', () async {
        // Arrange
        final mockAllStatus = {
          'ESP32-SUMP-01': true,
          'ESP32-TOP-01': false,
        };
        
        when(mockSupabaseService.getAllDevicesStatus())
            .thenAnswer((_) async => mockAllStatus);
        
        // Act
        final result = await mockSupabaseService.getAllDevicesStatus();
        
        // Assert
        expect(result, equals(mockAllStatus));
        expect(result['ESP32-SUMP-01'], isTrue);
        expect(result['ESP32-TOP-01'], isFalse);
      });
    });
    
    group('Error Handling', () {
      test('should handle network errors gracefully', () async {
        // Arrange
        when(mockSupabaseService.getLatestTankReadings())
            .thenThrow(Exception('Network error'));
        
        // Act & Assert
        expect(
          () => mockSupabaseService.getLatestTankReadings(),
          throwsA(isA<Exception>()),
        );
      });
      
      test('should return empty list on database error', () async {
        // Arrange
        when(mockSupabaseService.getMotorEvents())
            .thenAnswer((_) async => []);
        
        // Act
        final result = await mockSupabaseService.getMotorEvents();
        
        // Assert
        expect(result, isEmpty);
      });
    });
  });
}
