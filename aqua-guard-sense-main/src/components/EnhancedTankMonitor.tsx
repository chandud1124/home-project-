
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Droplets, AlertTriangle, CheckCircle, Wifi, Zap, Settings, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";

interface EnhancedTankMonitorProps {
  title: string;
  currentLevel: number;
  capacity: number;
  status: 'full' | 'normal' | 'low' | 'critical';
  sensorHealth: 'online' | 'warning' | 'offline';
  esp32Status: {
    connected: boolean;
    wifiStrength: number;
    lastSeen: Date;
  };
  symbol: '🏠' | '🕳️';
  floatSwitch?: boolean;
  motorRunning?: boolean;
  manualOverride?: boolean;
  onRequestEsp32Connect?: (deviceName: string, onSuccess: () => void) => void;
}

export const EnhancedTankMonitor = ({ 
  title, 
  currentLevel, 
  capacity, 
  status,
  sensorHealth,
  esp32Status,
  symbol,
  floatSwitch,
  motorRunning,
  manualOverride,
  onRequestEsp32Connect
}: EnhancedTankMonitorProps) => {
  const [esp32Config, setEsp32Config] = useState({
    macAddress: '80:F3:DA:65:47:38',
    ipAddress: '192.168.0.132'
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(currentLevel);
  const [flowDirection, setFlowDirection] = useState<'filling' | 'draining' | 'stable'>('stable');

  const currentLiters = Math.round((currentLevel / 100) * capacity);

  // Detect flow direction
  useEffect(() => {
    if (currentLevel > previousLevel + 1) {
      setFlowDirection('filling');
    } else if (currentLevel < previousLevel - 1) {
      setFlowDirection('draining');
    } else {
      setFlowDirection('stable');
    }
    setPreviousLevel(currentLevel);
  }, [currentLevel, previousLevel]);

  const getFlowAnimation = () => {
    switch(flowDirection) {
      case 'filling': return 'animate-water-filling';
      case 'draining': return 'animate-water-draining';
      default: return 'animate-water-fill';
    }
  };

  const getFlowIcon = () => {
    switch(flowDirection) {
      case 'filling': return <TrendingUp className="w-4 h-4 text-success" />;
      case 'draining': return <TrendingDown className="w-4 h-4 text-warning" />;
      default: return null;
    }
  };
  
  const getTankColor = (level: number) => {
    if (level >= 80) return 'bg-gradient-to-t from-success to-success/80'; // Full - Success
    if (level >= 60) return 'bg-gradient-to-t from-primary to-primary/80'; // Good - Primary
    if (level >= 40) return 'bg-gradient-to-t from-warning to-warning/80'; // Medium - Warning
    if (level >= 20) return 'bg-gradient-to-t from-orange-500 to-orange-400'; // Low - Orange
    return 'bg-gradient-to-t from-destructive to-destructive/80'; // Critical - Destructive
  };

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'full': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  const getSensorIcon = (health: string) => {
    switch(health) {
      case 'online': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'offline': return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };

  const handleConnectEsp32 = () => {
    if (onRequestEsp32Connect) {
      onRequestEsp32Connect(title, () => {
        setIsConnecting(true);
        // Simulate connection process
        setTimeout(() => {
          setIsConnecting(false);
          console.log('ESP32 Connection attempt:', esp32Config);
        }, 2000);
      });
    } else {
      // Fallback for backward compatibility
      setIsConnecting(true);
      setTimeout(() => {
        setIsConnecting(false);
        console.log('ESP32 Connection attempt:', esp32Config);
      }, 2000);
    }
  };

  return (
    <Card className="p-4 bg-card/60 md:backdrop-blur-sm backdrop-blur-none border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{symbol}</span>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Droplets className="w-5 h-5 text-primary" />
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {getSensorIcon(sensorHealth)}
              <span className="text-sm text-muted-foreground">
                {sensorHealth === 'online' ? 'Sensor OK' : 'Sensor Issue'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {getFlowIcon()}
            <Badge variant={getStatusBadgeVariant(status)}>
              {status.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wifi className={`w-3 h-3 ${esp32Status.connected ? 'text-success' : 'text-destructive'}`} />
            <span>WiFi: {esp32Status.wifiStrength}dBm</span>
          </div>
        </div>
      </div>

      {/* Enhanced Tank Visual with Realistic Water Animation */}
      <div className="mb-4">
        <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden border-2 border-border">
          {/* Water Level with Enhanced Animation */}
          <div
            className={`absolute bottom-0 left-0 w-full transition-all duration-1500 ease-out ${getFlowAnimation()} ${getTankColor(currentLevel)}`}
            style={{
              height: `${currentLevel}%`,
              '--fill-level': `${currentLevel}%`,
              '--previous-level': `${previousLevel}%`
            } as React.CSSProperties & { '--fill-level': string; '--previous-level': string }}
          >
            {/* Water Surface Effect - Desktop Only */}
            <div className="hidden md:block absolute top-0 left-0 w-full h-3 bg-gradient-to-b from-white/25 to-transparent animate-water-wave" />

            {/* Ripple Effect - Desktop Only */}
            <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-white/15 rounded-full animate-water-ripple" />

            {/* Bubbles Effect for Filling - Desktop Only */}
            {currentLevel > 15 && (
              <div className="hidden md:flex">
                <div className="absolute bottom-1/4 left-1/5 w-1.5 h-1.5 bg-white/40 rounded-full animate-water-bubbles" style={{ animationDelay: '0s' }} />
                <div className="absolute bottom-1/3 left-4/5 w-1 h-1 bg-white/30 rounded-full animate-water-bubbles" style={{ animationDelay: '1.2s' }} />
                <div className="absolute bottom-2/5 left-2/5 w-1 h-1 bg-white/35 rounded-full animate-water-bubbles" style={{ animationDelay: '0.8s' }} />
                <div className="absolute bottom-1/2 left-3/5 w-0.5 h-0.5 bg-white/25 rounded-full animate-water-bubbles" style={{ animationDelay: '2.1s' }} />
              </div>
            )}

            {/* Mobile Static Water Surface */}
            <div className="md:hidden absolute top-0 left-0 w-full h-2 bg-gradient-to-b from-white/20 to-transparent" />

            {/* Enhanced Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/15" />
          </div>

          {/* Water Level Indicator with Enhanced Styling */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-card/95 md:backdrop-blur-md backdrop-blur-none rounded-xl px-4 py-2 shadow-xl border border-border/60">
              <span className="text-xl font-bold text-foreground">
                {currentLevel}%
              </span>
              <div className="text-xs text-muted-foreground mt-0.5">
                {currentLiters}L / {capacity}L
              </div>
            </div>
          </div>

          {/* Enhanced Level Markers */}
          <div className="absolute right-2 top-0 h-full flex flex-col justify-between py-2 text-xs text-muted-foreground/70 font-medium">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
        </div>
      </div>

      {/* Tank Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Current Volume</p>
          <p className="text-xl font-bold text-primary">{currentLiters}L</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Capacity</p>
          <p className="text-xl font-bold text-foreground">{capacity}L</p>
        </div>
      </div>

      {/* Float Switch & Motor Status */}
      {motorRunning !== undefined && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-1 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Motor Status</p>
              <Badge 
                variant={motorRunning ? 'default' : 'secondary'} 
                className="mt-1"
              >
                {motorRunning ? 'Running' : 'Stopped'}
              </Badge>
            </div>
          </div>
          {manualOverride && (
            <div className="mt-2 text-center">
              <Badge variant="outline" className="text-xs">
                Manual Override Active
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* ESP32 Status & Connection */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${esp32Status.connected ? 'text-success' : 'text-destructive'}`} />
            <span className={`text-sm ${esp32Status.connected ? 'text-success' : 'text-destructive'}`}>
              {esp32Status.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-background/50 hover:bg-accent/10 border-border/50">
                <Settings className="w-4 h-4 mr-2" />
                ESP32 Config
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">ESP32 Configuration - {title}</DialogTitle>
                <DialogDescription>
                  Configure ESP32 device settings including network connection and monitoring parameters.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mac" className="text-foreground">MAC Address</Label>
                  <Input
                    id="mac"
                    value={esp32Config.macAddress}
                    onChange={(e) => setEsp32Config(prev => ({ ...prev, macAddress: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip" className="text-foreground">IP Address</Label>
                  <Input
                    id="ip"
                    value={esp32Config.ipAddress}
                    onChange={(e) => setEsp32Config(prev => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleConnectEsp32}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect ESP32'}
                  </Button>
                  <Button variant="outline" className="flex-1 bg-background/50 border-border">
                    Test Connection
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {esp32Status.lastSeen && (
          <p className="text-xs text-muted-foreground mt-1">
            Last seen: {esp32Status.lastSeen.toLocaleTimeString()}
          </p>
        )}
      </div>
    </Card>
  );
};
