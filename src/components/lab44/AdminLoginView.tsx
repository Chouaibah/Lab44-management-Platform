'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';

import {
  Shield, Lock, RefreshCw, Eye, EyeOff, ChevronLeft, GraduationCap, AlertCircle,
} from 'lucide-react';

import { FloatingDecor, fadeSlide } from '@/lib/helpers';

export default function AdminLoginView() {
  const { setView, setAuth, setStudents, setColumns, setGrades, setAttendance } = useLab44Store();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!password) { toast.error('Password is required'); return; }

    setLoading(true);
    try {
      const res = await fetchWithTimeout('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) {
        const errMsg = data.error || 'Invalid password';
        setLoginError(errMsg);
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      setAuth({ role: 'admin', student: null });

      const [dataRes, vmRes] = await Promise.all([fetchWithTimeout('/api/data'), fetchWithTimeout('/api/vm-requests')]);
      const allData = await dataRes.json();
      const vmData = await vmRes.json();
      setStudents(allData.students || []);
      setColumns(allData.columns || []);
      setGrades(allData.grades || []);
      setAttendance(allData.attendance || []);
      useLab44Store.getState().setVmRequests(vmData.requests || []);

      toast.success('Admin access granted');
      setView('admin-panel');
    } catch {
      setLoginError('Connection error');
      toast.error('Connection error');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-6 bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20 overflow-y-auto">
    <FloatingDecor />
    <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
    <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
    <CardHeader className="text-center space-y-0.5 relative z-10 pb-2">
    <motion.div
    animate={{ rotate: [0, 5, -5, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
    >
    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    </motion.div>
    <CardTitle className="text-lg">Admin Login</CardTitle>
    <CardDescription className="text-xs">Restricted area &mdash; authorized personnel only</CardDescription>
    </CardHeader>

    <form onSubmit={handleLogin}>
    <CardContent className="space-y-3 pb-3">
    <AnimatePresence>
    {loginError && (
      <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      className="flex items-start gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 p-3"
      >
      <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">Authentication failed</p>
      <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{loginError}</p>
      </div>
      </motion.div>
    )}
    </AnimatePresence>

    <div className="space-y-2">
    <Label htmlFor="apw">Password</Label>
    <div className="relative">
    <Input
    id="apw"
    type={showPw ? 'text' : 'password'}
    placeholder="Enter admin password"
    value={password}
    onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
    className="pr-10"
    autoComplete="current-password"
    />
    <button
    type="button"
    onClick={() => setShowPw(!showPw)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    >
    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
    </div>
    </div>
    </CardContent>

    <CardFooter className="flex-col gap-3 pt-3">
    <Button type="submit" variant="default" className="w-full" disabled={loading}>
    {loading ? (
      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Authenticating...</>
    ) : (
      <><Lock className="h-4 w-4 mr-2" /> Sign In</>
    )}
    </Button>

    <Button variant="ghost" onClick={() => setView('student-login')} className="w-full text-muted-foreground hover:text-foreground">
    <ChevronLeft className="h-4 w-4 mr-1" /> Back to Student Portal
    </Button>

    <div className="mt-1">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 dark:bg-muted/40 px-3 py-1 text-[10px] font-medium text-muted-foreground">
    <GraduationCap className="h-3 w-3" /> Powered by <span>Lab44</span>
    </span>
    </div>
    </CardFooter>
    </form>
    </Card>

    <div className="mt-6 text-center">
    <button onClick={() => setView('instructor-login')} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors font-medium">
    Instructor login &rarr;
    </button>
    </div>
    </motion.div>
    </div>
  );
}
