'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Database, ChevronLeft, Download, Upload, Lock, Shield,
  AlertTriangle, Loader2, Eye, EyeOff, KeyRound, FileArchive,
  CheckCircle2, Info,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav } from '@/lib/helpers';

// ─── Component ──────────────────────────────────────────────────────────────

export default function BackupView() {
  const { setView } = useLab44Store();

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPw, setExportConfirmPw] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showExportPw, setShowExportPw] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [showImportPw, setShowImportPw] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Confirm dialogs
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  // ─── Export handler ────────────────────────────────────────────────

  const handleExport = async () => {
    if (!exportPassword || exportPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (exportPassword !== exportConfirmPw) {
      toast.error('Passwords do not match');
      return;
    }

    setExporting(true);
    try {
      const res = await fetch('/api/admin/backups/encrypted-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: exportPassword }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Export failed' }));
        toast.error(errData.error || 'Failed to create backup');
        setExporting(false);
        return;
      }

      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `lab44-backup-${dateStr}.lab44`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Encrypted backup created and downloaded successfully');
      setExportPassword('');
      setExportConfirmPw('');
      setExportConfirmOpen(false);
    } catch {
      toast.error('Failed to create backup');
    }
    setExporting(false);
  };

  // ─── Import handler ────────────────────────────────────────────────

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a backup file');
      return;
    }
    if (!importPassword || importPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportStatus('Uploading backup file...');

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('password', importPassword);

      setImportProgress(20);
      setImportStatus('Decrypting and validating...');

      const res = await fetch('/api/admin/backups/encrypted-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Failed to restore backup');
        setImporting(false);
        setImportProgress(0);
        return;
      }

      // Animate progress
      const steps = [
        'Importing labs...',
        'Importing instructors...',
        'Importing students...',
        'Importing grades...',
        'Importing attendance...',
        'Importing announcements...',
        'Finalizing...',
      ];
      for (let i = 0; i < steps.length; i++) {
        setImportStatus(steps[i]);
        setImportProgress(30 + Math.round(((i + 1) / steps.length) * 70));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      toast.success('Backup restored successfully! Page will reload.');
      setImportConfirmOpen(false);
      setImportFile(null);
      setImportPassword('');

      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to restore backup');
    }
    setImporting(false);
  };

  // ─── File drag & drop ──────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.lab44') && !file.name.endsWith('.zip')) {
      toast.error('Please upload a .lab44 backup file');
      return;
    }
    setImportFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
  };

  // ─── Password strength ──────────────────────────────────────────────

  const getPasswordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 4) score++;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;

    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: 'text-red-500' },
      { score: 2, label: 'Fair', color: 'text-amber-500' },
      { score: 3, label: 'Good', color: 'text-amber-600' },
      { score: 4, label: 'Strong', color: 'text-emerald-600 dark:text-emerald-400' },
      { score: 5, label: 'Very strong', color: 'text-emerald-600 dark:text-emerald-400' },
    ];
    return levels[score] || levels[0];
  };

  const pwStrength = getPasswordStrength(exportPassword);

  return (
    <motion.div {...fadeSlide} className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <BreadcrumbNav items={[{ label: 'Admin', view: 'admin-panel' }, { label: 'Backups' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Encrypted Backups
          </h1>
          <p className="text-sm text-muted-foreground">
            Create encrypted backups or restore from a backup file
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setView('admin-panel')}>
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to Panel
        </Button>
      </div>



      {/* ─── What's included ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-muted/50 border border-border/50">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">What&apos;s included in the backup</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['Labs', 'Instructors', 'Students', 'Grade Columns', 'Grades', 'Attendance', 'Announcements', 'Sub-groups', 'Messages', 'Settings'].map(item => (
              <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── Create Backup Card ─────────────────────────────────────── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-500" /> Create Backup
            </CardTitle>
            <CardDescription>Export all data as an encrypted backup file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Encryption Password
              </Label>
              <div className="relative">
                <Input
                  type={showExportPw ? 'text' : 'password'}
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Min. 4 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowExportPw(!showExportPw)}
                >
                  {showExportPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {exportPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= pwStrength.score
                            ? pwStrength.score <= 1 ? 'bg-red-500'
                              : pwStrength.score <= 2 ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-medium ${pwStrength.color}`}>
                    {pwStrength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirm Password</Label>
              <Input
                type="password"
                value={exportConfirmPw}
                onChange={(e) => setExportConfirmPw(e.target.value)}
                placeholder="Confirm encryption password"
              />
              {exportConfirmPw && exportPassword !== exportConfirmPw && (
                <p className="text-[10px] text-red-500">Passwords do not match</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-1.5">
                <FileArchive className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Output format</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Encrypted ZIP archive (<code className="font-mono bg-muted px-1 rounded">.lab44</code>) containing AES-256-GCM encrypted data with PBKDF2 key derivation.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={!exportPassword || exportPassword.length < 4 || exportPassword !== exportConfirmPw || exporting}
              onClick={() => setExportConfirmOpen(true)}
            >
              {exporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Backup...</>
              ) : (
                <><Lock className="h-4 w-4 mr-2" /> Create Encrypted Backup</>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* ─── Restore Backup Card ────────────────────────────────────── */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-500" /> Restore Backup
            </CardTitle>
            <CardDescription>Upload an encrypted backup to restore data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File upload area */}
            <div
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 transition-all duration-200 cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5 scale-[1.02]' :
                importFile ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20' :
                'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.getElementById('import-backup-input');
                if (input) input.click();
              }}
            >
              <input
                id="import-backup-input"
                type="file"
                accept=".lab44,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              {importFile ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <Upload className={`h-8 w-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'} transition-colors`} />
                  <p className={`text-sm font-medium ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isDragging ? 'Drop your file here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">.lab44 encrypted backup file</p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Decryption Password
              </Label>
              <div className="relative">
                <Input
                  type={showImportPw ? 'text' : 'password'}
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter backup password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowImportPw(!showImportPw)}
                >
                  {showImportPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Warning</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Restoring will merge data from the backup into the current database. Existing records won&apos;t be deleted. This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {importing && (
              <div className="space-y-2">
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{importStatus}</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
              disabled={!importFile || !importPassword || importPassword.length < 4 || importing}
              onClick={() => setImportConfirmOpen(true)}
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restoring...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Restore from Backup</>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ─── Export Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" /> Create Encrypted Backup
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will create a full encrypted backup of all your data including students, grades, attendance, announcements, and settings.
              </span>
              <span className="block text-amber-600 dark:text-amber-400 font-medium">
                Remember your password! It cannot be recovered and you will need it to restore the backup.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport} disabled={exporting} className="bg-emerald-600 hover:bg-emerald-700">
              {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : <><Lock className="h-4 w-4 mr-2" /> Create Backup</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Import Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Restore from Backup
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You are about to restore data from <strong>{importFile?.name}</strong>.
              </span>
              <span className="block">
                This will merge the backup data into your current database. Existing records will not be deleted, but new records from the backup will be added.
              </span>
              <span className="block text-amber-600 dark:text-amber-400 font-medium">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importing} className="bg-amber-600 hover:bg-amber-700">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restoring...</> : <><Upload className="h-4 w-4 mr-2" /> Restore Backup</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
