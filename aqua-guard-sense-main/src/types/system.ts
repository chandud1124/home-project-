
export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

export interface ESP32Status {
  connected: boolean;
  batteryLevel: number;
  wifiStrength: number;
  lastSeen: Date;
}

export interface SystemStatusData {
  wifiConnected: boolean;
  batteryLevel: number;
  temperature: number;
  uptime: string;
  esp32Status: {
    topTank: 'online' | 'offline' | 'error';
    sump: 'online' | 'offline' | 'error';
  };
}

export interface ConsumptionData {
  date: string;
  consumption: number;
  fills: number;
  motorStarts: number;
}

export interface AIInsight {
  id: string;
  type: 'prediction' | 'anomaly' | 'recommendation' | 'maintenance';
  title: string;
  message: string;
  confidence: number;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface UsagePattern {
  hourlyPattern: number[];
  weeklyPattern: number[];
  seasonalTrend: 'increasing' | 'decreasing' | 'stable';
  averageDailyUsage: number;
  peakHours: number[];
}

export interface SystemData {
  topTankLevel: number;
  sumpLevel: number;
  motorRunning: boolean;
  alerts: SystemAlert[];
  lastUpdate: Date;
}
