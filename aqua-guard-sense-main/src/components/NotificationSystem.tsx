
import { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, AlertTriangle, Info, CheckCircle, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiService } from "@/services/api";

// Local notification representation (extends base alert semantics)
interface NotificationItem {
  id?: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'alarm';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  severity?: 'low' | 'medium' | 'high';
  esp32_id?: string;
  persistent?: boolean;
}

// Incoming SSE payloads we care about for notifications
interface SystemAlertEventPayload {
  type: 'info' | 'warning' | 'error' | 'success' | 'alarm';
  message: string;
  severity?: 'low' | 'medium' | 'high';
  esp32_id?: string;
  active?: boolean; // whether alert still active (mapped to persistent)
}

interface GenericMessagePayload { message?: string }

type NotificationEventPayload = SystemAlertEventPayload | GenericMessagePayload;

export const NotificationSystem = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        updateUnreadCount(data.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Load existing notifications from backend
    loadNotifications();
  }, [loadNotifications]);

  const updateUnreadCount = (notifs: NotificationItem[]) => {
    const unread = notifs.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  const markAsRead = (id: string | undefined) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (id: string | undefined) => {
    const notification = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-success" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  // Subscribe to realtime alerts from the SSE/api service
  useEffect(() => {
    // Handle system_alert messages coming from backend
    const unsubscribeSystemAlert = apiService.onWebSocketMessage('system_alert', (data) => {
      try {
        if (!data || typeof data !== 'object') return;
        const maybe = data as NotificationEventPayload;
        const type: NotificationItem['type'] = 'type' in maybe && maybe.type ? maybe.type : 'info';
        const message = 'message' in maybe && maybe.message ? maybe.message : 'System alert received';
        addNotification({
          type,
          title: 'System Alert',
          message,
          severity: 'severity' in maybe ? maybe.severity : 'medium',
          esp32_id: 'esp32_id' in maybe ? maybe.esp32_id : undefined,
          persistent: 'active' in maybe ? maybe.active : undefined
        });
      } catch (e) {
        console.warn('Failed to process system_alert for notifications:', e);
      }
    });

    // Optional: generic warning/error/info events
    const unsubscribeWarning = apiService.onWebSocketMessage('warning', (data) => {
      const msg = (data && typeof data === 'object' && 'message' in data) ? (data as GenericMessagePayload).message : undefined;
      addNotification({ type: 'warning', title: 'Warning', message: msg || 'Warning event' });
    });
    const unsubscribeError = apiService.onWebSocketMessage('error', (data) => {
      const msg = (data && typeof data === 'object' && 'message' in data) ? (data as GenericMessagePayload).message : undefined;
      addNotification({ type: 'error', title: 'Error', message: msg || 'Error event' });
    });
    const unsubscribeInfo = apiService.onWebSocketMessage('info', (data) => {
      const msg = (data && typeof data === 'object' && 'message' in data) ? (data as GenericMessagePayload).message : undefined;
      addNotification({ type: 'info', title: 'Info', message: msg || 'Information' });
    });

    return () => {
      unsubscribeSystemAlert();
      unsubscribeWarning();
      unsubscribeError();
      unsubscribeInfo();
    };
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-background/50 border-border/50">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>
              View and manage system notifications and alerts.
            </DialogDescription>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`p-3 cursor-pointer transition-colors ${
                  !notification.read ? 'bg-primary/5 border-primary/20' : 'bg-card'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-50 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
