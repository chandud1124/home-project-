
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { TankReading, SystemAlert } from "@/services/api";

interface OfflineData {
  tanks: TankReading[];
  alerts: SystemAlert[];
  lastSync: Date;
}

export const useOfflineSupport = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const { toast } = useToast();

  const syncOfflineData = useCallback(async () => {
    if (!offlineData) return;

    try {
      // Sync with server when back online
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offlineData)
      });

      if (response.ok) {
        toast({
          title: "Data Synced",
          description: "Offline data has been synchronized.",
        });
      }
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }, [offlineData, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Connection restored. Syncing data...",
      });
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline Mode",
        description: "You're now offline. Some features may be limited.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline data from localStorage
    const savedData = localStorage.getItem('offlineData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Only keep offline data if it's recent (within last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (parsedData.lastSync && new Date(parsedData.lastSync) > oneDayAgo) {
          setOfflineData(parsedData);
        } else {
          // Clear old cached data
          localStorage.removeItem('offlineData');
        }
      } catch (error) {
        console.error('Failed to parse offline data:', error);
        localStorage.removeItem('offlineData');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, syncOfflineData]);

  const saveOfflineData = (data: Partial<OfflineData>) => {
    const updatedData = {
      ...offlineData,
      ...data,
      lastSync: new Date()
    };
    setOfflineData(updatedData as OfflineData);
    localStorage.setItem('offlineData', JSON.stringify(updatedData));
  };

  return {
    isOnline,
    offlineData,
    saveOfflineData
  };
};
