import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { EnhancedTankMonitor } from "./EnhancedTankMonitor";
import { TankMonitor } from "./TankMonitor";
import { Droplets, Play, Pause, RotateCcw } from "lucide-react";

export const WaterAnimationDemo = () => {
  const [topTankLevel, setTopTankLevel] = useState(75);
  const [sumpTankLevel, setSumpTankLevel] = useState(25);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

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
    // For demo purposes, just call onSuccess
    onSuccess();
  };

  // Predefined animation sequences
  const animationSequences = [
    { top: 75, sump: 25, delay: 0 },
    { top: 85, sump: 15, delay: 2000 },
    { top: 95, sump: 5, delay: 4000 },
    { top: 100, sump: 0, delay: 6000 },
    { top: 90, sump: 10, delay: 8000 },
    { top: 70, sump: 30, delay: 10000 },
    { top: 50, sump: 50, delay: 12000 },
    { top: 30, sump: 70, delay: 14000 },
    { top: 10, sump: 90, delay: 16000 },
    { top: 5, sump: 95, delay: 18000 },
    { top: 75, sump: 25, delay: 20000 },
  ];

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setAnimationStep((prev) => {
        const nextStep = (prev + 1) % animationSequences.length;
        const sequence = animationSequences[nextStep];

        setTimeout(() => {
          setTopTankLevel(sequence.top);
          setSumpTankLevel(sequence.sump);
        }, 100); // Small delay to ensure smooth transition

        return nextStep;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const handlePlayPause = () => {
    setIsAnimating(!isAnimating);
  };

  const handleReset = () => {
    setIsAnimating(false);
    setAnimationStep(0);
    setTopTankLevel(75);
    setSumpTankLevel(25);
  };

  const handleManualLevelChange = (tank: 'top' | 'sump', level: number[]) => {
    if (tank === 'top') {
      setTopTankLevel(level[0]);
    } else {
      setSumpTankLevel(level[0]);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Droplets className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Water Animation Demo</h2>
            <Badge variant="outline" className="ml-2">
              {isAnimating ? 'Playing' : 'Paused'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayPause}
              variant={isAnimating ? "secondary" : "default"}
              size="sm"
            >
              {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isAnimating ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Animation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Top Tank Level: {topTankLevel}%</label>
            <Slider
              value={[topTankLevel]}
              onValueChange={(value) => handleManualLevelChange('top', value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">Sump Tank Level: {sumpTankLevel}%</label>
            <Slider
              value={[sumpTankLevel]}
              onValueChange={(value) => handleManualLevelChange('sump', value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Tank Monitors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EnhancedTankMonitor
            title="Top Tank"
            currentLevel={topTankLevel}
            capacity={500}
            status={topTankLevel > 80 ? 'full' : topTankLevel > 60 ? 'normal' : topTankLevel > 30 ? 'low' : 'critical'}
            sensorHealth="online"
            symbol="🏠"
            esp32Status={{
              connected: true,
              wifiStrength: -45,
              lastSeen: new Date()
            }}
            floatSwitch={false}
            motorRunning={topTankLevel < 30 && sumpTankLevel > 20}
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
          />

          <EnhancedTankMonitor
            title="Sump Tank"
            currentLevel={sumpTankLevel}
            capacity={500}
            status={sumpTankLevel > 80 ? 'full' : sumpTankLevel > 60 ? 'normal' : sumpTankLevel > 30 ? 'low' : 'critical'}
            sensorHealth="online"
            symbol="🕳️"
            esp32Status={{
              connected: true,
              wifiStrength: -42,
              lastSeen: new Date()
            }}
            floatSwitch={sumpTankLevel > 80}
            motorRunning={topTankLevel < 30 && sumpTankLevel > 20}
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
          />
        </div>

        {/* Basic Tank Monitor for Comparison */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Basic Tank Monitor (for comparison)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TankMonitor
              title="Basic Top Tank"
              currentLevel={topTankLevel}
              capacity={500}
              status={topTankLevel > 80 ? 'full' : topTankLevel > 60 ? 'normal' : topTankLevel > 30 ? 'low' : 'critical'}
              sensorHealth="online"
            />
            <TankMonitor
              title="Basic Sump Tank"
              currentLevel={sumpTankLevel}
              capacity={500}
              status={sumpTankLevel > 80 ? 'full' : sumpTankLevel > 60 ? 'normal' : sumpTankLevel > 30 ? 'low' : 'critical'}
              sensorHealth="online"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
