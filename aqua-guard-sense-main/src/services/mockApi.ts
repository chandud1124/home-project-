// Mock API service for development and testing without backend

import { TankReading, MotorEvent, SystemAlert, SystemStatus, ConsumptionData, ESP32Device } from './api';

// Mock data for tanks
const mockTanks: TankReading[] = [
  {
    id: '1',
    tank_type: 'top',
    level_percentage: 75,
    level_liters: 750,
    sensor_health: 'good',
    esp32_id: 'esp32-top-01',
    signal_strength: 85,
    float_switch: true,
    timestamp: new Date().toISOString()
  },
  {
    id: '2',
    tank_type: 'sump',
    level_percentage: 45,
    level_liters: 450,
    sensor_health: 'good',
    esp32_id: 'esp32-sump-01',
    signal_strength: 78,
    float_switch: false,
    motor_running: false,
    manual_override: false,
    auto_mode_enabled: true,
    timestamp: new Date().toISOString()
  }
];

// Mock data for motor events
const mockMotorEvents: MotorEvent[] = [
  {
    id: '1',
    event_type: 'motor_started',
    duration: 0,
    esp32_id: 'esp32-sump-01',
    motor_running: true,
    power_detected: true,
    current_draw: 2.5,
    timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  },
  {
    id: '2',
    event_type: 'motor_stopped',
    duration: 1800, // 30 minutes
    esp32_id: 'esp32-sump-01',
    motor_running: false,
    power_detected: false,
    current_draw: 0,
    timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
  }
];

// Mock data for system alerts
const mockAlerts: SystemAlert[] = [
  {
    id: '1',
    type: 'warning',
    message: 'Top tank water level below 20%',
    resolved: false,
    timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  },
  {
    id: '2',
    type: 'info',
    message: 'Motor started automatically',
    resolved: true,
    timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  },
  {
    id: '3',
    type: 'error',
    message: 'Sump tank sensor communication error',
    resolved: true,
    timestamp: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  }
];

// Mock data for system status
const mockSystemStatus: SystemStatus = {
  id: '1',
  wifi_connected: true,
  battery_level: 85,
  temperature: 32.5,
  esp32_top_status: 'online',
  esp32_sump_status: 'online',
  wifi_strength: 78,
  float_switch: true,
  motor_running: false,
  manual_override: false,
  connection_state: 'stable',
  backend_responsive: true,
  timestamp: new Date().toISOString()
};

// Mock data for consumption
const mockDailyConsumption: ConsumptionData[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);
  return {
    date: date.toISOString().split('T')[0],
    consumption: Math.floor(Math.random() * 500) + 200, // 200-700 liters
    fills: Math.floor(Math.random() * 3) + 1, // 1-3 fills
    motorStarts: Math.floor(Math.random() * 5) + 1 // 1-5 starts
  };
});

const mockMonthlyConsumption: ConsumptionData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);
  return {
    date: date.toISOString().split('T')[0],
    consumption: Math.floor(Math.random() * 500) + 200, // 200-700 liters
    fills: Math.floor(Math.random() * 3) + 1, // 1-3 fills
    motorStarts: Math.floor(Math.random() * 5) + 1 // 1-5 starts
  };
});

// Mock data for ESP32 devices
const mockESP32Devices: ESP32Device[] = [
  {
    id: 'esp32-top-01',
    mac_address: '30:AE:A4:1F:54:32',
    ip_address: '192.168.0.120',
    device_type: 'top_tank_monitor',
    firmware_version: '1.2.0',
    status: 'online',
    is_connected: true,
    current_ip: '192.168.0.120',
    last_seen: new Date().toISOString(),
    registered_at: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
    created_at: new Date(Date.now() - 2592000000).toISOString() // 30 days ago
  },
  {
    id: 'esp32-sump-01',
    mac_address: '30:AE:A4:1F:54:33',
    ip_address: '192.168.0.121',
    device_type: 'sump_tank_monitor',
    firmware_version: '1.2.0',
    status: 'online',
    is_connected: true,
    current_ip: '192.168.0.121',
    last_seen: new Date().toISOString(),
    registered_at: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
    created_at: new Date(Date.now() - 2592000000).toISOString() // 30 days ago
  }
];

