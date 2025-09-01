import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertTriangle } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description: string;
  actionType: 'motor_start' | 'motor_stop' | 'auto_mode_toggle' | 'esp32_save' | 'esp32_update' | 'esp32_connect';
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  actionType
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get stored PIN (in production, this should be more secure)
  const getStoredPin = () => {
    return localStorage.getItem('water_system_pin') || '1234'; // Default PIN for demo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const storedPin = getStoredPin();

    if (pin === storedPin) {
      setIsLoading(false);
      setPin('');
      console.log(`🔐 PIN authentication successful for: ${actionType}`);
      onSuccess();
    } else {
      setError('Incorrect PIN. Please try again.');
      console.warn(`🚨 PIN authentication failed for: ${actionType}`);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  const getActionIcon = () => {
    switch (actionType) {
      case 'motor_start':
        return '🔄';
      case 'motor_stop':
        return '⏹️';
      case 'auto_mode_toggle':
        return '⚙️';
      default:
        return '🔒';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-warning" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">{getActionIcon()}</div>
            <p className="text-sm text-muted-foreground">
              Enter your PIN to authorize this action
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN Code</Label>
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                className="text-center text-lg tracking-widest"
                autoFocus
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isLoading || pin.length !== 4}
              >
                {isLoading ? 'Verifying...' : 'Authorize'}
              </Button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Default PIN: 1234 (Change this in settings for security)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              🔒 All motor operations require PIN authentication
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
