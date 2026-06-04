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

import { KeyRound, RefreshCw, Lock, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface AdminResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userRole: 'student' | 'instructor';
  userName: string;
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

export default function AdminResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userRole,
  userName,
}: AdminResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const resetState = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setShowConfirmPw(false);
    setLoading(false);
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  };

  const handleReset = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userRole, newPassword }),
      });
      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error || 'Password reset failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success(`Password reset for ${userName}`);
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
                Password Reset
              </DialogTitle>
              <DialogDescription>
                The password for {userName} has been reset successfully.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full">Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Reset Password
              </DialogTitle>
              <DialogDescription>
                Set a new password for <strong>{userName}</strong> ({userRole})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-new-pw" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> New Password
                </Label>
                <div className="relative">
                  <Input
                    id="admin-new-pw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

              <div className="space-y-2">
                <Label htmlFor="admin-confirm-pw" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="admin-confirm-pw"
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Re-enter the new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
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
                onClick={handleReset}
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {loading ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Resetting...</> : <><KeyRound className="h-4 w-4 mr-1" /> Reset Password</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
