import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Zap, TrendingUp, AlertTriangle, Settings, Power } from "lucide-react";
import { EnhancedTankMonitor } from "./EnhancedTankMonitor";
import { AutoMotorControl } from "./AutoMotorControl";
import { SystemAlerts } from "./SystemAlerts";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { SystemStatus } from "./SystemStatus";
import { ConsumptionChart } from "./ConsumptionChart";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import { SystemAlertSchema, ConsumptionDataSchema, AIInsightSchema } from '@/lib/schemas';
import type { SystemAlert, ConsumptionData, AIInsight } from '@/types/system';

interface MobileDashboardProps {
  // Tank data
  totalWaterLevel: number;
  waterLevelChange: number;
  
  // Motor data
  motorStatus: string;
  motorLastRun: string;
  motorRuntime: number;
  motorStartCount: number;
  motorCurrentDraw: number;
  autoMode: boolean;
  motorRunning: boolean;
  
  // System data
  efficiency: number;
  dailyUsage: number;
  alerts: AlertItem[];
  aiInsights: AIInsight[];
  
  // ESP32 status
  esp32TopStatus: {
    connected: boolean;
    wifiStrength: number;
    lastSeen: Date | null;
    connectionState?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
    backendResponsive?: boolean;
  };
  esp32SumpStatus: {
    connected: boolean;
    wifiStrength: number;
    lastSeen: Date | null;
    connectionState?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
    backendResponsive?: boolean;
  };
  
  // Consumption data
  dailyConsumptionData: ConsumptionPoint[];
  monthlyConsumptionData: ConsumptionPoint[];
  
  // Handlers
  onToggleAutoMode: (enabled: boolean) => void;
  onMotorStart: () => void;
  onMotorStop: () => void;
  onRefreshEsp32Status: () => void;
  onAIQuerySubmit: (query: string) => void;
  queryResponse: string;
};

// Domain type aliases
type AlertItem = SystemAlert;
type AIInsightItem = AIInsight;
type ConsumptionPoint = ConsumptionData;

const MobileDashboard: React.FC<MobileDashboardProps> = ({
  totalWaterLevel,
  waterLevelChange,
  motorStatus,
  motorLastRun,
  motorRuntime,
  motorStartCount,
  motorCurrentDraw,
  autoMode,
  motorRunning,
  efficiency,
  dailyUsage,
  alerts,
  aiInsights,
  esp32TopStatus,
  esp32SumpStatus,
  dailyConsumptionData,
  monthlyConsumptionData,
  onToggleAutoMode,
  onMotorStart,
  onMotorStop,
  onRefreshEsp32Status,
  onAIQuerySubmit,
  queryResponse
}) => {
  const [activeTab, setActiveTab] = React.useState('tanks');
  
  // Handle swipe gestures for tab navigation
  const { ref } = useSwipeGestures({
    onSwipeLeft: () => {
      const tabs = ['tanks', 'motor', 'analytics', 'system'];
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      }
    },
    onSwipeRight: () => {
      const tabs = ['tanks', 'motor', 'analytics', 'system'];
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    },
  });

  return (
    <div ref={ref} className="w-full pb-6">
      {/* Mobile Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6 w-full">
          <TabsTrigger value="tanks" className="flex flex-col items-center py-2">
            <Droplets className="h-5 w-5 mb-1" />
            <span className="text-xs">Tanks</span>
          </TabsTrigger>
          <TabsTrigger value="motor" className="flex flex-col items-center py-2">
            <Zap className="h-5 w-5 mb-1" />
            <span className="text-xs">Motor</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex flex-col items-center py-2">
            <TrendingUp className="h-5 w-5 mb-1" />
            <span className="text-xs">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex flex-col items-center py-2">
            <Settings className="h-5 w-5 mb-1" />
            <span className="text-xs">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Tanks Tab */}
        <TabsContent value="tanks" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Water Tanks
            </h2>
            <Badge variant="outline" className="bg-background/50">
              {totalWaterLevel.toLocaleString()} L Total
            </Badge>
          </div>
          
          <EnhancedTankMonitor 
            title="Top Tank"
            symbol="🏠"
            currentLevel={75}
            capacity={2000}
            status={motorStatus === 'Running' ? 'normal' : 'normal'}
            sensorHealth="online"
            esp32Status={esp32TopStatus}
          />
          
          <EnhancedTankMonitor 
            title="Sump Tank"
            symbol="🕳️"
            currentLevel={45}
            capacity={12500}
            status="normal"
            sensorHealth="online"
            esp32Status={esp32SumpStatus}
          />
        </TabsContent>

        {/* Motor Tab */}
        <TabsContent value="motor" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Motor Control
            </h2>
            <Badge 
              variant={motorStatus === 'Running' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {motorStatus}
            </Badge>
          </div>
          
          <AutoMotorControl 
            isRunning={motorRunning}
            autoMode={autoMode}
            currentDraw={motorCurrentDraw}
            runtime={motorRuntime}
            motorStartCount={motorStartCount}
            onToggleAuto={onToggleAutoMode}
            onManualControl={(action) => action === 'start' ? onMotorStart() : onMotorStop()}
            settings={{
              autoStartLevel: 20,
              autoStopLevel: 80,
              maxRuntime: 1800,
              minOffTime: 300
            }}
            onUpdateSettings={() => {}}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Analytics & Insights
            </h2>
            <Badge variant="outline" className="bg-background/50">
              {dailyUsage.toLocaleString()} L Today
            </Badge>
          </div>
          
          <ConsumptionChart 
            dailyData={dailyConsumptionData}
            monthlyData={monthlyConsumptionData}
          />
          
          <AIInsightsPanel
            insights={aiInsights}
            onQuerySubmit={onAIQuerySubmit}
            queryResponse={queryResponse}
            className="bg-card/60 backdrop-blur-sm border-border/50"
          />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              System Status
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshEsp32Status}
              className="bg-background/50 hover:bg-accent/10 border-border/50"
            >
              Refresh
            </Button>
          </div>
          
          <SystemStatus
            wifiConnected={true}
            temperature={28}
            uptime="3d 5h 22m"
            esp32Status={{
              topTank: esp32TopStatus.connected ? 'online' : 'offline',
              sump: esp32SumpStatus.connected ? 'online' : 'offline'
            }}
          />
          
          <SystemAlerts alerts={alerts} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MobileDashboard;