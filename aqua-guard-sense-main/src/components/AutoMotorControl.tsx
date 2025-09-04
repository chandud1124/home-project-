
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Power, Zap, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface AutoMotorControlProps {
  isRunning: boolean;
  autoMode: boolean;
  currentDraw: number;
  runtime: number;
  motorStartCount: number;
  onToggleAuto: (enabled: boolean) => void;
  onManualControl: (action: 'start' | 'stop') => void;
  settings: {
    autoStartLevel: number;
    autoStopLevel: number;
    maxRuntime: number;
    minOffTime: number;
  };
  onUpdateSettings: (settings: AutoMotorControlProps['settings']) => void;
}

export const AutoMotorControl = ({
  isRunning,
  autoMode,
  currentDraw,
  runtime,
  motorStartCount,
  onToggleAuto,
  onManualControl,
  settings,
  onUpdateSettings
}: AutoMotorControlProps) => {
  const [showSettings, setShowSettings] = useState(false);

  const getMotorStatusColor = () => {
    if (isRunning) return 'text-success'; // Running normally
    return 'text-muted-foreground'; // Stopped
  };

  const getMotorStatusText = () => {
    if (isRunning) return 'RUNNING';
    return 'STOPPED';
  };

  return (
    <Card className="p-6 bg-card/60 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Motor Control</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="bg-background/50 hover:bg-accent/10 border-border/50"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Motor Status Display */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center gap-3 p-4 rounded-lg border-2 ${
          isRunning ? 'border-success/20 bg-success/5' : 'border-border/50 bg-muted/20'
        }`}>
          <Power className={`w-8 h-8 ${getMotorStatusColor()}`} />
          <div>
            <p className={`text-xl font-bold ${getMotorStatusColor()}`}>
              {getMotorStatusText()}
            </p>
          </div>
        </div>
      </div>

      {/* Auto Mode Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
        <div>
          <p className="font-medium text-foreground">Automatic Mode</p>
          <p className="text-sm text-muted-foreground">
            Auto start/stop based on water levels
          </p>
        </div>
        <Switch
          checked={autoMode}
          onCheckedChange={onToggleAuto}
        />
      </div>

      {/* Manual Controls */}
      {!autoMode && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            onClick={() => onManualControl('start')}
            disabled={isRunning}
            className="bg-success hover:bg-success/80"
          >
            Start Motor
          </Button>
          <Button
            onClick={() => onManualControl('stop')}
            disabled={!isRunning}
            variant="destructive"
          >
            Stop Motor
          </Button>
        </div>
      )}

      {/* Runtime Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Runtime Today</p>
          <p className="text-lg font-bold flex items-center justify-center gap-1 text-foreground">
            <Clock className="w-4 h-4" />
            {Math.floor(runtime / 60)}h {runtime % 60}m
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Motor Starts Today</p>
          <p className="text-lg font-bold text-foreground">
            {motorStartCount}
          </p>
        </div>
      </div>

      {/* Auto Mode Settings */}
      {showSettings && (
        <div className="border-t border-border/50 pt-4 space-y-4">
          <h4 className="font-medium text-foreground">Auto Mode Settings</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Auto Start Level (%)</label>
              <input
                type="number"
                value={settings.autoStartLevel}
                onChange={(e) => onUpdateSettings({
                  ...settings,
                  autoStartLevel: parseInt(e.target.value)
                })}
                className="w-full p-2 border border-border rounded bg-background text-foreground"
                min="0"
                max="100"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Auto Stop Level (%)</label>
              <input
                type="number"
                value={settings.autoStopLevel}
                onChange={(e) => onUpdateSettings({
                  ...settings,
                  autoStopLevel: parseInt(e.target.value)
                })}
                className="w-full p-2 border border-border rounded bg-background text-foreground"
                min="0"
                max="100"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Max Runtime (minutes)</label>
              <input
                type="number"
                value={settings.maxRuntime}
                onChange={(e) => onUpdateSettings({
                  ...settings,
                  maxRuntime: parseInt(e.target.value)
                })}
                className="w-full p-2 border border-border rounded bg-background text-foreground"
                min="1"
                max="120"
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground">Min Off Time (minutes)</label>
              <input
                type="number"
                value={settings.minOffTime}
                onChange={(e) => onUpdateSettings({
                  ...settings,
                  minOffTime: parseInt(e.target.value)
                })}
                className="w-full p-2 border border-border rounded bg-background text-foreground"
                min="1"
                max="60"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
