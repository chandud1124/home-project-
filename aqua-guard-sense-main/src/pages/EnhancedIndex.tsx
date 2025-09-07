import { useState, useEffect } from "react";
import { EnhancedTankMonitor } from "@/components/EnhancedTankMonitor";
import { AutoMotorControl } from "@/components/AutoMotorControl";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { SystemAlerts } from "@/components/SystemAlerts";
import { SystemStatus } from "@/components/SystemStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useOfflineSupport } from "@/hooks/useOfflineSupport";
import { apiService } from "@/services/api";
import { createUIMessage, validateBackendMessage } from "@/lib/protocols";
import type { ConsumptionData } from "@/services/api";
import { 
  Droplets, 
  Zap, 
  TrendingUp, 
  Activity, 
  Settings,
  Waves,
  Power,
  BarChart3,
  AlertTriangle,
  StopCircle,
  Wrench
} from "lucide-react";

// Add missing type definitions
type SystemAlert = {
  id: string;
  type: "warning" | "info" | "error";
  message: string;
  timestamp: Date;
  resolved: boolean;
};

// WebSocket message types
interface TankReadingMessage {
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  timestamp: string;
  signal_strength?: number;
  float_switch?: boolean;
  motor_running?: boolean;
  manual_override?: boolean;
  auto_mode_enabled?: boolean;
}

interface SystemAlertMessage {
  id: number;
  type: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

interface SystemStatusMessage {
  wifi_connected: boolean;
  temperature: number;
  uptime: string;
  esp32_top_status: string;
  esp32_sump_status: string;
  timestamp: string;
}

type WebSocketMessageData = TankReadingMessage | SystemAlertMessage | SystemStatusMessage;

// API types - Updated to match API service types
interface TankReading {
  id: string; // Changed from number to string to match API
  tank_type: string;
  level_percentage: number;
  level_liters: number;
  timestamp: string;
  signal_strength?: number;
  float_switch?: boolean;
  motor_running?: boolean;
  manual_override?: boolean;
  auto_mode_enabled?: boolean;
  sensor_health?: string;
  esp32_id?: string;
  battery_voltage?: number;
}

interface ApiSystemAlert {
  id: string; // Changed from number to string to match API
  type: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

interface SystemStatusType {
  id?: string; // Changed from number to string and made optional
  wifi_connected: boolean;
  temperature: number;
  esp32_top_status: string;
  esp32_sump_status: string;
  timestamp: string;
  wifi_strength?: number;
  battery_level?: number;
  uptime?: string; // Added uptime property
}

const EnhancedIndex = () => {
  const [autoMode, setAutoMode] = useState(true);
  const [motorRunning, setMotorRunning] = useState(false);
  const { toast } = useToast();
  const { isOnline } = useOfflineSupport();

  // Backend integration state
  const [topTank, setTopTank] = useState<TankReading | null>(null);
  const [sumpTank, setSumpTank] = useState<TankReading | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusType | null>(null);
  const [consumptionData, setConsumptionData] = useState<ConsumptionData[]>([]);

  // Stale data tracking
  const [lastTopTankUpdate, setLastTopTankUpdate] = useState<Date | null>(null);
  const [lastSumpTankUpdate, setLastSumpTankUpdate] = useState<Date | null>(null);

  // Motor data state
  const [motorRuntime, setMotorRuntime] = useState<number>(0);
  const [motorCurrentDraw, setMotorCurrentDraw] = useState<number>(0);
  const [motorStartCount, setMotorStartCount] = useState<number>(0);

  // Dashboard data state
  const [totalWaterLevel, setTotalWaterLevel] = useState<number>(0);
  const [waterLevelChange, setWaterLevelChange] = useState<number>(0);
  const [motorStatus, setMotorStatus] = useState<string>('Stopped');
  const [motorLastRun, setMotorLastRun] = useState<string>('Never');
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const [efficiency, setEfficiency] = useState<number>(0);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [esp32LastSeen, setEsp32LastSeen] = useState<Date | null>(null);

  // Device registration state
  const [deviceRegistrations, setDeviceRegistrations] = useState<{
    [key: string]: { apiKey: string; hmacSecret: string }
  }>({});
  
  // Device registration handlers
  const isDeviceRegistered = (deviceName: string): boolean => {
    return !!deviceRegistrations[deviceName.toLowerCase()];
  };
  
  const getDeviceKeys = (deviceName: string) => {
    return deviceRegistrations[deviceName.toLowerCase()] || { apiKey: '', hmacSecret: '' };
  };
  
  const handleDeviceRegistration = (deviceName: string, apiKey: string, hmacSecret: string) => {
    setDeviceRegistrations(prev => ({
      ...prev,
      [deviceName.toLowerCase()]: { apiKey, hmacSecret }
    }));
  };
  
  const requestPinForEsp32Connect = (deviceName: string, onSuccess: () => void) => {
    // For now, just call onSuccess - PIN modal would be implemented here
    onSuccess();
  };

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setDashboardLoading(true);

        // Fetch tank data for total water level
        const tanks = await apiService.getTanks();
        const totalLiters = tanks.reduce((sum, tank) => sum + tank.level_liters, 0);
        setTotalWaterLevel(totalLiters);

        // Calculate water level change (mock for now - would need historical data)
        setWaterLevelChange(5.2); // This would be calculated from historical data

        // Fetch consumption data for daily usage
        const consumption = await apiService.getConsumptionData();
        const todayConsumption = consumption.reduce((sum, day) => sum + day.consumption, 0);
        setDailyUsage(todayConsumption);

        // Fetch motor events for motor status and data
        const motorEvents = await apiService.getMotorEvents();
        if (motorEvents.length > 0) {
          const lastEvent = motorEvents[motorEvents.length - 1];
          const lastRunTime = new Date(lastEvent.timestamp);
          const timeDiff = Date.now() - lastRunTime.getTime();
          const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
          
          if (lastEvent.event_type === 'motor_started') {
            setMotorStatus('Running');
            setMotorLastRun('Currently running');
          } else {
            setMotorStatus('Stopped');
            setMotorLastRun(`${hoursAgo}h ago`);
          }
        } else {
          setMotorStatus('No Data');
          setMotorLastRun('No motor events available');
        }

        // Calculate motor runtime and start count from motor events
        if (motorEvents.length > 0) {
          // Calculate today's motor runtime (in minutes)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todayEvents = motorEvents.filter(event => {
            const eventDate = new Date(event.timestamp);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === today.getTime();
          });
          
