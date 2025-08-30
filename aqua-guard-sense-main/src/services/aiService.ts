
import { ConsumptionData, AIInsight, UsagePattern, SystemData } from '@/types/system';

class AIService {
  private usageHistory: ConsumptionData[] = [];
  private patterns: UsagePattern | null = null;

  // Analyze consumption patterns and generate predictions
  analyzeUsagePatterns(data: ConsumptionData[]): UsagePattern {
    this.usageHistory = data;
    
    // Calculate hourly patterns (mock implementation)
    const hourlyPattern = Array.from({ length: 24 }, (_, hour) => {
      const hourData = data.filter(d => new Date(d.date).getHours() === hour);
      return hourData.reduce((sum, d) => sum + d.consumption, 0) / Math.max(hourData.length, 1);
    });

    // Calculate weekly patterns
    const weeklyPattern = Array.from({ length: 7 }, (_, day) => {
      const dayData = data.filter(d => new Date(d.date).getDay() === day);
      return dayData.reduce((sum, d) => sum + d.consumption, 0) / Math.max(dayData.length, 1);
    });

    // Calculate average daily usage
    const averageDailyUsage = data.reduce((sum, d) => sum + d.consumption, 0) / Math.max(data.length, 1);

    // Find peak hours
    const peakHours = hourlyPattern
      .map((consumption, hour) => ({ hour, consumption }))
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, 3)
      .map(item => item.hour);

    this.patterns = {
      hourlyPattern,
      weeklyPattern,
      seasonalTrend: 'stable',
      averageDailyUsage,
      peakHours
    };

    return this.patterns;
  }

  // Predict when tank will be empty
  predictTankEmpty(currentLevel: number, capacity: number): { hoursRemaining: number; confidence: number } {
    if (!this.patterns) {
      return { hoursRemaining: 0, confidence: 0 };
    }

    const currentHour = new Date().getHours();
    const hourlyConsumption = this.patterns.hourlyPattern[currentHour] || this.patterns.averageDailyUsage / 24;
    
    const currentLiters = (currentLevel / 100) * capacity;
    const hoursRemaining = currentLiters / Math.max(hourlyConsumption, 1);
    
    return {
      hoursRemaining: Math.max(0, hoursRemaining),
      confidence: Math.min(0.95, this.usageHistory.length / 30) // Higher confidence with more data
    };
  }

  // Detect anomalies in usage
  detectAnomalies(recentData: ConsumptionData[]): AIInsight[] {
    const insights: AIInsight[] = [];
    
    if (recentData.length < 7) return insights;

    const recent = recentData.slice(-7);
    const previousWeek = recentData.slice(-14, -7);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.consumption, 0) / recent.length;
    const previousAvg = previousWeek.reduce((sum, d) => sum + d.consumption, 0) / previousWeek.length;
    
    // Check for unusual consumption increase
    if (recentAvg > previousAvg * 1.3) {
      insights.push({
        id: `anomaly-${Date.now()}`,
        type: 'anomaly',
        title: 'Unusual Water Consumption',
        message: `Water usage has increased by ${Math.round((recentAvg - previousAvg) / previousAvg * 100)}% compared to last week. Check for possible leaks.`,
        confidence: 0.8,
        timestamp: new Date(),
        priority: 'high'
      });
    }

    // Check for frequent motor starts
    const motorStarts = recent.reduce((sum, d) => sum + d.motorStarts, 0);
    if (motorStarts > 50) {
      insights.push({
        id: `maintenance-${Date.now()}`,
        type: 'maintenance',
        title: 'High Motor Activity',
        message: `Motor started ${motorStarts} times this week. Consider checking for frequent on/off cycling.`,
        confidence: 0.9,
        timestamp: new Date(),
        priority: 'medium'
      });
    }

    return insights;
  }

  // Generate smart schedule recommendations
  generateSmartSchedule(currentHour: number): AIInsight[] {
    if (!this.patterns) return [];

    const insights: AIInsight[] = [];
    const lowUsageHours = this.patterns.hourlyPattern
      .map((consumption, hour) => ({ hour, consumption }))
      .sort((a, b) => a.consumption - b.consumption)
      .slice(0, 6)
      .map(item => item.hour);

    if (lowUsageHours.includes(currentHour)) {
      insights.push({
        id: `schedule-${Date.now()}`,
        type: 'recommendation',
        title: 'Optimal Fill Time',
        message: 'Current hour has low water usage. Good time to fill the tank.',
        confidence: 0.85,
        timestamp: new Date(),
        priority: 'low'
      });
    }

    return insights;
  }

  // Predict power outage impact
  predictPowerOutageImpact(currentTopTank: number, currentSump: number, capacity: { top: number; sump: number }): AIInsight {
    const topLiters = (currentTopTank / 100) * capacity.top;
    const sumpLiters = (currentSump / 100) * capacity.sump;
    
    const dailyUsage = this.patterns?.averageDailyUsage || 200;
    const hoursWithoutPump = topLiters / (dailyUsage / 24);
    
    return {
      id: `power-prediction-${Date.now()}`,
      type: 'prediction',
      title: 'Power Outage Preparedness',
      message: `With current tank levels, system can operate for approximately ${Math.round(hoursWithoutPump)} hours without power. ${hoursWithoutPump < 12 ? 'Consider filling tanks before planned outages.' : 'Good reserve capacity.'}`,
      confidence: 0.75,
      timestamp: new Date(),
      priority: hoursWithoutPump < 12 ? 'high' : 'low'
    };
  }

  // Natural language query processing
  processNaturalLanguageQuery(query: string, systemData: SystemData): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('water left') || lowerQuery.includes('tank level')) {
      return `Top tank is at ${systemData.topTankLevel}% (${Math.round(systemData.topTankLevel * 10)}L), Sump is at ${systemData.sumpLevel}% (${Math.round(systemData.sumpLevel * 20)}L)`;
    }
    
    if (lowerQuery.includes('when') && lowerQuery.includes('empty')) {
      const prediction = this.predictTankEmpty(systemData.topTankLevel, 1000);
      return `Based on current usage patterns, the top tank will be empty in approximately ${Math.round(prediction.hoursRemaining)} hours (${Math.round(prediction.confidence * 100)}% confidence)`;
    }
    
    if (lowerQuery.includes('usage') && lowerQuery.includes('trend')) {
      return `Average daily usage is ${Math.round(this.patterns?.averageDailyUsage || 200)}L. Peak usage hours are ${this.patterns?.peakHours.join(', ') || 'morning and evening'}.`;
    }
    
    return "I can help you with water levels, usage trends, predictions, and system status. Try asking about tank levels, when tanks will be empty, or usage patterns.";
  }
}

export const aiService = new AIService();
