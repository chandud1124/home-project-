import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Volume2,
  Zap
} from "lucide-react";

interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string | Date;
  resolved?: boolean;
}

interface SystemAlertsProps {
  alerts: SystemAlert[];
  className?: string;
}

export const SystemAlerts = ({ alerts, className }: SystemAlertsProps) => {
  const getAlertIcon = (type: string, message?: string) => {
    // Check for buzzer-related alerts
    if (message?.includes('Buzzer activated')) {
      return <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />;
    }
    // Check for motor control alerts
    if (message?.includes('Motor started') || message?.includes('Motor stopped')) {
      return <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />;
    }

    switch(type) {
      case 'success': return <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />;
      case 'error': return <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
      default: return <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch(type) {
      case 'error': return 'destructive';
      case 'warning': return 'default';
      default: return 'default';
    }
  };

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const recentAlerts = alerts.slice(0, 5); // Show last 5 alerts

  return (
    <Card className={`p-4 sm:p-6 bg-card border-border ${className || ''}`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold">System Alerts</h3>
        <Badge variant={activeAlerts.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
          {activeAlerts.length} Active
        </Badge>
      </div>

      <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
        {recentAlerts.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-success" />
            <p className="text-sm sm:text-base">All systems normal</p>
          </div>
        ) : (
          recentAlerts.map((alert) => (
            <Alert 
              key={alert.id} 
              variant={getAlertVariant(alert.type)}
              className={`${alert.resolved ? 'opacity-50' : ''} p-3 sm:p-4`}
            >
              {getAlertIcon(alert.type, alert.message)}
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="flex-1 text-xs sm:text-sm mb-2 sm:mb-0">{alert.message}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {alert.resolved && (
                    <Badge variant="outline" className="text-xs">
                      Resolved
                    </Badge>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ))
        )}
      </div>
    </Card>
  );
};
