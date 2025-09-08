import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, Settings, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { pushNotificationService } from '@/services/pushNotificationService';

interface NotificationSettings {
  enabled: boolean;
  tankAlerts: boolean;
  motorAlerts: boolean;
  maintenanceAlerts: boolean;
  criticalOnly: boolean;
}

export function NotificationSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    tankAlerts: true,
    motorAlerts: true,
    maintenanceAlerts: true,
    criticalOnly: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkNotificationSupport();
    loadSettings();
  }, []);

  const checkNotificationSupport = async () => {
    setIsSupported(pushNotificationService.isSupported);
    setPermission(pushNotificationService.permission);
    setIsSubscribed(pushNotificationService.isSubscribed);
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('aquaguard-notification-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const saveSettings = (newSettings: NotificationSettings) => {
    localStorage.setItem('aquaguard-notification-settings', JSON.stringify(newSettings));
    setSettings(newSettings);
  };

  const enableNotifications = async () => {
    setLoading(true);
    setError(null);

    try {
      const subscription = await pushNotificationService.subscribeToPush();
      if (subscription) {
        setIsSubscribed(true);
        setPermission('granted');
        saveSettings({ ...settings, enabled: true });
      } else {
        setError('Failed to enable push notifications. Please check your browser settings.');
      }
    } catch (err) {
      setError('Error enabling notifications: ' + (err as Error).message);
    }

    setLoading(false);
  };

  const disableNotifications = async () => {
    setLoading(true);
    
    try {
      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
      saveSettings({ ...settings, enabled: false });
    } catch (err) {
      setError('Error disabling notifications: ' + (err as Error).message);
    }

    setLoading(false);
  };

  const testNotification = () => {
    pushNotificationService.showLocalNotification({
      title: '🚰 AquaGuard Test',
      message: 'Notifications are working! You\'ll receive water system alerts.',
      type: 'info',
      data: { test: true }
    });
  };

  const getStatusBadge = () => {
    if (!isSupported) {
      return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Not Supported</Badge>;
    }
    
    if (permission === 'denied') {
      return <Badge variant="destructive"><BellOff className="w-3 h-3 mr-1" />Blocked</Badge>;
    }
    
    if (isSubscribed && settings.enabled) {
      return <Badge variant="default" className="bg-green-500"><Bell className="w-3 h-3 mr-1" />Active</Badge>;
    }
    
    return <Badge variant="secondary"><Bell className="w-3 h-3 mr-1" />Inactive</Badge>;
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>Mobile alerts for your water management system</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <BellOff className="w-4 h-4" />
            <AlertDescription>
              Push notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Push Notifications
          </div>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Get instant mobile alerts for water levels, motor status, and maintenance needs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Enable Push Notifications</h4>
            <p className="text-sm text-muted-foreground">
              Receive real-time alerts on your mobile device
            </p>
          </div>
          {!isSubscribed ? (
            <Button 
              onClick={enableNotifications} 
              disabled={loading}
              className="min-w-[100px]"
            >
              {loading ? 'Enabling...' : 'Enable'}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={disableNotifications}
              disabled={loading}
              className="min-w-[100px]"
            >
              {loading ? 'Disabling...' : 'Disable'}
            </Button>
          )}
        </div>

        {/* Settings */}
        {isSubscribed && settings.enabled && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Alert Preferences
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Tank Level Alerts</label>
                  <p className="text-xs text-muted-foreground">Low water, full tank, and level changes</p>
                </div>
                <Switch
                  checked={settings.tankAlerts}
                  onCheckedChange={(checked) => 
                    saveSettings({ ...settings, tankAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Motor Alerts</label>
                  <p className="text-xs text-muted-foreground">Motor status, runtime warnings, and failures</p>
                </div>
                <Switch
                  checked={settings.motorAlerts}
                  onCheckedChange={(checked) => 
                    saveSettings({ ...settings, motorAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Maintenance Alerts</label>
                  <p className="text-xs text-muted-foreground">AI-powered maintenance recommendations</p>
                </div>
                <Switch
                  checked={settings.maintenanceAlerts}
                  onCheckedChange={(checked) => 
                    saveSettings({ ...settings, maintenanceAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Critical Only</label>
                  <p className="text-xs text-muted-foreground">Only receive urgent system alerts</p>
                </div>
                <Switch
                  checked={settings.criticalOnly}
                  onCheckedChange={(checked) => 
                    saveSettings({ ...settings, criticalOnly: checked })
                  }
                />
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={testNotification}
              className="w-full"
            >
              <Bell className="w-4 h-4 mr-2" />
              Send Test Notification
            </Button>
          </div>
        )}

        {/* Browser permission info */}
        {permission === 'denied' && (
          <Alert>
            <BellOff className="w-4 h-4" />
            <AlertDescription>
              Notifications are blocked. Please enable them in your browser settings:
              <br />• Chrome: Settings → Privacy and Security → Site Settings → Notifications
              <br />• Safari: Safari → Preferences → Websites → Notifications
              <br />• Firefox: Settings → Privacy & Security → Permissions → Notifications
            </AlertDescription>
          </Alert>
        )}

        {/* Mobile PWA info */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <strong>💡 Pro Tip:</strong> Install AquaGuard as a mobile app for the best notification experience. 
          Look for "Add to Home Screen" in your browser menu.
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
