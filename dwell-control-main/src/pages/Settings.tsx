
import React from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Save, Wifi, Shield, Bell } from 'lucide-react';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              System Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure your IoT control system
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Network Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                Network Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mqtt-broker">MQTT Broker URL</Label>
                <Input id="mqtt-broker" placeholder="mqtt://your-broker.com:1883" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-username">MQTT Username</Label>
                <Input id="mqtt-username" placeholder="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-password">MQTT Password</Label>
                <Input id="mqtt-password" type="password" placeholder="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-discovery">Auto Device Discovery</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="device-discovery" defaultChecked />
                  <Label htmlFor="device-discovery" className="text-sm text-muted-foreground">
                    Automatically discover new devices on network
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input id="session-timeout" type="number" defaultValue="30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="require-auth">Require Authentication</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="require-auth" defaultChecked />
                  <Label htmlFor="require-auth" className="text-sm text-muted-foreground">
                    Require login to access the system
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="two-factor" />
                  <Label htmlFor="two-factor" className="text-sm text-muted-foreground">
                    Enable 2FA for additional security
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="email-notifications" defaultChecked />
                  <Label htmlFor="email-notifications" className="text-sm text-muted-foreground">
                    Receive device status updates via email
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="push-notifications" />
                  <Label htmlFor="push-notifications" className="text-sm text-muted-foreground">
                    Receive push notifications on mobile
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input id="notification-email" type="email" placeholder="admin@example.com" />
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Version:</span>
                <span className="text-sm">v1.2.0</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Last Update:</span>
                <span className="text-sm">2024-01-15</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Connected Devices:</span>
                <span className="text-sm">2 online</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Uptime:</span>
                <span className="text-sm">7 days, 12 hours</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
