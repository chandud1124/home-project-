import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wifi, 
  WifiOff, 
  Thermometer, 
  Activity,
  Shield
} from "lucide-react";

interface SystemStatusProps {
  wifiConnected: boolean;
  temperature: number;
  uptime: string;
  esp32Status: {
    topTank: 'online' | 'offline' | 'error';
    sump: 'online' | 'offline' | 'error';
  };
  className?: string;
}

export const SystemStatus = ({ 
  wifiConnected, 
  temperature,
  uptime,
  esp32Status,
  className 
}: SystemStatusProps) => {
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'online': return <Badge className="bg-success text-xs">Online</Badge>;
      case 'offline': return <Badge variant="secondary" className="text-xs">Offline</Badge>;
      case 'error': return <Badge variant="destructive" className="text-xs">Error</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };

  return (
    <Card className={`p-4 sm:p-6 bg-card border-border ${className || ''}`}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="text-base sm:text-lg font-semibold">System Status</h3>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* WiFi Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {wifiConnected ? (
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4 text-success" />
            ) : (
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-danger" />
            )}
            <span className="text-xs sm:text-sm">WiFi Connection</span>
          </div>
          <Badge variant={wifiConnected ? 'default' : 'destructive'} className="text-xs">
            {wifiConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm">System Temperature</span>
          </div>
          <span className="text-xs sm:text-sm font-medium">{temperature}°C</span>
        </div>

        {/* System Uptime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm">Uptime</span>
          </div>
          <span className="text-xs sm:text-sm font-medium">{uptime}</span>
        </div>

        {/* ESP32 Controllers Status */}
        <div className="border-t border-border pt-3 sm:pt-4 mt-3 sm:mt-4">
          <h4 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">Controller Status</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Top Tank ESP32</span>
              {getStatusBadge(esp32Status.topTank)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Sump ESP32</span>
              {getStatusBadge(esp32Status.sump)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
