
import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { DeviceCard } from '@/components/DeviceCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cpu, Plus } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';

const Devices = () => {
  const { devices, toggleSwitch, updateDevice, deleteDevice, addDevice } = useDevices();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDevice, setNewDevice] = useState({
    name: '',
    ip: '',
    mac: '',
    location: ''
  });

  const handleToggleSwitch = async (deviceId: string, switchId: string) => {
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

  const handleUpdateDevice = async (deviceId: string, updates: any) => {
    try {
      await updateDevice(deviceId, updates);
      toast({
        title: "Device Updated",
        description: "Device configuration saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await deleteDevice(deviceId);
      toast({
        title: "Device Deleted",
        description: "Device removed successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive"
      });
    }
  };

  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.ip) {
      toast({
        title: "Validation Error",
        description: "Please provide device name and IP address",
        variant: "destructive"
      });
      return;
    }

    try {
      await addDevice({
        name: newDevice.name,
        ip: newDevice.ip,
        mac: newDevice.mac,
        location: newDevice.location,
        switches: []
      });
      setNewDevice({ name: '', ip: '', mac: '', location: '' });
      setShowAddDialog(false);
      toast({
        title: "Device Added",
        description: "New device has been added successfully"
      });
    } catch (error: any) {
      let description = "Failed to add device";
      if (error?.response?.data?.error) {
        description = error.response.data.error;
      } else if (error?.message) {
        description = error.message;
      }
      toast({
        title: "Error",
        description,
        variant: "destructive"
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Device Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and configure your ESP32 devices
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Device
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-12">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No devices found</h3>
            <p className="text-muted-foreground mb-4">
              Add your first ESP32 device to get started
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggleSwitch={handleToggleSwitch}
                onUpdateDevice={handleUpdateDevice}
                onDeleteDevice={handleDeleteDevice}
              />
            ))}
          </div>
        )}

        {/* Add Device Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                  placeholder="e.g., Living Room ESP32"
                />
              </div>
              <div>
                <Label htmlFor="device-ip">IP Address</Label>
                <Input
                  id="device-ip"
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice({...newDevice, ip: e.target.value})}
                  placeholder="e.g., 192.168.1.101"
                />
              </div>
              <div>
                <Label htmlFor="device-mac">MAC Address (Optional)</Label>
                <Input
                  id="device-mac"
                  value={newDevice.mac}
                  onChange={(e) => setNewDevice({...newDevice, mac: e.target.value})}
                  placeholder="e.g., 24:6F:28:AE:97:12"
                />
              </div>
              <div>
                <Label htmlFor="device-location">Location/Room</Label>
                <Input
                  id="device-location"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                  placeholder="e.g., Living Room, Kitchen"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddDevice}>
                  Add Device
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Devices;
