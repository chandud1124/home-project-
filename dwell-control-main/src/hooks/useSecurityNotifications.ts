
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SecurityAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  location: string;
  message: string;
  timestamp: Date;
  type: 'timeout' | 'unauthorized_access' | 'device_offline';
  acknowledged: boolean;
}

export const useSecurityNotifications = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const { toast } = useToast();

  const addAlert = (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: SecurityAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date(),
      acknowledged: false
    };

    setAlerts(prev => [newAlert, ...prev]);
    
    // Show toast notification for security personnel
    toast({
      title: "🚨 Security Alert",
      description: `${alert.deviceName} in ${alert.location}: ${alert.message}`,
      variant: "destructive",
      duration: 10000 // 10 seconds for security alerts
    });

    // Play notification sound (in real implementation)
    console.log('SECURITY ALERT:', newAlert);
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const getUnacknowledgedCount = () => {
    return alerts.filter(alert => !alert.acknowledged).length;
  };

  return {
    alerts,
    addAlert,
    acknowledgeAlert,
    clearAllAlerts,
    getUnacknowledgedCount
  };
};
