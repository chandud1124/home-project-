
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, CheckCircle } from "lucide-react";

interface TankMonitorProps {
  title: string;
  currentLevel: number; // percentage 0-100
  capacity: number; // liters
  status: 'normal' | 'low' | 'critical' | 'full';
  sensorHealth: 'online' | 'warning' | 'offline';
}

export const TankMonitor = ({ 
  title, 
  currentLevel, 
  capacity, 
  status,
  sensorHealth 
}: TankMonitorProps) => {
  const currentLiters = Math.round((currentLevel / 100) * capacity);
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'full': return 'tank-level-full';
      case 'normal': return 'tank-level-medium';
      case 'low': return 'tank-level-low';
      case 'critical': return 'tank-level-empty';
      default: return 'tank-level-medium';
    }
  };

  const getSensorStatusIcon = (health: string) => {
    switch(health) {
      case 'online': return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-success" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-warning" />;
      case 'offline': return <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-danger" />;
    }
  };

  return (
    <Card className="p-4 sm:p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {getSensorStatusIcon(sensorHealth)}
          <Badge variant={status === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
            {status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Tank Visual - Mobile Optimized */}
      <div className="mb-3 sm:mb-4">
        <div className="relative w-full h-24 sm:h-32 bg-muted rounded-lg overflow-hidden border-2 border-border">
          <div 
            className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary to-primary/70 transition-all duration-1000 ease-out animate-tank-fill ${getStatusColor(status)}`}
            style={{ 
              height: `${currentLevel}%`, 
              '--fill-level': `${currentLevel}%` 
            } as React.CSSProperties & { '--fill-level': string }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg sm:text-2xl font-bold text-foreground mix-blend-difference">
              {currentLevel}%
            </span>
          </div>
        </div>
      </div>

      {/* Tank Stats - Mobile Layout */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-sm">
        <div className="text-center sm:text-left">
          <p className="text-muted-foreground text-xs sm:text-sm">Current Volume</p>
          <p className="text-lg sm:text-xl font-bold">{currentLiters}L</p>
        </div>
        <div className="text-center sm:text-left">
          <p className="text-muted-foreground text-xs sm:text-sm">Capacity</p>
          <p className="text-lg sm:text-xl font-bold">{capacity}L</p>
        </div>
      </div>
    </Card>
  );
};
