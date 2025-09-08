// AquaGuard Push Notification Service
export interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'maintenance';
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string = '';

  constructor() {
    this.initializeService();
  }

  async initializeService() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered for notifications');
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return true;
    } catch (error) {
      console.error('Failed to register service worker:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notifications are blocked');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async subscribeToPush(): Promise<PushSubscriptionData | null> {
    if (!this.registration) {
      await this.initializeService();
    }

    if (!this.registration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Push notification permission denied');
        return null;
      }

      // For now, we'll use a demo VAPID key - in production, generate your own
      const applicationServerKey = this.urlBase64ToUint8Array(
        'BNXzwbU8F2fF1J7EjHUV4iJJBHJE7hCkN6TgJjU9lKX8YzPdN3p8vE6YjCT9qEbT1nF7jK9qL3mE8dY4xVfT8qE'
      );

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource
      });

      const subscriptionData: PushSubscriptionData = {
        endpoint: this.subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!)
        }
      };

      console.log('✅ Push subscription created:', subscriptionData);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData);
      
      return subscriptionData;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async sendSubscriptionToServer(subscription: PushSubscriptionData) {
    try {
      // Send subscription to your backend to store for sending notifications
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });

      if (response.ok) {
        console.log('✅ Push subscription sent to server');
      } else {
        console.error('Failed to send subscription to server');
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      if (success) {
        this.subscription = null;
        console.log('✅ Unsubscribed from push notifications');
        
        // Notify server to remove subscription
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  // Show local notification (fallback for browsers without push support)
  showLocalNotification(payload: NotificationPayload) {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const options: NotificationOptions = {
      body: payload.message,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `aquaguard-${payload.type}`,
      data: payload.data,
      requireInteraction: payload.type === 'critical'
    };

    // Add actions if supported (modern browsers)
    if (payload.actions && 'actions' in Notification.prototype) {
      (options as any).actions = payload.actions;
    }

    new Notification(payload.title, options);
  }

  private getVibrationPattern(type: string): number[] {
    switch (type) {
      case 'critical':
        return [300, 100, 300, 100, 300];
      case 'warning':
        return [200, 100, 200];
      case 'info':
        return [100];
      default:
        return [200];
    }
  }

  // Utility methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  }

  // Check if notifications are supported and enabled
  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  get permission(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }

  get isSubscribed(): boolean {
    return this.subscription !== null;
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();

// Helper function to send AquaGuard-specific notifications
export async function sendAquaGuardNotification(
  type: 'tank_low' | 'tank_full' | 'motor_alert' | 'system_error' | 'maintenance_due',
  level?: number,
  tankType?: string
) {
  let payload: NotificationPayload;

  switch (type) {
    case 'tank_low':
      payload = {
        title: 'Water Level Alert',
        message: `${tankType} tank is low (${level}%). Consider refilling.`,
        type: 'warning',
        data: { type, level, tankType },
        actions: [
          { action: 'view', title: 'View Dashboard' },
          { action: 'start_motor', title: 'Start Motor' }
        ]
      };
      break;

    case 'tank_full':
      payload = {
        title: 'Tank Full',
        message: `${tankType} tank is full (${level}%). Motor stopped.`,
        type: 'info',
        data: { type, level, tankType },
        actions: [
          { action: 'view', title: 'View Dashboard' }
        ]
      };
      break;

    case 'motor_alert':
      payload = {
        title: 'Motor Alert',
        message: 'Motor has been running for extended time. Check system.',
        type: 'warning',
        data: { type },
        actions: [
          { action: 'view', title: 'View Status' },
          { action: 'stop_motor', title: 'Stop Motor' }
        ]
      };
      break;

    case 'system_error':
      payload = {
        title: 'System Error',
        message: 'AquaGuard system detected an error. Immediate attention required.',
        type: 'critical',
        data: { type },
        actions: [
          { action: 'view', title: 'View Details' }
        ]
      };
      break;

    case 'maintenance_due':
      payload = {
        title: 'Maintenance Due',
        message: 'AI analysis suggests system maintenance is recommended.',
        type: 'maintenance',
        data: { type },
        actions: [
          { action: 'view', title: 'View Insights' },
          { action: 'schedule', title: 'Schedule Maintenance' }
        ]
      };
      break;

    default:
      return;
  }

  pushNotificationService.showLocalNotification(payload);
}

export default pushNotificationService;
