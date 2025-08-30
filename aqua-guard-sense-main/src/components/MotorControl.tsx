
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Power, 
  PlayCircle, 
  StopCircle, 
  Zap, 
  Clock,
  Settings
} from "lucide-react";

interface MotorControlProps {
  isRunning: boolean;
  mode: 'manual' | 'automatic';
  runtime: number; // minutes
  todayStarts: number;
  onToggleMotor: () => void;
  onModeChange: (mode: 'manual' | 'automatic') => void;
  canStart: boolean;
  errorMessage?: string;
}

export const MotorControl = ({
  isRunning,
  mode,
  runtime,
  todayStarts,
  onToggleMotor,
  onModeChange,
  canStart,
  errorMessage
}: MotorControlProps) => {
  return (
    <Card className="p-4 sm:p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h3 className="text-base sm:text-lg font-semibold">Motor Control</h3>
        </div>
        <div className={`status-indicator ${
          isRunning ? 'status-online' : 
          errorMessage ? 'status-error' : 'status-offline'
        }`} />
      </div>

      {/* Motor Status Display - Mobile Optimized */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-center mb-3 sm:mb-4">
          <div className={`p-3 sm:p-4 rounded-full ${
            isRunning ? 'motor-running' : 
            errorMessage ? 'motor-error' : 'motor-stopped'
          }`}>
            <Power className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xl sm:text-2xl font-bold mb-1">
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </p>
          {errorMessage && (
            <p className="text-danger text-xs sm:text-sm">{errorMessage}</p>
          )}
        </div>
      </div>

      {/* Control Mode Switch - Mobile Layout */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-xs sm:text-sm font-medium">Control Mode</span>
          <Badge variant={mode === 'automatic' ? 'default' : 'secondary'} className="text-xs">
            {mode.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center justify-center space-x-2 sm:space-x-4">
          <label htmlFor="mode-switch" className="text-xs sm:text-sm">Manual</label>
          <Switch
            id="mode-switch"
            checked={mode === 'automatic'}
            onCheckedChange={(checked) => 
              onModeChange(checked ? 'automatic' : 'manual')
            }
          />
          <label htmlFor="mode-switch" className="text-xs sm:text-sm">Automatic</label>
        </div>
      </div>

      {/* Manual Control Buttons - Full Width on Mobile */}
      {mode === 'manual' && (
        <div className="mb-4 sm:mb-6">
          <Button
            onClick={onToggleMotor}
            disabled={!canStart && !isRunning}
            className="w-full h-12 sm:h-10 text-sm sm:text-base"
            variant={isRunning ? "destructive" : "default"}
          >
            {isRunning ? (
              <>
                <StopCircle className="w-4 h-4 mr-2" />
                Stop Motor
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Motor
              </>
            )}
          </Button>
          {!canStart && !isRunning && (
            <p className="text-danger text-xs mt-2 text-center">
              Cannot start: Check tank levels and safety conditions
            </p>
          )}
        </div>
      )}

      {/* Motor Statistics - Mobile Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm border-t border-border pt-3 sm:pt-4">
        <div className="flex flex-col sm:flex-row items-center sm:gap-2">
          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mb-1 sm:mb-0" />
          <div className="text-center sm:text-left">
            <p className="text-muted-foreground">Runtime Today</p>
            <p className="font-bold text-sm sm:text-base">{runtime} min</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:gap-2">
          <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mb-1 sm:mb-0" />
          <div className="text-center sm:text-left">
            <p className="text-muted-foreground">Starts Today</p>
            <p className="font-bold text-sm sm:text-base">{todayStarts}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
