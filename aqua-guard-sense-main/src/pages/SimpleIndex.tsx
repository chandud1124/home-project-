import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Wifi, Activity, Droplets, Zap, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface DeviceConfig {
  id: string;
  name: string;
  mac: string;
  ip: string;
  secretKey: string;
  isConfigured: boolean;
  lastSeen?: Date;
  status: 'online' | 'offline' | 'unknown';
}

interface TankData {
  level: number;
  motorRunning: boolean;
  autoMode: boolean;
  floatSwitch?: boolean;
  lastUpdate: Date;
}

const SimpleWaterTankDashboard: React.FC = () => {
  const { toast } = useToast();
  
  // Device configurations
  const [topTankConfig, setTopTankConfig] = useState<DeviceConfig>({
    id: 'ESP32_TOP_002',
    name: 'Top Tank Monitor',
    mac: '',
    ip: '',
    secretKey: '',
    isConfigured: false,
    status: 'unknown'
  });
  
  const [sumpTankConfig, setSumpTankConfig] = useState<DeviceConfig>({
    id: 'SUMP_TANK',
    name: 'Sump Tank Controller',
    mac: '',
    ip: '',
    secretKey: '',
    isConfigured: false,
    status: 'unknown'
  });
  
  // Tank data
  const [topTankData, setTopTankData] = useState<TankData>({
    level: 0,
    motorRunning: false,
    autoMode: true,
    lastUpdate: new Date()
  });
  
  const [sumpTankData, setSumpTankData] = useState<TankData>({
    level: 0,
    motorRunning: false,
    autoMode: true,
    floatSwitch: false,
    lastUpdate: new Date()
  });
  
  const [showSecrets, setShowSecrets] = useState<{[key: string]: boolean}>({});
  
  // Generate secret key for device
  const generateSecretKey = (): string => {
    return 'aq_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('') + '_' + Date.now().toString(16);
  };
  
  // Configure device
  const configureDevice = (deviceType: 'top' | 'sump') => {
    const secretKey = generateSecretKey();
    
    if (deviceType === 'top') {
      setTopTankConfig(prev => ({
        ...prev,
        secretKey,
        isConfigured: true,
        status: prev.ip ? 'offline' : 'unknown'
      }));
    } else {
      setSumpTankConfig(prev => ({
        ...prev,
        secretKey,
        isConfigured: true,
        status: prev.ip ? 'offline' : 'unknown'
      }));
    }
    
    toast({
      title: "Device Configured",
      description: `${deviceType === 'top' ? 'Top Tank' : 'Sump Tank'} secret key generated successfully!`
    });
  };
  
  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };
  
  // Toggle secret visibility
  const toggleSecretVisibility = (deviceId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };
  
  // Test device connection
  const testConnection = async (config: DeviceConfig) => {
    if (!config.ip) {
      toast({
        title: "No IP Address",
        description: "Please enter device IP address first",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(`http://${config.ip}/status`);
      if (response.ok) {
        const data = await response.json();
        
        // Update device status
        if (config.id === 'ESP32_TOP_002') {
          setTopTankConfig(prev => ({ ...prev, status: 'online', lastSeen: new Date() }));
          setTopTankData({
            level: data.level_percentage || 0,
            motorRunning: false,
            autoMode: true,
            lastUpdate: new Date()
          });
        } else {
          setSumpTankConfig(prev => ({ ...prev, status: 'online', lastSeen: new Date() }));
          setSumpTankData({
            level: data.level_percentage || 0,
            motorRunning: data.motor_running || false,
            autoMode: data.auto_mode !== undefined ? data.auto_mode : true,
            floatSwitch: data.float_switch || false,
            lastUpdate: new Date()
          });
        }
        
        toast({
          title: "Connection Successful",
          description: `${config.name} is online and responding`
        });
      } else {
        throw new Error('Device not responding');
      }
    } catch (error) {
      const deviceConfig = config.id === 'ESP32_TOP_002' ? setTopTankConfig : setSumpTankConfig;
      deviceConfig(prev => ({ ...prev, status: 'offline' }));
      
      toast({
        title: "Connection Failed",
        description: `Unable to connect to ${config.name}`,
        variant: "destructive"
      });
    }
  };
  
  // Get level color based on tank type and level
  const getLevelColor = (level: number, isTopTank: boolean) => {
    if (isTopTank) {
      if (level < 30) return 'text-red-500';
      if (level > 90) return 'text-blue-500';
      return 'text-green-500';
    } else {
      if (level < 25) return 'text-red-500';
      if (level > 85) return level > 90 ? 'text-red-500' : 'text-yellow-500';
      return 'text-green-500';
    }
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    };
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {status.toUpperCase()}
      </Badge>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">AquaGuard Simple</h1>
          <p className="text-gray-600">ESP32 Water Tank Monitoring System</p>
        </div>
        
        {/* Device Configuration Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Tank Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                Top Tank Monitor
              </CardTitle>
              <CardDescription>
                Water level monitoring only - communicates with Sump Tank
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="top-mac">MAC Address</Label>
                  <Input
                    id="top-mac"
                    value={topTankConfig.mac}
                    onChange={(e) => setTopTankConfig(prev => ({ ...prev, mac: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </div>
                <div>
                  <Label htmlFor="top-ip">IP Address</Label>
                  <Input
                    id="top-ip"
                    value={topTankConfig.ip}
                    onChange={(e) => setTopTankConfig(prev => ({ ...prev, ip: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => configureDevice('top')}
                  disabled={!topTankConfig.mac || !topTankConfig.ip}
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Generate Secret Key
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => testConnection(topTankConfig)}
                  disabled={!topTankConfig.ip}
                  size="sm"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
              
              {topTankConfig.isConfigured && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <strong>Device Secret Key:</strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(topTankConfig.id)}
                        >
                          {showSecrets[topTankConfig.id] ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      {showSecrets[topTankConfig.id] && (
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 p-2 rounded text-sm flex-1 break-all">
                            {topTankConfig.secretKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(topTankConfig.secretKey, 'Secret key')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-gray-600">
                        Copy this key to your ESP32 code before uploading
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(topTankConfig.status)}
              </div>
            </CardContent>
          </Card>
          
          {/* Sump Tank Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Sump Tank Controller
              </CardTitle>
              <CardDescription>
                Complete control system with motor, sensors, and safety features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sump-mac">MAC Address</Label>
                  <Input
                    id="sump-mac"
                    value={sumpTankConfig.mac}
                    onChange={(e) => setSumpTankConfig(prev => ({ ...prev, mac: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </div>
                <div>
                  <Label htmlFor="sump-ip">IP Address</Label>
                  <Input
                    id="sump-ip"
                    value={sumpTankConfig.ip}
                    onChange={(e) => setSumpTankConfig(prev => ({ ...prev, ip: e.target.value }))}
                    placeholder="192.168.1.101"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => configureDevice('sump')}
                  disabled={!sumpTankConfig.mac || !sumpTankConfig.ip}
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Generate Secret Key
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => testConnection(sumpTankConfig)}
                  disabled={!sumpTankConfig.ip}
                  size="sm"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
              
              {sumpTankConfig.isConfigured && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <strong>Device Secret Key:</strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(sumpTankConfig.id)}
                        >
                          {showSecrets[sumpTankConfig.id] ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      {showSecrets[sumpTankConfig.id] && (
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 p-2 rounded text-sm flex-1 break-all">
                            {sumpTankConfig.secretKey}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(sumpTankConfig.secretKey, 'Secret key')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-gray-600">
                        Copy this key to your ESP32 code before uploading
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(sumpTankConfig.status)}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tank Status Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Tank Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-500" />
                  Top Tank Status
                </span>
                {topTankConfig.status === 'online' && (
                  <Badge variant="outline" className="bg-green-50">
                    <Activity className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getLevelColor(topTankData.level, true)}`}>
                    {topTankData.level.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {((topTankData.level / 100) * 1000).toFixed(0)}L / 1000L
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Cylindrical Tank (Ø103cm × 120cm)
                  </p>
                </div>                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${topTankData.level}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Motor Control</div>
                    <div className="text-xs text-gray-600">
                      {topTankData.level < 30 ? 'Requesting START' : 
                       topTankData.level > 90 ? 'Requesting STOP' : 'Normal'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-semibold">Last Update</div>
                    <div className="text-xs text-gray-600">
                      {topTankData.lastUpdate.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Sump Tank Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Sump Tank Status
                </span>
                {sumpTankConfig.status === 'online' && (
                  <Badge variant="outline" className="bg-green-50">
                    <Activity className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getLevelColor(sumpTankData.level, false)}`}>
                    {sumpTankData.level.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {((sumpTankData.level / 100) * 1322.5).toFixed(0)}L / 1323L
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Rectangular Tank (230×230×250cm)
                  </p>
                </div>                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-orange-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${sumpTankData.level}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`font-semibold ${sumpTankData.motorRunning ? 'text-green-600' : 'text-gray-600'}`}>
                      Motor
                    </div>
                    <div className="text-xs">
                      {sumpTankData.motorRunning ? 'RUNNING' : 'STOPPED'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`font-semibold ${sumpTankData.autoMode ? 'text-blue-600' : 'text-yellow-600'}`}>
                      Mode
                    </div>
                    <div className="text-xs">
                      {sumpTankData.autoMode ? 'AUTO' : 'MANUAL'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className={`font-semibold ${sumpTankData.floatSwitch ? 'text-green-600' : 'text-red-600'}`}>
                      Float
                    </div>
                    <div className="text-xs">
                      {sumpTankData.floatSwitch ? 'OK' : 'LOW'}
                    </div>
                  </div>
                </div>
                
                <div className="text-center p-2 bg-gray-50 rounded text-sm">
                  <div className="font-semibold">Last Update</div>
                  <div className="text-xs text-gray-600">
                    {sumpTankData.lastUpdate.toLocaleTimeString()}
                  </div>
                </div>
                
                {/* Level Indicators */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span>Critical (90%+):</span>
                    <span className={sumpTankData.level >= 90 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                      LED ON + BUZZER
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>High (85-89%):</span>
                    <span className={sumpTankData.level >= 85 && sumpTankData.level < 90 ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>
                      LED BLINKING
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Low (&lt;25%):</span>
                    <span className={sumpTankData.level < 25 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                      LOW LED ON
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* System Overview */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Communication and control status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Droplets className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className="font-semibold">Top Tank</div>
                <div className="text-xs text-gray-600">Monitors water level</div>
                <div className="text-xs text-gray-600">Sends motor commands</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Wifi className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <div className="font-semibold">Local Network</div>
                <div className="text-xs text-gray-600">ESP32 ↔ ESP32</div>
                <div className="text-xs text-gray-600">Works offline</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Zap className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className="font-semibold">Sump Tank</div>
                <div className="text-xs text-gray-600">Controls motor</div>
                <div className="text-xs text-gray-600">Safety features</div>
              </div>
            </div>
            
            <Alert className="mt-4">
              <AlertDescription>
                <strong>How it works:</strong> Top Tank monitors water level and sends START/STOP commands to Sump Tank. 
                Sump Tank controls the motor based on commands and safety checks (float switch, water levels). 
                Both devices communicate directly over WiFi - no internet required.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SimpleWaterTankDashboard;
