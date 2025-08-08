import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, User, Wifi, WifiOff, Settings, LogOut, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDevices } from '@/hooks/useDevices';
import { useSecurityNotifications } from '@/hooks/useSecurityNotifications';
export const Header = () => {
  const navigate = useNavigate();
  const { devices } = useDevices();
  const { alerts: notifications } = useSecurityNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const connectedDevices = devices.filter(device => device.isOnline).length;
  const isConnected = connectedDevices > 0;

  // Only one dropdown open at a time
  const handleBellClick = () => {
    setShowNotifications((open) => {
      if (!open) setShowUserMenu(false);
      return !open;
    });
  };
  const handleUserClick = () => {
    setShowUserMenu((open) => {
      if (!open) setShowNotifications(false);
      return !open;
    });
  };
  const closeAll = () => {
    setShowNotifications(false);
    setShowUserMenu(false);
  };

  const anyOpen = showNotifications || showUserMenu;

  return (
    <header className="glass border-b border-border/50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor and control your IoT devices</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-success animate-[pulse_2s_ease-in-out_infinite]" />
                <Badge variant="outline" className="border-success/50 text-success bg-success/10 hover:bg-success/20">
                  {connectedDevices} devices online
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-destructive animate-[pulse_2s_ease-in-out_infinite]" />
                <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20">
                  Offline
                </Badge>
              </>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className={`relative ${showNotifications ? 'text-blue-600' : ''}`}
              onClick={handleBellClick}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full text-[10px] flex items-center justify-center">
                2
              </span>
            </Button>
            {showNotifications && (
              <Card className="absolute right-0 mt-2 w-80 z-50">
                <CardHeader className="pb-3">
                  <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-0">
                  <ScrollArea className="h-[300px] px-4">
                    {notifications.length > 0 ? (
                      <div className="grid gap-4 pb-4">
                        {notifications.map((alert) => (
                          <div key={alert.id} className="grid gap-1 border-b pb-3 last:border-none">
                            <p className="text-sm font-medium">{alert.type}</p>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No new notifications</p>
                    )}
                  </ScrollArea>
                  <div className="border-t px-4 py-2">
                    <Button variant="ghost" size="sm" onClick={closeAll} className="w-full">
                      Clear all
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={handleUserClick} className={showUserMenu ? 'text-blue-600' : ''}>
              <User className="w-5 h-5" />
            </Button>
            {showUserMenu && (
              <Card className="absolute right-0 mt-2 w-48 z-50">
                <CardContent className="p-0">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-t-lg transition-colors"
                    onClick={() => { closeAll(); navigate('/profile'); }}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => { closeAll(); navigate('/settings'); }}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-b-lg transition-colors"
                    onClick={() => {
                      closeAll();
                      localStorage.clear();
                      navigate('/login');
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {/* Overlay for dropdowns */}
      {anyOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={closeAll} />
      )}
    </header>
  );
};