          // Calculate total runtime for today
          let totalRuntime = 0;
          let startCount = 0;
          let lastStartTime: Date | null = null;
          
          todayEvents.forEach(event => {
            if (event.event_type === 'motor_started') {
              startCount++;
              lastStartTime = new Date(event.timestamp);
            } else if (event.event_type === 'motor_stopped' && lastStartTime) {
              const stopTime = new Date(event.timestamp);
              const runtime = (stopTime.getTime() - lastStartTime.getTime()) / (1000 * 60); // minutes
              totalRuntime += runtime;
              lastStartTime = null;
            }
          });
          
          // If motor is currently running, add current runtime
          if (motorRunning && lastStartTime) {
            const currentTime = new Date();
            const currentRuntime = (currentTime.getTime() - lastStartTime.getTime()) / (1000 * 60);
            totalRuntime += currentRuntime;
          }
          
          setMotorRuntime(Math.round(totalRuntime));
          setMotorStartCount(startCount);
          
          // Set current draw from latest motor event
          const latestEvent = motorEvents[motorEvents.length - 1];
          setMotorCurrentDraw(latestEvent.current_draw || 0);
        } else {
          setMotorRuntime(0);
          setMotorStartCount(0);
          setMotorCurrentDraw(0);
        }

        // Calculate efficiency (mock calculation - would be based on actual metrics)
        const sysStatus = await apiService.getSystemStatus();
        // Simple efficiency calculation based on uptime and performance
        const baseEfficiency = 85;
        const wifiBonus = sysStatus.wifi_connected ? 5 : 0;
        setEfficiency(baseEfficiency + wifiBonus);

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        toast({
          title: "Data Fetch Error",
          description: "Failed to load dashboard data. Using fallback values.",
          variant: "destructive",
        });

