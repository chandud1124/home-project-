import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../providers/app_providers.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  
  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  // Initialize Firebase Cloud Messaging
  Future<void> initialize() async {
    try {
      // Request permissions
      await _requestPermissions();
      
      // Initialize local notifications
      await _initializeLocalNotifications();
      
      // Get FCM token
      await _getFCMToken();
      
      // Configure message handlers
      _configureMessageHandlers();
      
      if (kDebugMode) {
        print('NotificationService initialized successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error initializing NotificationService: $e');
      }
    }
  }

  Future<void> _requestPermissions() async {
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: true,
      provisional: false,
      sound: true,
    );

    if (kDebugMode) {
      print('User granted notification permission: ${settings.authorizationStatus}');
    }
  }

  Future<void> _initializeLocalNotifications() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    
    final DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
      onDidReceiveLocalNotification: _onDidReceiveLocalNotification,
    );

    final InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: _onDidReceiveNotificationResponse,
    );
  }

  Future<void> _getFCMToken() async {
    try {
      _fcmToken = await _messaging.getToken();
      if (kDebugMode) {
        print('FCM Token: $_fcmToken');
      }
      
      // Listen for token refresh
      _messaging.onTokenRefresh.listen((newToken) {
        _fcmToken = newToken;
        if (kDebugMode) {
          print('FCM Token refreshed: $newToken');
        }
      });
    } catch (e) {
      if (kDebugMode) {
        print('Error getting FCM token: $e');
      }
    }
  }

  void _configureMessageHandlers() {
    // Handle messages when app is in foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    
    // Handle messages when app is in background but opened
    FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessage);
    
    // Handle messages when app is terminated and opened
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        _handleBackgroundMessage(message);
      }
    });
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    if (kDebugMode) {
      print('Received foreground message: ${message.messageId}');
    }

    // Show local notification for foreground messages
    await _showLocalNotification(message);
  }

  void _handleBackgroundMessage(RemoteMessage message) {
    if (kDebugMode) {
      print('Received background message: ${message.messageId}');
    }
    
    // Handle navigation or actions based on message data
    _handleNotificationAction(message.data);
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'aquaguard_alerts',
      'AquaGuard Alerts',
      channelDescription: 'Notifications for water tank alerts and motor status',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const DarwinNotificationDetails iOSPlatformChannelSpecifics =
        DarwinNotificationDetails();

    const NotificationDetails platformChannelSpecifics = NotificationDetails(
      android: androidPlatformChannelSpecifics,
      iOS: iOSPlatformChannelSpecifics,
    );

    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'AquaGuard Alert',
      message.notification?.body ?? 'New notification received',
      platformChannelSpecifics,
      payload: message.data.toString(),
    );
  }

  void _onDidReceiveLocalNotification(
    int id,
    String? title,
    String? body,
    String? payload,
  ) async {
    // Handle iOS local notification
    if (kDebugMode) {
      print('iOS local notification: $title - $body');
    }
  }

  void _onDidReceiveNotificationResponse(NotificationResponse response) async {
    if (response.payload != null) {
      if (kDebugMode) {
        print('Notification payload: ${response.payload}');
      }
      // Handle notification tap
      _handleNotificationAction(_parsePayload(response.payload!));
    }
  }

  void _handleNotificationAction(Map<String, dynamic> data) {
    final String? type = data['type'];
    final String? action = data['action'];
    
    switch (type) {
      case 'tank_alert':
        // Navigate to tank monitoring
        if (kDebugMode) {
          print('Opening tank monitoring for alert');
        }
        break;
      case 'motor_alert':
        // Navigate to motor control
        if (kDebugMode) {
          print('Opening motor control for alert');
        }
        break;
      case 'system_alert':
        // Navigate to alerts screen
        if (kDebugMode) {
          print('Opening alerts screen');
        }
        break;
      default:
        if (kDebugMode) {
          print('Unknown notification type: $type');
        }
    }
  }

  Map<String, dynamic> _parsePayload(String payload) {
    try {
      // Simple payload parsing - in production use proper JSON parsing
      return {'action': payload};
    } catch (e) {
      return {'action': 'default'};
    }
  }

  // Send notification for critical tank levels
  Future<void> sendTankLevelAlert({
    required String tankName,
    required double level,
    required String severity,
  }) async {
    final title = 'Tank Level Alert';
    final body = '$tankName water level is ${severity.toLowerCase()}: ${level.toInt()}%';
    
    await _showCriticalAlert(
      title: title,
      body: body,
      data: {
        'type': 'tank_alert',
        'tank': tankName.toLowerCase(),
        'level': level.toString(),
        'severity': severity,
      },
    );
  }

  // Send notification for motor status changes
  Future<void> sendMotorStatusAlert({
    required String status,
    required String mode,
    String? reason,
  }) async {
    final title = 'Motor Status Update';
    final body = 'Water pump motor $status in $mode mode${reason != null ? ' - $reason' : ''}';
    
    await _showAlert(
      title: title,
      body: body,
      data: {
        'type': 'motor_alert',
        'status': status,
        'mode': mode,
        'reason': reason ?? '',
      },
    );
  }

  // Send notification for device connectivity issues
  Future<void> sendDeviceConnectivityAlert({
    required String deviceId,
    required bool isOnline,
  }) async {
    final title = 'Device Connectivity';
    final body = '$deviceId is ${isOnline ? 'back online' : 'offline'}';
    
    await _showAlert(
      title: title,
      body: body,
      data: {
        'type': 'connectivity_alert',
        'device_id': deviceId,
        'status': isOnline ? 'online' : 'offline',
      },
    );
  }

  // Send notification for system alerts
  Future<void> sendSystemAlert({
    required String title,
    required String message,
    required String severity,
  }) async {
    if (severity.toLowerCase() == 'critical') {
      await _showCriticalAlert(
        title: title,
        body: message,
        data: {
          'type': 'system_alert',
          'severity': severity,
        },
      );
    } else {
      await _showAlert(
        title: title,
        body: message,
        data: {
          'type': 'system_alert',
          'severity': severity,
        },
      );
    }
  }

  Future<void> _showAlert({
    required String title,
    required String body,
    required Map<String, dynamic> data,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'aquaguard_alerts',
      'AquaGuard Alerts',
      channelDescription: 'Water management system notifications',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const DarwinNotificationDetails iOSDetails = DarwinNotificationDetails();

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iOSDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      details,
      payload: data.toString(),
    );
  }

  Future<void> _showCriticalAlert({
    required String title,
    required String body,
    required Map<String, dynamic> data,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'aquaguard_critical',
      'Critical Alerts',
      channelDescription: 'Critical water management alerts',
      importance: Importance.max,
      priority: Priority.max,
      icon: '@mipmap/ic_launcher',
      color: Color.fromARGB(255, 255, 0, 0),
      ledColor: Color.fromARGB(255, 255, 0, 0),
      ledOnMs: 1000,
      ledOffMs: 500,
      enableVibration: true,
      vibrationPattern: [0, 250, 250, 250],
    );

    const DarwinNotificationDetails iOSDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      interruptionLevel: InterruptionLevel.critical,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iOSDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      details,
      payload: data.toString(),
    );
  }

  // Subscribe to topics for targeted notifications
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      if (kDebugMode) {
        print('Subscribed to topic: $topic');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error subscribing to topic $topic: $e');
      }
    }
  }

  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      if (kDebugMode) {
        print('Unsubscribed from topic: $topic');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error unsubscribing from topic $topic: $e');
      }
    }
  }

  // Setup default topic subscriptions
  Future<void> setupDefaultSubscriptions() async {
    await subscribeToTopic('tank_alerts');
    await subscribeToTopic('motor_alerts');
    await subscribeToTopic('system_alerts');
  }

  // Clear all notifications
  Future<void> clearAllNotifications() async {
    await _localNotifications.cancelAll();
  }

  // Get notification count
  Future<List<ActiveNotification>> getActiveNotifications() async {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return await _localNotifications.getActiveNotifications();
    }
    return [];
  }
}
