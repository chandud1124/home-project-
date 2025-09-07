
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Droplets, AlertTriangle, CheckCircle, Wifi, Zap, Settings, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { BACKEND_URL } from "@/services/api";

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
    connectionState?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stable' | 'stale';
    backendResponsive?: boolean;
    heartbeatMissed?: number;
    uptime?: number;
  };
  symbol: '🏠' | '🕳️';
  floatSwitch?: boolean;
  motorRunning?: boolean;
  manualOverride?: boolean;
  onRequestEsp32Connect?: (deviceName: string, onSuccess: () => void) => void;
  initialMacAddress?: string;
  initialIpAddress?: string;
  onConfigChange?: (config: { macAddress: string; ipAddress: string; apiKey: string; hmacSecret: string }) => void;
  isDeviceRegistered?: boolean;
  deviceKeys?: { apiKey: string; hmacSecret: string };
  onDeviceRegistration?: (apiKey: string, hmacSecret: string) => void;
  onRequestPinForKeys?: (deviceName: string, onSuccess: () => void) => void;
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
  onRequestEsp32Connect,
  initialMacAddress,
  initialIpAddress,
  onConfigChange,
  isDeviceRegistered = false,
  deviceKeys,
  onDeviceRegistration,
  onRequestPinForKeys
}: EnhancedTankMonitorProps) => {
  // Load configuration from localStorage or use props/defaults
  const getInitialConfig = () => {
    const stored = localStorage.getItem(`esp32-config-${title}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('Invalid stored ESP32 config, using defaults');
      }
    }
    return {
      macAddress: initialMacAddress || '80:F3:DA:65:86:6C',
      ipAddress: initialIpAddress || '192.168.1.101',
      apiKey: '',
      hmacSecret: ''
    };
  };

  const [esp32Config, setEsp32Config] = useState(getInitialConfig);
  const [isConnecting, setIsConnecting] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(currentLevel);
  const [flowDirection, setFlowDirection] = useState<'filling' | 'draining' | 'stable'>('stable');
  const [keysRevealed, setKeysRevealed] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);

  const { toast } = useToast();

  // Session timeout management
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (keysRevealed && sessionExpiry) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((sessionExpiry - now) / 1000));
        setSessionTimeLeft(timeLeft);
        
        if (timeLeft <= 0) {
          setKeysRevealed(false);
          setSessionExpiry(null);
          toast({
            title: "Session Expired",
            description: "Keys have been hidden for security. Enter PIN again to view.",
            variant: "destructive",
          });
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [keysRevealed, sessionExpiry, toast]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      setKeysRevealed(false);
      setSessionExpiry(null);
      setSessionTimeLeft(0);
    };
  }, []);

  // Save configuration to localStorage and notify parent when config changes
  useEffect(() => {
    localStorage.setItem(`esp32-config-${title}`, JSON.stringify(esp32Config));
    if (onConfigChange) {
      onConfigChange(esp32Config);
    }
  }, [esp32Config, title, onConfigChange]);

  // Handle configuration updates with validation
  const handleConfigUpdate = (field: 'macAddress' | 'ipAddress' | 'apiKey' | 'hmacSecret', value: string) => {
    setEsp32Config(prev => ({
      ...prev,
      [field]: value
    }));
  };

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

  const getConnectionStateIcon = (state?: string) => {
    switch(state) {
      case 'stable': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'connected': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'connecting': return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
      case 'reconnecting': return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
      case 'stale': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };

  const getConnectionStateText = (state?: string) => {
    switch(state) {
      case 'stable': return 'Stable Connection';
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'stale': return 'Stale Data';
      default: return 'Disconnected';
    }
  };

  const handleConnectEsp32 = async () => {
    setIsConnecting(true);
    try {
      // Save device configuration to backend (without user-input keys)
      const deviceConfig = {
        esp32_id: `ESP32_${title.toUpperCase().replace(' ', '_')}`,
        mac_address: esp32Config.macAddress,
        device_type: title.toLowerCase().replace(' ', '_'),
        ip_address: esp32Config.ipAddress,
        firmware_version: '1.0.0'
        // Note: API key and HMAC secret will be generated by backend
      };

      const response = await fetch(`${BACKEND_URL}/api/esp32/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceConfig),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Device registered successfully:', result);
        toast({
          title: "Device Registered",
          description: `${title} has been registered with API keys saved to backend.`,
        });
        
        // Use the generated keys from backend response
        const generatedApiKey = result.api_key;
        const generatedHmacSecret = result.hmac_secret;
        console.log('Backend response keys:', generatedApiKey, generatedHmacSecret);
        
        // Update local config with generated keys
        setEsp32Config(prev => ({
          ...prev,
          apiKey: generatedApiKey,
          hmacSecret: generatedHmacSecret
        }));
        
        // Call parent callback to update device registration state with generated keys
        if (onDeviceRegistration) {
          onDeviceRegistration(generatedApiKey, generatedHmacSecret);
        }
        
        // Call the parent callback if provided
        if (onRequestEsp32Connect) {
          onRequestEsp32Connect(title, () => {
            setIsConnecting(false);
          });
        } else {
          setIsConnecting(false);
        }
      } else {
        console.error('Device registration failed:', result.error);
        toast({
          title: "Registration Failed",
          description: result.error || "Failed to register device. Please try again.",
          variant: "destructive",
        });
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('Error registering device:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to backend. Please check your network connection.",
        variant: "destructive",
      });
      setIsConnecting(false);
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
            {esp32Status.connectionState && (
              <>
                <span className="mx-1">•</span>
                {getConnectionStateIcon(esp32Status.connectionState)}
                <span className={`text-xs ${
                  esp32Status.connectionState === 'stable' ? 'text-success' :
                  esp32Status.connectionState === 'connected' ? 'text-success' :
                  esp32Status.connectionState === 'connecting' ? 'text-warning' :
                  esp32Status.connectionState === 'reconnecting' ? 'text-warning' :
                  'text-destructive'
                }`}>
                  {esp32Status.connectionState}
                </span>
              </>
            )}
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getConnectionStateIcon(esp32Status.connectionState)}
            <span className={`text-sm font-medium ${
              esp32Status.connectionState === 'stable' ? 'text-success' :
              esp32Status.connected ? 'text-success' : 'text-destructive'
            }`}>
              {getConnectionStateText(esp32Status.connectionState)}
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
                    onChange={(e) => handleConfigUpdate('macAddress', e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip" className="text-foreground">IP Address</Label>
                  <Input
                    id="ip"
                    value={esp32Config.ipAddress}
                    onChange={(e) => handleConfigUpdate('ipAddress', e.target.value)}
                    placeholder="192.168.1.100"
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-foreground">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      value={isDeviceRegistered && deviceKeys && keysRevealed ? deviceKeys.apiKey : ''}
                      onChange={(e) => !isDeviceRegistered && handleConfigUpdate('apiKey', e.target.value)}
                      placeholder={isDeviceRegistered 
                        ? (keysRevealed ? "Device registered - API key shown" : "Click 'Reveal Keys' to view") 
                        : "Keys will be auto-generated on registration"
                      }
                      className="bg-background border-border text-foreground font-mono text-sm"
                      readOnly={isDeviceRegistered}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!keysRevealed}
                      onClick={() => {
                        if (!keysRevealed) return;
                        const keyToCopy = deviceKeys?.apiKey || '';
                        navigator.clipboard.writeText(keyToCopy || '');
                        toast({
                          title: "API Key Copied",
                          description: "API key has been copied to clipboard",
                        });
                        // Hide keys after copying
                        if (keysRevealed) {
                          setKeysRevealed(false);
                          setSessionExpiry(null);
                          setSessionTimeLeft(0);
                        }
                      }}
                    >
                      �
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isDeviceRegistered 
                      ? "Auto-generated key for backend authentication (read-only)" 
                      : "Auto-generated key for backend authentication"
                    }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmacSecret" className="text-foreground">HMAC Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      id="hmacSecret"
                      value={isDeviceRegistered && deviceKeys && keysRevealed ? deviceKeys.hmacSecret : ''}
                      onChange={(e) => !isDeviceRegistered && handleConfigUpdate('hmacSecret', e.target.value)}
                      placeholder={isDeviceRegistered 
                        ? (keysRevealed ? "Device registered - HMAC secret shown" : "Click 'Reveal Keys' to view") 
                        : "Keys will be auto-generated on registration"
                      }
                      className="bg-background border-border text-foreground font-mono text-sm"
                      readOnly={isDeviceRegistered}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!keysRevealed}
                      onClick={() => {
                        if (!keysRevealed) return;
                        const secretToCopy = deviceKeys?.hmacSecret || '';
                        navigator.clipboard.writeText(secretToCopy || '');
                        toast({
                          title: "HMAC Secret Copied",
                          description: "HMAC secret has been copied to clipboard",
                        });
                        // Hide keys after copying
                        if (keysRevealed) {
                          setKeysRevealed(false);
                          setSessionExpiry(null);
                          setSessionTimeLeft(0);
                        }
                      }}
                    >
                      �
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isDeviceRegistered 
                      ? "Secret key for request signing - keep secure! (read-only)" 
                      : "Secret key for request signing - keep secure!"
                    }
                  </p>
                </div>

                {isDeviceRegistered && !keysRevealed && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (onRequestPinForKeys) {
                          onRequestPinForKeys(title, () => {
                            setKeysRevealed(true);
                            setSessionExpiry(Date.now() + 30000); // 30 seconds session
                            setSessionTimeLeft(30);
                          });
                        } else {
                          setKeysRevealed(true);
                          setSessionExpiry(Date.now() + 30000); // 30 seconds session
                          setSessionTimeLeft(30);
                        }
                      }}
                    >
                      🔐 Reveal Keys (PIN Required)
                    </Button>
                  </div>
                )}

                {isDeviceRegistered && keysRevealed && sessionTimeLeft > 0 && (
                  <div className="flex justify-center pt-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        <span>Keys visible for: <strong>{sessionTimeLeft}s</strong></span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setKeysRevealed(false);
                            setSessionExpiry(null);
                            setSessionTimeLeft(0);
                          }}
                          className="ml-2 h-6 px-2 text-xs text-amber-700 hover:bg-amber-100"
                        >
                          Hide Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isDeviceRegistered ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h4 className="font-medium text-green-900 text-sm mb-2">✅ Device Registered</h4>
                    <div className="text-xs text-green-800 space-y-1">
                      <p><strong>✓</strong> API Key and HMAC Secret are set</p>
                      <p><strong>✓</strong> Keys are read-only and secure</p>
                      <p><strong>✓</strong> Keys will only change if device is re-registered</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="font-medium text-blue-900 text-sm mb-2">� Device Registration</h4>
                    <div className="text-xs text-blue-800 space-y-1">
                      <p><strong>1.</strong> Fill in MAC Address and IP Address</p>
                      <p><strong>2.</strong> Click "Register Device"</p>
                      <p><strong>3.</strong> API Key & HMAC Secret will be auto-generated</p>
                      <p><strong>4.</strong> Keys are static and read-only after registration</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleConnectEsp32}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? 'Registering...' : 'Register Device'}
                  </Button>
                  <Button variant="outline" className="flex-1 bg-background/50 border-border">
                    Test Connection
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">WiFi:</span> {esp32Status.wifiStrength}dBm
          </div>
          <div>
            <span className="font-medium">Backend:</span> 
            <span className={esp32Status.backendResponsive ? 'text-success' : 'text-destructive'}>
              {esp32Status.backendResponsive ? 'Responsive' : 'Unresponsive'}
            </span>
          </div>
          {esp32Status.uptime && (
            <>
              <div>
                <span className="font-medium">Uptime:</span> {Math.floor(esp32Status.uptime / 3600000)}h {Math.floor((esp32Status.uptime % 3600000) / 60000)}m
              </div>
              <div>
                <span className="font-medium">Stability:</span> 
                <span className="text-success">Crash-only restart</span>
              </div>
            </>
          )}
        </div>
        
        {esp32Status.lastSeen && (
          <p className="text-xs text-muted-foreground mt-2">
            Last seen: {esp32Status.lastSeen.toLocaleTimeString()}
          </p>
        )}
        
        {/* Connection Stability Info */}
        {esp32Status.connectionState === 'stable' && (
          <div className="mt-2 p-2 bg-success/10 rounded-md border border-success/20">
            <p className="text-xs text-success font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Stable Connection - No restart needed
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ESP32 maintains connection indefinitely. Only restarts on crashes or panic mode.
            </p>
          </div>
        )}
        
        {esp32Status.connectionState === 'reconnecting' && (
          <div className="mt-2 p-2 bg-warning/10 rounded-md border border-warning/20">
            <p className="text-xs text-warning font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Smart Reconnection Active
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Using exponential backoff. No forced restart for connection issues.
            </p>
          </div>
        )}
        
        {esp32Status.heartbeatMissed && esp32Status.heartbeatMissed > 0 && (
          <div className="mt-2 p-2 bg-warning/10 rounded-md border border-warning/20">
            <p className="text-xs text-warning font-medium">
              ⚠️ Heartbeat missed: {esp32Status.heartbeatMissed} times
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Backend responsiveness monitoring active. No auto-restart.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
