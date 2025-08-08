
import { useState, useEffect } from 'react';
import { Device, DeviceStats } from '@/types';
import { deviceAPI } from '@/services/api';
import { useSecurityNotifications } from './useSecurityNotifications';

export const useDevices = () => {
  const { addAlert } = useSecurityNotifications();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await deviceAPI.getAllDevices();
      setDevices(response.data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSwitch = async (deviceId: string, switchId: string) => {
    try {
      const response = await deviceAPI.toggleSwitch(deviceId, switchId);
      
      // Update local state
      setDevices(prevDevices =>
        prevDevices.map(device =>
          device.id === deviceId ? response.data.data : device
        )
      );
      
      console.log(`Switch ${switchId} toggled on device ${deviceId}`);
    } catch (err: any) {
      console.error('Error toggling switch:', err);
      throw err;
    }
  };

  const toggleAllSwitches = async (state: boolean) => {
    try {
      // Toggle all switches across all devices
      const togglePromises = devices.flatMap(device =>
        device.switches.map(sw => toggleSwitch(device.id, sw.id))
      );
      
      await Promise.all(togglePromises);
      console.log(`All switches turned ${state ? 'on' : 'off'}`);
    } catch (err: any) {
      console.error('Error toggling all switches:', err);
      throw err;
    }
  };

  const addDevice = async (deviceData: Partial<Device>) => {
    try {
      const response = await deviceAPI.createDevice(deviceData);
      setDevices(prev => [...prev, response.data.data]);
      console.log('Device added:', response.data.data);
    } catch (err: any) {
      console.error('Error adding device:', err);
      throw err;
    }
  };

  const updateDevice = async (deviceId: string, updates: Partial<Device>) => {
    try {
      const response = await deviceAPI.updateDevice(deviceId, updates);
      setDevices(prev =>
        prev.map(device =>
          device.id === deviceId ? response.data.data : device
        )
      );
      console.log(`Device ${deviceId} updated`);
    } catch (err: any) {
      console.error('Error updating device:', err);
      throw err;
    }
  };

  const deleteDevice = async (deviceId: string) => {
    try {
      await deviceAPI.deleteDevice(deviceId);
      setDevices(prev => prev.filter(device => device.id !== deviceId));
      console.log(`Device ${deviceId} deleted`);
    } catch (err: any) {
      console.error('Error deleting device:', err);
      throw err;
    }
  };

  const getStats = async (): Promise<DeviceStats> => {
    try {
      const response = await deviceAPI.getStats();
      return response.data.data;
    } catch (err: any) {
      console.error('Error getting stats:', err);
      return {
        totalDevices: devices.length,
        onlineDevices: devices.filter(d => d.status === 'online').length,
        totalSwitches: devices.reduce((sum, d) => sum + d.switches.length, 0),
        activeSwitches: devices.reduce(
          (sum, d) => sum + d.switches.filter(s => s.state).length, 
          0
        ),
        totalPirSensors: devices.filter(d => d.pirSensor).length,
        activePirSensors: devices.filter(d => d.pirSensor?.isActive).length
      };
    }
  };

  return {
    devices,
    loading,
    error,
    toggleSwitch,
    toggleAllSwitches,
    addDevice,
    updateDevice,
    deleteDevice,
    getStats,
    refreshDevices: loadDevices
  };
};