// Mock API service
export const mockApiService = {
  // Tank operations
  getTanks: async (): Promise<TankReading[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockTanks]), 300);
    });
  },

  // Motor operations
  getMotorEvents: async (): Promise<MotorEvent[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockMotorEvents]), 300);
    });
  },

  toggleMotor: async (state: boolean): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Update the mock data
        const newEvent: MotorEvent = {
          id: (mockMotorEvents.length + 1).toString(),
          event_type: state ? 'motor_started' : 'motor_stopped',
          duration: state ? 0 : 1800,
          esp32_id: 'esp32-sump-01',
          motor_running: state,
          power_detected: state,
          current_draw: state ? 2.5 : 0,
          timestamp: new Date().toISOString()
        };
        mockMotorEvents.push(newEvent);
        resolve({ success: true });
      }, 500);
    });
  },

  controlMotor: async (action: 'start' | 'stop'): Promise<{ success: boolean; event: MotorEvent }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Update the mock data
        const newEvent: MotorEvent = {
          id: (mockMotorEvents.length + 1).toString(),
          event_type: action === 'start' ? 'motor_started' : 'motor_stopped',
          duration: action === 'start' ? 0 : 1800,
          esp32_id: 'esp32-sump-01',
          motor_running: action === 'start',
          power_detected: action === 'start',
          current_draw: action === 'start' ? 2.5 : 0,
          timestamp: new Date().toISOString()
        };
        mockMotorEvents.push(newEvent);
        resolve({ success: true, event: newEvent });
      }, 500);
    });
  },

  toggleAutoMode: async (enabled: boolean): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Update the sump tank auto mode
        const sumpTank = mockTanks.find(tank => tank.tank_type === 'sump');
        if (sumpTank) {
          sumpTank.auto_mode_enabled = enabled;
        }
        resolve({ success: true });
      }, 500);
    });
  },

  setAutoMode: async (enabled: boolean): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Update the sump tank auto mode
        const sumpTank = mockTanks.find(tank => tank.tank_type === 'sump');
        if (sumpTank) {
          sumpTank.auto_mode_enabled = enabled;
        }
        resolve();
      }, 500);
    });
  },

  resetManualOverride: async (): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Reset manual override for all tanks
        mockTanks.forEach(tank => {
          tank.manual_override = false;
        });
        resolve();
      }, 500);
    });
  },

  // Alert operations
  getAlerts: async (): Promise<SystemAlert[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockAlerts]), 300);
    });
  },

  // System status operations
  getSystemStatus: async (): Promise<SystemStatus> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ ...mockSystemStatus }), 300);
    });
  },

  // Consumption data operations
  getConsumptionData: async (period: 'daily' | 'monthly' = 'daily'): Promise<ConsumptionData[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (period === 'daily') {
          resolve([...mockDailyConsumption]);
        } else {
          resolve([...mockMonthlyConsumption]);
        }
      }, 300);
    });
  },

  // ESP32 device operations
  getESP32Devices: async (): Promise<ESP32Device[]> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...mockESP32Devices]), 300);
    });
  },

  // PIN verification (mock always returns true for testing)
  verifyPIN: async (pin: string): Promise<{ valid: boolean }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // For testing, accept any PIN that matches the one in localStorage or default to '1234'
        const storedPin = localStorage.getItem('water_system_pin') || '1234';
        resolve({ valid: pin === storedPin });
      }, 500);
    });
  },

  // AI query response (mock)
  submitAIQuery: async (query: string): Promise<{ response: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple mock responses based on keywords in the query
        if (query.toLowerCase().includes('water level')) {
          resolve({ response: 'The current water level in your top tank is 75% (750 liters) and your sump tank is at 45% (450 liters). Both levels are within normal operating parameters.' });
        } else if (query.toLowerCase().includes('motor')) {
          resolve({ response: 'Your motor is currently not running. The last operation was 30 minutes ago and ran for approximately 30 minutes. The system is in auto mode and will start automatically when needed.' });
        } else if (query.toLowerCase().includes('consumption')) {
          resolve({ response: 'Your average daily water consumption for the past week is approximately 450 liters. This is within your normal usage patterns.' });
        } else {
          resolve({ response: 'I don\'t have specific information about that query. Please ask about water levels, motor status, or consumption patterns.' });
        }
      }, 1000);
    });
  }
};