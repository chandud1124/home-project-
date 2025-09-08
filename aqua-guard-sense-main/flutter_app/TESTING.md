# AquaGuard Sense Flutter App Testing Guide

## Overview
This guide covers comprehensive testing for the AquaGuard Sense Flutter mobile application, including unit tests, widget tests, integration tests, and deployment preparation.

## Test Structure

### 1. Unit Tests
Location: `test/unit/`

#### Service Tests
- `test/unit/supabase_service_test.dart` - Test database operations
- `test/unit/notification_service_test.dart` - Test push notification handling
- `test/unit/ml_service_test.dart` - Test ML prediction models

#### Provider Tests
- `test/unit/tank_data_provider_test.dart` - Test tank data state management
- `test/unit/motor_control_provider_test.dart` - Test motor control logic
- `test/unit/alerts_provider_test.dart` - Test alerts management

#### Model Tests
- `test/unit/models_test.dart` - Test data model serialization/deserialization

### 2. Widget Tests
Location: `test/widget/`

#### Component Tests
- `test/widget/tank_monitor_test.dart` - Test tank visualization widget
- `test/widget/motor_control_test.dart` - Test motor control interface
- `test/widget/alert_card_test.dart` - Test alert display components

#### Screen Tests
- `test/widget/dashboard_screen_test.dart` - Test dashboard UI
- `test/widget/analytics_screen_test.dart` - Test analytics charts
- `test/widget/alerts_screen_test.dart` - Test alerts interface

### 3. Integration Tests
Location: `integration_test/`

#### End-to-End Tests
- `integration_test/app_test.dart` - Full app workflow testing
- `integration_test/real_time_test.dart` - Test real-time data updates
- `integration_test/offline_test.dart` - Test offline functionality

## Running Tests

### Prerequisites
```bash
# Install test dependencies
flutter pub get

# Ensure test environment is set up
flutter test --help
```

### Unit Tests
```bash
# Run all unit tests
flutter test test/unit/

# Run specific test file
flutter test test/unit/supabase_service_test.dart

# Run tests with coverage
flutter test --coverage
```

### Widget Tests
```bash
# Run all widget tests
flutter test test/widget/

# Run with verbose output
flutter test test/widget/ --verbose
```

### Integration Tests
```bash
# Run integration tests on connected device
flutter test integration_test/

# Run on specific device
flutter test integration_test/ -d <device_id>
```

## Test Configuration

### 1. Test Environment Setup
Create `test/test_config.dart`:
```dart
class TestConfig {
  static const String testSupabaseUrl = 'your_test_supabase_url';
  static const String testSupabaseKey = 'your_test_supabase_key';
  static const bool enableNetworkTests = false;
}
```

### 2. Mock Services
Location: `test/mocks/`

#### Mock Data
- Tank readings with various scenarios
- Motor events for different patterns
- System alerts of all severities
- Network response mocking

#### Mock Services
- Mock Supabase client
- Mock Firebase messaging
- Mock ML model responses
- Mock notification service

### 3. Test Data
Location: `test/data/`

#### Sample Data Files
- `tank_readings.json` - Sample tank data
- `motor_events.json` - Sample motor events
- `alerts.json` - Sample system alerts
- `ml_predictions.json` - Sample ML outputs

## Performance Testing

### 1. Memory Usage
```bash
# Test memory leaks
flutter test --track-widget-creation

# Profile memory usage
flutter test --enable-vmservice
```

### 2. Rendering Performance
```bash
# Test UI performance
flutter test --verbose --enable-experiment=non-nullable
```

### 3. Network Performance
- Test with slow network conditions
- Test offline/online transitions
- Test large data set handling

## Security Testing

### 1. Data Protection
- Test encrypted data storage
- Verify API key security
- Test authentication flows

### 2. Input Validation
- Test SQL injection prevention
- Test XSS protection
- Test input sanitization

## Accessibility Testing

