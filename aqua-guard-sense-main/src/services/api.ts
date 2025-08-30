
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api`;

export interface TankReading {
  id: number;
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  timestamp: string;
}

export interface MotorEvent {
  id: number;
  event_type: string;
  duration?: number;
  timestamp: string;
}

export interface SystemAlert {
  id: number;
  type: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

export interface SystemStatus {
  id: number;
  wifi_connected: boolean;
  battery_level: number;
  temperature: number;
  esp32_top_status: string;
  esp32_sump_status: string;
  timestamp: string;
}

export interface ConsumptionData {
  date: string;
  consumption: number;
  fills: number;
  motorStarts: number;
}

class ApiService {
  private requestQueue: Map<string, Promise<any>> = new Map();
  
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const cacheKey = `${options?.method || 'GET'}_${endpoint}`;
    
    // If we already have a request in progress for this endpoint, return it
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey)!;
    }
    
    const requestPromise = this.makeRequest<T>(endpoint, options);
    
    // Cache the request promise
    this.requestQueue.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from cache after request completes
      this.requestQueue.delete(cacheKey);
    }
  }
  
  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Tank methods
  async getTanks(): Promise<TankReading[]> {
    return this.request<TankReading[]>('/tanks');
  }

  async addTankReading(reading: Omit<TankReading, 'id' | 'timestamp'>): Promise<TankReading> {
    return this.request<TankReading>('/tanks/reading', {
      method: 'POST',
      body: JSON.stringify(reading),
    });
  }

  // Motor methods
  async controlMotor(action: 'start' | 'stop'): Promise<{ success: boolean; event: MotorEvent }> {
    return this.request<{ success: boolean; event: MotorEvent }>('/motor/control', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async getMotorEvents(): Promise<MotorEvent[]> {
    return this.request<MotorEvent[]>('/motor/events');
  }

  // Alert methods
  async getAlerts(): Promise<SystemAlert[]> {
    return this.request<SystemAlert[]>('/alerts');
  }

  async addAlert(alert: Omit<SystemAlert, 'id' | 'resolved' | 'timestamp'>): Promise<SystemAlert> {
    return this.request<SystemAlert>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  // System status methods
  async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/system/status');
  }

  async updateSystemStatus(status: Omit<SystemStatus, 'id' | 'timestamp'>): Promise<SystemStatus> {
    return this.request<SystemStatus>('/system/status', {
      method: 'POST',
      body: JSON.stringify(status),
    });
  }

  // Consumption data
  async getConsumptionData(period: 'daily' | 'monthly' = 'daily'): Promise<ConsumptionData[]> {
    return this.request<ConsumptionData[]>(`/consumption?period=${period}`);
  }
}

export const apiService = new ApiService();
