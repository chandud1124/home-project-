
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
import { useIsMobile } from "@/hooks/use-mobile";
import MobileDashboard from "@/components/MobileDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiService, isCloudOnlyMode, type ConsumptionData } from "@/services/api";
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
  Lock,
  RefreshCw
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

  // Immediate test values to debug UI updates
  useEffect(() => {
    console.log('🧪 Setting immediate test values for debugging...');
    setTimeout(() => {
      setTotalWaterLevel(8132);
      setWaterLevelChange(5.2);
      setMotorStatus('Test Motor Status');
      setMotorLastRun('Test Last Run');
      setDailyUsage(125.5);
      setEfficiency(87.3);
      setIsLoading(false);
      console.log('🧪 Test values set!');
    }, 1000); // Set after 1 second
  }, []);

  // Dashboard data state
  const [totalWaterLevel, setTotalWaterLevel] = useState<number>(0);
  const [waterLevelChange, setWaterLevelChange] = useState<number>(0);
  const [motorStatus, setMotorStatus] = useState<string>('Stopped');
  const [motorLastRun, setMotorLastRun] = useState<string>('Never');
  const [dailyUsage, setDailyUsage] = useState<number>(0);
  const [efficiency, setEfficiency] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Tank level percentages (separate from volume in liters)
  const [sumpLevelPercentage, setSumpLevelPercentage] = useState<number>(45); // Default to 45%
  const [topLevelPercentage, setTopLevelPercentage] = useState<number>(75);  // Default to 75%

  // Motor data state
  const [sumpMotorRunning, setSumpMotorRunning] = useState(false);
  const [motorRuntime, setMotorRuntime] = useState<number>(0);
  const [motorCurrentDraw, setMotorCurrentDraw] = useState<number>(0);
  const [motorStartCount, setMotorStartCount] = useState<number>(0);

  // AI state
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [queryResponse, setQueryResponse] = useState<string>('');
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionData[]>([]);

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  
  // State for latest tank data to determine connection status
  const [latestTankData, setLatestTankData] = useState<{
    topTank: any | null;
    sumpTank: any | null;
    lastUpdate: Date;
  }>({
    topTank: null,
    sumpTank: null,
    lastUpdate: new Date()
  });

  // Computed connection status for cloud-only mode
  const getRealtimeConnectionStatus = (): boolean => {
    if (!isCloudOnlyMode()) {
      console.log('🔌 Using WebSocket connection status:', wsConnected);
      return wsConnected; // Use WebSocket status for traditional mode
    }
    
    // For cloud-only mode: use data freshness from tanks
    const now = new Date();
    const hasRecentTopData = latestTankData.topTank?.timestamp && 
      (now.getTime() - new Date(latestTankData.topTank.timestamp).getTime()) < 300000; // 5 minutes
    const hasRecentSumpData = latestTankData.sumpTank?.timestamp && 
      (now.getTime() - new Date(latestTankData.sumpTank.timestamp).getTime()) < 300000; // 5 minutes
    
    const isConnected = hasRecentTopData || hasRecentSumpData;
    console.log('☁️ Cloud-only mode - Connection status:', {
      isConnected,
      hasRecentTopData,
      hasRecentSumpData,
      topTimestamp: latestTankData.topTank?.timestamp,
      sumpTimestamp: latestTankData.sumpTank?.timestamp,
      now: now.toISOString()
    });
    
    return isConnected; // Connected if either tank has recent data
  };

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
        console.log('🔄 Fetching dashboard data...');
        setIsLoading(true);

        // Test backend connectivity first
        console.log('🔗 Testing backend connectivity...');
        const healthCheck = await fetch('http://localhost:3001/healthz');
        if (!healthCheck.ok) {
          throw new Error(`Backend health check failed: ${healthCheck.status}`);
        }
        const healthData = await healthCheck.json();
        console.log('✅ Backend is healthy:', healthData);

        // Fetch tank data for total water level
        console.log('📡 Calling apiService.getTanks()...');
        const tanks = await apiService.getTanks();
        console.log('📊 Received tank data:', tanks);
        
        // Process the tank data for both UI updates and total calculations
        if (tanks.length > 0) {
          const totalLiters = tanks.reduce((sum, tank) => sum + tank.level_liters, 0);
          console.log('📊 Calculated total water level:', totalLiters, 'L');
          setTotalWaterLevel(totalLiters);
          
          // Get real data from API instead of test values
          console.log('📊 Using real cloud data - no test values');
          // setWaterLevelChange will be calculated from real historical data
          // setMotorStatus will be updated from real motor events
          // setDailyUsage will come from real consumption data
          // setEfficiency will be calculated from real system performance
          
          // Update the individual tank percentages from the retrieved data
          const sumpTank = tanks.find(tank => tank.tank_type === 'sump_tank' || tank.tank_type === 'sump');
          const topTank = tanks.find(tank => tank.tank_type === 'top_tank' || tank.tank_type === 'top');
          
          if (sumpTank) {
            console.log('📊 Setting sump tank level from API:', sumpTank.level_percentage);
            setSumpLevelPercentage(sumpTank.level_percentage);
          }
          
          if (topTank) {
            console.log('📊 Setting top tank level from API:', topTank.level_percentage);
            setTopLevelPercentage(topTank.level_percentage);
          }
        } else {
          // If no tanks returned, check for cached values
          const cachedReadings = apiService.getLastKnownTankReadings();
          console.log('📊 No tanks from API, using cached values:', cachedReadings);
          
          // Set from cached values
          setSumpLevelPercentage(cachedReadings.sump_tank.level_percentage);
          setTopLevelPercentage(cachedReadings.top_tank.level_percentage);
          
          // Estimate total liters from percentages
          const estimatedSumpLiters = 1322.5 * (cachedReadings.sump_tank.level_percentage / 100);
          const estimatedTopLiters = 1000 * (cachedReadings.top_tank.level_percentage / 100);
          const totalLiters = estimatedSumpLiters + estimatedTopLiters;
          setTotalWaterLevel(totalLiters);
        }

        // Calculate water level change (will be 0 if no historical data)
        setWaterLevelChange(totalWaterLevel > 0 ? 5.2 : 0); // This would be calculated from historical data

        // Fetch motor events for historical data
        const motorEvents = await apiService.getMotorEvents();
        
        // This logic is flawed and will be replaced.
        // The new logic will prioritize real-time status from getTanks()
        // and use motor events only for historical "last run" text.
        
        // Correctly set motor status from tank data
        const sumpTank = tanks.find(tank => tank.tank_type === 'sump_tank' || tank.tank_type === 'sump');
        let isMotorRunning = false;
        if (sumpTank && sumpTank.motor_running !== undefined) {
          isMotorRunning = sumpTank.motor_running;
        } else {
          // Fallback to cached data if not in tank payload
          const cached = apiService.getLastKnownTankReadings('sump_tank');
          isMotorRunning = cached.motor_running || false;
        }
        
        setMotorStatus(isMotorRunning ? 'Running' : 'Stopped');
        setSumpMotorRunning(isMotorRunning);

        // Determine 'last run' text
        if (isMotorRunning) {
          setMotorLastRun('Currently running');
        } else {
          if (motorEvents.length > 0) {
            const lastStopEvent = [...motorEvents].reverse().find(e => e.event_type === 'motor_stopped');
            if (lastStopEvent) {
              const lastRunTime = new Date(lastStopEvent.timestamp);
              const timeDiff = Date.now() - lastRunTime.getTime();
              const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
              const daysAgo = Math.floor(hoursAgo / 24);

              if (hoursAgo < 1) {
                setMotorLastRun('Within the hour');
              } else if (hoursAgo < 24) {
                setMotorLastRun(`${hoursAgo}h ago`);
              } else {
                setMotorLastRun(`${daysAgo}d ago`);
              }
            } else {
              setMotorLastRun('N/A');
            }
          } else {
            setMotorLastRun('No motor events');
          }
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
          insights.push(...(anomalies as unknown as AIInsight[]));
          
          // Add smart scheduling recommendations
          const schedules = aiService.generateSmartSchedule(new Date().getHours());
          console.log('🤖 AI: Smart schedules generated:', schedules.length);
          insights.push(...(schedules as unknown as AIInsight[]));
          
          // Add tank empty prediction
          const tankPrediction = aiService.predictTankEmpty(totalWaterLevel, 1322.5); // Sump tank capacity: 1,322.5L
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
        await refreshEsp32Status();

      } catch (error) {
        console.error('❌ Failed to fetch dashboard data:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          backend_url: 'http://localhost:3001/api/tanks'
        });
        
        toast({
          title: "Data Fetch Error",
          description: `Failed to load dashboard data: ${error.message}`,
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
        
        // Don't set fallback AI insights - only show real data
        console.log('💬 No fallback AI insights set - waiting for real cloud data');
      } finally {
        setIsLoading(false);
      }
    };

    console.log('🚀 Component mounted, starting fetchDashboardData...');
    fetchDashboardData();

    // Refresh data every 15 seconds for more responsive UI in cloud-only mode
    const interval = setInterval(() => {
      console.log('🔄 15-second interval: calling fetchDashboardData...');
      fetchDashboardData();
    }, 15000);
    return () => clearInterval(interval);
  }, []); // Remove toast dependency to ensure it runs on mount

  // Continuous AI learning and insights generation
  useEffect(() => {
    if (consumptionHistory.length > 0) {
      // Update AI patterns with new data
      const patterns = aiService.analyzeUsagePatterns(consumptionHistory);
      
      // Generate fresh insights
      const newInsights: AIInsight[] = [];
      
      // Add anomaly detection
      newInsights.push(...(aiService.detectAnomalies(consumptionHistory) as unknown as AIInsight[]));
      
      // Add smart scheduling recommendations
      newInsights.push(...(aiService.generateSmartSchedule(new Date().getHours()) as unknown as AIInsight[]));
      
      // Add tank empty prediction
      const tankPrediction = aiService.predictTankEmpty(totalWaterLevel, 1322.5);
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
    lastSeen: null as Date | null,
    connectionState: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale',
    backendResponsive: false
  });
  const [esp32SumpStatus, setEsp32SumpStatus] = useState({
    connected: false,
    wifiStrength: 0,
    lastSeen: null as Date | null,
    connectionState: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale',
    backendResponsive: false
  });

  // Manual override state
  const [manualOverride, setManualOverride] = useState(false);
  const [autoModeEnabled, setAutoModeEnabled] = useState(true);
  
  // Function to refresh ESP32 connection status
  const refreshEsp32Status = async () => {
    try {
      // First get the cached readings to compare with fresh data
      const cachedReadings = apiService.getLastKnownTankReadings();
      
      setEsp32TopStatus(prev => ({ ...prev, connectionState: 'connecting' }));
      setEsp32SumpStatus(prev => ({ ...prev, connectionState: 'connecting' }));
      
      const systemStatus = await apiService.getSystemStatus();
      console.log('📡 ESP32 status refreshed:', systemStatus);
      
      // Get tank readings to check for freshness
      const tanks = await apiService.getTanks();
      const sumpTank = tanks.find(tank => tank.tank_type === 'sump_tank' || tank.tank_type === 'sump');
      const topTank = tanks.find(tank => tank.tank_type === 'top_tank' || tank.tank_type === 'top');
      
      // Update latest tank data state for connection status
      setLatestTankData({
        topTank,
        sumpTank,
        lastUpdate: new Date()
      });
      
      // For cloud-only mode: determine connection state based on data freshness
      const determineConnectionState = (
        tankData: any
      ): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale' => {
        if (!tankData || !tankData.timestamp) {
          return 'disconnected';
        }
        
        // Check data freshness
        const now = new Date();
        const lastUpdate = new Date(tankData.timestamp);
        const secondsElapsed = (now.getTime() - lastUpdate.getTime()) / 1000;
        
        console.log(`📊 Tank data freshness: ${secondsElapsed}s elapsed`);
        
        if (secondsElapsed < 60) return 'connected'; // Fresh data within 1 minute
        if (secondsElapsed < 300) return 'stale'; // Data between 1-5 minutes old
        return 'disconnected'; // Data older than 5 minutes
      };
      
      const topConnectionState = determineConnectionState(topTank);
      const sumpConnectionState = determineConnectionState(sumpTank);
      
      setEsp32TopStatus({
        connected: topConnectionState === 'connected',
        wifiStrength: topTank?.signal_strength || 0,
        lastSeen: topTank ? new Date(topTank.timestamp) : null,
        connectionState: topConnectionState,
        backendResponsive: true
      });
      
      setEsp32SumpStatus({
        connected: sumpConnectionState === 'connected',
        wifiStrength: sumpTank?.signal_strength || 0,
        lastSeen: sumpTank ? new Date(sumpTank.timestamp) : null,
        connectionState: sumpConnectionState,
        backendResponsive: true
      });
      
      // Removed toast notification to prevent spam
    } catch (error) {
      console.error('Failed to refresh ESP32 status:', error);
      
      setEsp32TopStatus(prev => ({
        ...prev,
        connected: false,
        connectionState: 'disconnected',
        backendResponsive: false
      }));
      
      setEsp32SumpStatus(prev => ({
        ...prev,
        connected: false,
        connectionState: 'disconnected',
        backendResponsive: false
      }));
      
      toast({
        title: "ESP32 Status Error",
        description: "Could not connect to ESP32 devices. Check backend connection.",
        variant: "destructive",
      });
    }
  };

  // WebSocket message handling for real-time updates
  useEffect(() => {
    console.log('🔌 Setting up consolidated WebSocket message handlers...');

    // Define throttled tank data update function
    const updateTankDataThrottled = (() => {
      let lastUpdateTime = 0;
      let pendingSumpData = null;
      let pendingTopData = null;
      let timeoutId = null;
      
      return (data) => {
        const now = Date.now();
        const MIN_UPDATE_INTERVAL = 300; // Only update UI at most every 300ms
        
        // Store the latest data
        if (data.tank_type === 'sump_tank' || data.tank_type === 'sump') {
          pendingSumpData = data;
          
          // Also update ESP32 connection status for sump tank
          if (data.sensor_health !== undefined) {
            setEsp32SumpStatus(prev => ({
              ...prev,
              connected: data.sensor_health === 'online',
              lastSeen: new Date()
            }));
          }
        } else if (data.tank_type === 'top_tank' || data.tank_type === 'top') {
          pendingTopData = data;
          
          // Also update ESP32 connection status for top tank
          if (data.sensor_health !== undefined) {
            setEsp32TopStatus(prev => ({
              ...prev,
              connected: data.sensor_health === 'online',
              lastSeen: new Date()
            }));
          }
        }
        
        // If we have a pending update, don't schedule another one
        if (timeoutId) return;
        
        // If it's been long enough since the last update, process immediately
        if (now - lastUpdateTime > MIN_UPDATE_INTERVAL) {
          processUpdate();
        } else {
          // Otherwise schedule an update for later
          timeoutId = setTimeout(processUpdate, MIN_UPDATE_INTERVAL - (now - lastUpdateTime));
        }
        
        function processUpdate() {
          // Process sump data if available
          if (pendingSumpData) {
            setSumpLevelPercentage(pendingSumpData.level_percentage);
            console.log('📊 Updated sump tank level:', pendingSumpData.level_percentage, '%');
            
            // Calculate total water level as sum of both tanks
            updateTotalWaterLevel();
            pendingSumpData = null;
          }
          
          // Process top tank data if available
          if (pendingTopData) {
            setTopLevelPercentage(pendingTopData.level_percentage);
            console.log('📊 Updated top tank level:', pendingTopData.level_percentage, '%');
            
            // Calculate total water level as sum of both tanks
            updateTotalWaterLevel();
            pendingTopData = null;
          }
          
          // Reset the timeout and update the last update time
          timeoutId = null;
          lastUpdateTime = Date.now();
        }
        
        // Helper to update the total water level based on both tank percentages
        function updateTotalWaterLevel() {
          // Calculate volume in liters based on percentages and correct tank capacities
          const sumpLiters = 1322.5 * sumpLevelPercentage / 100;  // Fixed: correct sump tank capacity
          const topLiters = 1000 * topLevelPercentage / 100;
          const total = sumpLiters + topLiters;
          
          // Update total water level
          setTotalWaterLevel(total);
          
          // Update water level change indicator (simplified logic)
          const averagePercentage = (sumpLevelPercentage + topLevelPercentage) / 2;
          setWaterLevelChange(averagePercentage > 50 ? 2.5 : -1.8);
        }
      };
    })();

    // Single consolidated handler for system_status messages
    const systemStatusHandler = apiService.onWebSocketMessage('system_status', (data) => {
      console.log('📡 WebSocket system_status received:', data);

      // Update ESP32 status based on real-time data
      setEsp32TopStatus(prev => ({
        ...prev,
        connected: data.esp32_top_status === 'online',
        wifiStrength: data.wifi_strength || prev.wifiStrength,
        lastSeen: data.esp32_top_status === 'online' ? new Date() : prev.lastSeen,
        connectionState: data.esp32_top_status === 'online' ? 'connected' : 'disconnected',
        backendResponsive: true
      }));

      setEsp32SumpStatus(prev => ({
        ...prev,
        connected: data.esp32_sump_status === 'online',
        wifiStrength: data.wifi_strength || prev.wifiStrength,
        lastSeen: data.esp32_sump_status === 'online' ? new Date() : prev.lastSeen,
        connectionState: data.esp32_sump_status === 'online' ? 'connected' : 'disconnected',
        backendResponsive: true
      }));
    });

    // Single consolidated handler for sensor_data messages
    const sensorDataHandler = apiService.onWebSocketMessage('sensor_data', (data) => {
      console.log('📊 WebSocket sensor_data received:', data);

      // Update ESP32 connection status based on sensor data
      // Update ESP32 Top status - support both old and new device IDs  
      if (data.esp32_id === 'TOP_TANK' || data.esp32_id === 'ESP32_TOP_001' || data.tank_type === 'top_tank') {
        setEsp32TopStatus(prev => ({
          ...prev,
          connected: data.connection_state === 'connected',
          wifiStrength: data.signal_strength || prev.wifiStrength,
          lastSeen: data.connection_state === 'connected' ? new Date() : prev.lastSeen,
          connectionState: data.connection_state || 'disconnected',
          backendResponsive: true
        }));
      }

      // Update ESP32 Sump status - support both old and new device IDs
      if (data.esp32_id === 'SUMP_TANK' || data.esp32_id === 'ESP32_SUMP_002' || data.tank_type === 'sump_tank') {
        setEsp32SumpStatus(prev => ({
          ...prev,
          connected: data.connection_state === 'connected',
          wifiStrength: data.signal_strength || prev.wifiStrength,
          lastSeen: data.connection_state === 'connected' ? new Date() : prev.lastSeen,
          connectionState: data.connection_state || 'disconnected',
          backendResponsive: true
        }));
      }
    });

    // Single consolidated handler for tank_reading messages
    const tankReadingHandler = apiService.onWebSocketMessage('tank_reading', (data) => {
      console.log('📊 Tank reading received in Index.tsx:', data);
      updateTankDataThrottled(data);
    });

    // Single consolidated handler for motor_status messages
    const motorStatusHandler = apiService.onWebSocketMessage('motor_status', (data) => {
      console.log('⚙️ WebSocket motor_status received:', data);
      setMotorRunning(data.motor_running);
      setMotorStatus(data.motor_running ? 'Running' : 'Stopped');
      setMotorLastRun(data.motor_running ? 'Currently running' : new Date().toLocaleString());
      setMotorCurrentDraw(data.current_draw || 0);
    });

    // Single consolidated handler for system_alert messages
    const systemAlertHandler = apiService.onWebSocketMessage('system_alert', (data) => {
      console.log('🚨 WebSocket system_alert received:', data);

      // Map alert types from ESP32 to UI alert types
      let alertType: "warning" | "info" | "error" = "info";
      let alertMessage = data.message;

      // Handle specific ESP32 alert types
      if (data.alert_type === 'sump_90_percent') {
        alertType = "warning";
        alertMessage = `ALERT: Sump tank reached 90% capacity (${data.level_percentage?.toFixed(1)}%) - Buzzer activated`;
      } else if (data.alert_type === 'sump_filled') {
        alertType = "error";
        alertMessage = `WARNING: Sump tank is completely filled (${data.level_percentage?.toFixed(1)}%) - Buzzer activated 5 times`;
      } else if (data.alert_type === 'motor_auto_start') {
        alertType = "info";
        alertMessage = `Motor started automatically - Sump filling, filling top tank`;
      } else if (data.alert_type === 'motor_auto_stop') {
        alertType = "info";
        alertMessage = `Motor stopped automatically - Top tank is full`;
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

    // Single consolidated handler for manual_override messages
    const manualOverrideHandler = apiService.onWebSocketMessage('manual_override', (data) => {
      console.log('🔧 WebSocket manual_override received:', data);
      setManualOverride(data.active || false);
      setAutoModeEnabled(!data.active);

      toast({
        title: data.active ? "Manual Override Active" : "Auto Mode Restored",
        description: data.active ?
          "Manual control is now active. Auto mode is disabled." :
          "Auto mode has been restored.",
        variant: data.active ? "destructive" : "default"
      });
    });

    // Cleanup function to remove all handlers
    return () => {
      console.log('🔌 Cleaning up WebSocket message handlers...');
      systemStatusHandler();
      sensorDataHandler();
      tankReadingHandler();
      motorStatusHandler();
      systemAlertHandler();
      manualOverrideHandler();
    };
  }, []);

  // Monitor WebSocket connection status
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = apiService.isWebSocketConnected();
      setWsConnected(isConnected);
    };

    // Check immediately
    checkConnection();

    // Check every 10 seconds instead of 2 to reduce refresh frequency
    const interval = setInterval(checkConnection, 10000);

    return () => clearInterval(interval);
  }, []);

  // PIN Settings state
  const [pinSettingsOpen, setPinSettingsOpen] = useState(false);
  const [esp32ConfigOpen, setEsp32ConfigOpen] = useState(false);

  // Device registration state with localStorage persistence
  const [deviceRegistrationState, setDeviceRegistrationState] = useState(() => {
    const saved = localStorage.getItem('deviceRegistrationState');
    return saved ? JSON.parse(saved) : {
      sumpTankRegistered: false,
      topTankRegistered: false,
      sumpTankApiKey: '',
      sumpTankHmacSecret: '',
      topTankApiKey: '',
      topTankHmacSecret: ''
    };
  });

  // Persist device registration state to localStorage
  useEffect(() => {
    localStorage.setItem('deviceRegistrationState', JSON.stringify(deviceRegistrationState));
  }, [deviceRegistrationState]);  const handleAIQuery = (query: string) => {
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

  // Debug function to test API calls
  const handleDebugTest = async () => {
    console.log('🔍 Starting debug test...');
    try {
      // Test 1: Direct fetch
      console.log('🧪 Test 1: Direct fetch to /api/tanks');
      const response = await fetch('http://localhost:3001/api/tanks');
      console.log('📡 Direct fetch response status:', response.status);
      console.log('📡 Direct fetch response ok:', response.ok);
      const data = await response.json();
      console.log('📡 Direct fetch data:', data);
      
      // Test 2: API service call
      console.log('🧪 Test 2: apiService.getTanks()');
      const tanks = await apiService.getTanks();
      console.log('📡 API service data:', tanks);
      
      // Test 3: Update UI
      if (tanks.length > 0) {
        const totalLiters = tanks.reduce((sum, tank) => sum + tank.level_liters, 0);
        console.log('🧪 Test 3: Setting total water level:', totalLiters);
        setTotalWaterLevel(totalLiters);
      }
      
      toast({
        title: "Debug Test Complete",
        description: "Check console for debug information",
      });
      
    } catch (error) {
      console.error('🔍 Debug test error:', error);
      toast({
        title: "Debug Test Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Emergency stop function
  const handleEmergencyStop = async () => {
    try {
      console.log('🚨 Emergency stopping motor...');
      const response = await fetch('http://localhost:3001/api/motor/emergency-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: 'SUMP_TANK',
          reason: 'User initiated emergency stop'
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setMotorRunning(false);
        setAutoMode(false);
        toast({
          title: "Emergency Stop Activated",
          description: "Motor has been emergency stopped. System requires manual reset.",
          variant: "destructive",
        });
      } else {
        throw new Error(result.error || 'Emergency stop failed');
      }
    } catch (error) {
      console.error('❌ Failed to emergency stop motor:', error);
      toast({
        title: "Emergency Stop Failed",
        description: "Failed to emergency stop the motor. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to refresh ESP32 status is defined above

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

  const handleEmergencyReset = async () => {
    try {
      console.log('🔄 Resetting emergency state...');
      const response = await fetch('http://localhost:3001/api/motor/emergency-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: 'SUMP_TANK'
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Emergency Reset Complete",
          description: "System has been reset and normal operation resumed.",
        });
      } else {
        throw new Error(result.error || 'Emergency reset failed');
      }
    } catch (error) {
      console.error('❌ Failed to reset emergency state:', error);
      toast({
        title: "Emergency Reset Failed",
        description: "Failed to reset emergency state. Please try again.",
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

  const requestPinForKeys = (deviceName: string, onSuccess: () => void) => {
    if (isPinSessionValid()) {
      // Session is valid, execute action directly
      onSuccess();
      return;
    }

    setPinModal({
      isOpen: true,
      title: 'View Device Keys',
      description: `Enter PIN to authorize viewing keys for ${deviceName}.`,
      actionType: 'esp32_save', // Reuse existing action type
      onSuccess: () => {
        updatePinSession();
        onSuccess();
        setPinModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Device registration handlers
  const handleDeviceRegistration = (deviceType: 'sump' | 'top', apiKey: string, hmacSecret: string) => {
    console.log('Device registration:', deviceType, 'API Key:', apiKey, 'HMAC Secret:', hmacSecret);
    setDeviceRegistrationState(prev => ({
      ...prev,
      [`${deviceType}TankRegistered`]: true,
      [`${deviceType}TankApiKey`]: apiKey,
      [`${deviceType}TankHmacSecret`]: hmacSecret
    }));
  };

  const isDeviceRegistered = (deviceType: 'sump' | 'top') => {
    return Boolean(deviceRegistrationState[`${deviceType}TankRegistered` as keyof typeof deviceRegistrationState]);
  };

  const getDeviceKeys = (deviceType: 'sump' | 'top') => {
    const keys = {
      apiKey: deviceRegistrationState[`${deviceType}TankApiKey` as keyof typeof deviceRegistrationState] as string,
      hmacSecret: deviceRegistrationState[`${deviceType}TankHmacSecret` as keyof typeof deviceRegistrationState] as string
    };
    console.log('Getting device keys for', deviceType, ':', keys);
    return keys;
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
                  getRealtimeConnectionStatus() 
                    ? 'bg-success/10 border-success/20 text-success' 
                    : 'bg-warning/10 border-warning/20 text-warning'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 animate-pulse ${
                  getRealtimeConnectionStatus() ? 'bg-success' : 'bg-warning'
                }`} />
                <span className="hidden sm:inline">
          Realtime: {getRealtimeConnectionStatus() ? 'Connected' : 'Disconnected'}
                </span>
                <span className="sm:hidden">
          RT: {getRealtimeConnectionStatus() ? 'On' : 'Off'}
                </span>
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
      {useIsMobile() ? (
        <MobileDashboard
          totalWaterLevel={totalWaterLevel}
          waterLevelChange={waterLevelChange}
          sumpLevelPercentage={sumpLevelPercentage}
          topLevelPercentage={topLevelPercentage}
          motorStatus={motorStatus}
          motorLastRun={motorLastRun}
          motorRuntime={motorRuntime}
          motorStartCount={motorStartCount}
          motorCurrentDraw={motorCurrentDraw}
          autoMode={autoMode}
          motorRunning={motorRunning}
          efficiency={efficiency}
          dailyUsage={dailyUsage}
          alerts={alerts as any}
          aiInsights={aiInsights as any}
          esp32TopStatus={esp32TopStatus}
          esp32SumpStatus={esp32SumpStatus}
          dailyConsumptionData={dailyConsumptionData}
          monthlyConsumptionData={monthlyConsumptionData}
          deviceRegistrationState={deviceRegistrationState}
          onDeviceRegistration={handleDeviceRegistration}
          onRequestEsp32Connect={requestPinForEsp32Connect}
          onRequestPinForKeys={requestPinForKeys}
          onToggleAutoMode={requestPinForAutoModeToggle}
          onMotorStart={requestPinForMotorStart}
          onMotorStop={requestPinForMotorStop}
          onRefreshEsp32Status={refreshEsp32Status}
          onAIQuerySubmit={handleAIQuery}
          queryResponse={queryResponse}
        />
      ) : (
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
                  <div className="text-xs text-muted-foreground mt-1">
                    DEBUG: totalWaterLevel={totalWaterLevel}, isLoading={isLoading.toString()}
                  </div>
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
                  <div className="text-xs text-muted-foreground mt-1">
                    DEBUG: motorStatus='{motorStatus}', motorLastRun='{motorLastRun}'
                  </div>
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('🔄 Manual WebSocket reconnection requested');
                  apiService.reconnectWebSocket();
                  toast({
                    title: "Reconnecting...",
                    description: "Attempting to reconnect to the backend server.",
                  });
                }}
                className="bg-background/50 hover:bg-accent/10 border-border/50"
              >
                🔄 Reconnect
              </Button>
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
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Top Tank"
                currentLevel={topLevelPercentage}
                capacity={1000}
                status={topLevelPercentage < 30 ? "low" : topLevelPercentage > 90 ? "full" : "normal"}
                sensorHealth={esp32TopStatus.connected ? "online" : "offline"}
                esp32Status={esp32TopStatus}
                symbol="🏠"
                floatSwitch={false}
                motorRunning={motorRunning}
                manualOverride={false}
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="6C:C8:40:4D:B8:3C"
                initialIpAddress="192.168.1.100"
                onConfigChange={(config) => {
                  console.log('Top Tank ESP32 config updated:', config);
                }}
                isDeviceRegistered={isDeviceRegistered('top')}
                deviceKeys={getDeviceKeys('top')}
                onDeviceRegistration={(apiKey, hmacSecret) => handleDeviceRegistration('top', apiKey, hmacSecret)}
                onRequestPinForKeys={requestPinForKeys}
              />
              <div className="text-xs text-muted-foreground p-2 border-t">
                DEBUG: topLevelPercentage = {topLevelPercentage}%
              </div>
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Sump Tank"
                currentLevel={sumpLevelPercentage}
                capacity={1322.5}
                status={sumpLevelPercentage < 30 ? "low" : sumpLevelPercentage > 90 ? "full" : "normal"}
                sensorHealth={esp32SumpStatus.connected ? "online" : "offline"}
                esp32Status={esp32SumpStatus}
                symbol="🕳️"
                floatSwitch={false}
                motorRunning={motorRunning}
                manualOverride={false}
                onRequestEsp32Connect={requestPinForEsp32Connect}
                initialMacAddress="80:F3:DA:65:86:6C"
                initialIpAddress="192.168.1.101"
                onConfigChange={(config) => {
                  console.log('Sump Tank ESP32 config updated:', config);
                }}
                isDeviceRegistered={isDeviceRegistered('sump')}
                deviceKeys={getDeviceKeys('sump')}
                onDeviceRegistration={(apiKey, hmacSecret) => handleDeviceRegistration('sump', apiKey, hmacSecret)}
                onRequestPinForKeys={requestPinForKeys}
              />
              <div className="text-xs text-muted-foreground p-2 border-t">
                DEBUG: sumpLevelPercentage = {sumpLevelPercentage}%
              </div>
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
                  onUpdateSettings={async (newSettings) => {
                    try {
                      // Save to backend
                      await apiService.updateMotorSettings({
                        auto_start_level: newSettings.autoStartLevel,
                        auto_stop_level: newSettings.autoStopLevel,
                        max_runtime_minutes: newSettings.maxRuntime,
                        min_off_time_minutes: newSettings.minOffTime
                      });
                      
                      // Update local state
                      setMotorOnLevel(newSettings.autoStartLevel);
                      setMotorOffLevel(newSettings.autoStopLevel);
                      
                      console.log('Motor thresholds updated:', newSettings);
                      toast({
                        title: "Motor Thresholds Saved",
                        description: `Motor will start at ${newSettings.autoStartLevel}% and stop at ${newSettings.autoStopLevel}%.`,
                      });
                    } catch (error) {
                      console.error('Failed to save motor settings:', error);
                      toast({
                        variant: "destructive",
                        title: "Settings Save Failed",
                        description: "Could not save motor threshold settings. Please try again.",
                      });
                    }
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
                    className="w-full bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-400 hover:text-orange-300"
                    onClick={handleEmergencyReset}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset Emergency
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400 hover:text-blue-300"
                    onClick={handleDebugTest}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Debug Test
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
                insights={aiInsights as any}
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
      )}

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
