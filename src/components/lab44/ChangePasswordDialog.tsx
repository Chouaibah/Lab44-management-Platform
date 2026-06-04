'use client';

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

import { Lock, RefreshCw, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
  if (score <= 2) return { label: 'Fair', color: 'bg-amber-500', width: '50%' };
  if (score <= 3) return { label: 'Good', color: 'bg-emerald-400', width: '75%' };
  return { label: 'Strong', color: 'bg-emerald-600', width: '100%' };
}

export default function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const resetState = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setLoading(false);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from your current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error || 'Password change failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success('Password changed successfully!');
    } catch {
      toast.error('Connection error');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Password Changed
              </DialogTitle>
              <DialogDescription>
                Your password has been updated successfully.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground mt-3">You can now use your new password to sign in.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full">Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Change Password
              </DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-pw">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-pw" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`h-3 w-3 ${
                        strength.label === 'Weak' ? 'text-red-500' :
                        strength.label === 'Fair' ? 'text-amber-500' :
                        strength.label === 'Good' ? 'text-emerald-400' :
                        'text-emerald-600'
                      }`} />
                      <span className={`text-[11px] font-medium ${
                        strength.label === 'Weak' ? 'text-red-500' :
                        strength.label === 'Fair' ? 'text-amber-500' :
                        strength.label === 'Good' ? 'text-emerald-400' :
                        'text-emerald-600'
                      }`}>
                        {strength.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-new-pw" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-new-pw"
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pr-10 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-400 dark:border-red-500 focus-visible:ring-red-400'
                        : confirmPassword && confirmPassword === newPassword
                          ? 'border-emerald-400 dark:border-emerald-500 focus-visible:ring-emerald-400'
                          : ''
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] text-red-500 font-medium">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleChangePassword}
                disabled={loading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              >
                {loading ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Changing...</> : <><Lock className="h-4 w-4 mr-1" /> Change Password</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
