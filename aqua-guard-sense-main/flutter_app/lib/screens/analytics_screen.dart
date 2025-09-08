import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/app_providers.dart';
import '../models/tank_reading.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _selectedTimeRange = '24h';
  
  final List<String> _timeRanges = ['24h', '7d', '30d', '90d'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      body: Column(
        children: [
          _buildHeader(),
          _buildTimeRangeSelector(),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildWaterLevelAnalytics(),
                _buildConsumptionAnalytics(),
                _buildMotorAnalytics(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Analytics Dashboard',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          TabBar(
            controller: _tabController,
            tabs: const [
              Tab(text: 'Water Levels'),
              Tab(text: 'Consumption'),
              Tab(text: 'Motor Usage'),
            ],
            labelColor: Colors.blue,
            unselectedLabelColor: Colors.grey,
            indicatorColor: Colors.blue,
          ),
        ],
      ),
    );
  }

  Widget _buildTimeRangeSelector() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Row(
        children: [
          Text(
            'Time Range:',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _timeRanges.map((range) {
                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedTimeRange = range;
                      });
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _selectedTimeRange == range 
                            ? Colors.blue 
                            : Colors.grey[200],
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        range,
                        style: TextStyle(
                          color: _selectedTimeRange == range 
                              ? Colors.white 
                              : Colors.grey[600],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWaterLevelAnalytics() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildWaterLevelChart(),
          const SizedBox(height: 16),
          _buildTankComparisonChart(),
          const SizedBox(height: 16),
          _buildWaterLevelStats(),
        ],
      ),
    );
  }

  Widget _buildConsumptionAnalytics() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildConsumptionChart(),
          const SizedBox(height: 16),
          _buildConsumptionStats(),
          const SizedBox(height: 16),
          _buildConsumptionTrends(),
        ],
      ),
    );
  }

  Widget _buildMotorAnalytics() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildMotorUsageChart(),
          const SizedBox(height: 16),
          _buildMotorStats(),
          const SizedBox(height: 16),
          _buildMotorEfficiency(),
        ],
      ),
    );
  }

  Widget _buildWaterLevelChart() {
    return Consumer<TankDataProvider>(
      builder: (context, provider, child) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Water Level Trends',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 250,
                  child: LineChart(
                    _getWaterLevelChartData(provider),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTankComparisonChart() {
    return Consumer<TankDataProvider>(
      builder: (context, provider, child) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tank Level Comparison',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 200,
                  child: BarChart(
                    _getTankComparisonChartData(provider),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildConsumptionChart() {
    return Consumer<TankDataProvider>(
      builder: (context, provider, child) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Water Consumption',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 250,
                  child: LineChart(
                    _getConsumptionChartData(provider),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildMotorUsageChart() {
    return Consumer<MotorControlProvider>(
      builder: (context, provider, child) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Motor Usage Patterns',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 200,
                  child: BarChart(
                    _getMotorUsageChartData(provider),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildWaterLevelStats() {
    return Consumer<TankDataProvider>(
      builder: (context, provider, child) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Water Level Statistics',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        'Sump Avg',
                        '${provider.getSumpWaterLevelPercentage().toStringAsFixed(1)}%',
                        Colors.blue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        'Top Avg',
                        '${provider.getTopWaterLevelPercentage().toStringAsFixed(1)}%',
                        Colors.green,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        'Quality',
                        provider.latestSumpReading?.phLevel.toStringAsFixed(1) ?? 'N/A',
                        Colors.purple,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildConsumptionStats() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Consumption Statistics',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    'Today',
                    '245 L',
                    Colors.blue,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    'Week',
                    '1.8k L',
                    Colors.green,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildStatCard(
                    'Month',
                    '7.2k L',
                    Colors.orange,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMotorStats() {
    return Consumer<MotorControlProvider>(
      builder: (context, provider, child) {
        final runtime = provider.getMotorRuntimeToday();
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Motor Statistics',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        'Runtime Today',
                        '${runtime.inHours}h ${runtime.inMinutes % 60}m',
                        Colors.green,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        'Cycles',
                        '${provider.motorEvents.length}',
                        Colors.blue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildStatCard(
                        'Efficiency',
                        '92%',
                        Colors.purple,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildConsumptionTrends() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Consumption Trends',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildTrendItem('Morning Peak', '6-9 AM', '35%', Colors.orange),
            _buildTrendItem('Evening Peak', '6-8 PM', '28%', Colors.blue),
            _buildTrendItem('Night Usage', '10 PM-6 AM', '15%', Colors.purple),
            _buildTrendItem('Day Usage', '9 AM-6 PM', '22%', Colors.green),
          ],
        ),
      ),
    );
  }

  Widget _buildMotorEfficiency() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Motor Efficiency',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildEfficiencyItem('Energy Usage', '2.3 kWh/day', '85%', Colors.green),
            _buildEfficiencyItem('Water Pumped', '1,200 L/day', '92%', Colors.blue),
            _buildEfficiencyItem('Uptime', '22.5 hrs/day', '94%', Colors.purple),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrendItem(String title, String time, String percentage, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  time,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Text(
            percentage,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEfficiencyItem(String metric, String value, String efficiency, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              metric,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              efficiency,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  LineChartData _getWaterLevelChartData(TankDataProvider provider) {
    final sumpReadings = provider.getSumpReadingsForPeriod(_getSelectedDuration());
    final topReadings = provider.getTopReadingsForPeriod(_getSelectedDuration());

    return LineChartData(
      gridData: const FlGridData(show: true),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text(
                _formatChartTime(value),
                style: const TextStyle(fontSize: 10),
              );
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text('${value.toInt()}%');
            },
          ),
        ),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      borderData: FlBorderData(show: true),
      lineBarsData: [
        LineChartBarData(
          spots: _convertReadingsToSpots(sumpReadings, 200.0),
          isCurved: true,
          color: Colors.blue,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            color: Colors.blue.withOpacity(0.1),
          ),
        ),
        LineChartBarData(
          spots: _convertReadingsToSpots(topReadings, 150.0),
          isCurved: true,
          color: Colors.green,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            color: Colors.green.withOpacity(0.1),
          ),
        ),
      ],
    );
  }

  BarChartData _getTankComparisonChartData(TankDataProvider provider) {
    return BarChartData(
      alignment: BarChartAlignment.spaceAround,
      maxY: 100,
      barTouchData: BarTouchData(enabled: false),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (double value, TitleMeta meta) {
              const style = TextStyle(fontSize: 12);
              Widget text;
              switch (value.toInt()) {
                case 0:
                  text = const Text('Sump', style: style);
                  break;
                case 1:
                  text = const Text('Top', style: style);
                  break;
                default:
                  text = const Text('', style: style);
                  break;
              }
              return SideTitleWidget(
                axisSide: meta.axisSide,
                child: text,
              );
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text('${value.toInt()}%');
            },
          ),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      borderData: FlBorderData(show: false),
      barGroups: [
        BarChartGroupData(
          x: 0,
          barRods: [
            BarChartRodData(
              toY: provider.getSumpWaterLevelPercentage(),
              color: Colors.blue,
              width: 40,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(4),
              ),
            ),
          ],
        ),
        BarChartGroupData(
          x: 1,
          barRods: [
            BarChartRodData(
              toY: provider.getTopWaterLevelPercentage(),
              color: Colors.green,
              width: 40,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  LineChartData _getConsumptionChartData(TankDataProvider provider) {
    // Mock consumption data - in real app, calculate from tank level differences
    return LineChartData(
      gridData: const FlGridData(show: true),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text(
                _formatChartTime(value),
                style: const TextStyle(fontSize: 10),
              );
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text('${value.toInt()}L');
            },
          ),
        ),
      ),
      borderData: FlBorderData(show: true),
      lineBarsData: [
        LineChartBarData(
          spots: _generateMockConsumptionData(),
          isCurved: true,
          color: Colors.orange,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            color: Colors.orange.withOpacity(0.1),
          ),
        ),
      ],
    );
  }

  BarChartData _getMotorUsageChartData(MotorControlProvider provider) {
    // Mock motor usage data - in real app, analyze motor events
    return BarChartData(
      alignment: BarChartAlignment.spaceAround,
      maxY: 12,
      barTouchData: BarTouchData(enabled: false),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (double value, TitleMeta meta) {
              const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              return Text(
                days[value.toInt()],
                style: const TextStyle(fontSize: 10),
              );
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (value, meta) {
              return Text('${value.toInt()}h');
            },
          ),
        ),
      ),
      borderData: FlBorderData(show: false),
      barGroups: _generateMockMotorData(),
    );
  }

  List<FlSpot> _convertReadingsToSpots(List<TankReading> readings, double tankHeight) {
    if (readings.isEmpty) return [];
    
    final spots = <FlSpot>[];
    final now = DateTime.now();
    
    for (int i = 0; i < readings.length; i++) {
      final reading = readings[i];
      final timeDiff = now.difference(reading.timestamp).inHours.toDouble();
      final percentage = (reading.waterLevel / tankHeight * 100).clamp(0.0, 100.0);
      spots.add(FlSpot(timeDiff, percentage));
    }
    
    return spots.reversed.toList();
  }

  List<FlSpot> _generateMockConsumptionData() {
    return [
      const FlSpot(0, 15),
      const FlSpot(2, 25),
      const FlSpot(4, 35),
      const FlSpot(6, 45),
      const FlSpot(8, 30),
      const FlSpot(10, 20),
      const FlSpot(12, 40),
      const FlSpot(14, 35),
      const FlSpot(16, 50),
      const FlSpot(18, 45),
      const FlSpot(20, 30),
      const FlSpot(22, 20),
    ];
  }

  List<BarChartGroupData> _generateMockMotorData() {
    final data = [8, 9, 7, 8, 10, 6, 5]; // Hours per day
    
    return data.asMap().entries.map((entry) {
      return BarChartGroupData(
        x: entry.key,
        barRods: [
          BarChartRodData(
            toY: entry.value.toDouble(),
            color: Colors.blue,
            width: 20,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(2),
              topRight: Radius.circular(2),
            ),
          ),
        ],
      );
    }).toList();
  }

  Duration _getSelectedDuration() {
    switch (_selectedTimeRange) {
      case '24h':
        return const Duration(hours: 24);
      case '7d':
        return const Duration(days: 7);
      case '30d':
        return const Duration(days: 30);
      case '90d':
        return const Duration(days: 90);
      default:
        return const Duration(hours: 24);
    }
  }

  String _formatChartTime(double value) {
    final hours = value.toInt();
    if (hours == 0) return 'Now';
    if (hours < 24) return '${hours}h';
    return '${(hours / 24).toInt()}d';
  }
}
