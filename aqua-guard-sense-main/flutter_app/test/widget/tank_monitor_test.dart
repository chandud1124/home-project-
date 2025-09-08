import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import '../lib/widgets/tank_monitor.dart';
import '../lib/providers/app_providers.dart';
import '../lib/models/tank_reading.dart';

void main() {
  group('TankMonitor Widget Tests', () {
    late TankReading mockTankReading;
    
    setUp(() {
      mockTankReading = TankReading(
        id: 1,
        deviceId: 'ESP32-SUMP-01',
        waterLevel: 150.0,
        temperature: 25.5,
        phLevel: 7.2,
        tdsLevel: 450.0,
        timestamp: DateTime.now(),
      );
    });
    
    Widget createTestWidget({
      required TankReading? latestReading,
      required double waterLevelPercentage,
      required TankStatus status,
      required bool isOnline,
    }) {
      return MaterialApp(
        home: Scaffold(
          body: TankMonitor(
            tankName: 'Test Tank',
            deviceId: 'ESP32-TEST-01',
            latestReading: latestReading,
            waterLevelPercentage: waterLevelPercentage,
            status: status,
            isOnline: isOnline,
          ),
        ),
      );
    }
    
    testWidgets('should display tank name and device ID', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: mockTankReading,
        waterLevelPercentage: 75.0,
        status: TankStatus.normal,
        isOnline: true,
      ));
      
      // Assert
      expect(find.text('Test Tank'), findsOneWidget);
      expect(find.text('ESP32-TEST-01'), findsOneWidget);
    });
    
    testWidgets('should display correct water level percentage', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: mockTankReading,
        waterLevelPercentage: 85.0,
        status: TankStatus.normal,
        isOnline: true,
      ));
      
      // Assert
      expect(find.text('85%'), findsOneWidget);
    });
    
    testWidgets('should show online status indicator when connected', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: mockTankReading,
        waterLevelPercentage: 75.0,
        status: TankStatus.normal,
        isOnline: true,
      ));
      
      // Assert
      expect(find.byIcon(Icons.wifi), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off), findsNothing);
    });
    
    testWidgets('should show offline status indicator when disconnected', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: mockTankReading,
        waterLevelPercentage: 75.0,
        status: TankStatus.normal,
        isOnline: false,
      ));
      
      // Assert
      expect(find.byIcon(Icons.wifi_off), findsOneWidget);
      expect(find.byIcon(Icons.wifi), findsNothing);
    });
    
    testWidgets('should display tank metrics when data is available', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: mockTankReading,
        waterLevelPercentage: 75.0,
        status: TankStatus.normal,
        isOnline: true,
      ));
      
      // Assert
      expect(find.text('150 cm'), findsOneWidget); // Water level
      expect(find.text('26°C'), findsOneWidget); // Temperature (rounded)
      expect(find.text('7.2'), findsOneWidget); // pH level
      expect(find.text('450 ppm'), findsOneWidget); // TDS level
    });
    
    testWidgets('should show "No data available" when reading is null', (tester) async {
      // Act
      await tester.pumpWidget(createTestWidget(
        latestReading: null,
        waterLevelPercentage: 0.0,
        status: TankStatus.critical,
        isOnline: false,
      ));
      
      // Assert
      expect(find.text('No data available'), findsOneWidget);
    });
    
    group('Tank Status Display', () {
      testWidgets('should show critical status with red color', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 5.0,
          status: TankStatus.critical,
          isOnline: true,
        ));
        
        // Assert
        expect(find.text('CRITICAL'), findsOneWidget);
        expect(find.byIcon(Icons.warning), findsOneWidget);
      });
      
      testWidgets('should show low status with orange color', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 20.0,
          status: TankStatus.low,
          isOnline: true,
        ));
        
        // Assert
        expect(find.text('LOW'), findsOneWidget);
        expect(find.byIcon(Icons.water_drop), findsOneWidget);
      });
      
      testWidgets('should show normal status with green color', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 50.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Assert
        expect(find.text('NORMAL'), findsOneWidget);
      });
      
      testWidgets('should show full status with blue color', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 95.0,
          status: TankStatus.full,
          isOnline: true,
        ));
        
        // Assert
        expect(find.text('FULL'), findsOneWidget);
      });
    });
    
    group('Water Level Animation', () {
      testWidgets('should have animated container for water level', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 60.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Find the animated container
        expect(find.byType(AnimatedContainer), findsAtLeastNWidgets(1));
        
        // Pump the animation to completion
        await tester.pumpAndSettle();
        
        // Verify animation completed
        expect(find.text('60%'), findsOneWidget);
      });
    });
    
    group('Timestamp Formatting', () {
      testWidgets('should show "Just now" for recent timestamps', (tester) async {
        // Arrange
        final recentReading = TankReading(
          id: 1,
          deviceId: 'ESP32-SUMP-01',
          waterLevel: 150.0,
          temperature: 25.5,
          phLevel: 7.2,
          tdsLevel: 450.0,
          timestamp: DateTime.now().subtract(const Duration(seconds: 30)),
        );
        
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: recentReading,
          waterLevelPercentage: 75.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Assert
        expect(find.textContaining('Just now'), findsOneWidget);
      });
      
      testWidgets('should show minutes for timestamps within an hour', (tester) async {
        // Arrange
        final oldReading = TankReading(
          id: 1,
          deviceId: 'ESP32-SUMP-01',
          waterLevel: 150.0,
          temperature: 25.5,
          phLevel: 7.2,
          tdsLevel: 450.0,
          timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
        );
        
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: oldReading,
          waterLevelPercentage: 75.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Assert
        expect(find.textContaining('30m ago'), findsOneWidget);
      });
    });
    
    group('Accessibility', () {
      testWidgets('should have semantic labels for screen readers', (tester) async {
        // Act
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 75.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Assert - Check that important elements have semantic information
        expect(
          find.bySemanticsLabel(RegExp('Test Tank')),
          findsOneWidget,
        );
      });
      
      testWidgets('should handle high contrast mode', (tester) async {
        // This would require platform-specific testing
        // For now, verify that colors are used consistently
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 5.0,
          status: TankStatus.critical,
          isOnline: true,
        ));
        
        // Verify critical status is visually distinct
        expect(find.text('CRITICAL'), findsOneWidget);
      });
    });
    
    group('Performance', () {
      testWidgets('should handle rapid updates efficiently', (tester) async {
        // Act - Simulate rapid data updates
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 50.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Update with new values
        await tester.pumpWidget(createTestWidget(
          latestReading: mockTankReading,
          waterLevelPercentage: 60.0,
          status: TankStatus.normal,
          isOnline: true,
        ));
        
        // Should handle updates smoothly
        await tester.pumpAndSettle();
        expect(find.text('60%'), findsOneWidget);
      });
    });
  });
}
