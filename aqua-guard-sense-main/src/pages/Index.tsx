
import { useState, useEffect } from "react";
import { EnhancedTankMonitor } from "@/components/EnhancedTankMonitor";
import { AutoMotorControl } from "@/components/AutoMotorControl";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { SystemAlerts } from "@/components/SystemAlerts";
import { SystemStatus } from "@/components/SystemStatus";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
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

type AIInsight = {
  id: string;
  type: "prediction" | "anomaly" | "recommendation";
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

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Mock data for demonstration
  const mockAlerts: SystemAlert[] = [
    {
      id: '1',
      type: 'warning',
      message: 'Top tank water level is getting low (25%)',
      timestamp: new Date(),
      resolved: false
    },
    {
      id: '2',
      type: 'info',
      message: 'Motor cycle completed successfully',
      timestamp: new Date(Date.now() - 300000),
      resolved: true
    }
  ];

  const mockInsights: AIInsight[] = [
    {
      id: '1',
      type: 'prediction',
      title: 'Water Usage Pattern',
      message: 'Based on current consumption, top tank will need refilling in approximately 4 hours',
      confidence: 0.85,
      priority: 'medium',
      timestamp: new Date()
    }
  ];

  // Define ConsumptionData type
  type ConsumptionData = {
    date: string;
    consumption: number;
    fills: number;
    motorStarts: number;
  };
  
  // Fix consumption data to match ConsumptionData interface
  const mockDailyData: ConsumptionData[] = Array.from({ length: 24 }, (_, i) => ({
    date: `${String(i).padStart(2, '0')}:00`,
    consumption: Math.floor(Math.random() * 50) + 10,
    fills: Math.floor(Math.random() * 3),
    motorStarts: Math.floor(Math.random() * 5)
  }));
  
  const mockMonthlyData: ConsumptionData[] = Array.from({ length: 12 }, (_, i) => ({
    date: `Month ${i + 1}`,
    consumption: Math.floor(Math.random() * 1500) + 500,
    fills: Math.floor(Math.random() * 30) + 10,
    motorStarts: Math.floor(Math.random() * 100) + 50
  }));

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
      tankLevels: { top: 75, sump: 45 },
      systemHealth: 'good'
    });
  };

  // Handle auto mode toggle
  const handleAutoModeToggle = (enabled: boolean) => {
    setAutoMode(enabled);
    if (!enabled) {
      setMotorRunning(false);
    }
    toast({
      title: enabled ? "Auto Mode Enabled" : "Auto Mode Disabled",
      description: enabled ? "Motor will automatically start/stop based on water levels." : "Motor is now in manual control mode.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-success/3 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                  <Waves className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    AquaFlow Pro
                  </h1>
                  <p className="text-sm text-muted-foreground">Industrial Water Management System</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="px-3 py-1 bg-success/10 border-success/20 text-success">
                <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
                System Online
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
              <div className="text-2xl font-bold text-foreground">1,245L</div>
              <p className="text-xs text-success mt-1">+5% from yesterday</p>
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
              <div className="text-2xl font-bold text-foreground">
                {motorRunning ? 'Running' : 'Stopped'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {motorRunning ? 'Active for 12 min' : 'Last run: 2h ago'}
              </p>
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
              <div className="text-2xl font-bold text-foreground">456L</div>
              <p className="text-xs text-success mt-1">Within normal range</p>
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
              <div className="text-2xl font-bold text-foreground">94%</div>
              <p className="text-xs text-success mt-1">Excellent performance</p>
            </CardContent>
          </Card>
        </div>

        {/* Tank Monitoring Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Droplets className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Tank Monitoring</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Top Tank"
                currentLevel={75}
                capacity={1000}
                status="normal"
                sensorHealth="online"
                esp32Status={{
                  connected: true,
                  batteryLevel: 85,
                  wifiStrength: 75,
                  lastSeen: new Date()
                }}
                symbol="🏠"
              />
            </Card>
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <EnhancedTankMonitor
                title="Sump Tank"
                currentLevel={45}
                capacity={800}
                status="low"
                sensorHealth="online"
                esp32Status={{
                  connected: true,
                  batteryLevel: 78,
                  wifiStrength: 82,
                  lastSeen: new Date()
                }}
                symbol="🕳️"
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
                  powerDetected={true}
                  autoMode={autoMode}
                  currentDraw={2.3}
                  runtime={145}
                  onToggleAuto={handleAutoModeToggle}
                  onManualControl={(action) => {
                    if (action === 'start') {
                      setMotorRunning(true);
                      toast({
                        title: "Motor Started",
                        description: "Motor has been started manually.",
                      });
                    } else {
                      setMotorRunning(false);
                      toast({
                        title: "Motor Stopped",
                        description: "Motor has been stopped manually.",
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
                    dailyData={mockDailyData}
                    monthlyData={mockMonthlyData}
                  />
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <AIInsightsPanel
                insights={mockInsights}
                onQuerySubmit={handleAIQuery}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
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
                wifiConnected={true}
                batteryLevel={85}
                temperature={28}
                uptime="2d 14h 32m"
                esp32Status={{
                  topTank: 'online',
                  sump: 'online'
                }}
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
            
            <Card className="bg-card/60 backdrop-blur-sm border-border/50">
              <SystemAlerts 
                alerts={mockAlerts} 
                className="bg-card/60 backdrop-blur-sm border-border/50"
              />
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
