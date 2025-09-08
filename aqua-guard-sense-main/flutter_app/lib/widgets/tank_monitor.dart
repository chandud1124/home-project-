import 'package:flutter/material.dart';
import '../models/tank_reading.dart';
import '../providers/app_providers.dart';

class TankMonitor extends StatelessWidget {
  final String tankName;
  final String deviceId;
  final TankReading? latestReading;
  final double waterLevelPercentage;
  final TankStatus status;
  final bool isOnline;
  
  const TankMonitor({
    super.key,
    required this.tankName,
    required this.deviceId,
    required this.latestReading,
    required this.waterLevelPercentage,
    required this.status,
    required this.isOnline,
  });
  
  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            const SizedBox(height: 16),
            _buildTankVisualization(context),
            const SizedBox(height: 16),
            _buildMetrics(context),
          ],
        ),
      ),
    );
  }
  
  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tankName,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              deviceId,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
        Row(
          children: [
            _buildStatusIndicator(),
            const SizedBox(width: 8),
            _buildConnectionStatus(),
          ],
        ),
      ],
    );
  }
  
  Widget _buildStatusIndicator() {
    Color statusColor;
    IconData statusIcon;
    
    switch (status) {
      case TankStatus.critical:
        statusColor = Colors.red;
        statusIcon = Icons.warning;
        break;
      case TankStatus.low:
        statusColor = Colors.orange;
        statusIcon = Icons.water_drop;
        break;
      case TankStatus.normal:
        statusColor = Colors.green;
        statusIcon = Icons.water_drop;
        break;
      case TankStatus.full:
        statusColor = Colors.blue;
        statusIcon = Icons.water_drop;
        break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusIcon, size: 16, color: statusColor),
          const SizedBox(width: 4),
          Text(
            status.name.toUpperCase(),
            style: TextStyle(
              color: statusColor,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildConnectionStatus() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isOnline ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(
        isOnline ? Icons.wifi : Icons.wifi_off,
        size: 16,
        color: isOnline ? Colors.green : Colors.red,
      ),
    );
  }
  
  Widget _buildTankVisualization(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 120,
        height: 200,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Tank outline
            Container(
              width: 120,
              height: 200,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey[400]!, width: 3),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(8),
                  bottomRight: Radius.circular(8),
                ),
              ),
            ),
            // Water animation
            Positioned(
              bottom: 0,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 800),
                width: 114,
                height: (194 * waterLevelPercentage / 100).clamp(0.0, 194.0),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: _getWaterColors(),
                  ),
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(5),
                    bottomRight: Radius.circular(5),
                  ),
                ),
              ),
            ),
            // Water level percentage
            Positioned(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Text(
                  '${waterLevelPercentage.toInt()}%',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            // Water level indicator line
            if (latestReading != null)
              Positioned(
                bottom: (194 * waterLevelPercentage / 100).clamp(0.0, 194.0),
                child: Container(
                  width: 130,
                  height: 2,
                  color: Colors.blue[800],
                ),
              ),
          ],
        ),
      ),
    );
  }
  
  List<Color> _getWaterColors() {
    switch (status) {
      case TankStatus.critical:
        return [Colors.red[300]!, Colors.red[600]!];
      case TankStatus.low:
        return [Colors.orange[300]!, Colors.orange[600]!];
      case TankStatus.normal:
        return [Colors.blue[300]!, Colors.blue[600]!];
      case TankStatus.full:
        return [Colors.blue[200]!, Colors.blue[700]!];
    }
  }
  
  Widget _buildMetrics(BuildContext context) {
    if (latestReading == null) {
      return const Center(
        child: Text(
          'No data available',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }
    
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildMetricItem(
              'Water Level',
              '${latestReading!.waterLevel.toInt()} cm',
              Icons.height,
              Colors.blue,
            ),
            _buildMetricItem(
              'Temperature',
              '${latestReading!.temperature.toInt()}°C',
              Icons.thermostat,
              Colors.orange,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildMetricItem(
              'pH Level',
              '${latestReading!.phLevel.toStringAsFixed(1)}',
              Icons.science,
              Colors.green,
            ),
            _buildMetricItem(
              'TDS',
              '${latestReading!.tdsLevel.toInt()} ppm',
              Icons.opacity,
              Colors.purple,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'Last updated: ${_formatTimestamp(latestReading!.timestamp)}',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
  
  Widget _buildMetricItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            color: Colors.grey,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
  
  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else {
      return '${timestamp.day}/${timestamp.month} ${timestamp.hour}:${timestamp.minute.toString().padLeft(2, '0')}';
    }
  }
}
