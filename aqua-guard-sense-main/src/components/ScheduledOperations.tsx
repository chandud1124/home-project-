
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, Play, Pause } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ScheduledTask {
  id: string;
  name: string;
  action: 'start_motor' | 'stop_motor' | 'run_for_duration' | 'check_levels';
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'interval';
    time?: string; // HH:MM format
    days?: number[]; // 0-6, Sunday-Saturday
    interval?: number; // minutes
  };
  conditions?: {
    minLevel?: number;
    maxLevel?: number;
    tankType?: string;
  };
  duration?: number; // minutes, for run_for_duration
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export const ScheduledOperations = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ScheduledTask[]>([
    {
      id: '1',
      name: 'Morning Fill',
      action: 'start_motor',
      schedule: { type: 'daily', time: '06:00' },
      conditions: { minLevel: 30, tankType: 'sump' },
      enabled: true,
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      name: 'Evening Check',
      action: 'check_levels',
      schedule: { type: 'daily', time: '20:00' },
      enabled: true,
      nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000)
    },
    {
      id: '3',
      name: 'Weekend Maintenance',
      action: 'run_for_duration',
      schedule: { type: 'weekly', days: [0, 6], time: '10:00' },
      duration: 15,
      enabled: false,
      nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }
  ]);

  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const actionLabels = {
    start_motor: 'Start Motor',
    stop_motor: 'Stop Motor',
    run_for_duration: 'Run for Duration',
    check_levels: 'Check Water Levels'
  };

  const scheduleTypeLabels = {
    once: 'One Time',
    daily: 'Daily',
    weekly: 'Weekly',
    interval: 'Interval'
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const createNewTask = (): ScheduledTask => ({
    id: Date.now().toString(),
    name: 'New Scheduled Task',
    action: 'start_motor',
    schedule: { type: 'daily', time: '08:00' },
    enabled: true
  });

  const saveTask = (task: ScheduledTask) => {
    if (isAddingNew) {
      setTasks(prev => [...prev, task]);
      setIsAddingNew(false);
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
    setEditingTask(null);
    
    toast({
      title: "Scheduled Task Saved",
      description: `${task.name} has been ${isAddingNew ? 'created' : 'updated'}.`,
    });
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast({
      title: "Scheduled Task Deleted",
      description: "The scheduled task has been removed.",
    });
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const runTaskNow = (task: ScheduledTask) => {
    toast({
      title: "Task Executed",
      description: `${task.name} has been executed manually.`,
    });
    
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, lastRun: new Date() } : t
    ));
  };

  const formatSchedule = (schedule: ScheduledTask['schedule']) => {
    switch (schedule.type) {
      case 'daily':
        return `Daily at ${schedule.time}`;
      case 'weekly':
        return `Weekly on ${schedule.days?.map(d => dayNames[d]).join(', ')} at ${schedule.time}`;
      case 'interval':
        return `Every ${schedule.interval} minutes`;
      case 'once':
        return `Once at ${schedule.time}`;
      default:
        return 'Unknown schedule';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Scheduled Operations</h2>
        <Button onClick={() => {
          setEditingTask(createNewTask());
          setIsAddingNew(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={task.enabled}
                  onCheckedChange={() => toggleTask(task.id)}
                />
                <div>
                  <h3 className="font-semibold text-foreground">{task.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {actionLabels[task.action]} • {formatSchedule(task.schedule)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runTaskNow(task)}
                  disabled={!task.enabled}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTask(task)}
                >
                  <Clock className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteTask(task.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 text-xs">
              <Badge variant={task.enabled ? 'default' : 'secondary'}>
                {task.enabled ? 'Active' : 'Disabled'}
              </Badge>
              {task.nextRun && (
                <Badge variant="outline">
                  Next: {task.nextRun.toLocaleString()}
                </Badge>
              )}
              {task.lastRun && (
                <Badge variant="outline">
                  Last: {task.lastRun.toLocaleString()}
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editingTask && (
        <Card className="p-6 border-primary/20 bg-primary/5">
          <h3 className="text-lg font-semibold mb-4">
            {isAddingNew ? 'Create New Scheduled Task' : 'Edit Scheduled Task'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label>Task Name</Label>
              <Input
                value={editingTask.name}
                onChange={(e) => setEditingTask(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Action</Label>
                <Select
                  value={editingTask.action}
                  onValueChange={(value: ScheduledTask['action']) => setEditingTask(prev => prev ? { ...prev, action: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start_motor">Start Motor</SelectItem>
                    <SelectItem value="stop_motor">Stop Motor</SelectItem>
                    <SelectItem value="run_for_duration">Run for Duration</SelectItem>
                    <SelectItem value="check_levels">Check Water Levels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Schedule Type</Label>
                <Select
                  value={editingTask.schedule.type}
                  onValueChange={(value: ScheduledTask['schedule']['type']) => setEditingTask(prev => prev ? {
                    ...prev,
                    schedule: { ...prev.schedule, type: value }
                  } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One Time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="interval">Interval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(editingTask.schedule.type === 'daily' || editingTask.schedule.type === 'once' || editingTask.schedule.type === 'weekly') && (
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={editingTask.schedule.time || '08:00'}
                  onChange={(e) => setEditingTask(prev => prev ? {
                    ...prev,
                    schedule: { ...prev.schedule, time: e.target.value }
                  } : null)}
                />
              </div>
            )}

            {editingTask.schedule.type === 'interval' && (
              <div>
                <Label>Interval (minutes)</Label>
                <Input
                  type="number"
                  value={editingTask.schedule.interval || 60}
                  onChange={(e) => setEditingTask(prev => prev ? {
                    ...prev,
                    schedule: { ...prev.schedule, interval: parseInt(e.target.value) }
                  } : null)}
                />
              </div>
            )}

            {editingTask.action === 'run_for_duration' && (
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={editingTask.duration || 15}
                  onChange={(e) => setEditingTask(prev => prev ? { ...prev, duration: parseInt(e.target.value) } : null)}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={() => saveTask(editingTask)}>
                {isAddingNew ? 'Create Task' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTask(null);
                  setIsAddingNew(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
