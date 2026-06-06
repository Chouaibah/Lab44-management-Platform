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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  GraduationCap,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  BookOpen,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

import { FloatingDecor, fadeSlide } from '@/lib/helpers';

export default function InstructorLoginView() {
  const { setView, setAuth } = useLab44Store();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim()) { toast.error('Username is required'); return; }
    if (!password) { toast.error('Password is required'); return; }

    setLoading(true);
    try {
      const res = await fetchWithTimeout('/api/auth/instructor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!data.ok) {
        const errMsg = data.error || 'Invalid credentials';
        setLoginError(errMsg);
        toast.error(errMsg);
        setLoading(false);
        return;
      }

      setAuth({ role: 'instructor', student: null, instructor: data.instructor });

      toast.success(`Welcome, ${data.instructor.displayName}!`);
      setView('instructor-panel');
    } catch {
      setLoginError('Connection error');
      toast.error('Connection error');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-6 bg-gradient-to-br from-gray-50 via-white to-amber-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-amber-950/20 overflow-y-auto">
    <FloatingDecor />
    <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
    <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
    <CardHeader className="text-center space-y-0.5 relative z-10 pb-2">
    <motion.div
    animate={{ rotate: [0, 5, -5, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    >
    <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
    </motion.div>
    <CardTitle className="text-lg">Instructor Login</CardTitle>
    <CardDescription className="text-xs">Enter your credentials to manage your lab</CardDescription>
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
    <Label htmlFor="iuser">Username</Label>
    <Input
    id="iuser"
    placeholder="Enter your username"
    value={username}
    onChange={(e) => { setUsername(e.target.value); setLoginError(''); }}
    autoComplete="username"
    />
    </div>

    <div className="space-y-2">
    <Label htmlFor="ipw">Password</Label>
    <div className="relative">
    <Input
    id="ipw"
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

    <CardFooter className="flex-col gap-3 pt-1">
    <Button type="submit" variant="default" className="w-full" disabled={loading}>
    {loading ? (
      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Authenticating...</>
    ) : (
      <><Lock className="h-4 w-4 mr-2" /> Sign In</>
    )}
    </Button>

    <p className="text-[11px] text-muted-foreground text-center flex items-center gap-1 justify-center">
    <KeyRound className="h-3 w-3" /> Forgot your password? Contact The Administrator

    </p>

    <Button variant="ghost" onClick={() => setView('student-login')} className="w-full text-muted-foreground hover:text-foreground">
    <ChevronLeft className="h-4 w-4 mr-1" /> Back to Student Portal
    </Button>
    </CardFooter>
    </form>
    </Card>

    <div className="mt-6 text-center">
    <button onClick={() => setView('admin-login')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
    Admin access &rarr;
    </button>
    </div>
    </motion.div>

    </div>
  );
}
