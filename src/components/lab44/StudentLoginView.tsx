'use client';

import React, { useState, useEffect } from 'react';
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

import { GraduationCap, LogIn, RefreshCw, Users, AlertCircle, Eye, EyeOff, Lock, KeyRound } from 'lucide-react';

import { FloatingDecor, fadeSlide } from '@/lib/helpers';
import PasswordResetDialog from '@/components/lab44/PasswordResetDialog';

export default function StudentLoginView() {
  const { setView, setAuth, setStudents, setColumns, setGrades, setAttendance, setStudentLabs, signupEnabled, setSignupEnabled } = useLab44Store();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, studentsRes] = await Promise.all([fetch('/api/settings'), fetch('/api/students')]);
        const settingsData = await settingsRes.json();
        setSignupEnabled(settingsData.signup_enabled !== 'false');
        const studentsData = await studentsRes.json();
        setTotalStudents(Array.isArray(studentsData) ? studentsData.length : null);
      } catch { /* ignore */ }
      setCheckingSettings(false);
    })();
  }, [setSignupEnabled]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (studentId.trim().length < 2) {
      toast.error('Student ID must be at least 2 characters');
      return;
    }

    if (!password) {
      toast.error('Password is required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { studentId: studentId.trim(), password };

      const res = await fetchWithTimeout('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        const errMsg = data.error || 'Student not found';
        setLoginError(errMsg);
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      setAuth({ role: 'student', student: data.student });

      const dataRes = await fetchWithTimeout('/api/data');
      const allData = await dataRes.json();
      setStudents(allData.students || []);
      setColumns(allData.columns || []);
      setGrades(allData.grades || []);
      setAttendance(allData.attendance || []);
      setStudentLabs(allData.studentLabs || []);

      // Track login date for study streak
      try {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem('lab44-login-dates');
        const dates: string[] = stored ? JSON.parse(stored) : [];
        if (dates[dates.length - 1] !== today) {
          dates.push(today);
          localStorage.setItem('lab44-login-dates', JSON.stringify(dates));
        }
      } catch { /* ignore */ }

      toast.success(`Welcome, ${data.student.firstName}!`);
      setView('student-choice');
    } catch {
      setLoginError('Connection error');
      toast.error('Connection error');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-6 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/20 overflow-y-auto">
      <FloatingDecor />
      <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
        <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
          <CardHeader className="text-center space-y-0.5 relative z-10 pb-2">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <CardTitle className="text-lg">Student Login</CardTitle>
            <CardDescription className="text-xs">Enter your credentials to access the lab portal</CardDescription>
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
                <Label htmlFor="sid">Student ID</Label>
                <Input id="sid" placeholder="20240001" value={studentId} onChange={(e) => { setStudentId(e.target.value); setLoginError(''); }} autoComplete="username" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spw">Password</Label>
                <div className="relative">
                  <Input
                    id="spw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
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
                {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : <><LogIn className="h-4 w-4 mr-2" /> Sign In</>}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center flex items-center gap-1 justify-center">
                <KeyRound className="h-3 w-3" /> Forgot your password? Contact Your Instructor{' '}

              </p>
              {!checkingSettings && signupEnabled && (
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => setView('student-register')} className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                    Register here
                  </button>
                </p>
              )}
              {!checkingSettings && !signupEnabled && (
                <p className="text-sm text-muted-foreground text-center">
                  Registration is currently closed.
                </p>
              )}
              {!checkingSettings && totalStudents !== null && (
                <p className="text-xs text-muted-foreground text-center">
                  <Users className="h-3 w-3 inline mr-1" />{totalStudents} student{totalStudents !== 1 ? 's' : ''} registered
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
        <div className="mt-6 text-center flex items-center justify-center gap-4">
          <button onClick={() => setView('admin-login')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Admin access &rarr;
          </button>
          <span className="text-muted-foreground/30">|</span>
          <button onClick={() => setView('instructor-login')} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors font-medium">
            Instructor login &rarr;
          </button>
        </div>

      </motion.div>


    </div>
  );
}
