import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'providers/app_providers.dart';
import 'services/supabase_service.dart';
import 'services/notification_service.dart';
import 'services/ml_service.dart';
import 'screens/dashboard_screen.dart';
import 'screens/analytics_screen.dart';
import 'screens/alerts_screen.dart';

// Background message handler
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("Handling a background message: ${message.messageId}");
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  try {
    await Firebase.initializeApp();
  } catch (e) {
    print('Error initializing Firebase: $e');
  }
  
  // Initialize Supabase
  try {
    await SupabaseService.initialize();
  } catch (e) {
    print('Error initializing Supabase: $e');
  }
  
  // Set Firebase background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  
  runApp(const AquaGuardApp());
}

class AquaGuardApp extends StatelessWidget {
  const AquaGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TankDataProvider()),
        ChangeNotifierProvider(create: (_) => MotorControlProvider()),
        ChangeNotifierProvider(create: (_) => AlertsProvider()),
      ],
      child: MaterialApp(
        title: 'AquaGuard Sense',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.light,
          ),
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
            elevation: 0,
            centerTitle: true,
          ),
          cardTheme: const CardTheme(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(12)),
            ),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              elevation: 2,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
          appBarTheme: AppBarTheme(
            backgroundColor: Colors.grey[900],
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: true,
          ),
        ),
        themeMode: ThemeMode.system,
        home: const AppInitializer(),
        routes: {
          '/dashboard': (context) => const MainScreen(),
          '/analytics': (context) => const MainScreen(initialIndex: 1),
          '/alerts': (context) => const MainScreen(initialIndex: 2),
        },
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/':
              return MaterialPageRoute(builder: (_) => const AppInitializer());
            default:
              return MaterialPageRoute(
                builder: (_) => const Scaffold(
                  body: Center(
                    child: Text('Page not found'),
                  ),
                ),
              );
          }
        },
      ),
    );
  }
}

class AppInitializer extends StatefulWidget {
  const AppInitializer({super.key});

  @override
  State<AppInitializer> createState() => _AppInitializerState();
}

class _AppInitializerState extends State<AppInitializer> {
  bool _isInitialized = false;
  String _initializationStatus = 'Initializing AquaGuard...';
  double _progress = 0.0;

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    try {
      // Step 1: Initialize Notification Service
      setState(() {
        _initializationStatus = 'Setting up notifications...';
        _progress = 0.2;
      });
      await NotificationService().initialize();
      await NotificationService().setupDefaultSubscriptions();
      
      // Step 2: Initialize ML Service
      setState(() {
        _initializationStatus = 'Loading ML models...';
        _progress = 0.4;
      });
      await MLService().initialize();
      
      // Step 3: Setup Supabase authentication
      setState(() {
        _initializationStatus = 'Connecting to cloud services...';
        _progress = 0.6;
      });
      await SupabaseService().signInAnonymously();
      
      // Step 4: Initialize data providers
      setState(() {
        _initializationStatus = 'Loading system data...';
        _progress = 0.8;
      });
      
      if (mounted) {
        await context.read<TankDataProvider>().initialize();
        await context.read<MotorControlProvider>().initialize();
        await context.read<AlertsProvider>().initialize();
      }
      
      // Complete initialization
      setState(() {
        _initializationStatus = 'Ready!';
        _progress = 1.0;
        _isInitialized = true;
      });
      
      // Navigate to main screen after a short delay
      await Future.delayed(const Duration(milliseconds: 500));
      
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainScreen()),
        );
      }
      
    } catch (e) {
      setState(() {
        _initializationStatus = 'Initialization failed: $e';
      });
      
      // Show error dialog after a delay
      await Future.delayed(const Duration(seconds: 2));
      
      if (mounted) {
        _showErrorDialog();
      }
    }
  }

  void _showErrorDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Initialization Error'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              color: Colors.red,
              size: 48,
            ),
            const SizedBox(height: 16),
            Text(_initializationStatus),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _initializeApp(); // Retry initialization
            },
            child: const Text('Retry'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const MainScreen()),
              );
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo/Icon
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.water_drop,
                  size: 60,
                  color: Colors.blue,
                ),
              ),
              const SizedBox(height: 32),
              
              // App name
              Text(
                'AquaGuard Sense',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
              ),
              const SizedBox(height: 8),
              
              Text(
                'Smart Water Management System',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 48),
              
              // Progress indicator
              SizedBox(
                width: 200,
                child: Column(
                  children: [
                    LinearProgressIndicator(
                      value: _progress,
                      backgroundColor: Colors.grey[300],
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.blue),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _initializationStatus,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 48),
              
              // Loading animation
              if (!_isInitialized)
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  final int initialIndex;
  
  const MainScreen({super.key, this.initialIndex = 0});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late int _currentIndex;
  late PageController _pageController;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const AnalyticsScreen(),
    const AlertsScreen(),
  ];

  final List<BottomNavigationBarItem> _navItems = [
    const BottomNavigationBarItem(
      icon: Icon(Icons.dashboard),
      label: 'Dashboard',
    ),
    const BottomNavigationBarItem(
      icon: Icon(Icons.analytics),
      label: 'Analytics',
    ),
    const BottomNavigationBarItem(
      icon: Icon(Icons.notifications),
      label: 'Alerts',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_getAppBarTitle()),
        actions: [
          Consumer<AlertsProvider>(
            builder: (context, provider, child) {
              if (provider.activeAlerts.isNotEmpty) {
                return Stack(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications),
                      onPressed: () {
                        setState(() {
                          _currentIndex = 2;
                          _pageController.animateToPage(
                            2,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        });
                      },
                    ),
                    if (provider.criticalAlertsCount > 0)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 16,
                            minHeight: 16,
                          ),
                          child: Text(
                            '${provider.criticalAlertsCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                );
              }
              return const SizedBox.shrink();
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshData,
          ),
        ],
      ),
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        },
        items: _navItems.map((item) {
          final index = _navItems.indexOf(item);
          if (index == 2) {
            // Add badge to alerts tab
            return BottomNavigationBarItem(
              icon: Consumer<AlertsProvider>(
                builder: (context, provider, child) {
                  if (provider.activeAlerts.isNotEmpty) {
                    return Stack(
                      children: [
                        item.icon,
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 12,
                              minHeight: 12,
                            ),
                            child: Text(
                              '${provider.activeAlerts.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ],
                    );
                  }
                  return item.icon;
                },
              ),
              label: item.label,
            );
          }
          return item;
        }).toList(),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.blue,
        unselectedItemColor: Colors.grey,
      ),
    );
  }

  String _getAppBarTitle() {
    switch (_currentIndex) {
      case 0:
        return 'Dashboard';
      case 1:
        return 'Analytics';
      case 2:
        return 'Alerts';
      default:
        return 'AquaGuard';
    }
  }

  Future<void> _refreshData() async {
    try {
      await Future.wait([
        context.read<TankDataProvider>().refreshData(),
        context.read<MotorControlProvider>().initialize(),
        context.read<AlertsProvider>().initialize(),
      ]);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Data refreshed successfully'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Refresh failed: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }
}
