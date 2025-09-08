import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_providers.dart';
import '../widgets/tank_monitor.dart';
import '../widgets/motor_control.dart';
import '../models/system_alert.dart'; // Import for AlertSeverity and AlertType

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    if (mounted) {
      await context.read<TankDataProvider>().initialize();
      await context.read<MotorControlProvider>().initialize();
      await context.read<AlertsProvider>().initialize();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      body: RefreshIndicator(
        onRefresh: _refreshData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildWelcomeSection(),
              const SizedBox(height: 20),
              _buildQuickStats(),
              const SizedBox(height: 24),
              _buildTankMonitors(),
              const SizedBox(height: 24),
              _buildMotorControl(),
              const SizedBox(height: 24),
              _buildRecentAlerts(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.blue, Colors.blueAccent],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AquaGuard Sense',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Smart Water Management System',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withOpacity(0.9),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _getCurrentTimeGreeting(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.water_drop,
              color: Colors.white,
              size: 32,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStats() {
    return Consumer3<TankDataProvider, MotorControlProvider, AlertsProvider>(
      builder: (context, tankProvider, motorProvider, alertsProvider, child) {
        return Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Sump Tank',
                '${tankProvider.getSumpWaterLevelPercentage().toInt()}%',
                Icons.water,
                tankProvider.getSumpTankStatus() == TankStatus.critical
                    ? Colors.red
                    : Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Top Tank',
                '${tankProvider.getTopWaterLevelPercentage().toInt()}%',
                Icons.water_drop,
                tankProvider.getTopTankStatus() == TankStatus.critical
                    ? Colors.red
                    : Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Motor',
                motorProvider.isMotorRunning ? 'Running' : 'Stopped',
                Icons.power_settings_new,
                motorProvider.isMotorRunning ? Colors.green : Colors.grey,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Alerts',
                '${alertsProvider.activeAlerts.length}',
                Icons.notification_important,
                alertsProvider.criticalAlertsCount > 0
                    ? Colors.red
                    : alertsProvider.activeAlerts.isNotEmpty
                        ? Colors.orange
                        : Colors.green,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              color: Colors.grey,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildTankMonitors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tank Monitoring',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Consumer<TankDataProvider>(
          builder: (context, provider, child) {
            return Column(
              children: [
                TankMonitor(
                  tankName: 'Sump Tank',
                  deviceId: TankDataProvider.sumpDeviceId,
                  latestReading: provider.latestSumpReading,
                  waterLevelPercentage: provider.getSumpWaterLevelPercentage(),
                  status: provider.getSumpTankStatus(),
                  isOnline: provider.isSumpDeviceOnline,
                ),
                const SizedBox(height: 12),
                TankMonitor(
                  tankName: 'Top Tank',
                  deviceId: TankDataProvider.topDeviceId,
                  latestReading: provider.latestTopReading,
                  waterLevelPercentage: provider.getTopWaterLevelPercentage(),
                  status: provider.getTopTankStatus(),
                  isOnline: provider.isTopDeviceOnline,
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildMotorControl() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Motor Control',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        const MotorControl(),
      ],
    );
  }

  Widget _buildRecentAlerts() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Alerts',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pushNamed(context, '/alerts'),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Consumer<AlertsProvider>(
          builder: (context, provider, child) {
            if (provider.isLoadingAlerts) {
              return const Center(
                child: CircularProgressIndicator(),
              );
            }
            
            if (provider.activeAlerts.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green[600]),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'All systems running normally. No active alerts.',
                        style: TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            
            return Column(
              children: provider.activeAlerts.take(3).map((alert) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _getAlertColor(alert.severityLevel).withOpacity(0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: _getAlertColor(alert.severityLevel).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getAlertIcon(alert.alertType),
                          size: 16,
                          color: _getAlertColor(alert.severityLevel),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              alert.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              alert.message,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      Text(
                        _formatAlertTime(alert.timestamp),
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }

  Color _getAlertColor(AlertSeverity severity) {
    switch (severity) {
      case AlertSeverity.critical:
        return Colors.red;
      case AlertSeverity.high:
        return Colors.orange;
      case AlertSeverity.medium:
        return Colors.yellow[700]!;
      case AlertSeverity.low:
        return Colors.blue;
      default:
        return Colors.grey; // Default fallback color
    }
  }

  IconData _getAlertIcon(AlertType type) {
    switch (type) {
      case AlertType.error:
        return Icons.error;
      case AlertType.warning:
        return Icons.warning;
      case AlertType.info:
        return Icons.info;
      default:
        return Icons.info; // Default fallback icon
    }
  }

  String _formatAlertTime(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inMinutes < 1) {
      return 'Now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h';
    } else {
      return '${difference.inDays}d';
    }
  }

  String _getCurrentTimeGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good Morning!';
    } else if (hour < 17) {
      return 'Good Afternoon!';
    } else {
      return 'Good Evening!';
    }
  }

  Future<void> _refreshData() async {
    await Future.wait([
      context.read<TankDataProvider>().refreshData(),
      context.read<MotorControlProvider>().initialize(),
      context.read<AlertsProvider>().initialize(),
    ]);
  }
}
