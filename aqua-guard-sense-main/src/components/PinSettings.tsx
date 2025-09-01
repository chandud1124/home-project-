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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PinSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinSettings: React.FC<PinSettingsProps> = ({
  isOpen,
  onClose
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getStoredPin = () => {
    return localStorage.getItem('water_system_pin') || '1234';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Simulate API delay
    setTimeout(() => {
      const storedPin = getStoredPin();

      // Verify current PIN
      if (currentPin !== storedPin) {
        setError('Current PIN is incorrect.');
        setIsLoading(false);
        return;
      }

      // Validate new PIN
      if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
        setError('New PIN must be exactly 4 digits.');
        setIsLoading(false);
        return;
      }

      // Confirm PIN match
      if (newPin !== confirmPin) {
        setError('New PIN and confirmation do not match.');
        setIsLoading(false);
        return;
      }

      // Update PIN
      localStorage.setItem('water_system_pin', newPin);
      setSuccess('PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setIsLoading(false);

      console.log('🔐 PIN updated successfully');
    }, 500);
  };

  const resetForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Security Settings
          </DialogTitle>
          <DialogDescription>
            Change your PIN to secure motor control operations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" />
                PIN Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• PIN protects motor start/stop operations</p>
                <p>• PIN secures auto mode enable/disable</p>
                <p>• Failed attempts are logged for security</p>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Enter current PIN"
                maxLength={4}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new 4-digit PIN"
                maxLength={4}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm new PIN"
                maxLength={4}
                className="text-center text-lg tracking-widest"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
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
                disabled={isLoading || !currentPin || !newPin || !confirmPin}
              >
                {isLoading ? 'Updating...' : 'Update PIN'}
              </Button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              🔒 Keep your PIN secure and don't share it with others
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
