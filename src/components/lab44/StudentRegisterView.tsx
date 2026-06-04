'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { UserPlus, Lock, RefreshCw, ChevronLeft, Mail, CheckCircle, Eye, EyeOff, ShieldCheck, ShieldQuestion } from 'lucide-react';

import { FloatingDecor, fadeSlide } from '@/lib/helpers';

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

export default function StudentRegisterView() {
  const { setView, setAuth, signupEnabled } = useLab44Store();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim().length < 2) { toast.error('First name must be at least 2 characters'); return; }
    if (lastName.trim().length < 2) { toast.error('Last name must be at least 2 characters'); return; }
    if (studentId.trim().length < 2) { toast.error('Student ID must be at least 2 characters'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    // Validate security question/answer pair
    if ((securityQuestion && !securityAnswer.trim()) || (!securityQuestion && securityAnswer.trim())) {
      toast.error('Please provide both a security question and answer, or leave both empty.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          studentId: studentId.trim(),
          password,
          securityQuestion: securityQuestion || undefined,
          securityAnswer: securityAnswer.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Registration failed'); setLoading(false); return; }

      toast.success('Account created successfully!');
      setAuth({ role: null, student: null });
      setCreated(true);
      useLab44Store.getState().setViewSilent('student-register');
    } catch {
      toast.error('Connection error');
    }
    setLoading(false);
  };

  if (created) {
    return (
      <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/20">
        <FloatingDecor />
        <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
          <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
            <CardHeader className="text-center space-y-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
              >
                <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <CardTitle className="text-xl">Your Account Has Been Created Successfully</CardTitle>
              <CardDescription className="mt-2">Go to Login to access your account with your Student ID and password.</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button onClick={() => setView('student-login')} className="w-full">
                <ChevronLeft className="h-4 w-4 mr-1" /> Go to Login
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!signupEnabled) {
    return (
    <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/20">
        <FloatingDecor />
        <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
          <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
            <CardHeader className="text-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
              >
                <Lock className="h-10 w-10 text-amber-500" />
              </motion.div>
              <CardTitle className="text-xl">Registration Closed</CardTitle>
              <CardDescription className="mt-2">Student registration is currently disabled.</CardDescription>
              <p className="text-sm text-muted-foreground mt-3 flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" /> Please contact your instructor for access.
              </p>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button variant="outline" onClick={() => setView('student-login')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Login
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/20">
      <FloatingDecor />
      <motion.div {...fadeSlide} className="w-full max-w-md relative z-10">
        <Card className="shadow-lg transition-shadow duration-300 hover:shadow-xl">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-xl">Create Account</CardTitle>
            <CardDescription>Register as a new student in the lab portal</CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
            {/*First Name*/}
            <div className="space-y-2">
            <Label htmlFor="rfn">First Name</Label>
            <Input
            id="rfn"
            placeholder="BAHLOUL"
            value={firstName}
            onChange={(e) => {
              // You Can use only aplphabet
              const alphaOnly = e.target.value.replace(/[^a-zA-Z]/g, '');
              setFirstName(alphaOnly.toUpperCase());
            }}
            title="Only alphabetic characters are allowed"
            />
            </div>

            {/*Last Name*/}
            <div className="space-y-2">
            <Label htmlFor="rln">Last Name</Label>
            <Input
            id="rln"
            placeholder="Chouaib"
            value={lastName}
            onChange={(e) => {
              // Remove numbers , only use Alphabet
              let val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
              // First character to majuscule
              val = val
              .split(/\s+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
              setLastName(val);
            }}
            title="Only alphabetic characters are allowed"
            />
            </div>


              <div className="space-y-2">
              <Label htmlFor="rsid">Student ID</Label>
              <Input
              id="rsid"
              placeholder="202X31XXXXXX"
              value={studentId}
              onChange={(e) => {
                // السماح بالأرقام فقط (0-9)
                const numericValue = e.target.value.replace(/\D/g, '');
                setStudentId(numericValue);
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              title="Please enter numbers only"
              />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="rpw" className="flex items-center gap-1.5">
                   Password
                </Label>
                <div className="relative">
                  <Input
                    id="rpw"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {/* Password strength indicator */}
                {password && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: strength.width }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${strength.color}`}
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

              {/* Confirm Password field */}
              <div className="space-y-2">
                <Label htmlFor="rcpw" className="flex items-center gap-1.5">
                   Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="rcpw"
                    type={showConfirmPw ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pr-10 ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-400 dark:border-red-500 focus-visible:ring-red-400'
                        : confirmPassword && confirmPassword === password
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
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-[11px] text-red-500 font-medium">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === password && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>

                )}
              </div>

                <div className="space-y-3">
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <> Create Account</>}
              </Button>
              <Button variant="ghost" onClick={() => setView('student-login')} className="w-full">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
