import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_providers.dart';

class MotorControl extends StatefulWidget {
  const MotorControl({super.key});

  @override
  State<MotorControl> createState() => _MotorControlState();
}

class _MotorControlState extends State<MotorControl>
    with TickerProviderStateMixin {
  late AnimationController _motorAnimationController;
  late AnimationController _pulseAnimationController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _motorAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    
    _pulseAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    
    _pulseAnimation = Tween<double>(
      begin: 1.0,
      end: 1.1,
    ).animate(CurvedAnimation(
      parent: _pulseAnimationController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _motorAnimationController.dispose();
    _pulseAnimationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<MotorControlProvider>(
      builder: (context, motorProvider, child) {
        // Update animations based on motor status
        if (motorProvider.isMotorRunning) {
          _motorAnimationController.repeat();
          _pulseAnimationController.repeat(reverse: true);
        } else {
          _motorAnimationController.stop();
          _pulseAnimationController.stop();
        }
        
        return Card(
          elevation: 4,
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(context, motorProvider),
                const SizedBox(height: 20),
                _buildMotorVisualization(context, motorProvider),
                const SizedBox(height: 20),
                _buildControlButtons(context, motorProvider),
                const SizedBox(height: 16),
                _buildModeToggle(context, motorProvider),
                const SizedBox(height: 16),
                _buildStatistics(context, motorProvider),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, MotorControlProvider provider) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Water Pump Motor',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              provider.isAutoMode ? 'Auto Mode' : 'Manual Mode',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: provider.isAutoMode ? Colors.green : Colors.blue,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        _buildStatusChip(provider),
      ],
    );
  }

  Widget _buildStatusChip(MotorControlProvider provider) {
    final isRunning = provider.isMotorRunning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isRunning 
            ? Colors.green.withOpacity(0.1)
            : Colors.grey.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isRunning ? Colors.green : Colors.grey,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: isRunning ? Colors.green : Colors.grey,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isRunning ? 'RUNNING' : 'STOPPED',
            style: TextStyle(
              color: isRunning ? Colors.green : Colors.grey,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMotorVisualization(BuildContext context, MotorControlProvider provider) {
    return Center(
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: provider.isMotorRunning ? _pulseAnimation.value : 1.0,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: provider.isMotorRunning 
                    ? Colors.blue.withOpacity(0.1)
                    : Colors.grey.withOpacity(0.1),
                border: Border.all(
                  color: provider.isMotorRunning ? Colors.blue : Colors.grey,
                  width: 3,
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Motor blades/fan
                  AnimatedBuilder(
                    animation: _motorAnimationController,
                    builder: (context, child) {
                      return Transform.rotate(
                        angle: _motorAnimationController.value * 2 * 3.14159,
                        child: Icon(
                          Icons.settings,
                          size: 50,
                          color: provider.isMotorRunning ? Colors.blue : Colors.grey,
                        ),
                      );
                    },
                  ),
                  // Center dot
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: provider.isMotorRunning ? Colors.blue : Colors.grey,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildControlButtons(BuildContext context, MotorControlProvider provider) {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: provider.isMotorRunning || provider.isLoadingEvents
                ? null
                : () => _startMotor(provider),
            icon: provider.isLoadingEvents
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.play_arrow),
            label: const Text('START'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: !provider.isMotorRunning || provider.isLoadingEvents
                ? null
                : () => _stopMotor(provider),
            icon: provider.isLoadingEvents
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.stop),
            label: const Text('STOP'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildModeToggle(BuildContext context, MotorControlProvider provider) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => _toggleMode(provider, true),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: provider.isAutoMode ? Colors.green : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.auto_mode,
                      color: provider.isAutoMode ? Colors.white : Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'AUTO',
                      style: TextStyle(
                        color: provider.isAutoMode ? Colors.white : Colors.grey[600],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => _toggleMode(provider, false),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: !provider.isAutoMode ? Colors.blue : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.touch_app,
                      color: !provider.isAutoMode ? Colors.white : Colors.grey[600],
                      size: 20,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'MANUAL',
                      style: TextStyle(
                        color: !provider.isAutoMode ? Colors.white : Colors.grey[600],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatistics(BuildContext context, MotorControlProvider provider) {
    final runtimeToday = provider.getMotorRuntimeToday();
    final hours = runtimeToday.inHours;
    final minutes = runtimeToday.inMinutes % 60;
    
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Column(
        children: [
          Text(
            'Today\'s Runtime',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${hours}h ${minutes}m',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: Colors.blue[700],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('Total Events', '${provider.motorEvents.length}', Icons.list),
              _buildStatItem('Mode', provider.isAutoMode ? 'Auto' : 'Manual', Icons.settings),
              _buildStatItem(
                'Status', 
                provider.isMotorRunning ? 'Active' : 'Idle', 
                provider.isMotorRunning ? Icons.power : Icons.power_off,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  void _startMotor(MotorControlProvider provider) async {
    final success = await provider.startMotor(isAutoMode: provider.isAutoMode);
    
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Motor started successfully'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to start motor'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _stopMotor(MotorControlProvider provider) async {
    final success = await provider.stopMotor(isAutoMode: provider.isAutoMode);
    
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Motor stopped successfully'),
            backgroundColor: Colors.orange,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to stop motor'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _toggleMode(MotorControlProvider provider, bool autoMode) async {
    final success = await provider.toggleAutoMode(autoMode);
    
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Switched to ${autoMode ? 'Auto' : 'Manual'} mode'),
            backgroundColor: Colors.blue,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to change mode'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
