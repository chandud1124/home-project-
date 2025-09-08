import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;
import '../models/tank_reading.dart';
import '../models/motor_event.dart';
import '../models/system_alert.dart';

class WebSocketService {
  // Cloud WebSocket endpoint - using Supabase Edge Functions  
  static const String websocketUrl = 'wss://dwcouaacpqipvvsxiygo.supabase.co/functions/v1/websocket';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3Y291YWFjcHFpcHZ2c3hpeWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mjg4OTAsImV4cCI6MjA3MjMwNDg5MH0.KSMEdolMR0rk95oUiLyrImcfBij5uDs6g9F7iC7FQY4';
  
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  bool _shouldReconnect = true;
  
  // Stream controllers for different data types
  final StreamController<TankReading> _tankReadingController = StreamController.broadcast();
  final StreamController<MotorEvent> _motorEventController = StreamController.broadcast();
  final StreamController<SystemAlert> _systemAlertController = StreamController.broadcast();
  final StreamController<bool> _connectionController = StreamController.broadcast();
  
  // Public streams
  Stream<TankReading> get tankReadingStream => _tankReadingController.stream;
  Stream<MotorEvent> get motorEventStream => _motorEventController.stream;
  Stream<SystemAlert> get systemAlertStream => _systemAlertController.stream;
  Stream<bool> get connectionStream => _connectionController.stream;
  
  bool get isConnected => _isConnected;
  
  // Initialize WebSocket connection with authentication
  Future<bool> connect() async {
    try {
      if (_isConnected) {
        return true;
      }
      
      print('Connecting to cloud WebSocket: $websocketUrl');
      
      // Add authentication headers for Supabase
      final uri = Uri.parse(websocketUrl);
      _channel = WebSocketChannel.connect(
        uri,
        protocols: ['websocket'],
      );
      
      // Send authentication after connection
      Timer(const Duration(milliseconds: 500), () {
        sendMessage({
          'type': 'auth',
          'token': supabaseAnonKey,
        });
      });
      
      _subscription = _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnection,
      );
      
      _isConnected = true;
      _connectionController.add(true);
      print('WebSocket connected successfully');
      return true;
    } catch (e) {
      print('WebSocket connection failed: $e');
      _isConnected = false;
      _connectionController.add(false);
      _scheduleReconnect();
      return false;
    }
  }
  
  // Handle incoming messages
  void _handleMessage(dynamic data) {
    try {
      final Map<String, dynamic> message = json.decode(data.toString());
      final String type = message['type'] ?? '';
      
      switch (type) {
        case 'tank_reading':
          final reading = TankReading.fromJson(message['data']);
          _tankReadingController.add(reading);
          break;
          
        case 'motor_event':
          final event = MotorEvent.fromJson(message['data']);
          _motorEventController.add(event);
          break;
          
        case 'system_alert':
          final alert = SystemAlert.fromJson(message['data']);
          _systemAlertController.add(alert);
          break;
          
        case 'connection':
          print('WebSocket connection message: ${message['message']}');
          break;
          
        default:
          print('Unknown WebSocket message type: $type');
      }
    } catch (e) {
      print('Error parsing WebSocket message: $e');
    }
  }
  
  // Handle WebSocket errors
  void _handleError(error) {
    print('WebSocket error: $error');
    _isConnected = false;
    _connectionController.add(false);
    _scheduleReconnect();
  }
  
  // Handle WebSocket disconnection
  void _handleDisconnection() {
    print('WebSocket disconnected');
    _isConnected = false;
    _connectionController.add(false);
    if (_shouldReconnect) {
      _scheduleReconnect();
    }
  }
  
  // Schedule automatic reconnection
  void _scheduleReconnect() {
    if (!_shouldReconnect) return;
    
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (!_isConnected && _shouldReconnect) {
        print('Attempting WebSocket reconnection...');
        connect();
      }
    });
  }
  
  // Send message to WebSocket server
  void sendMessage(Map<String, dynamic> message) {
    if (_isConnected && _channel != null) {
      try {
        _channel!.sink.add(json.encode(message));
      } catch (e) {
        print('Error sending WebSocket message: $e');
      }
    } else {
      print('Cannot send message: WebSocket not connected');
    }
  }
  
  // Send motor command
  void sendMotorCommand(String action, {String deviceId = 'SUMP_TANK'}) {
    sendMessage({
      'type': 'motor_command',
      'data': {
        'device_id': deviceId,
        'action': action,
        'timestamp': DateTime.now().toIso8601String(),
      }
    });
  }
  
  // Subscribe to specific device updates
  void subscribeToDevice(String deviceId) {
    sendMessage({
      'type': 'subscribe',
      'data': {'device_id': deviceId}
    });
  }
  
  // Disconnect WebSocket
  Future<void> disconnect() async {
    _shouldReconnect = false;
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    
    if (_channel != null) {
      await _channel!.sink.close(status.normalClosure);
      _channel = null;
    }
    
    _isConnected = false;
    _connectionController.add(false);
    print('WebSocket disconnected');
  }
  
  // Dispose resources
  void dispose() {
    disconnect();
    _tankReadingController.close();
    _motorEventController.close();
    _systemAlertController.close();
    _connectionController.close();
  }
}
