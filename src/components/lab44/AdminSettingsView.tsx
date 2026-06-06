'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Cog, ChevronLeft, Lock, RefreshCw, Save,
  Server, CheckCircle2, XCircle, Globe, UserPlus,
  AlertTriangle, Trash2,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav } from '@/lib/helpers';

export default function AdminSettingsView() {
  const { setView, signupEnabled, setSignupEnabled, logout } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Dark Mode Schedule state
  const [darkModeSchedule, setDarkModeSchedule] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('lab44-dark-mode-schedule');
      const enabled = saved === 'true';
      setDarkModeSchedule(enabled);
      if (enabled) applyDarkModeSchedule();
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!darkModeSchedule) return;
    const interval = setInterval(applyDarkModeSchedule, 60000);
    return () => clearInterval(interval);
  }, [darkModeSchedule]);

  const applyDarkModeSchedule = () => {
    try {
      const hour = new Date().getHours();
      const shouldBeDark = hour >= 18 || hour < 8;
      const html = document.documentElement;
      if (shouldBeDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    } catch { /* ignore */ }
  };

  const handleDarkModeScheduleToggle = (enabled: boolean) => {
    setDarkModeSchedule(enabled);
    try {
      localStorage.setItem('lab44-dark-mode-schedule', String(enabled));
    } catch { /* ignore */ }
    if (enabled) {
      applyDarkModeSchedule();
      toast.success('Dark mode schedule enabled (6pm–8am)');
    } else {
      toast.success('Dark mode schedule disabled');
    }
  };

  const [isCurrentlyScheduledDark, setIsCurrentlyScheduledDark] = useState(false);

  useEffect(() => {
    if (!darkModeSchedule) {
      setIsCurrentlyScheduledDark(false);
      return;
    }
    const check = () => {
      const hour = new Date().getHours();
      setIsCurrentlyScheduledDark(hour >= 18 || hour < 8);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [darkModeSchedule]);

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Registration toggle
  const [regLoading, setRegLoading] = useState(false);

  // XCP-ng settings
  const [xcpngHost, setXcpngHost] = useState('');
  const [xcpngUser, setXcpngUser] = useState('');
  const [xcpngPw, setXcpngPw] = useState('');
  const [xcpngPwSet, setXcpngPwSet] = useState(false);
  const [xcpngLoading, setXcpngLoading] = useState(false);
  const [xcpngTestResult, setXcpngTestResult] = useState<{ ok: boolean; message: string; connected: boolean } | null>(null);

  // Guacamole settings
  const [guacUrl, setGuacUrl] = useState('');
  const [guacUser, setGuacUser] = useState('');
  const [guacPw, setGuacPw] = useState('');
  const [guacPwSet, setGuacPwSet] = useState(false);
  const [guacLoading, setGuacLoading] = useState(false);
  const [guacConnected, setGuacConnected] = useState(false);
  const [guacTestResult, setGuacTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
      } catch { toast.error('Failed to load settings'); }
      // Load XCP-ng settings
      try {
        const xcpRes = await fetch('/api/xcp-ng');
        const xcpData = await xcpRes.json();
        setXcpngHost(xcpData.xcpng_host || '');
        setXcpngUser(xcpData.xcpng_username || '');
        setXcpngPwSet(xcpData.xcpng_password_set || false);
      } catch { /* ignore */ }
      // Load Guacamole settings
      try {
        const guacRes = await fetch('/api/guacamole');
        const guacData = await guacRes.json();
        setGuacUrl(guacData.guacamole_url || '');
        setGuacUser(guacData.guacamole_root_username || '');
        setGuacPwSet(guacData.guacamole_root_password_set || false);
        setGuacConnected(guacData.connected || false);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error('Failed to save setting'); return false; }
      setSettings(prev => ({ ...prev, [key]: value }));
      return true;
    } catch { toast.error('Connection error'); return false; }
  };

  const handlePasswordChange = async () => {
    if (!currentPw) { toast.error('Current password is required'); return; }
    if (!newPw || newPw.length < 4) { toast.error('New password must be at least 4 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPw }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error('Current password is incorrect'); setPwLoading(false); return; }
      const ok = await updateSetting('admin_password', newPw);
      if (ok) {
        toast.success('Password changed successfully');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      }
    } catch { toast.error('Connection error'); }
    setPwLoading(false);
  };

  const handleRegToggle = async (checked: boolean) => {
    setRegLoading(true);
    const ok = await updateSetting('signup_enabled', String(checked));
    if (ok) {
      setSignupEnabled(checked);
      toast.success(`Student registration ${checked ? 'enabled' : 'disabled'}`);
    }
    setRegLoading(false);
  };

  const handleTestXcpng = async () => {
    if (!xcpngHost.trim()) { toast.error('XCP-ng host is required'); return; }
    setXcpngLoading(true);
    setXcpngTestResult(null);
    try {
      const res = await fetch('/api/xcp-ng', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: xcpngHost.trim(), username: xcpngUser.trim(), password: xcpngPw }),
      });
      const data = await res.json();
      setXcpngTestResult({ ok: data.ok || false, message: data.message || (data.error || 'Unknown error'), connected: data.connected || false });
    } catch { setXcpngTestResult({ ok: false, message: 'Connection error', connected: false }); }
    setXcpngLoading(false);
  };

  const handleSaveXcpng = async () => {
    if (!xcpngHost.trim()) { toast.error('XCP-ng host is required'); return; }
    setXcpngLoading(true);
    try {
      const res = await fetch('/api/xcp-ng', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: xcpngHost.trim(), username: xcpngUser.trim(), password: xcpngPw.length > 0 ? xcpngPw : undefined }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to save'); setXcpngLoading(false); return; }
      setXcpngPwSet(xcpngPw.length > 0);
      setXcpngPw('');
      toast.success('XCP-ng settings saved');
    } catch { toast.error('Connection error'); }
    setXcpngLoading(false);
  };

  const handleTestGuac = async () => {
    if (!guacUrl.trim()) { toast.error('Guacamole Host Address is required'); return; }
    setGuacLoading(true);
    setGuacTestResult(null);
    try {
      const res = await fetch('/api/guacamole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: guacUrl.trim(), rootUsername: guacUser.trim(), rootPassword: guacPw }),
      });
      const data = await res.json();
      setGuacTestResult({ ok: data.ok || false, message: data.message || (data.error || 'Unknown error') });
      if (data.ok) setGuacConnected(true);
    } catch { setGuacTestResult({ ok: false, message: 'Connection error' }); }
    setGuacLoading(false);
  };

  const handleSaveGuac = async () => {
    if (!guacUrl.trim()) { toast.error('Guacamole Host Address is required'); return; }
    setGuacLoading(true);
    try {
      const res = await fetch('/api/guacamole', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: guacUrl.trim(),
                             rootUsername: guacUser.trim(),
                             rootPassword: guacPw.length > 0 ? guacPw : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to save'); setGuacLoading(false); return; }
      setGuacPwSet(guacPw.length > 0);
      setGuacPw('');
      toast.success('Guacamole settings saved');
    } catch { toast.error('Connection error'); }
    setGuacLoading(false);
  };

  const handlePurge = async () => {
    try {
      const res = await fetch('/api/data/purge?confirm=true', { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Purge failed'); return; }
      toast.success('All data has been reset');
      logout();
      setView('student-login');
    } catch { toast.error('Connection error'); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div {...fadeSlide} className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
    <BreadcrumbNav items={[{ label: 'Admin', view: 'admin-panel' }, { label: 'Settings' }]} />
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
    <h1 className="text-2xl font-bold flex items-center gap-2">
     Settings
    </h1>
    <p className="text-sm text-muted-foreground">Configure lab and admin settings</p>
    </div>
    <Button variant="outline" size="sm" onClick={() => setView('admin-panel')}>
    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Panel
    </Button>
    </div>

    <Tabs defaultValue="general" className="space-y-6">
    <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
    </TabsList>

    {/* ── General Tab ──────────────────────────────────────────── */}
    <TabsContent value="general" className="space-y-6">
    {/* Admin Password */}
    <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
    <Lock className="h-4 w-4 text-rose-500" /> Admin Password
    </CardTitle>
    <CardDescription>Change the admin login password</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
    <div className="space-y-1.5">
    <Label className="text-xs">Current Password (verification)</Label>
    <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">New Password</Label>
    <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" />
    {newPw.length > 0 && (() => {
      const score = (newPw.length >= 8 ? 1 : 0) + (newPw.length >= 10 ? 1 : 0) + (/[A-Z]/.test(newPw) && /[a-z]/.test(newPw) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(newPw) ? 1 : 0);
      const strengthGradient = ['from-red-400 to-red-600', 'from-amber-400 to-amber-600', 'from-amber-400 to-yellow-500', 'from-emerald-400 to-emerald-600', 'from-emerald-400 to-teal-600'];
      const strengthLabels = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
      const strengthLabelColors = ['text-red-500', 'text-amber-500', 'text-amber-600', 'text-emerald-600 dark:text-emerald-400', 'text-emerald-600 dark:text-emerald-400'];
      const labelIdx = newPw.length < 6 ? 0 : newPw.length < 8 ? 1 : newPw.length < 10 ? 2 : !/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) ? 3 : 4;
      return (
        <div className="space-y-1">
        <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= score ? `bg-gradient-to-r ${strengthGradient[score]}` : 'bg-muted'}`} />
        ))}
        </div>
        <p className={`text-[10px] font-medium ${strengthLabelColors[labelIdx]}`}>
        {strengthLabels[labelIdx]}
        </p>
        </div>
      );
    })()}
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">Confirm New Password</Label>
    <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" />
    {confirmPw.length > 0 && newPw !== confirmPw && (
      <p className="text-[10px] text-red-500">Passwords do not match</p>
    )}
    </div>
    </CardContent>
    <CardFooter>
    <Button onClick={handlePasswordChange} disabled={pwLoading}>
    {pwLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Lock className="h-4 w-4 mr-2" /> Change Password</>}
    </Button>
    </CardFooter>
    </Card>

    {/* Student Registration */}
    <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
    <UserPlus className="h-4 w-4 text-violet-500" /> Student Registration
    </CardTitle>
    <CardDescription>Control whether new students can register</CardDescription>
    </CardHeader>
    <CardContent>
    <div className="flex items-center justify-between">
    <div>
    <p className="text-sm font-medium">Allow Student Registration</p>
    <p className="text-xs text-muted-foreground">When enabled, students can create accounts from the login page</p>
    </div>
    <Switch checked={signupEnabled} onCheckedChange={handleRegToggle} disabled={regLoading} />
    </div>
    </CardContent>
    </Card>

    {/* Danger Zone */}
    <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
    <AlertTriangle className="h-4 w-4" /> Danger Zone
    </CardTitle>
    <CardDescription className="text-red-600/70 dark:text-red-400/60">Irreversible actions that will permanently delete data</CardDescription>
    </CardHeader>
    <CardContent>
    <AlertDialog>
    <AlertDialogTrigger asChild>
    <Button variant="destructive" className="gap-2">
    <Trash2 className="h-4 w-4" /> Reset All Data
    </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
    <AlertDialogHeader>
    <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
    <AlertTriangle className="h-5 w-5" /> Are you absolutely sure?
    </AlertDialogTitle>
    <AlertDialogDescription>
    This action cannot be undone. This will permanently delete all students, grades, attendance records,
    VM requests, announcements, and reset all settings to defaults. You will be logged out.
    </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction onClick={handlePurge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
    Yes, delete everything
    </AlertDialogAction>
    </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>
    </CardContent>
    </Card>
    </TabsContent>

    {/* ── Infrastructure Tab ─────────────────────────────────────── */}
    <TabsContent value="infrastructure" className="space-y-6">
    {/* XCP-ng Hypervisor Connection */}
    <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
    <Server className="h-4 w-4 text-cyan-500" /> XCP-ng Hypervisor
    </CardTitle>
    <CardDescription>Configure XCP-ng host connection for VM management</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
    <div className="space-y-1.5">
    <Label className="text-xs">Host Address</Label>
    <Input value={xcpngHost} onChange={(e) => setXcpngHost(e.target.value)} placeholder="192.168.1.100 or https://xcp-ng.example.com" />
    <p className="text-[10px] text-muted-foreground">XCP-ng server IP or hostname (HTTPS is used by default; self-signed certs accepted)</p>
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">Username</Label>
    <Input value={xcpngUser} onChange={(e) => setXcpngUser(e.target.value)} placeholder="root" />
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">Password {xcpngPwSet && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}</Label>
    <Input type="password" value={xcpngPw} onChange={(e) => setXcpngPw(e.target.value)} placeholder={xcpngPwSet ? "••••••••" : "Enter XCP-ng password"} />
    </div>
    {xcpngTestResult && (
      <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${xcpngTestResult.connected ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'}`}>
      {xcpngTestResult.connected ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      <p>{xcpngTestResult.message}</p>
      </div>
    )}
    </CardContent>
    <CardFooter className="flex gap-2">
    <Button onClick={handleTestXcpng} disabled={xcpngLoading} variant="outline">
    {xcpngLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : <><Globe className="h-4 w-4 mr-2" /> Test Connection</>}
    </Button>
    <Button onClick={handleSaveXcpng} disabled={xcpngLoading}>
    {xcpngLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save XCP-ng Settings</>}
    </Button>
    </CardFooter>
    </Card>

    {/* Guacamole Gateway */}
    <Card className="shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
    <CardTitle className="text-base flex items-center gap-2">
    <Globe className="h-4 w-4 text-orange-500" /> Guacamole Gateway
    </CardTitle>
    <Badge variant={guacConnected ? 'default' : 'secondary'} className={guacConnected ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}>
    {guacConnected ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</> : <><XCircle className="h-3 w-3 mr-1" /> Disconnected</>}
    </Badge>
    </div>
    <CardDescription>Configure Guacamole remote desktop gateway for VM access</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
    <div className="space-y-1.5">
    <Label className="text-xs">Host Address</Label>
    <Input value={guacUrl} onChange={(e) => setGuacUrl(e.target.value)} placeholder="192.168.1.100:8080 or https://guacamole.example.com" />
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">Username</Label>
    <Input value={guacUser} onChange={(e) => setGuacUser(e.target.value)} placeholder="guacadmin" />
    </div>
    <div className="space-y-1.5">
    <Label className="text-xs">Password {guacPwSet && <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>}</Label>
    <Input type="password" value={guacPw} onChange={(e) => setGuacPw(e.target.value)} placeholder={guacPwSet ? "••••••••" : "Enter Guacamole password"} />
    </div>
    {guacTestResult && (
      <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${guacTestResult.ok ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'}`}>
      {guacTestResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      <p>{guacTestResult.message}</p>
      </div>
    )}
    </CardContent>
    <CardFooter className="flex gap-2">
    <Button onClick={handleTestGuac} disabled={guacLoading} variant="outline">
    {guacLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : <><Globe className="h-4 w-4 mr-2" /> Test Connection</>}
    </Button>
    <Button onClick={handleSaveGuac} disabled={guacLoading}>
    {guacLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
    </Button>
    </CardFooter>
    </Card>
    </TabsContent>
    </Tabs>
    </motion.div>
  );
}
