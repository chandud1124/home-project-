
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { Device, Switch as SwitchType } from '@/types';

interface DeviceConfigDialogProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceId: string, config: any) => void;
}

export const DeviceConfigDialog: React.FC<DeviceConfigDialogProps> = ({
  device,
  isOpen,
  onClose,
  onSave
}) => {
  const [switches, setSwitches] = useState<SwitchType[]>(device.switches);
  const [pirSensor, setPirSensor] = useState(device.pirSensor);

  const addSwitch = () => {
    const newSwitch: SwitchType = {
      id: `sw_${Date.now()}`,
      name: `Switch ${switches.length + 1}`,
      gpio: 2,
      state: false,
      type: 'relay',
      hasManualSwitch: false,
    };
    setSwitches([...switches, newSwitch]);
  };

  const removeSwitch = (switchId: string) => {
    setSwitches(switches.filter(sw => sw.id !== switchId));
  };

  const updateSwitch = (switchId: string, updates: Partial<SwitchType>) => {
    setSwitches(switches.map(sw => 
      sw.id === switchId ? { ...sw, ...updates } : sw
    ));
  };

  const handleSave = () => {
    onSave(device.id, {
      switches,
      pirSensor
    });
    onClose();
  };

  const usedGpioPins = switches.map(sw => sw.gpio).filter(gpio => gpio);
  if (pirSensor?.gpio) usedGpioPins.push(pirSensor.gpio);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {device.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Device Info */}
          <div className="glass p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Device Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>IP: {device.ip}</div>
              <div>MAC: {device.mac}</div>
              <div>Status: {device.status}</div>
              <div>Firmware: {device.firmware}</div>
            </div>
          </div>

          {/* Switches Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Switch Configuration</h3>
              <Button onClick={addSwitch} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Switch
              </Button>
            </div>

            {switches.map((switch_, index) => (
              <div key={switch_.id} className="glass p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Switch {index + 1}</h4>
                  <Button
                    onClick={() => removeSwitch(switch_.id)}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Switch Name</Label>
                    <Input
                      value={switch_.name}
                      onChange={(e) => updateSwitch(switch_.id, { name: e.target.value })}
                      placeholder="Enter switch name"
                    />
                  </div>

                  <div>
                    <Label>GPIO Pin</Label>
                    <Select 
                      value={switch_.gpio.toString()} 
                      onValueChange={(value) => updateSwitch(switch_.id, { gpio: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27].map(pin => (
                          <SelectItem 
                            key={pin} 
                            value={pin.toString()}
                            disabled={usedGpioPins.includes(pin) && switch_.gpio !== pin}
                          >
                            GPIO {pin} {usedGpioPins.includes(pin) && switch_.gpio !== pin ? '(Used)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Switch Type</Label>
                    <Select 
                      value={switch_.type} 
                      onValueChange={(value) => updateSwitch(switch_.id, { type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relay">Relay</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="fan">Fan</SelectItem>
                        <SelectItem value="outlet">Outlet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={switch_.hasManualSwitch || false}
                        onCheckedChange={(checked) => updateSwitch(switch_.id, { hasManualSwitch: checked })}
                      />
                      <Label>Has Manual Switch</Label>
                    </div>

                    {switch_.hasManualSwitch && (
                      <Select 
                        value={switch_.manualSwitchGpio?.toString() || ''} 
                        onValueChange={(value) => updateSwitch(switch_.id, { manualSwitchGpio: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select GPIO for manual switch" />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 3, 6, 7, 8, 9, 10, 11, 20, 24, 28, 29, 30, 31].map(pin => (
                            <SelectItem 
                              key={pin} 
                              value={pin.toString()}
                              disabled={usedGpioPins.includes(pin)}
                            >
                              GPIO {pin} {usedGpioPins.includes(pin) ? '(Used)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={switch_.hasPirSensor || false}
                      onCheckedChange={(checked) => updateSwitch(switch_.id, { hasPirSensor: checked })}
                    />
                    <Label>Enable PIR Control</Label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PIR Sensor Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={!!pirSensor}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPirSensor({
                      id: 'pir_main',
                      name: 'PIR Sensor',
                      gpio: 16,
                      isActive: true,
                      sensitivity: 80,
                      timeout: 300,
                      linkedSwitches: []
                    });
                  } else {
                    setPirSensor(undefined);
                  }
                }}
              />
              <Label className="font-semibold">Enable PIR Sensor</Label>
            </div>

            {pirSensor && (
              <div className="glass p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sensor Name</Label>
                    <Input
                      value={pirSensor.name}
                      onChange={(e) => setPirSensor({...pirSensor, name: e.target.value})}
                      placeholder="PIR Sensor name"
                    />
                  </div>

                  <div>
                    <Label>GPIO Pin</Label>
                    <Select 
                      value={pirSensor.gpio.toString()} 
                      onValueChange={(value) => setPirSensor({...pirSensor, gpio: parseInt(value)})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39].map(pin => (
                          <SelectItem 
                            key={pin} 
                            value={pin.toString()}
                            disabled={usedGpioPins.includes(pin) && pirSensor.gpio !== pin}
                          >
                            GPIO {pin} {usedGpioPins.includes(pin) && pirSensor.gpio !== pin ? '(Used)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Sensitivity (%)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={pirSensor.sensitivity}
                      onChange={(e) => setPirSensor({...pirSensor, sensitivity: parseInt(e.target.value)})}
                    />
                  </div>

                  <div>
                    <Label>Auto-off Timeout (seconds)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="3600"
                      value={pirSensor.timeout}
                      onChange={(e) => setPirSensor({...pirSensor, timeout: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
