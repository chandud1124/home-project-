
import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface AlertRule {
  id: string;
  name: string;
  condition: 'level_below' | 'level_above' | 'motor_runtime' | 'sensor_offline';
  threshold: number;
  tankType: 'top_tank' | 'sump' | 'both';
  enabled: boolean;
  priority: 'low' | 'medium' | 'high';
  actions: {
    email: boolean;
    push: boolean;
    sound: boolean;
    led: boolean;
  };
}

export const AlertConfiguration = () => {
  const { toast } = useToast();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: '1',
      name: 'Low Water Level',
      condition: 'level_below',
      threshold: 20,
      tankType: 'top_tank',
      enabled: true,
      priority: 'high',
      actions: { email: true, push: true, sound: true, led: false }
    },
    {
      id: '2',
      name: 'Motor Overrun',
      condition: 'motor_runtime',
      threshold: 30,
      tankType: 'sump',
      enabled: true,
      priority: 'medium',
      actions: { email: true, push: false, sound: false, led: true }
    },
    {
      id: '3',
      name: 'Sensor Offline',
      condition: 'sensor_offline',
      threshold: 300,
      tankType: 'both',
      enabled: true,
      priority: 'high',
      actions: { email: true, push: true, sound: false, led: true }
    }
  ]);

  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const conditionLabels = {
    level_below: 'Water level below (%)',
    level_above: 'Water level above (%)',
    motor_runtime: 'Motor runtime exceeds (minutes)',
    sensor_offline: 'Sensor offline for (seconds)'
  };

  const createNewRule = (): AlertRule => ({
    id: Date.now().toString(),
    name: 'New Alert Rule',
    condition: 'level_below',
    threshold: 20,
    tankType: 'top_tank',
    enabled: true,
    priority: 'medium',
    actions: { email: false, push: false, sound: false, led: false }
  });

  const saveRule = (rule: AlertRule) => {
    if (isAddingNew) {
      setAlertRules(prev => [...prev, rule]);
      setIsAddingNew(false);
    } else {
      setAlertRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    }
    setEditingRule(null);
    
    toast({
      title: "Alert Rule Saved",
      description: `${rule.name} has been ${isAddingNew ? 'created' : 'updated'}.`,
    });
  };

  const deleteRule = (id: string) => {
    setAlertRules(prev => prev.filter(r => r.id !== id));
    toast({
      title: "Alert Rule Deleted",
      description: "The alert rule has been removed.",
    });
  };

  const toggleRule = (id: string) => {
    setAlertRules(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const getPriorityColor = (priority: string): "default" | "secondary" | "destructive" => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Alert Configuration</h2>
        <Button onClick={() => {
          setEditingRule(createNewRule());
          setIsAddingNew(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Alert Rule
        </Button>
      </div>

      <div className="grid gap-4">
        {alertRules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => toggleRule(rule.id)}
                />
                <div>
                  <h3 className="font-semibold text-foreground">{rule.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {conditionLabels[rule.condition]}: {rule.threshold}
                    {rule.condition.includes('level') ? '%' : 
                     rule.condition === 'motor_runtime' ? ' min' : ' sec'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={getPriorityColor(rule.priority)}>
                  {rule.priority.toUpperCase()}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRule(rule)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteRule(rule.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 text-xs">
              <Badge variant="outline">Tank: {rule.tankType.replace('_', ' ')}</Badge>
              {rule.actions.email && <Badge variant="outline">📧 Email</Badge>}
              {rule.actions.push && <Badge variant="outline">📱 Push</Badge>}
              {rule.actions.sound && <Badge variant="outline">🔊 Sound</Badge>}
              {rule.actions.led && <Badge variant="outline">💡 LED</Badge>}
            </div>
          </Card>
        ))}
      </div>

      {editingRule && (
        <Card className="p-6 border-primary/20 bg-primary/5">
          <h3 className="text-lg font-semibold mb-4">
            {isAddingNew ? 'Create New Alert Rule' : 'Edit Alert Rule'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={editingRule.name}
                onChange={(e) => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Condition</Label>
                <Select
                  value={editingRule.condition}
                  onValueChange={(value: AlertRule['condition']) => setEditingRule(prev => prev ? { ...prev, condition: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level_below">Water level below</SelectItem>
                    <SelectItem value="level_above">Water level above</SelectItem>
                    <SelectItem value="motor_runtime">Motor runtime exceeds</SelectItem>
                    <SelectItem value="sensor_offline">Sensor offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Threshold</Label>
                <Input
                  type="number"
                  value={editingRule.threshold}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, threshold: parseInt(e.target.value) } : null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tank Type</Label>
                <Select
                  value={editingRule.tankType}
                  onValueChange={(value: AlertRule['tankType']) => setEditingRule(prev => prev ? { ...prev, tankType: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top_tank">Top Tank</SelectItem>
                    <SelectItem value="sump">Sump Tank</SelectItem>
                    <SelectItem value="both">Both Tanks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select
                  value={editingRule.priority}
                  onValueChange={(value: AlertRule['priority']) => setEditingRule(prev => prev ? { ...prev, priority: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">Actions</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.actions.email}
                    onCheckedChange={(checked) => setEditingRule(prev => prev ? {
                      ...prev,
                      actions: { ...prev.actions, email: checked }
                    } : null)}
                  />
                  <Label>Email notification</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.actions.push}
                    onCheckedChange={(checked) => setEditingRule(prev => prev ? {
                      ...prev,
                      actions: { ...prev.actions, push: checked }
                    } : null)}
                  />
                  <Label>Push notification</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.actions.sound}
                    onCheckedChange={(checked) => setEditingRule(prev => prev ? {
                      ...prev,
                      actions: { ...prev.actions, sound: checked }
                    } : null)}
                  />
                  <Label>Sound alert</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.actions.led}
                    onCheckedChange={(checked) => setEditingRule(prev => prev ? {
                      ...prev,
                      actions: { ...prev.actions, led: checked }
                    } : null)}
                  />
                  <Label>LED indicator</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => saveRule(editingRule)}>
                {isAddingNew ? 'Create Rule' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingRule(null);
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