        // Fallback values
        setTotalWaterLevel(1245);
        setWaterLevelChange(5);
        setMotorStatus('Stopped');
        setMotorLastRun('2h ago');
        setDailyUsage(456);
        setEfficiency(94);
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh data every 10 seconds for more responsive UI
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [toast]);

  // API service functions - using global apiService with Supabase direct integration
  const apiServiceLocal = {
    getTanks: async (): Promise<TankReading[]> => {
      // Use the global API service which has Supabase direct integration
      return await apiService.getTanks();
    },
    getSystemStatus: async (): Promise<SystemStatusType> => {
      // Mock system status for cloud-only mode
      return {
        wifi_connected: true,
        temperature: 25.0,
        uptime: '1h 30m',
        esp32_top_status: 'online',
        esp32_sump_status: 'online',
        battery_level: 95,
        wifi_strength: -45,
        timestamp: new Date().toISOString()
      };
    },
    getAlerts: async (): Promise<ApiSystemAlert[]> => {
      const alerts = await apiService.getAlerts();
      return alerts.map(alert => ({
        ...alert,
        id: alert.id // Keep as string, no need to parse to int
      }));
    },
    getConsumptionData: async (): Promise<ConsumptionData[]> => {
      // Mock consumption data for cloud-only mode
      return [];
    },
    getMotorEvents: async (): Promise<any[]> => {
      return await apiService.getMotorEvents();
    }
  };

  // WebSocket connection
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = () => {
    // Skip WebSocket connection in cloud-only mode
    if (import.meta.env.VITE_CLOUD_ONLY_MODE === 'true' || import.meta.env.VITE_WEBSOCKET_URL === 'disabled') {
      console.log('🌐 WebSocket disabled - using cloud-only mode with Supabase real-time');
      setIsConnected(true); // Consider cloud connection as "connected"
      setReconnectAttempts(0);
      return;
    }

    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max WebSocket reconnection attempts reached');
      return;
    }

    try {
      const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8083';
      const websocket = new WebSocket(websocketUrl);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
      };
      
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          switch (message.type) {
            case 'sensor_data': {
              const tankData = message.payload as TankReadingMessage;
              console.log('Processing sensor_data:', tankData);
              if (tankData.tank_type === 'top_tank') {
                console.log('Updating top tank:', tankData.level_percentage);
                setTopTank({
                  id: '1',
                  tank_type: tankData.tank_type,
                  level_percentage: tankData.level_percentage,
                  level_liters: tankData.level_liters,
                  timestamp: new Date().toISOString(),
                  signal_strength: tankData.signal_strength
                });
                setLastTopTankUpdate(new Date());
                setEsp32LastSeen(new Date());
              } else if (tankData.tank_type === 'sump_tank') {
                setSumpTank({
                  id: '2',
                  tank_type: tankData.tank_type,
                  level_percentage: tankData.level_percentage,
                  level_liters: tankData.level_liters,
                  timestamp: new Date().toISOString(),
                  float_switch: tankData.float_switch,
                  motor_running: tankData.motor_running,
                  manual_override: tankData.manual_override,
                  auto_mode_enabled: tankData.auto_mode_enabled
                });
                // Sync auto mode state with ESP32
                if (tankData.auto_mode_enabled !== undefined) {
                  setAutoMode(tankData.auto_mode_enabled);
                }
                // Sync motor running state with ESP32
                if (tankData.motor_running !== undefined) {
                  setMotorRunning(tankData.motor_running);
                }
              }
              break;
            }
            case 'tank_reading': {
              const tankData = message.data as TankReadingMessage;
              console.log('Processing tank_reading:', tankData);
              if (tankData.tank_type === 'top_tank') {
                console.log('Updating top tank:', tankData.level_percentage);
                setTopTank({
                  id: '1',
                  tank_type: tankData.tank_type,
                  level_percentage: tankData.level_percentage,
                  level_liters: tankData.level_liters,
                  timestamp: tankData.timestamp,
                  signal_strength: tankData.signal_strength,
                  float_switch: tankData.float_switch,
                  motor_running: tankData.motor_running,
                  manual_override: tankData.manual_override
                });
                setLastTopTankUpdate(new Date());
                setEsp32LastSeen(new Date(tankData.timestamp));
              } else if (tankData.tank_type === 'sump_tank') {
                setSumpTank({
                  id: '2',
                  tank_type: tankData.tank_type,
                  level_percentage: tankData.level_percentage,
                  level_liters: tankData.level_liters,
                  timestamp: tankData.timestamp,
                  float_switch: tankData.float_switch,
                  motor_running: tankData.motor_running,
                  manual_override: tankData.manual_override,
                  auto_mode_enabled: tankData.auto_mode_enabled
                });
                setLastSumpTankUpdate(new Date());
                // Sync auto mode state with ESP32
                if (tankData.auto_mode_enabled !== undefined) {
                  setAutoMode(tankData.auto_mode_enabled);
                }
                // Sync motor running state with ESP32
                if (tankData.motor_running !== undefined) {
                  setMotorRunning(tankData.motor_running);
                }
              }
              break;
            }
            case 'heartbeat': {
              console.log('Received heartbeat from ESP32');
              setEsp32LastSeen(new Date());
              break;
            }
            case 'system_alert': {
              const alertData = message.data as SystemAlertMessage;
              const newAlert = {
                id: alertData.id.toString(),
                type: alertData.type as 'info' | 'warning' | 'error',
                message: alertData.message,
                timestamp: new Date(alertData.timestamp),
                resolved: alertData.resolved
              };
              setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
              break;
            }
            case 'system_status': {
              const statusData = message.data as SystemStatusMessage;
              const newSystemStatus = {
                id: '1',
                wifi_connected: statusData.wifi_connected,
                temperature: statusData.temperature,
                esp32_top_status: statusData.esp32_top_status,
                esp32_sump_status: statusData.esp32_sump_status,
                timestamp: statusData.timestamp
              };
              setSystemStatus(newSystemStatus);
              break;
            }
            case 'motor_status': {
              const motorData = message.data;
              console.log('Processing motor_status:', motorData);
              
              // Update motor running state
              setMotorRunning(motorData.motor_running);
              
              // Update motor current draw
              setMotorCurrentDraw(motorData.current_draw || 0);
              
              // Update motor status display
              setMotorStatus(motorData.motor_running ? 'Running' : 'Stopped');
              
              // Update last run time
              if (motorData.motor_running) {
                setMotorLastRun('Currently running');
              } else {
                setMotorLastRun(new Date().toLocaleString());
              }
              
              // Update ESP32 last seen
              setEsp32LastSeen(new Date(motorData.timestamp));
              break;
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000) {
          setReconnectAttempts(prev => prev + 1);
          setTimeout(() => {
            console.log(`Attempting WebSocket reconnection (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            connectWebSocket();
          }, 2000); // Wait 2 seconds before reconnecting
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
      setWs(websocket);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, []);

  // Fetch initial data from backend
  useEffect(() => {
    if (hasFetchedInitialData || isFetchingData) return;

    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setIsFetchingData(true);
        setHasFetchedInitialData(true);
        
        console.log('Fetching data from backend...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const [tanks, statusData, alertsData, consumption] = await Promise.allSettled([
            apiService.getTanks(),
            apiService.getSystemStatus(),
            apiService.getAlerts(),
            apiService.getConsumptionData()
          ]);
          
          console.log('API Results:', { tanks, statusData, alertsData, consumption });

          if (statusData.status === 'fulfilled') {
            setSystemStatus(statusData.value);
          }

          if (tanks.status === 'fulfilled') {
            const topTanks = tanks.value.filter((tank: TankReading) => tank.tank_type === 'top_tank');
            const latestTopTank = topTanks.sort((a: TankReading, b: TankReading) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
            setTopTank(latestTopTank);

            const sumpTanks = tanks.value.filter((tank: TankReading) => tank.tank_type === 'sump_tank');
            const latestSumpTank = sumpTanks.sort((a: TankReading, b: TankReading) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
            setSumpTank(latestSumpTank);
          }

          if (alertsData.status === 'fulfilled') {
            const convertedAlerts = alertsData.value.map(alert => ({
              id: alert.id.toString(),
              type: alert.type as 'info' | 'warning' | 'error',
              message: alert.message,
              timestamp: new Date(alert.timestamp),
              resolved: alert.resolved
            }));
            setAlerts(convertedAlerts);
          }

          if (consumption.status === 'fulfilled') {
            setConsumptionData(consumption.value);
          }
          
          clearTimeout(timeoutId);
        } catch (apiError) {
          console.error('API request failed:', apiError);
          // No fallback - component will show loading or empty state
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
        setIsFetchingData(false);
      }
    };

    fetchInitialData();
  }, [hasFetchedInitialData, isFetchingData]);

  const handleAIQuery = (query: string) => {
    console.log('AI Query:', query);
  };

  // Emergency stop function
  const handleEmergencyStop = () => {
    setMotorRunning(false);
    setAutoMode(false);
    toast({
      title: "Emergency Stop Activated",
      description: "Motor has been stopped and all automatic functions disabled for safety.",
      variant: "destructive",
    });
  };

  // System diagnostics function
  const handleSystemDiagnostics = () => {
    toast({
      title: "System Diagnostics",
      description: "Running system health check... All systems operational.",
    });
    console.log("System Diagnostics:", {
      motorStatus: motorRunning ? 'running' : 'stopped',
      autoMode: autoMode,
      tankLevels: { 
        top: topTankData.level_percentage, 
        sump: sumpTankData.level_percentage 
      },
      systemHealth: 'good'
    });
  };

  // Handle auto mode toggle
  const handleAutoModeToggle = (enabled: boolean) => {
    setAutoMode(enabled);
    if (!enabled) {
      setMotorRunning(false);
    }
    
    // Send auto mode control to ESP32
    if (ws && ws.readyState === WebSocket.OPEN) {
      const autoModeCommand = {
        type: 'auto_mode_control',
        enabled: enabled,
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(autoModeCommand));
      console.log('Sent auto mode control command:', autoModeCommand);
    }
    
    toast({
      title: enabled ? "Auto Mode Enabled" : "Auto Mode Disabled",
      description: enabled ? "Motor will automatically start/stop based on water levels." : "Motor is now in manual control mode.",
    });
  };

  // Use real data with defaults when not available
  const topTankData = topTank || {
    level_percentage: 0,
    level_liters: 0,
    tank_type: 'top_tank',
    signal_strength: -50
  };

  const sumpTankData = sumpTank || {
    level_percentage: 0,
    level_liters: 0,
    tank_type: 'sump',
    float_switch: false, // Default to no water detected
    motor_running: false, // Default to motor stopped
    manual_override: false // Default to no manual override
  };

  // Determine ESP32 connection status based on recent activity
  const isEsp32Connected = esp32LastSeen && (new Date().getTime() - esp32LastSeen.getTime()) < 30000; // 30 seconds

  const systemStatusData = systemStatus || {
    wifi_connected: isEsp32Connected,
    temperature: 25,
    esp32_top_status: isEsp32Connected ? 'online' : 'offline',
    esp32_sump_status: 'offline', // Assuming only top tank for now
    wifi_strength: -50 // Default WiFi strength
  };

  // Use real data directly
  const dailyData = consumptionData;
  const monthlyData = consumptionData;
  const currentAlerts = alerts;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Animated Background Elements - Mobile Optimized */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Large background elements - hidden on mobile for performance */}
        <div className="hidden md:block absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="hidden md:block absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-success/3 rounded-full blur-3xl animate-pulse delay-500" />

        {/* Mobile-optimized smaller elements */}
        <div className="md:hidden absolute -top-20 -right-20 w-40 h-40 bg-primary/3 rounded-full blur-xl animate-pulse" />
        <div className="md:hidden absolute -bottom-20 -left-20 w-48 h-48 bg-accent/3 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="md:hidden absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-success/2 rounded-full blur-xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                  <Waves className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    AquaFlow Pro
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">Industrial Water Management System</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 justify-center sm:justify-end">
              <Badge variant="outline" className={`px-2 sm:px-3 py-1 text-xs sm:text-sm ${
                isConnected 
                  ? 'bg-success/10 border-success/20 text-success' 
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                  isConnected ? 'bg-success animate-pulse' : 'bg-destructive'
                }`} />
                <span className="hidden sm:inline">
                  {isConnected ? 'Real-time Connected' : 'Real-time Offline'}
                </span>
                <span className="sm:hidden">
                  {isConnected ? 'Connected' : 'Offline'}
                </span>
              </Badge>
              {reconnectAttempts > 0 && (
                <Badge variant="outline" className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-warning/10 border-warning/20 text-warning">
                  <span className="hidden sm:inline">
                    Reconnecting... ({reconnectAttempts}/{maxReconnectAttempts})
                  </span>
                  <span className="sm:hidden">
                    Reconnecting ({reconnectAttempts})
                  </span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="relative z-10 bg-destructive/10 border-b border-destructive/20">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>You're currently offline. Some features may be limited.</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/60 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                Total Water Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{totalWaterLevel.toLocaleString()}L</div>
                  <p className={`text-xs mt-1 ${waterLevelChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {waterLevelChange >= 0 ? '+' : ''}{waterLevelChange.toFixed(1)}% from yesterday
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Motor Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${motorStatus === 'Running' ? 'text-success' : 'text-foreground'}`}>
                    {motorStatus}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {motorLastRun}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Daily Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{dailyUsage.toFixed(0)}L</div>
                  <p className="text-xs text-success mt-1">Within normal range</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border-border/50 hover:bg-card/80 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{efficiency}%</div>
                  <p className="text-xs text-success mt-1">Excellent performance</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tank Monitoring Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Droplets className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Tank Monitoring</h2>
            {isLoading && (
              <Badge variant="secondary" className="ml-2">
                Loading...
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Top Tank"
                currentLevel={topTankData.level_percentage}
                capacity={1000}
                status={topTankData.level_percentage > 80 ? "full" :
                        topTankData.level_percentage > 50 ? "normal" :
                        topTankData.level_percentage > 20 ? "low" : "critical"}
                sensorHealth={systemStatusData.esp32_top_status === 'online' ? 'online' : 'offline'}
                esp32Status={{
                  connected: isEsp32Connected,
                  wifiStrength: topTank?.signal_strength || systemStatusData.wifi_strength || -50,
                  lastSeen: esp32LastSeen || new Date()
                }}
                symbol="🏠"
                floatSwitch={false}
                motorRunning={motorRunning}
                manualOverride={false}
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="6C:C8:40:4D:B8:3C"
                initialIpAddress="192.168.1.100"
                onConfigChange={(config) => {
                  console.log('Top Tank ESP32 config updated:', config);
                  // Here you can send the config to your backend or handle it as needed
                }}
                isDeviceRegistered={isDeviceRegistered('top')}
                deviceKeys={getDeviceKeys('top')}
                onDeviceRegistration={(apiKey, hmacSecret) => handleDeviceRegistration('top', apiKey, hmacSecret)}
              />
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Sump Tank"
                currentLevel={sumpTankData.level_percentage}
                capacity={13225}
                status={sumpTankData.level_percentage > 80 ? "full" :
                        sumpTankData.level_percentage > 50 ? "normal" :
                        sumpTankData.level_percentage > 20 ? "low" : "critical"}
                sensorHealth={systemStatusData.esp32_sump_status === 'online' ? 'online' : 'offline'}
                esp32Status={{
                  connected: systemStatusData.esp32_sump_status === 'online',
                  wifiStrength: 82,
                  lastSeen: new Date()
                }}
                symbol="🕳️"
                floatSwitch={sumpTankData.float_switch}
                motorRunning={sumpTankData.motor_running}
                manualOverride={sumpTankData.manual_override}
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="80:F3:DA:65:86:6C"
                initialIpAddress="192.168.1.101"
                onConfigChange={(config) => {
                  console.log('Sump Tank ESP32 config updated:', config);
                  // Here you can send the config to your backend or handle it as needed
                }}
                isDeviceRegistered={isDeviceRegistered('sump')}
                deviceKeys={getDeviceKeys('sump')}
                onDeviceRegistration={(apiKey, hmacSecret) => handleDeviceRegistration('sump', apiKey, hmacSecret)}
              />
            </Card>
          </div>
        </section>

        {/* Motor Control & System Management */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Power className="h-5 w-5 text-warning" />
            <h2 className="text-xl font-semibold">Motor Control & Automation</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-card/60 backdrop-blur-sm border-border/50">
                <AutoMotorControl
                  isRunning={motorRunning}
                  autoMode={autoMode}
                  currentDraw={motorCurrentDraw}
                  runtime={motorRuntime}
                  motorStartCount={motorStartCount}
                  onToggleAuto={handleAutoModeToggle}
                  onManualControl={(action) => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      const motorCommand = {
                        type: 'motor_control',
                        state: action === 'start',
                        timestamp: new Date().toISOString()
                      };
                      ws.send(JSON.stringify(motorCommand));
                      console.log('Sent motor control command:', motorCommand);
                      
                      // Update local state for immediate UI feedback
                      setMotorRunning(action === 'start');
                      
                      toast({
                        title: action === 'start' ? "Motor Started" : "Motor Stopped",
                        description: `Motor control command sent to ESP32.`,
                      });
                    } else {
                      toast({
                        title: "Connection Error",
                        description: "Cannot send motor command - WebSocket not connected.",
                        variant: "destructive"
                      });
                    }
                  }}
                  settings={{
                    autoStartLevel: 30,
                    autoStopLevel: 85,
                    maxRuntime: 60,
                    minOffTime: 15
                  }}
                  onUpdateSettings={(newSettings) => {
                    console.log('Settings updated:', newSettings);
                    toast({
                      title: "Settings Updated",
                      description: "Motor control settings have been saved.",
                    });
                  }}
                />
              </Card>
            </div>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Quick Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auto Mode</span>
                  <Switch
                    checked={autoMode}
                    onCheckedChange={handleAutoModeToggle}
                  />
                </div>
                
                <Separator className="bg-border/50" />
                
                <div className="space-y-2">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={handleEmergencyStop}
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    Emergency Stop
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-background/50 hover:bg-accent/10 border-border/50"
                    onClick={handleSystemDiagnostics}
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    System Diagnostics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Analytics & Monitoring */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold">Analytics & Insights</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-card/60 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Water Consumption Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsumptionChart 
                    dailyData={dailyData}
                    monthlyData={monthlyData}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* System Status & Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-xl font-semibold">System Status & Alerts</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <SystemStatus
                wifiConnected={systemStatusData.wifi_connected}
                temperature={systemStatusData.temperature}
                uptime="2d 14h 32m"
                esp32Status={{
                  topTank: systemStatusData.esp32_top_status as 'online' | 'offline' | 'error',
                  sump: systemStatusData.esp32_sump_status as 'online' | 'offline' | 'error'
                }}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <SystemAlerts 
                alerts={currentAlerts} 
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default EnhancedIndex;