### 1. Screen Reader Support
```dart
// Test semantic labels
testWidgets('Tank monitor has proper semantics', (tester) async {
  await tester.pumpWidget(testWidget);
  
  expect(
    find.bySemanticsLabel('Water level: 75%'),
    findsOneWidget,
  );
});
```

### 2. Color Contrast
- Test color accessibility
- Verify dark mode support
- Test high contrast mode

## Device Testing Matrix

### Android Testing
| Device Category | Min Version | Test Priority |
|----------------|-------------|---------------|
| Phones | Android 7.0 (API 24) | High |
| Tablets | Android 8.0 (API 26) | Medium |
| Foldables | Android 10.0 (API 29) | Low |

### iOS Testing
| Device Category | Min Version | Test Priority |
|----------------|-------------|---------------|
| iPhones | iOS 12.0 | High |
| iPads | iOS 13.0 | Medium |

## Automated Testing Pipeline

### 1. CI/CD Integration
```yaml
# .github/workflows/flutter_tests.yml
name: Flutter Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test --coverage
      - run: flutter test integration_test/
```

### 2. Test Reporting
```bash
# Generate test coverage report
genhtml coverage/lcov.info -o coverage/html

# Upload to coverage service
bash <(curl -s https://codecov.io/bash)
```

## Load Testing

### 1. Real-time Data Simulation
```dart
// Simulate high-frequency data updates
void simulateHighDataLoad() {
  // Test 100 tank readings per minute
  // Test 50 motor events per hour
  // Test 20 alerts per day
}
```

### 2. Memory Stress Testing
```dart
// Test with large data sets
void testLargeDataHandling() {
  // Load 10,000+ tank readings
  // Test chart rendering with large datasets
  // Verify memory cleanup
}
```

## Testing Checklist

### Pre-Release Testing
- [ ] All unit tests passing
- [ ] All widget tests passing  
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Accessibility requirements met
- [ ] Security scan completed
- [ ] Device matrix testing completed
- [ ] Offline functionality verified
- [ ] Real-time updates working
- [ ] Push notifications working
- [ ] ML predictions accurate
- [ ] Error handling robust
- [ ] Network retry logic working
- [ ] Data synchronization verified
- [ ] Battery usage optimized

### Post-Release Monitoring
- [ ] Crash reporting configured
- [ ] Performance monitoring active
- [ ] User feedback collection
- [ ] A/B testing setup
- [ ] Analytics tracking
- [ ] Error rate monitoring
- [ ] API usage monitoring
- [ ] Battery usage tracking

## Deployment Testing

### 1. Build Testing
```bash
# Test release build
flutter build apk --release
flutter build appbundle --release
flutter build ios --release

# Test build sizes
flutter build apk --analyze-size
```

### 2. Store Deployment
```bash
# Android Play Console testing
# - Internal testing
# - Closed testing
# - Open testing
# - Production release

# iOS App Store testing
# - TestFlight internal testing
# - TestFlight external testing
# - App Store review
# - Production release
```

### 3. Firebase App Distribution
```bash
# Distribute to testers
firebase appdistribution:distribute app-release.apk \
  --app 1:123456789:android:abcd1234 \
  --groups "testers" \
  --release-notes "Beta release with new features"
```

## Troubleshooting

### Common Test Issues
1. **Async Operations**: Use `pumpAndSettle()` for animations
2. **Network Tests**: Mock HTTP responses properly
3. **State Management**: Reset provider state between tests
4. **Platform Widgets**: Use appropriate platform-specific finders

### Test Environment Issues
1. **Flutter Version**: Ensure consistent Flutter SDK
2. **Dependencies**: Keep test dependencies up to date
3. **Device Setup**: Configure test devices properly
4. **Network**: Stable internet for integration tests

## Continuous Improvement

### Test Metrics
- Code coverage target: 80%+
- Test execution time: <5 minutes
- Test reliability: 95%+ pass rate
- Performance benchmarks within 10% variance

### Regular Reviews
- Monthly test strategy review
- Quarterly device matrix update  
- Semi-annual testing tool evaluation
- Annual testing infrastructure audit
