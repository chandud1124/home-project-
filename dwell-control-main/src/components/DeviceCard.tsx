import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  MoreVertical, 
  Settings, 
  Trash2,
  Calendar
} from 'lucide-react';
import { SwitchControl } from './SwitchControl';
import { DeviceConfigDialog } from './DeviceConfigDialog';
import { Device } from '@/types';

interface DeviceCardProps {
  device: Device;
  onToggleSwitch: (deviceId: string, switchId: string) => void;
  onUpdateDevice: (deviceId: string, updates: any) => void;
  onDeleteDevice: (deviceId: string) => void;
  onConfigureDevice?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ 
  device, 
  onToggleSwitch, 
  onUpdateDevice, 
  onDeleteDevice,
  onConfigureDevice
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const handleConfigure = () => {
    console.log(`Configure device: ${device.name}`);
    if (onConfigureDevice) {
      onConfigureDevice();
    } else {
      setShowConfig(true);
    }
    setShowActions(false);
  };

  const handleSchedule = () => {
    console.log(`Schedule device: ${device.name}`);
    setShowActions(false);
    // TODO: Open scheduling dialog
  };

  const handleDelete = () => {
    console.log(`Delete device: ${device.name}`);
    if (window.confirm(`Are you sure you want to delete ${device.name}?`)) {
      onDeleteDevice(device.id);
    }
    setShowActions(false);
  };

  const handleConfigSave = (deviceId: string, config: any) => {
    console.log(`Saving config for device ${deviceId}:`, config);
    onUpdateDevice(deviceId, config);
  };

  return (
    <>
      <Card className="glass hover:shadow-lg transition-all duration-300 group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                device.status === 'online' 
                  ? 'bg-success/20 text-success animate-pulse-online' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className={device.status === 'online' ? 'status-online' : 'status-offline'}
                  >
                    {device.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {device.ip}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showActions && (
                <div className="absolute right-0 top-8 glass rounded-md shadow-lg p-1 z-10 min-w-[120px]">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={handleConfigure}
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={handleSchedule}
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start gap-2 text-danger hover:text-danger"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Device Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {device.status === 'online' ? (
                <Wifi className="w-4 h-4 text-success" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                Signal: {device.signalStrength}%
              </span>
            </div>
            <span className="text-muted-foreground">
              Uptime: {device.uptime}
            </span>
          </div>

          {/* Switches */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Switches</h4>
            <div className="grid grid-cols-2 gap-2">
              {device.switches.map((switch_) => (
                <SwitchControl
                  key={switch_.id}
                  switch={switch_}
                  onToggle={() => onToggleSwitch(device.id, switch_.id)}
                  disabled={device.status === 'offline'}
                  isPirActive={
                    switch_.hasPirSensor && 
                    device.pirSensor?.isActive && 
                    device.pirSensor.linkedSwitches.includes(switch_.id)
                  }
                />
              ))}
            </div>
          </div>

          {/* PIR Sensor Info */}
          {device.pirSensor && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">PIR Sensor: {device.pirSensor.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    device.pirSensor.isActive ? 'bg-green-500 animate-pulse' : 'bg-muted'
                  }`} />
                  <span className="text-xs text-muted-foreground">
                    {device.pirSensor.isActive ? 'Active' : 'Idle'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                GPIO {device.pirSensor.gpio} • Timeout: {device.pirSensor.timeout}s • Sensitivity: {device.pirSensor.sensitivity}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Only show DeviceConfigDialog if onConfigureDevice is not provided */}
      {!onConfigureDevice && (
        <DeviceConfigDialog
          device={device}
          isOpen={showConfig}
          onClose={() => setShowConfig(false)}
          onSave={handleConfigSave}
        />
      )}
    </>
  );
};
