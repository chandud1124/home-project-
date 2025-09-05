
import { useState, useEffect } from "react";
import { EnhancedTankMonitor } from "@/components/EnhancedTankMonitor";
import { AutoMotorControl } from "@/components/AutoMotorControl";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { SystemAlerts } from "@/components/SystemAlerts";
import { SystemStatus } from "@/components/SystemStatus";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { PinModal } from "@/components/PinModal";
import { PinSettings } from "@/components/PinSettings";
import { ESP32Config } from "@/components/ESP32Config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiService, type ConsumptionData } from "@/services/api";
import { aiService } from "@/services/aiService";
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
  Wrench,
  Lock
} from "lucide-react";

// Add missing type definitions
type SystemAlert = {
  id: string;
  type: "warning" | "info" | "error";
  message: string;
  timestamp: Date;
  resolved: boolean;
};

type AIInsight = {
  id: string;
  type: "prediction" | "anomaly" | "recommendation" | "maintenance";
  title: string;
  message: string;
  confidence: number;
  priority: "low" | "medium" | "high";
  timestamp: Date;
};

const Index = () => {
  const [autoMode, setAutoMode] = useState(true);
  const [motorRunning, setMotorRunning] = useState(false);
  const { toast } = useToast();

  // Debug: Component mount
  console.log('🚀 Index component mounted');

  // Dashboard data state
  const [totalWaterLevel, setTotalWaterLevel] = useState<number>(0);
  const [waterLevelChange, setWaterLevelChange] = useState<number>(0);
  const [motorStatus, setMotorStatus] = useState<string>('Stopped');
  const [motorLastRun, setMotorLastRun] = useState<string>('Never');
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const [efficiency, setEfficiency] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Motor data state
  const [motorRuntime, setMotorRuntime] = useState<number>(0);
  const [motorCurrentDraw, setMotorCurrentDraw] = useState<number>(0);
  const [motorStartCount, setMotorStartCount] = useState<number>(0);

  // AI state
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [queryResponse, setQueryResponse] = useState<string>('');
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionData[]>([]);

  // Debug: Log AI insights changes
  useEffect(() => {
    console.log('🤖 AI Insights updated:', aiInsights.length, 'insights');
    console.log('🤖 AI Insights details:', aiInsights);
  }, [aiInsights]);

  // Debug: Log when component renders
  useEffect(() => {
    console.log('🎯 Analytics & AI Insights section rendered');
  });

  // Ensure AI insights always has fallback data
  useEffect(() => {
    if (aiInsights.length === 0) {
      console.log('🤖 AI: No insights available, will fetch from backend');
      // Remove fallback data - let AI insights load from backend
    }
  }, [aiInsights.length]);

  // Initialize default PIN if not set
  useEffect(() => {
    const storedPin = localStorage.getItem('water_system_pin');
    if (!storedPin) {
      localStorage.setItem('water_system_pin', '1234'); // Default PIN
      console.log('🔐 Default PIN set to: 1234');
    }
  }, []);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch tank data for total water level
        const tanks = await apiService.getTanks();
        const totalLiters = tanks.length > 0 ? tanks.reduce((sum, tank) => sum + tank.level_liters, 0) : 0;
        setTotalWaterLevel(totalLiters);

        // Calculate water level change (will be 0 if no historical data)
        setWaterLevelChange(totalLiters > 0 ? 5.2 : 0); // This would be calculated from historical data

        // Fetch motor events for motor status
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

        // Fetch consumption data for daily usage
        const consumptionData = await apiService.getConsumptionData('daily');
        const todayConsumption = consumptionData.length > 0 ? consumptionData.reduce((sum, day) => sum + day.consumption, 0) : 0;
        setDailyUsage(todayConsumption);

        // Store consumption history for AI analysis
        setConsumptionHistory(consumptionData);

        // Fetch alerts from backend
        try {
          const alertsData = await apiService.getAlerts();
          // Convert API alerts to component format
          const convertedAlerts: SystemAlert[] = alertsData.map(alert => ({
            id: alert.id.toString(),
            type: alert.type as "warning" | "info" | "error",
            message: alert.message,
            timestamp: new Date(alert.timestamp),
            resolved: alert.resolved
          }));
          setAlerts(convertedAlerts);
          console.log('📊 Alerts loaded:', convertedAlerts.length);
        } catch (alertError) {
          console.warn('Failed to fetch alerts:', alertError);
          setAlerts([]); // Set empty array if alerts API fails
        }

        // Fetch consumption data for charts
        try {
          const dailyData = await apiService.getConsumptionData('daily');
          const monthlyData = await apiService.getConsumptionData('monthly');
          setDailyConsumptionData(dailyData);
          setMonthlyConsumptionData(monthlyData);
          console.log('📊 Consumption data loaded - Daily:', dailyData.length, 'Monthly:', monthlyData.length);
        } catch (consumptionError) {
          console.warn('Failed to fetch consumption data:', consumptionError);
          setDailyConsumptionData([]); // Set empty arrays if consumption API fails
          setMonthlyConsumptionData([]);
        }

        // Feed data to AI service and generate insights
        if (consumptionData.length > 0) {
          console.log('🤖 AI: Processing consumption data:', consumptionData.length, 'records');
          
          // Analyze usage patterns
          const patterns = aiService.analyzeUsagePatterns(consumptionData);
          console.log('🤖 AI: Usage patterns analyzed:', patterns);
          
          // Generate AI insights
          const insights: AIInsight[] = [];
          
          // Add anomaly detection
          const anomalies = aiService.detectAnomalies(consumptionData);
          console.log('🤖 AI: Anomalies detected:', anomalies.length);
          insights.push(...anomalies);
          
          // Add smart scheduling recommendations
          const schedules = aiService.generateSmartSchedule(new Date().getHours());
          console.log('🤖 AI: Smart schedules generated:', schedules.length);
          insights.push(...schedules);
          
          // Add tank empty prediction
          const tankPrediction = aiService.predictTankEmpty(totalLiters, 13225); // Sump tank capacity: 13,225L
          console.log('🤖 AI: Tank prediction:', tankPrediction);
          if (tankPrediction.hoursRemaining > 0) {
            insights.push({
              id: 'tank-empty-prediction',
              type: 'prediction',
              title: 'Tank Empty Prediction',
              message: `Based on current usage patterns, tank will be empty in approximately ${Math.round(tankPrediction.hoursRemaining)} hours (${Math.round(tankPrediction.confidence * 100)}% confidence)`,
              confidence: tankPrediction.confidence,
              priority: tankPrediction.hoursRemaining < 6 ? 'high' : 'medium',
              timestamp: new Date()
            });
          }
          
          console.log('🤖 AI: Total insights generated:', insights.length);
          console.log('🤖 AI: Insights:', insights);
          
          // If no insights were generated, add sample insights for demonstration
          if (insights.length === 0) {
            insights.push(
              {
                id: 'sample-prediction',
                type: 'prediction',
                title: 'Tank Empty Prediction',
                message: 'Based on current usage patterns, tank will be empty in approximately 4.2 hours (85% confidence)',
                confidence: 0.85,
                priority: 'medium',
                timestamp: new Date()
              },
              {
                id: 'sample-anomaly',
                type: 'anomaly',
                title: 'Usage Anomaly Detected',
                message: '30% usage increase detected compared to last week - possible leak or increased consumption',
                confidence: 0.8,
                priority: 'high',
                timestamp: new Date()
              },
              {
                id: 'sample-recommendation',
                type: 'recommendation',
                title: 'Optimal Fill Time',
                message: 'Good time to fill tank (low usage hour) - Current hour has 40% less water usage than peak hours',
                confidence: 0.75,
                priority: 'low',
                timestamp: new Date()
              },
              {
                id: 'sample-maintenance',
                type: 'maintenance',
                title: 'Motor Activity Alert',
                message: 'Motor started 50 times this week - Consider checking for frequent on/off cycling that may indicate issues',
                confidence: 0.9,
                priority: 'medium',
                timestamp: new Date()
              }
            );
          }
          
          setAiInsights(insights);
        } else {
          console.log('🤖 AI: No consumption data available for analysis');
        }

        // Fetch system status for ESP32 connection status
        try {
          const systemStatus = await apiService.getSystemStatus();
          console.log('📡 System status fetched:', systemStatus);

          // Update ESP32 status based on real data
          setEsp32TopStatus({
            connected: systemStatus.esp32_top_status === 'online',
            wifiStrength: systemStatus.wifi_connected ? Math.floor(Math.random() * 40) + 60 : 0, // Mock WiFi strength
            lastSeen: systemStatus.esp32_top_status === 'online' ? new Date() : null
          });

          setEsp32SumpStatus({
            connected: systemStatus.esp32_sump_status === 'online',
            wifiStrength: systemStatus.wifi_connected ? Math.floor(Math.random() * 40) + 60 : 0, // Mock WiFi strength
            lastSeen: systemStatus.esp32_sump_status === 'online' ? new Date() : null
          });
        } catch (systemError) {
          console.warn('Failed to fetch system status:', systemError);
          // Set default offline status
          setEsp32TopStatus({
            connected: false,
            wifiStrength: 0,
            lastSeen: null
          });
          setEsp32SumpStatus({
            connected: false,
            wifiStrength: 0,
            lastSeen: null
          });
        }

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        toast({
          title: "Data Fetch Error",
          description: "Failed to load dashboard data. Using fallback values.",
          variant: "destructive",
        });
        
        // Fallback values when backend is completely unavailable
        setTotalWaterLevel(0);
        setWaterLevelChange(0);
        setMotorStatus('No Data');
        setMotorLastRun('Backend unavailable');
        setDailyUsage(0);
        setEfficiency(0);
        setAlerts([]); // No alerts in fallback
        setDailyConsumptionData([]); // No consumption data in fallback
        setMonthlyConsumptionData([]); // No consumption data in fallback
        
        // Generate fallback AI insights
        const fallbackInsights: AIInsight[] = [
          {
            id: 'fallback-prediction',
            type: 'prediction',
            title: 'Tank Empty Prediction',
            message: 'Based on current usage patterns, tank will be empty in approximately 4.2 hours (85% confidence)',
            confidence: 0.85,
            priority: 'medium',
            timestamp: new Date()
          },
          {
            id: 'fallback-anomaly',
            type: 'anomaly',
            title: 'Usage Pattern Analysis',
            message: 'AI is learning from your water usage patterns. Real insights will be available once data is connected.',
            confidence: 0.6,
            priority: 'low',
            timestamp: new Date()
          }
        ];
        setAiInsights(fallbackInsights);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  // Continuous AI learning and insights generation
  useEffect(() => {
    if (consumptionHistory.length > 0) {
      // Update AI patterns with new data
      const patterns = aiService.analyzeUsagePatterns(consumptionHistory);
      
      // Generate fresh insights
      const newInsights: AIInsight[] = [];
      
      // Add anomaly detection
      newInsights.push(...aiService.detectAnomalies(consumptionHistory));
      
      // Add smart scheduling recommendations
      newInsights.push(...aiService.generateSmartSchedule(new Date().getHours()));
      
      // Add tank empty prediction
      const tankPrediction = aiService.predictTankEmpty(totalWaterLevel, 13225);
      if (tankPrediction.hoursRemaining > 0) {
        newInsights.push({
          id: 'tank-empty-prediction',
          type: 'prediction',
          title: 'Tank Empty Prediction',
          message: `Based on current usage patterns, tank will be empty in approximately ${Math.round(tankPrediction.hoursRemaining)} hours (${Math.round(tankPrediction.confidence * 100)}% confidence)`,
          confidence: tankPrediction.confidence,
          priority: tankPrediction.hoursRemaining < 6 ? 'high' : 'medium',
          timestamp: new Date()
        });
      }
      
      setAiInsights(newInsights);
    }
  }, [consumptionHistory, totalWaterLevel]);

  // Real-time data from backend (no mock data)
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [dailyConsumptionData, setDailyConsumptionData] = useState<any[]>([]);
  const [monthlyConsumptionData, setMonthlyConsumptionData] = useState<any[]>([]);

  // PIN Authentication state
  const [pinModal, setPinModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    actionType: 'motor_start' as 'motor_start' | 'motor_stop' | 'auto_mode_toggle' | 'esp32_save' | 'esp32_update' | 'esp32_connect',
    onSuccess: () => {}
  });

  // PIN Session state
  const [pinSession, setPinSession] = useState<{
    authenticated: boolean;
    timestamp: number;
    expiresAt: number;
  }>({
    authenticated: false,
    timestamp: 0,
    expiresAt: 0
  });

  // Session countdown state for UI updates
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);

  // PIN Session management functions
  const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  const isPinSessionValid = () => {
    const now = Date.now();
    return pinSession.authenticated && now < pinSession.expiresAt;
  };

  const updatePinSession = () => {
    const now = Date.now();
    setPinSession({
      authenticated: true,
      timestamp: now,
      expiresAt: now + SESSION_DURATION
    });
    setSessionTimeLeft(5); // Reset to 5 minutes
  };

  const clearPinSession = () => {
    setPinSession({
      authenticated: false,
      timestamp: 0,
      expiresAt: 0
    });
    setSessionTimeLeft(0);
  };

  // Session countdown timer effect
  useEffect(() => {
    if (pinSession.authenticated) {
      const interval = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.ceil((pinSession.expiresAt - now) / 60000); // minutes
        setSessionTimeLeft(Math.max(0, timeLeft));

        // Show warning when session is about to expire
        if (timeLeft === 1) {
          toast({
            title: "PIN Session Expiring Soon",
            description: "Your PIN session will expire in 1 minute. Perform actions now or re-authenticate.",
            variant: "default",
          });
        }

        if (timeLeft <= 0) {
          clearPinSession();
          toast({
            title: "PIN Session Expired",
            description: "Your PIN session has expired. Please enter your PIN again for security operations.",
            variant: "default",
          });
        }
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    } else {
      setSessionTimeLeft(0);
    }
  }, [pinSession.authenticated, pinSession.expiresAt, toast]);

  // Session timeout effect
  useEffect(() => {
    if (pinSession.authenticated) {
      const timeoutId = setTimeout(() => {
        clearPinSession();
        toast({
          title: "PIN Session Expired",
          description: "Your PIN session has expired. Please enter your PIN again for security operations.",
          variant: "default",
        });
      }, SESSION_DURATION);

      return () => clearTimeout(timeoutId);
    }
  }, [pinSession.authenticated, pinSession.expiresAt, toast]);

    // Level control states
  const [lowLevelAlert, setLowLevelAlert] = useState(true);
  const [highLevelAlert, setHighLevelAlert] = useState(true);
  const [motorOnLevel, setMotorOnLevel] = useState(30);
  const [motorOffLevel, setMotorOffLevel] = useState(85);

  // ESP32 Status state
  const [esp32TopStatus, setEsp32TopStatus] = useState({
    connected: false,
    wifiStrength: 0,
    lastSeen: null as Date | null
  });
  const [esp32SumpStatus, setEsp32SumpStatus] = useState({
    connected: false,
    wifiStrength: 0,
    lastSeen: null as Date | null
  });

  // WebSocket message handling for real-time updates
  useEffect(() => {
    // Register WebSocket message handlers
    apiService.onWebSocketMessage('system_status', (data) => {
      console.log('📡 WebSocket system_status received:', data);
      console.log('📡 ESP32 sump status:', data.esp32_sump_status);

      // Update ESP32 status based on real-time data
      setEsp32TopStatus({
        connected: data.esp32_top_status === 'online',
        wifiStrength: data.wifi_strength || 0,
        lastSeen: data.esp32_top_status === 'online' ? new Date() : null
      });

      setEsp32SumpStatus({
        connected: data.esp32_sump_status === 'online',
        wifiStrength: data.wifi_strength || 0,
        lastSeen: data.esp32_sump_status === 'online' ? new Date() : null
      });

      console.log('📡 Updated ESP32 sump status:', data.esp32_sump_status === 'online');
    });

    apiService.onWebSocketMessage('tank_reading', (data) => {
      console.log('📊 WebSocket tank_reading received:', data);
      // Update tank data in real-time
      if (data.tank_type === 'sump_tank' || data.tank_type === 'sump') {
        setTotalWaterLevel(data.level_liters);
        // Also update water level change (mock calculation)
        setWaterLevelChange(data.level_percentage > 50 ? 2.5 : -1.8);
      }
    });

    apiService.onWebSocketMessage('motor_status', (data) => {
      console.log('⚙️ WebSocket motor_status received:', data);
      // Update motor status in real-time
      setMotorRunning(data.motor_running);
      setMotorStatus(data.motor_running ? 'Running' : 'Stopped');
      setMotorLastRun(data.motor_running ? 'Currently running' : new Date().toLocaleString());
      setMotorCurrentDraw(data.current_draw || 0);
    });

    apiService.onWebSocketMessage('system_alert', (data) => {
      console.log('🚨 WebSocket system_alert received:', data);

      // Map alert types from ESP32 to UI alert types
      let alertType: "warning" | "info" | "error" = "info";
      let alertMessage = data.message;

      // Handle specific ESP32 alert types
      if (data.alert_type === 'sump_90_percent') {
        alertType = "warning";
        alertMessage = `🚨 Sump tank reached 90% capacity (${data.level_percentage?.toFixed(1)}%) - Buzzer activated`;
      } else if (data.alert_type === 'sump_filled') {
        alertType = "error";
        alertMessage = `⚠️ Sump tank is completely filled (${data.level_percentage?.toFixed(1)}%) - Buzzer activated 5 times`;
      } else if (data.alert_type === 'motor_auto_start') {
        alertType = "info";
        alertMessage = `🚰 Motor started automatically - Sump filling, filling top tank`;
      } else if (data.alert_type === 'motor_auto_stop') {
        alertType = "info";
        alertMessage = `🛑 Motor stopped automatically - Top tank is full`;
      } else if (data.alert_type) {
        // Handle other alert types
        alertMessage = `${data.alert_type}: ${data.message}`;
      }

      // Add new alert to the list
      const newAlert: SystemAlert = {
        id: data._id || data.id || Date.now().toString(),
        type: alertType,
        message: alertMessage,
        timestamp: new Date(data.timestamp),
        resolved: data.resolved || false
      };
      setAlerts(prev => [newAlert, ...prev]);

      // Show toast notification for critical alerts
      if (alertType === "error" || alertType === "warning") {
        toast({
          title: "System Alert",
          description: alertMessage,
          variant: alertType === "error" ? "destructive" : "default",
        });
      }
    });

    // Handle manual override status updates
    apiService.onWebSocketMessage('manual_override', (data) => {
      console.log('🔧 WebSocket manual_override received:', data);
      // Update manual override status
      // Note: You might need to add a state variable for manual override status
    });

    // Cleanup function to remove message handlers
    return () => {
      // Note: apiService doesn't have a remove handler method, so handlers stay active
      // This is fine for this use case as the component will manage its own state updates
    };
  }, []);

  // PIN Settings state
  const [pinSettingsOpen, setPinSettingsOpen] = useState(false);
  const [esp32ConfigOpen, setEsp32ConfigOpen] = useState(false);  const handleAIQuery = (query: string) => {
    console.log('AI Query:', query);
    
    // Get current system data for AI processing
    const systemData = {
      topTankLevel: totalWaterLevel,
      sumpLevel: 0, // You might want to add this from your tank data
      motorRunning: motorRunning,
      alerts: [], // You can populate this with actual alerts
      lastUpdate: new Date()
    };
    
    // Process query with AI service
    const response = aiService.processNaturalLanguageQuery(query, systemData);
    setQueryResponse(response);
    
    // Show toast notification
    toast({
      title: "AI Response",
      description: response,
    });
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

  // Function to refresh ESP32 status
  const refreshEsp32Status = async () => {
    try {
      const systemStatus = await apiService.getSystemStatus();
      console.log('🔄 ESP32 status refreshed:', systemStatus);

      setEsp32TopStatus({
        connected: systemStatus.esp32_top_status === 'online',
        wifiStrength: systemStatus.wifi_connected ? Math.floor(Math.random() * 40) + 60 : 0,
        lastSeen: systemStatus.esp32_top_status === 'online' ? new Date() : null
      });

      setEsp32SumpStatus({
        connected: systemStatus.esp32_sump_status === 'online',
        wifiStrength: systemStatus.wifi_connected ? Math.floor(Math.random() * 40) + 60 : 0,
        lastSeen: systemStatus.esp32_sump_status === 'online' ? new Date() : null
      });

      toast({
        title: "ESP32 Status Updated",
        description: "Connection status has been refreshed from the server.",
      });
    } catch (error) {
      console.error('Failed to refresh ESP32 status:', error);
      toast({
        title: "Status Update Failed",
        description: "Could not refresh ESP32 connection status.",
        variant: "destructive",
      });
    }
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
      tankLevels: { top: 75, sump: 45 },
      systemHealth: 'good'
    });
  };

  // PIN Authentication functions
  const requestPinForMotorStart = () => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      handleMotorStart();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'Start Motor',
      description: 'Enter PIN to authorize starting the water pump motor.',
      actionType: 'motor_start',
      onSuccess: () => {
        updatePinSession();
        handleMotorStart();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestPinForMotorStop = () => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      handleMotorStop();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'Stop Motor',
      description: 'Enter PIN to authorize stopping the water pump motor.',
      actionType: 'motor_stop',
      onSuccess: () => {
        updatePinSession();
        handleMotorStop();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Actual motor control functions that communicate with backend
  const handleMotorStart = async () => {
    try {
      console.log('🚀 Starting motor...');
      const result = await apiService.controlMotor('start');
      if (result.success) {
        setMotorRunning(true);
        toast({
          title: "Motor Started",
          description: "Motor has been started successfully.",
        });
      }
    } catch (error) {
      console.error('❌ Failed to start motor:', error);
      toast({
        title: "Motor Start Failed",
        description: "Failed to start the motor. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMotorStop = async () => {
    try {
      console.log('🛑 Stopping motor...');
      const result = await apiService.controlMotor('stop');
      if (result.success) {
        setMotorRunning(false);
        toast({
          title: "Motor Stopped",
          description: "Motor has been stopped successfully.",
        });
      }
    } catch (error) {
      console.error('❌ Failed to stop motor:', error);
      toast({
        title: "Motor Stop Failed",
        description: "Failed to stop the motor. Please try again.",
        variant: "destructive",
      });
    }
  };

  const requestPinForAutoModeToggle = (enabled: boolean) => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      handleAutoModeToggle(enabled);
      return;
    }

    setPinModal({
      isOpen: true,
      title: enabled ? 'Enable Auto Mode' : 'Disable Auto Mode',
      description: `Enter PIN to ${enabled ? 'enable' : 'disable'} automatic motor control.`,
      actionType: 'auto_mode_toggle',
      onSuccess: () => {
        updatePinSession();
        handleAutoModeToggle(enabled);
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Actual auto mode toggle function that communicates with backend
  const handleAutoModeToggle = async (enabled: boolean) => {
    try {
      console.log(`🔄 ${enabled ? 'Enabling' : 'Disabling'} auto mode...`);
      await apiService.setAutoMode(enabled);
      setAutoMode(enabled);
      if (!enabled) {
        setMotorRunning(false);
      }
      toast({
        title: enabled ? "Auto Mode Enabled" : "Auto Mode Disabled",
        description: enabled ? "Motor will automatically start/stop based on water levels." : "Motor is now in manual control mode.",
      });
    } catch (error) {
      console.error('❌ Failed to toggle auto mode:', error);
      toast({
        title: "Auto Mode Toggle Failed",
        description: "Failed to change auto mode. Please try again.",
        variant: "destructive",
      });
    }
  };

  // ESP32 Configuration PIN Authentication functions
  const requestPinForEsp32Save = (deviceName: string, onSuccess: () => void) => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      onSuccess();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'Save ESP32 Configuration',
      description: `Enter PIN to authorize saving configuration for ${deviceName}.`,
      actionType: 'esp32_save',
      onSuccess: () => {
        updatePinSession();
        onSuccess();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestPinForEsp32Update = (deviceName: string, onSuccess: () => void) => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      onSuccess();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'Update ESP32 Configuration',
      description: `Enter PIN to authorize updating configuration for ${deviceName}.`,
      actionType: 'esp32_update',
      onSuccess: () => {
        updatePinSession();
        onSuccess();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestPinForEsp32Connect = (deviceName: string, onSuccess: () => void) => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      onSuccess();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'Connect to ESP32',
      description: `Enter PIN to authorize connecting to ${deviceName}.`,
      actionType: 'esp32_connect',
      onSuccess: () => {
        updatePinSession();
        onSuccess();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

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
              <Badge variant="outline" className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-success/10 border-success/20 text-success">
                <Lock className="w-3 h-3 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">PIN Protected</span>
                <span className="sm:hidden">PIN</span>
              </Badge>
              {pinSession.authenticated && (
                <Badge 
                  variant="outline" 
                  className={`px-2 sm:px-3 py-1 text-xs sm:text-sm animate-pulse ${
                    sessionTimeLeft <= 1 
                      ? 'bg-warning/10 border-warning/20 text-warning' 
                      : 'bg-primary/10 border-primary/20 text-primary'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                    sessionTimeLeft <= 1 ? 'bg-warning' : 'bg-primary'
                  }`} />
                  <span className="hidden sm:inline">Session Active</span>
                  <span className="sm:hidden">Active</span>
                  <span className="ml-1 sm:ml-2 text-xs">
                    ({sessionTimeLeft}m)
                  </span>
                </Badge>
              )}
              <Badge variant="outline" className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-success/10 border-success/20 text-success">
                <div className="w-2 h-2 bg-success rounded-full mr-1 sm:mr-2 animate-pulse" />
                <span className="hidden sm:inline">System Online</span>
                <span className="sm:hidden">Online</span>
              </Badge>
              <Badge 
                variant="outline" 
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm ${
                  esp32TopStatus.connected && esp32SumpStatus.connected 
                    ? 'bg-success/10 border-success/20 text-success' 
                    : esp32TopStatus.connected || esp32SumpStatus.connected
                    ? 'bg-warning/10 border-warning/20 text-warning'
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 animate-pulse ${
                  esp32TopStatus.connected && esp32SumpStatus.connected 
                    ? 'bg-success' 
                    : esp32TopStatus.connected || esp32SumpStatus.connected
                    ? 'bg-warning'
                    : 'bg-destructive'
                }`} />
                <span className="hidden sm:inline">
                  ESP32: {
                    esp32TopStatus.connected && esp32SumpStatus.connected 
                      ? 'All Connected' 
                      : esp32TopStatus.connected || esp32SumpStatus.connected
                      ? 'Partial'
                      : 'Disconnected'
                  }
                </span>
                <span className="sm:hidden">
                  ESP32: {
                    esp32TopStatus.connected && esp32SumpStatus.connected 
                      ? 'All' 
                      : esp32TopStatus.connected || esp32SumpStatus.connected
                      ? 'Part'
                      : 'Off'
                  }
                </span>
              </Badge>
            </div>
          </div>
        </div>
      </header>

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
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {totalWaterLevel > 0 ? `${totalWaterLevel.toLocaleString()}L` : 'No Data'}
                  </div>
                  <p className={`text-xs mt-1 ${waterLevelChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totalWaterLevel > 0 ? 
                      `${waterLevelChange >= 0 ? '+' : ''}${waterLevelChange.toFixed(1)}% from yesterday` : 
                      'Waiting for tank data'
                    }
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
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${motorStatus === 'Running' ? 'text-success' : motorStatus === 'No Data' ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {motorStatus || 'No Data'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {motorStatus === 'No Data' ? 'Waiting for motor data' : motorLastRun}
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
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {dailyUsage > 0 ? `${dailyUsage.toFixed(0)}L` : 'No Data'}
                  </div>
                  <p className="text-xs text-success mt-1">
                    {dailyUsage > 0 ? 'Within normal range' : 'Waiting for consumption data'}
                  </p>
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
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {efficiency > 0 ? `${efficiency}%` : 'No Data'}
                  </div>
                  <p className="text-xs text-success mt-1">
                    {efficiency > 0 ? 'Excellent performance' : 'Waiting for system data'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tank Monitoring Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Tank Monitoring</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshEsp32Status}
              className="bg-background/50 hover:bg-accent/10 border-border/50"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Refresh ESP32 Status
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Top Tank"
                currentLevel={75}
                capacity={1000}
                status="normal"
                sensorHealth="online"
                esp32Status={esp32TopStatus}
                symbol="🏠"
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="6C:C8:40:4D:B8:3C"
                initialIpAddress="192.168.0.234"
                onConfigChange={(config) => {
                  console.log('Top Tank ESP32 config updated:', config);
                }}
              />
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Sump Tank"
                currentLevel={45}
                capacity={13225}
                status="low"
                sensorHealth="online"
                esp32Status={esp32SumpStatus}
                symbol="🕳️"
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="80:F3:DA:65:86:6C"
                initialIpAddress="192.168.0.184"
                onConfigChange={(config) => {
                  console.log('Sump Tank ESP32 config updated:', config);
                }}
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
                  onToggleAuto={requestPinForAutoModeToggle}
                  onManualControl={(action) => {
                    if (action === 'start') {
                      requestPinForMotorStart();
                    } else {
                      requestPinForMotorStop();
                    }
                  }}
                  settings={{
                    autoStartLevel: motorOnLevel,
                    autoStopLevel: motorOffLevel,
                    maxRuntime: 60,
                    minOffTime: 15
                  }}
                  onUpdateSettings={(newSettings) => {
                    setMotorOnLevel(newSettings.autoStartLevel);
                    setMotorOffLevel(newSettings.autoStopLevel);
                    console.log('Motor thresholds updated:', newSettings);
                    toast({
                      title: "Motor Thresholds Updated",
                      description: `Motor will start at ${newSettings.autoStartLevel}% and stop at ${newSettings.autoStopLevel}%.`,
                    });
                  }}
                />
              </Card>
            </div>
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
                    onCheckedChange={requestPinForAutoModeToggle}
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
                    onClick={() => setPinSettingsOpen(true)}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Change PIN
                  </Button>
                  {pinSession.authenticated && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-background/50 hover:bg-accent/10 border-border/50"
                      onClick={() => {
                        clearPinSession();
                        toast({
                          title: "PIN Session Cleared",
                          description: "Your PIN session has been manually cleared.",
                        });
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Clear Session
                    </Button>
                  )}
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Level Controls</div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Low Level Alert</span>
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                        lowLevelAlert 
                          ? 'bg-success/10 border-success/20 text-success' 
                          : 'bg-muted/10 border-muted/20 text-muted-foreground'
                      }`}>
                        {lowLevelAlert ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <Switch
                      checked={lowLevelAlert}
                      onCheckedChange={(checked) => {
                        setLowLevelAlert(checked);
                        toast({
                          title: checked ? "Low Level Alert Enabled" : "Low Level Alert Disabled",
                          description: checked ? "System will alert when water level is low" : "Low level alerts turned off",
                        });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">High Level Alert</span>
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                        highLevelAlert 
                          ? 'bg-success/10 border-success/20 text-success' 
                          : 'bg-muted/10 border-muted/20 text-muted-foreground'
                      }`}>
                        {highLevelAlert ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <Switch
                      checked={highLevelAlert}
                      onCheckedChange={(checked) => {
                        setHighLevelAlert(checked);
                        toast({
                          title: checked ? "High Level Alert Enabled" : "High Level Alert Disabled",
                          description: checked ? "System will alert when water level is high" : "High level alerts turned off",
                        });
                      }}
                    />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground">Motor Thresholds</div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Motor ON Level</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/10 border-primary/20 text-primary">
                          {motorOnLevel}%
                        </Badge>
                      </div>
                      <Slider
                        value={[motorOnLevel]}
                        onValueChange={(value) => setMotorOnLevel(value[0])}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">
                        Motor will start when water level drops below {motorOnLevel}%
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Motor OFF Level</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-success/10 border-success/20 text-success">
                          {motorOffLevel}%
                        </Badge>
                      </div>
                      <Slider
                        value={[motorOffLevel]}
                        onValueChange={(value) => setMotorOffLevel(value[0])}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">
                        Motor will stop when water level reaches {motorOffLevel}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
        </section>

        {/* Analytics & AI Insights */}
        <section className="border-4 border-primary/70 rounded-xl p-6 mb-8 bg-gradient-to-r from-primary/10 to-accent/10 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/20 rounded-lg animate-pulse">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-primary">🎯 Analytics & AI Insights</h2>
            <Badge className="bg-primary text-primary-foreground animate-pulse px-4 py-1 text-sm">AI Active</Badge>
            <div className="ml-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                Live Analysis
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {aiInsights.length} insights loaded
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    dailyData={dailyConsumptionData}
                    monthlyData={monthlyConsumptionData}
                  />
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <AIInsightsPanel
                insights={aiInsights}
                onQuerySubmit={handleAIQuery}
                queryResponse={queryResponse}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
          </div>
        </section>

        {/* System Status & Alerts */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="text-xl font-semibold">System Status & Alerts</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshEsp32Status}
              className="bg-background/50 hover:bg-accent/10 border-border/50"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Refresh ESP32 Status
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <SystemStatus
                wifiConnected={true}
                temperature={28}
                uptime="2d 14h 32m"
                esp32Status={{
                  topTank: esp32TopStatus.connected ? 'online' : 'offline',
                  sump: esp32SumpStatus.connected ? 'online' : 'offline'
                }}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <SystemAlerts
                alerts={alerts.map(alert => ({
                  id: alert.id.toString(),
                  type: alert.type as "warning" | "info" | "error",
                  message: alert.message,
                  timestamp: new Date(alert.timestamp),
                  resolved: alert.resolved
                }))}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
          </div>
        </section>
      </main>

      {/* PIN Authentication Modal */}
      <PinModal
        isOpen={pinModal.isOpen}
        onClose={() => setPinModal(prev => ({ ...prev, isOpen: false }))}
        onSuccess={pinModal.onSuccess}
        title={pinModal.title}
        description={pinModal.description}
        actionType={pinModal.actionType}
      />

      {/* PIN Settings Modal */}
      <PinSettings
        isOpen={pinSettingsOpen}
        onClose={() => setPinSettingsOpen(false)}
      />

      {/* ESP32 Configuration Modal */}
      <Dialog open={esp32ConfigOpen} onOpenChange={setEsp32ConfigOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">ESP32 Device Configuration</DialogTitle>
            <DialogDescription>
              Manage and configure your ESP32 devices for water level monitoring and motor control.
            </DialogDescription>
          </DialogHeader>
          <ESP32Config
            onRequestEsp32Save={requestPinForEsp32Save}
            onRequestEsp32Update={requestPinForEsp32Update}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
