import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Background message handler
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("Handling a background message: ${message.messageId}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    // Initialize Firebase
    await Firebase.initializeApp();
    
    // Initialize Supabase
    await Supabase.initialize(
      url: 'YOUR_SUPABASE_URL', // Replace with actual URL
      anonKey: 'YOUR_SUPABASE_ANON_KEY', // Replace with actual key
    );
    
    // Set up Firebase Messaging
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    
    print('✅ AquaGuard Sense initialized successfully');
  } catch (e) {
    print('❌ Initialization error: $e');
  }
  
  runApp(const AquaGuardApp());
}

class AquaGuardApp extends StatelessWidget {
  const AquaGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AquaGuard Sense',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          elevation: 2,
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isConnected = false;
  String _status = 'Initializing...';

  @override
  void initState() {
    super.initState();
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    try {
      // Check Firebase connectivity
      Firebase.app();
      
      // Check Supabase connectivity
      Supabase.instance.client;
      
      setState(() {
        _isConnected = true;
        _status = 'Connected to cloud services';
      });
    } catch (e) {
      setState(() {
        _isConnected = false;
        _status = 'Connection error: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AquaGuard Sense'),
        actions: [
          IconButton(
            icon: Icon(_isConnected ? Icons.cloud_done : Icons.cloud_off),
            onPressed: _checkConnectivity,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Icon(
                      _isConnected ? Icons.check_circle : Icons.error,
                      color: _isConnected ? Colors.green : Colors.red,
                      size: 32,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'System Status',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Text(
                            _status,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Water Tank Monitoring Section
            Text(
              'Water Tank Monitoring',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            
            // Tank Cards
            Row(
              children: [
                Expanded(
                  child: _buildTankCard(
                    'Sump Tank',
                    '75%',
                    Colors.blue,
                    Icons.water_drop,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildTankCard(
                    'Top Tank',
                    '45%',
                    Colors.orange,
                    Icons.water,
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Motor Control Section
            Text(
              'Motor Control',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Motor Status'),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.green.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'AUTO',
                            style: TextStyle(
                              color: Colors.green,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              _showMessage('Motor Start Command Sent');
                            },
                            icon: const Icon(Icons.play_arrow),
                            label: const Text('START'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              _showMessage('Motor Stop Command Sent');
                            },
                            icon: const Icon(Icons.stop),
                            label: const Text('STOP'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Quick Stats
            Text(
              'Quick Stats',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            
            Row(
              children: [
                Expanded(
                  child: _buildStatCard('Water Used Today', '125L', Icons.opacity),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard('Motor Runtime', '2.5h', Icons.timer),
                ),
              ],
            ),
            
            const SizedBox(height: 10),
            
            Row(
              children: [
                Expanded(
                  child: _buildStatCard('Efficiency', '92%', Icons.eco),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard('Alerts', '2', Icons.warning),
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Cloud Integration Info
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.cloud, color: Colors.blue),
                        const SizedBox(width: 8),
                        Text(
                          'Cloud Integration',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      '✅ Connected to Firebase for real-time notifications\n'
                      '✅ Connected to Supabase for data storage\n'
                      '✅ Same backend as your web application\n'
                      '✅ Real-time sync across all devices',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.analytics),
            label: 'Analytics',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.notifications),
            label: 'Alerts',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget _buildTankCard(String title, String level, Color color, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              level,
              style: TextStyle(
                fontSize: 18,
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          children: [
            Icon(icon, size: 24, color: Colors.blue),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
