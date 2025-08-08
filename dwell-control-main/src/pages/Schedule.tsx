
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { useToast } from '@/hooks/use-toast';

interface Schedule {
  id: string;
  name: string;
  time: string;
  action: 'on' | 'off';
  days: string[];
  switches: string[];
  enabled: boolean;
  timeoutMinutes?: number;
}

// Google Calendar Connect Component
function GoogleCalendarConnect({ onConnect }: { onConnect: () => void }) {
  const [status, setStatus] = useState('Disconnected');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    setStatus('Connecting...');
    try {
      const res = await fetch('/api/google-calendar/auth-url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus('Failed to get auth URL');
      }
    } catch (err) {
      setStatus('Failed to connect');
    }
    setLoading(false);
  };

  return (
    <div className="mb-4">
      <p className="mb-2">Google Calendar Connection Status: <b>{status}</b></p>
      <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
        {loading ? 'Connecting...' : 'Connect Google Calendar'}
      </Button>
    </div>
  );
}

// Excel Import Component
function ExcelImport({ onSchedulesExtracted }: { onSchedulesExtracted: (schedules: any[]) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const schedules = XLSX.utils.sheet_to_json(sheet);
      onSchedulesExtracted(schedules);
    };
    reader.readAsArrayBuffer(file);
  };
  return (
    <div className="mb-4">
      <label className="mr-2">Import Schedules from Excel:</label>
      <input type="file" accept=".xlsx, .xls" onChange={handleFile} />
    </div>
  );
}

const Schedule = () => {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      id: '1',
      name: 'Morning Classroom Lights',
      time: '07:00',
      action: 'on',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      switches: ['1-sw1', '2-sw3'],
      enabled: true,
      timeoutMinutes: 600 // 10 hours
    },
    {
      id: '2',
      name: 'Evening Shutdown',
      time: '18:00',
      action: 'off',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      switches: ['1-sw1', '1-sw2', '2-sw3'],
      enabled: true,
      timeoutMinutes: 0
    }
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [importedSchedules, setImportedSchedules] = useState<any[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);

  const handleAddSchedule = (scheduleData: any) => {
    const newSchedule: Schedule = {
      id: Date.now().toString(),
      enabled: true,
      ...scheduleData
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    toast({
      title: "Schedule Added",
      description: `${scheduleData.name} has been scheduled successfully`
    });
  };

  const handleEditSchedule = (scheduleData: any) => {
    if (!editingSchedule) return;
    
    setSchedules(prev => 
      prev.map(schedule => 
        schedule.id === editingSchedule.id 
          ? { ...schedule, ...scheduleData }
          : schedule
      )
    );
    
    setEditingSchedule(null);
    toast({
      title: "Schedule Updated",
      description: `${scheduleData.name} has been updated successfully`
    });
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    toast({
      title: "Schedule Deleted",
      description: "Schedule has been removed successfully"
    });
  };

  const toggleSchedule = (scheduleId: string) => {
    setSchedules(prev => 
      prev.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, enabled: !schedule.enabled }
          : schedule
      )
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Google Calendar Integration */}
        <GoogleCalendarConnect onConnect={() => setCalendarConnected(true)} />

        {/* Excel Import */}
        <ExcelImport onSchedulesExtracted={setImportedSchedules} />

        {/* Show imported schedules and allow adding them */}
        {importedSchedules.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold">Imported Schedules Preview</h4>
            <pre className="bg-muted p-2 rounded max-h-48 overflow-auto text-xs">{JSON.stringify(importedSchedules, null, 2)}</pre>
            <Button
              className="mt-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                // Convert imported schedules to Schedule type and merge
                const converted = importedSchedules.map((item, idx) => {
                  let actionRaw = (item.action || item.Action || 'on').toString().toLowerCase();
                  let action: 'on' | 'off' = actionRaw === 'off' ? 'off' : 'on';
                  return {
                    id: `imported-${Date.now()}-${idx}`,
                    name: item.name || item.Name || `Imported Schedule ${idx + 1}`,
                    time: item.time || item.Time || '09:00',
                    action,
                    days: (item.days || item.Days || 'Monday,Tuesday,Wednesday,Thursday,Friday').split(',').map((d: string) => d.trim()),
                    switches: (item.switches || item.Switches || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                    enabled: true,
                    timeoutMinutes: Number(item.timeoutMinutes || item.TimeoutMinutes || 0)
                  } as Schedule;
                });
                setSchedules(prev => [...prev, ...converted]);
                setImportedSchedules([]);
                toast({
                  title: 'Imported Schedules Added',
                  description: `${converted.length} schedule(s) imported and added.`
                });
              }}
            >
              Add Imported Schedules
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Schedule Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Automate classroom lighting and devices with smart scheduling
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule
          </Button>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No schedules configured</h3>
            <p className="text-muted-foreground mb-4">
              Create automated schedules for your classroom devices
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Schedule
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {schedule.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                        {schedule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Time:</span>
                      <span className="text-sm">{schedule.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Action:</span>
                      <Badge variant={schedule.action === 'on' ? 'default' : 'outline'}>
                        Turn {schedule.action}
                      </Badge>
                    </div>
                    {schedule.timeoutMinutes && schedule.timeoutMinutes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Timeout:</span>
                        <span className="text-xs text-orange-600">
                          {Math.floor(schedule.timeoutMinutes / 60)}h {schedule.timeoutMinutes % 60}m
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium">Days:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {schedule.days.map((day) => (
                          <Badge key={day} variant="outline" className="text-xs">
                            {day.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Devices:</span>
                      <div className="text-xs text-muted-foreground mt-1">
                        {schedule.switches.length} device(s) selected
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant={schedule.enabled ? 'secondary' : 'default'}
                        onClick={() => toggleSchedule(schedule.id)}
                      >
                        {schedule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ScheduleDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingSchedule(null);
          }}
          onSave={editingSchedule ? handleEditSchedule : handleAddSchedule}
          schedule={editingSchedule}
        />
      </div>
    </Layout>
  );
};

export default Schedule;
