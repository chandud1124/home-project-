
import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleLeft, Lightbulb, Fan, Zap, Power } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';
import { MasterSwitchCard } from '@/components/MasterSwitchCard';

const Switches = () => {
  const { devices, toggleSwitch, toggleAllSwitches } = useDevices();
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

  // Group switches by type
  const switchesByType = {
    light: allSwitches.filter(sw => sw.type === 'light'),
    fan: allSwitches.filter(sw => sw.type === 'fan'),
    outlet: allSwitches.filter(sw => sw.type === 'outlet'),
    relay: allSwitches.filter(sw => sw.type === 'relay')
  };

  // Group switches by location/room
  const switchesByLocation = allSwitches.reduce((acc, sw) => {
    const location = sw.location;
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(sw);
    return acc;
  }, {} as Record<string, typeof allSwitches>);

  const totalSwitches = allSwitches.length;
  const activeSwitches = allSwitches.filter(sw => sw.state).length;

  const handleToggle = async (deviceId: string, switchId: string) => {
    try {
      await toggleSwitch(deviceId, switchId);
      toast({
        title: "Switch Toggled",
        description: "Switch state updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle switch",
        variant: "destructive"
      });
    }
  };

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

  const getSwitchIcon = (type: string) => {
    switch (type) {
      case 'light': return <Lightbulb className="w-4 h-4" />;
      case 'fan': return <Fan className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const renderSwitchGrid = (switches: typeof allSwitches) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {switches.map((switchItem) => (
        <Card key={`${switchItem.deviceId}-${switchItem.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {getSwitchIcon(switchItem.type)}
                {switchItem.name}
              </CardTitle>
              <Badge variant={switchItem.deviceStatus === 'online' ? 'default' : 'secondary'}>
                {switchItem.deviceStatus}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">
                    {switchItem.deviceName}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {switchItem.location}
                  </p>
                </div>
                <Switch
                  checked={switchItem.state}
                  onCheckedChange={() => handleToggle(switchItem.deviceId, switchItem.id)}
                  disabled={switchItem.deviceStatus === 'offline'}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                GPIO: {switchItem.gpio} | Type: {switchItem.type}
              </div>
              {switchItem.hasPirSensor && (
                <Badge variant="outline" className="text-xs">
                  PIR Sensor Connected
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Switch Control
            </h1>
            <p className="text-muted-foreground mt-1">
              Control all switches across your devices
            </p>
          </div>
        </div>

        {/* Master Switch Controls */}
        <MasterSwitchCard
          totalSwitches={totalSwitches}
          activeSwitches={activeSwitches}
          onMasterToggle={handleMasterToggle}
        />

        {allSwitches.length === 0 ? (
          <div className="text-center py-12">
            <ToggleLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No switches found</h3>
            <p className="text-muted-foreground">
              Configure switches on your devices to see them here
            </p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="all">All Switches</TabsTrigger>
              <TabsTrigger value="lights">Lights</TabsTrigger>
              <TabsTrigger value="fans">Fans</TabsTrigger>
              <TabsTrigger value="outlets">Outlets</TabsTrigger>
              <TabsTrigger value="rooms">By Room</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {renderSwitchGrid(allSwitches)}
            </TabsContent>

            <TabsContent value="lights">
              {switchesByType.light.length > 0 ? (
                renderSwitchGrid(switchesByType.light)
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No light switches found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="fans">
              {switchesByType.fan.length > 0 ? (
                renderSwitchGrid(switchesByType.fan)
              ) : (
                <div className="text-center py-8">
                  <Fan className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No fan switches found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="outlets">
              {switchesByType.outlet.length > 0 ? (
                renderSwitchGrid(switchesByType.outlet)
              ) : (
                <div className="text-center py-8">
                  <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No outlet switches found</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rooms">
              <div className="space-y-6">
                {Object.entries(switchesByLocation).map(([location, switches]) => (
                  <div key={location}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Power className="w-5 h-5" />
                      {location}
                      <Badge variant="secondary" className="ml-2">
                        {switches.length} switches
                      </Badge>
                    </h3>
                    {renderSwitchGrid(switches)}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
};

export default Switches;
