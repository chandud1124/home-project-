
import React from 'react';

import { MasterSwitchCard } from '@/components/MasterSwitchCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Power, Lightbulb, Fan, Zap, Home } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';

const Master = () => {
  const { devices, toggleAllSwitches } = useDevices();
  const { toast } = useToast();

  const allSwitches = devices.flatMap(device => 
    device.switches.map(sw => ({
      ...sw,
      deviceName: device.name,
      deviceId: device.id,
      deviceStatus: device.status,
      location: device.location || 'Unknown'
    }))
  );

  const totalSwitches = allSwitches.length;
  const activeSwitches = allSwitches.filter(sw => sw.state).length;

  // Group switches by type for quick controls
  const switchesByType = {
    light: allSwitches.filter(sw => sw.type === 'light'),
    fan: allSwitches.filter(sw => sw.type === 'fan'),
    outlet: allSwitches.filter(sw => sw.type === 'outlet'),
    relay: allSwitches.filter(sw => sw.type === 'relay')
  };

  // Group switches by location
  const switchesByLocation = allSwitches.reduce((acc, sw) => {
    const location = sw.location;
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(sw);
    return acc;
  }, {} as Record<string, typeof allSwitches>);

  const handleMasterToggle = async (state: boolean) => {
    try {
      await toggleAllSwitches(state);
      toast({
        title: state ? "All Switches On" : "All Switches Off",
        description: `All switches have been turned ${state ? 'on' : 'off'}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle master switch",
        variant: "destructive"
      });
    }
  };

  const handleTypeToggle = async (type: string, state: boolean) => {
    const switchesOfType = switchesByType[type as keyof typeof switchesByType];
    // This would need to be implemented in useDevices hook
    toast({
      title: `${type.charAt(0).toUpperCase() + type.slice(1)}s ${state ? 'On' : 'Off'}`,
      description: `All ${type} switches have been turned ${state ? 'on' : 'off'}`
    });
  };

  const handleLocationToggle = async (location: string, state: boolean) => {
    // This would need to be implemented in useDevices hook
    toast({
      title: `${location} ${state ? 'On' : 'Off'}`,
      description: `All switches in ${location} have been turned ${state ? 'on' : 'off'}`
    });
  };

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Master Control
            </h1>
            <p className="text-muted-foreground mt-1">
              Control all devices and switches from one place
            </p>
          </div>
        </div>

        {/* Master Switch Controls */}
        <MasterSwitchCard
          totalSwitches={totalSwitches}
          activeSwitches={activeSwitches}
          onMasterToggle={handleMasterToggle}
        />

        {/* Quick Controls by Type */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Control by Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(switchesByType).map(([type, switches]) => {
              const activeCount = switches.filter(sw => sw.state).length;
              const total = switches.length;
              const allOn = activeCount === total && total > 0;
              
              const getIcon = () => {
                switch (type) {
                  case 'light': return <Lightbulb className="w-5 h-5" />;
                  case 'fan': return <Fan className="w-5 h-5" />;
                  default: return <Zap className="w-5 h-5" />;
                }
              };

              return (
                <Card key={type} className="glass">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getIcon()}
                      {type.charAt(0).toUpperCase() + type.slice(1)}s
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {activeCount} of {total} on
                        </p>
                      </div>
                      <Button
                        variant={allOn ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTypeToggle(type, !allOn)}
                        disabled={total === 0}
                      >
                        {allOn ? 'Turn Off' : 'Turn On'}
                      </Button>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {total} {type}s
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Control by Location/Room */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Control by Room</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(switchesByLocation).map(([location, switches]) => {
              const activeCount = switches.filter(sw => sw.state).length;
              const total = switches.length;
              const allOn = activeCount === total && total > 0;

              return (
                <Card key={location} className="glass">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      {location}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {activeCount} of {total} switches on
                        </p>
                      </div>
                      <Button
                        variant={allOn ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleLocationToggle(location, !allOn)}
                        disabled={total === 0}
                      >
                        {allOn ? 'Turn Off' : 'Turn On'}
                      </Button>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {total} switches
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
  );
};

export default Master;
