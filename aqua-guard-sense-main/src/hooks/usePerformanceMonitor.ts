
import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  responseTime: number;
  errorRate: number;
  memoryUsage: number;
  connectionStatus: 'excellent' | 'good' | 'poor' | 'critical';
  lastUpdate: Date;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    responseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    connectionStatus: 'good',
    lastUpdate: new Date()
  });

  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    const measurePerformance = () => {
      const startTime = performance.now();
      
      // Simulate API call measurement
      fetch('/api/health', { method: 'HEAD' })
        .then(() => {
          const responseTime = performance.now() - startTime;
          
          // Get memory usage if available
          const memoryUsage = (performance as { memory?: { usedJSHeapSize: number } }).memory ?
            (performance as { memory?: { usedJSHeapSize: number } }).memory!.usedJSHeapSize / 1048576 : 0;

          const connectionStatus = responseTime < 100 ? 'excellent' :
                                 responseTime < 300 ? 'good' :
                                 responseTime < 1000 ? 'poor' : 'critical';

          const newMetrics: PerformanceMetrics = {
            responseTime,
            errorRate: 0,
            memoryUsage,
            connectionStatus,
            lastUpdate: new Date()
          };

          setMetrics(newMetrics);
          setPerformanceHistory(prev => [...prev.slice(-29), newMetrics]);
        })
        .catch(() => {
          const newMetrics: PerformanceMetrics = {
            responseTime: 0,
            errorRate: 100,
            memoryUsage: 0,
            connectionStatus: 'critical',
            lastUpdate: new Date()
          };
          
          setMetrics(newMetrics);
        });
    };

    measurePerformance();
    const interval = setInterval(measurePerformance, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return { metrics, performanceHistory };
};
