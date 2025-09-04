
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Droplets, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";

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
  const [previousLevel, setPreviousLevel] = useState(currentLevel);
  const [flowDirection, setFlowDirection] = useState<'filling' | 'draining' | 'stable'>('stable');

  const currentLiters = Math.round((currentLevel / 100) * capacity);

  // Detect flow direction
  useEffect(() => {
    if (currentLevel > previousLevel + 1) {
      setFlowDirection('filling');
    } else if (currentLevel < previousLevel - 1) {
      setFlowDirection('draining');
    } else {
      setFlowDirection('stable');
    }
    setPreviousLevel(currentLevel);
  }, [currentLevel, previousLevel]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'full': return 'tank-level-full';
      case 'normal': return 'tank-level-medium';
      case 'low': return 'tank-level-low';
      case 'critical': return 'tank-level-empty';
      default: return 'tank-level-medium';
    }
  };

  const getFlowAnimation = () => {
    switch(flowDirection) {
      case 'filling': return 'animate-water-filling';
      case 'draining': return 'animate-water-draining';
      default: return 'animate-water-fill';
    }
  };

  const getFlowIcon = () => {
    switch(flowDirection) {
      case 'filling': return <TrendingUp className="w-3 h-3 text-success" />;
      case 'draining': return <TrendingDown className="w-3 h-3 text-warning" />;
      default: return null;
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
          {getFlowIcon()}
          {getSensorStatusIcon(sensorHealth)}
          <Badge variant={status === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
            {status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Enhanced Tank Visual with Realistic Water Animation */}
      <div className="mb-3 sm:mb-4">
        <div className="relative w-full h-24 sm:h-32 bg-muted rounded-lg overflow-hidden border-2 border-border">
          {/* Water Level with Enhanced Animation */}
          <div
            className={`absolute bottom-0 left-0 w-full bg-gradient-to-t from-primary/90 to-primary/60 transition-all duration-1500 ease-out ${getFlowAnimation()} ${getStatusColor(status)}`}
            style={{
              height: `${currentLevel}%`,
              '--fill-level': `${currentLevel}%`,
              '--previous-level': `${previousLevel}%`
            } as React.CSSProperties & { '--fill-level': string; '--previous-level': string }}
          >
            {/* Water Surface Effect - Desktop Only */}
            <div className="hidden md:block absolute top-0 left-0 w-full h-2 bg-gradient-to-b from-white/20 to-transparent animate-water-wave" />

            {/* Ripple Effect - Desktop Only */}
            <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-white/10 rounded-full animate-water-ripple" />

            {/* Bubbles Effect for Filling - Desktop Only */}
            {currentLevel > 10 && (
              <div className="hidden md:flex">
                <div className="absolute bottom-1/4 left-1/4 w-1 h-1 bg-white/30 rounded-full animate-water-bubbles" style={{ animationDelay: '0s' }} />
                <div className="absolute bottom-1/3 left-3/4 w-0.5 h-0.5 bg-white/20 rounded-full animate-water-bubbles" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-1/2 left-1/2 w-0.5 h-0.5 bg-white/25 rounded-full animate-water-bubbles" style={{ animationDelay: '2s' }} />
              </div>
            )}

            {/* Mobile Static Water Surface */}
            <div className="md:hidden absolute top-0 left-0 w-full h-1 bg-gradient-to-b from-white/15 to-transparent" />
          </div>

          {/* Level Percentage Display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-card/90 md:backdrop-blur-sm backdrop-blur-none rounded-lg px-3 py-1 shadow-lg border border-border/50">
              <span className="text-lg sm:text-2xl font-bold text-foreground">
                {currentLevel}%
              </span>
            </div>
          </div>

          {/* Level Markers */}
          <div className="absolute right-1 top-0 h-full flex flex-col justify-between py-1 text-xs text-muted-foreground/60">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
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
