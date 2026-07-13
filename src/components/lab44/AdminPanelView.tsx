'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Student, Instructor, VMRequest } from '@/types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

import {
  Settings, Clock, RefreshCw, Server, CheckCircle2, XCircle, Trash2,
  Users, AlertTriangle, Monitor, UserPlus,
  BarChart3, CalendarCheck, FileText, Download, ShieldCheck, Eye,
  ArrowRightLeft, KeyRound,
} from 'lucide-react';

import AdminResetPasswordDialog from '@/components/lab44/admin/AdminResetPasswordDialog';

import { fadeSlide, vmStatusBadge, fmtDateTime, timeAgo, BreadcrumbNav, getInitials, getAvatarColor } from '@/lib/helpers';

export default function AdminPanelView() {
  const { vmRequests, setVmRequests, setView, students, setStudents, labs, setLabs, instructors, setInstructors, setAuth } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [vmFilter, setVmFilter] = useState<string>('all');
  const [approveNote, setApproveNote] = useState('');
  const [approveIp, setApproveIp] = useState('');
  const [approveProtocol, setApproveProtocol] = useState('SSH');
  const [rejectNote, setRejectNote] = useState('');
  const [approveDialogReq, setApproveDialogReq] = useState<VMRequest | null>(null);
  const [rejectDialogReq, setRejectDialogReq] = useState<VMRequest | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<{ userId: number; userRole: 'student' | 'instructor'; name: string } | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [userFilter, setUserFilter] = useState<string>('');
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [resetPwTarget, setResetPwTarget] = useState<{ userId: number; userRole: 'student' | 'instructor'; userName: string } | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ userId: number; userRole: 'student' | 'instructor'; userName: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [vmRes, dataRes, labsRes, instructorsRes] = await Promise.all([
        fetch('/api/vm-requests'),
                                                                          fetch('/api/data'),
                                                                          fetch('/api/labs'),
                                                                          fetch('/api/instructors'),
      ]);
      const vmData = await vmRes.json();
      const data = await dataRes.json();
      const labsData = await labsRes.json();
      const instructorsData = await instructorsRes.json();
      setVmRequests(vmData.requests || []);
      setStudents(data.students || []);
      if (labsData.labs) setLabs(labsData.labs);
      if (Array.isArray(instructorsData)) setInstructors(instructorsData);
      else if (instructorsData.instructors) setInstructors(instructorsData.instructors);
    } catch { toast.error('Failed to load data'); }
    setLoading(false);
  }, [setVmRequests, setStudents, setLabs, setInstructors]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleApproveVM = async () => {
    if (!approveDialogReq) return;
    try {
      const res = await fetch(`/api/vm-requests/${approveDialogReq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', note: approveNote || null, vmIp: approveIp || null, accessProtocol: approveProtocol })
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to approve'); return; }
      toast.success('VM request approved');
      setApproveDialogReq(null);
      setApproveNote('');
      setApproveIp('');
      loadAll();
    } catch { toast.error('Connection error'); }
  };

  const handleRejectVM = async () => {
    if (!rejectDialogReq) return;
    try {
      const res = await fetch(`/api/vm-requests/${rejectDialogReq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', note: rejectNote || null })
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to reject'); return; }
      toast.success('VM request rejected');
      setRejectDialogReq(null);
      setRejectNote('');
      loadAll();
    } catch { toast.error('Connection error'); }
  };

  const handleDeleteVMRequest = async (id: number) => {
    try {
      const res = await fetch(`/api/vm-requests/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete'); return; }
      toast.success('Request deleted');
      loadAll();
    } catch { toast.error('Connection error'); }
  };

  const handleClearAllVMs = async () => {
    try {
      const res = await fetch('/api/vm-requests?all=true', { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed'); return; }
      toast.success('All VM requests cleared');
      loadAll();
    } catch { toast.error('Connection error'); }
  };

  const filteredVmRequests = useMemo(() => vmRequests.filter(r => vmFilter === 'all' ? true : r.status === vmFilter), [vmRequests, vmFilter]);
  const pendingVmCount = useMemo(() => vmRequests.filter(r => r.status === 'pending').length, [vmRequests]);
  const approvedVmCount = useMemo(() => vmRequests.filter(r => r.status === 'approved').length, [vmRequests]);
  const rejectedVmCount = useMemo(() => vmRequests.filter(r => r.status === 'rejected').length, [vmRequests]);

  const handleImpersonate = async () => {
    if (!impersonateTarget) return;
    setImpersonating(true);
    try {
      const res = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: impersonateTarget.userId, userRole: impersonateTarget.userRole }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || 'Failed to impersonate');
        setImpersonating(false);
        return;
      }
      if (data.role === 'student') {
        setAuth({
          role: 'student',
          student: data.user,
          instructor: null,
          isImpersonating: true,
          originalRole: 'admin',
          originalUserId: 0,
        });
        setView('student-choice');
      } else if (data.role === 'instructor') {
        setAuth({
          role: 'instructor',
          student: null,
          instructor: data.user,
          isImpersonating: true,
          originalRole: 'admin',
          originalUserId: 0,
        });
        setView('instructor-panel');
      }
      toast.success(`Now viewing as ${impersonateTarget.name}`);
      setImpersonateTarget(null);
    } catch {
      toast.error('Connection error');
    } finally {
      setImpersonating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      const endpoint = deleteUserTarget.userRole === 'student' ? 'students' : 'instructors';
      const res = await fetch(`/api/${endpoint}/${deleteUserTarget.userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || `Failed to delete ${deleteUserTarget.userRole}`);
        setDeletingUser(false);
        return;
      }
      toast.success(`${deleteUserTarget.userName} has been deleted`);
      setDeleteUserTarget(null);
      loadAll();
    } catch {
      toast.error('Connection error');
    }
    setDeletingUser(false);
  };

  const filteredStudents = useMemo(() => {
    if (!userFilter) return students;
    const q = userFilter.toLowerCase();
    return students.filter(s =>
    s.firstName.toLowerCase().includes(q) ||
    s.lastName.toLowerCase().includes(q) ||
    s.studentId.toLowerCase().includes(q)
    );
  }, [students, userFilter]);

  const filteredInstructors = useMemo(() => {
    if (!userFilter) return instructors;
    const q = userFilter.toLowerCase();
    return instructors.filter(i =>
    i.displayName.toLowerCase().includes(q) ||
    i.username.toLowerCase().includes(q)
    );
  }, [instructors, userFilter]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
    <BreadcrumbNav items={[{ label: 'Admin Dashboard' }]} />
    <div className="mb-6">
      <h1 className="text-lg font-semibold">System Overview</h1>
      <p className="text-sm text-muted-foreground">Manage students, instructors, and VM requests</p>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-2xl font-semibold">{students.length}</p>
        <p className="text-xs text-muted-foreground mt-1">Students</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-2xl font-semibold">{instructors.length}</p>
        <p className="text-xs text-muted-foreground mt-1">Instructors</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-2xl font-semibold">{approvedVmCount}</p>
        <p className="text-xs text-muted-foreground mt-1">Active VMs</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-2xl font-semibold">{pendingVmCount}</p>
        <p className="text-xs text-muted-foreground mt-1">Pending</p>
      </div>
    </div>

    {/* ─── Two-Column: Users + VM Requests ────────────────────────────── */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

    {/* Users Section */}
    <Card className="shadow-sm">
    <CardHeader className="pb-3">
    <CardTitle className="text-base">Users
    <Badge variant="secondary" className="ml-2 h-5 text-[10px] px-1.5 align-middle">{students.length + instructors.length}</Badge>
    </CardTitle>
    <div className="mt-2">
    <Input
    placeholder="Search students or instructors..."
    value={userFilter}
    onChange={(e) => setUserFilter(e.target.value)}
    className="h-8 text-sm"
    />
    </div>
    </CardHeader>
    <CardContent className="p-0">
    {filteredInstructors.length > 0 && (
      <>
      <div className="px-4 py-2 border-b border-border/50 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instructors ({filteredInstructors.length})</p>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
      <div className="space-y-1 p-2">
      {filteredInstructors.map((i) => {
        const nameParts = i.displayName.trim().split(/\s+/);
        const initials = getInitials(nameParts[0] || '', nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
        const avatarBg = getAvatarColor(i.displayName);
        return (
          <div key={i.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${avatarBg}`}>
          {initials}
          </div>
          <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{i.displayName}</p>
          <p className="text-xs text-muted-foreground font-mono">{i.username}</p>
          </div>
          {i.labIds && i.labIds.length > 1 ? (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
            {i.labIds.length} labs
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
            {i.labName || '—'}
            </Badge>
          )}
          <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30" onClick={() => setImpersonateTarget({ userId: i.id, userRole: 'instructor', name: i.displayName })} title="Impersonate">
          <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" onClick={() => setResetPwTarget({ userId: i.id, userRole: 'instructor', userName: i.displayName })} title="Reset Password">
          <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" onClick={() => setDeleteUserTarget({ userId: i.id, userRole: 'instructor', userName: i.displayName })} title="Delete Instructor">
          <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </div>
          </div>
        );
      })}
      </div>
      </div>
      </>
    )}

    {filteredStudents.length > 0 && (
      <>
      <div className="px-4 py-2 border-b border-border/50 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Students ({filteredStudents.length})</p>
      </div>
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
      <div className="space-y-1 p-2">
      {filteredStudents.map((s) => {
        const fullName = `${s.firstName} ${s.lastName}`;
        const initials = getInitials(s.firstName, s.lastName);
        const avatarBg = getAvatarColor(fullName);
        return (
          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${avatarBg}`}>
          {initials}
          </div>
          <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground font-mono">{s.studentId}</p>
          </div>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
          {s.labIds?.length || 0} lab{s.labIds?.length !== 1 ? 's' : ''}
          </Badge>
          <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30" onClick={() => setImpersonateTarget({ userId: s.id, userRole: 'student', name: fullName })} title="Impersonate">
          <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" onClick={() => setResetPwTarget({ userId: s.id, userRole: 'student', userName: fullName })} title="Reset Password">
          <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" onClick={() => setDeleteUserTarget({ userId: s.id, userRole: 'student', userName: fullName })} title="Delete Student">
          <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </div>
          </div>
        );
      })}
      </div>
      </div>
      </>
    )}



    {filteredStudents.length === 0 && filteredInstructors.length === 0 && (
      <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">No users found</p>
      </div>
    )}
    </CardContent>
    </Card>

    {/* VM Requests Section */}
    <Card className="shadow-sm">
    <CardHeader className="pb-3">
    <CardTitle className="text-base">VM Requests
    {pendingVmCount > 0 && (
      <Badge className="ml-2 bg-amber-500 text-white border-amber-500 h-5 text-[10px] px-1.5 animate-pulse align-middle">{pendingVmCount} pending</Badge>
    )}
    </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
    <div className="flex items-center gap-2 p-4 border-b border-border/50">
    <Select value={vmFilter} onValueChange={setVmFilter}>
    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
    <SelectContent>
    <SelectItem value="all">All Status</SelectItem>
    <SelectItem value="pending">Pending</SelectItem>
    <SelectItem value="approved">Approved</SelectItem>
    <SelectItem value="rejected">Rejected</SelectItem>
    </SelectContent>
    </Select>
    <AlertDialog>
    <AlertDialogTrigger asChild>
    <Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
    <AlertDialogHeader>
    <AlertDialogTitle>Clear All VM Requests</AlertDialogTitle>
    <AlertDialogDescription>This will permanently delete all VM requests. This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction onClick={handleClearAllVMs}>Delete All</AlertDialogAction>
    </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>
    </div>

    {filteredVmRequests.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 text-center">
      <Server className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="font-semibold mb-1">No VM Requests</h3>
      <p className="text-sm text-muted-foreground">{vmFilter !== 'all' ? 'No requests match the selected filter.' : 'No VM requests have been submitted yet.'}</p>
      </div>
    ) : (
      <ScrollArea className="max-h-[400px]">
      <Table>
      <TableHeader>
      <TableRow className="bg-muted/50">
      <TableHead className="pl-4">Student</TableHead>
      <TableHead>Template</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>IP</TableHead>
      <TableHead className="pr-4">Actions</TableHead>
      </TableRow>
      </TableHeader>
      <TableBody>
      {filteredVmRequests.map((req, idx) => (
        <TableRow key={req.id} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
        <TableCell className="pl-4">
        <div className="flex items-center gap-2 min-w-0">
        {req.status === 'pending' && (
          <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
        <div className="min-w-0">
        <p className="font-medium text-sm truncate">{req.studentName}</p>
        <p className="text-xs text-muted-foreground font-mono">{req.studentId}</p>
        </div>
        </div>
        </TableCell>
        <TableCell className="text-sm">{req.templateName || '—'}</TableCell>
        <TableCell>{vmStatusBadge(req.status)}</TableCell>
        <TableCell className="font-mono text-sm">{req.vmIp || '—'}</TableCell>
        <TableCell className="pr-4">
        <div className="flex items-center gap-1">
        {req.status === 'pending' && (
          <>
          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => { setApproveDialogReq(req); setApproveNote(''); setApproveIp(''); setApproveProtocol('SSH'); }}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => { setRejectDialogReq(req); setRejectNote(''); }}>
          <XCircle className="h-3 w-3 mr-1" /> Reject
          </Button>
          </>
        )}
        <AlertDialog>
        <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600">
        <Trash2 className="h-3 w-3" />
        </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
        <AlertDialogHeader>
        <AlertDialogTitle>Delete Request</AlertDialogTitle>
        <AlertDialogDescription>Delete this VM request? This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={() => handleDeleteVMRequest(req.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
        </div>
        </TableCell>
        </TableRow>
      ))}
      </TableBody>
      </Table>
      </ScrollArea>
    )}
    </CardContent>
    </Card>

    </div>

    {/* Dialogs */}
    <AlertDialog open={deleteUserTarget !== null} onOpenChange={(open) => { if (!open) setDeleteUserTarget(null); }}>
    <AlertDialogContent>
    <AlertDialogHeader>
    <AlertDialogTitle>Delete {deleteUserTarget?.userRole}?</AlertDialogTitle>
    <AlertDialogDescription>
    Are you sure you want to permanently delete <strong>{deleteUserTarget?.userName}</strong>? This action cannot be undone and all associated data will be removed.
    </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
    <AlertDialogCancel onClick={() => setDeleteUserTarget(null)}>Cancel</AlertDialogCancel>
    <AlertDialogAction onClick={handleDeleteUser} disabled={deletingUser} className="bg-red-600 hover:bg-red-700">
    {deletingUser ? 'Deleting...' : 'Delete'}
    </AlertDialogAction>
    </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={impersonateTarget !== null} onOpenChange={(open) => { if (!open) setImpersonateTarget(null); }}>
    <AlertDialogContent>
    <AlertDialogHeader>
    <AlertDialogTitle>Log in as {impersonateTarget?.name}?</AlertDialogTitle>
    <AlertDialogDescription>
    You will see the app as this {impersonateTarget?.userRole}. A banner will appear at the top allowing you to exit impersonation at any time. This action will be logged.
    </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
    <AlertDialogCancel onClick={() => setImpersonateTarget(null)}>Cancel</AlertDialogCancel>
    <AlertDialogAction onClick={handleImpersonate} disabled={impersonating} className="bg-amber-600 hover:bg-amber-700">
    {impersonating ? 'Switching...' : 'Impersonate'}
    </AlertDialogAction>
    </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>

    <Dialog open={approveDialogReq !== null} onOpenChange={(open) => { if (!open) setApproveDialogReq(null); }}>
    <DialogContent>
    <DialogHeader>
    <DialogTitle>Approve VM Request</DialogTitle>
    <DialogDescription>Approve VM for <strong>{approveDialogReq?.studentName}</strong> ({approveDialogReq?.templateName})</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
    <div className="space-y-1.5"><Label className="text-xs">VM IP Address</Label><Input value={approveIp} onChange={(e) => setApproveIp(e.target.value)} placeholder="e.g. 192.168.1.100" /></div>
    <div className="space-y-1.5">
    <Label className="text-xs">Access Protocol</Label>
    <Select value={approveProtocol} onValueChange={setApproveProtocol}>
    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent>
    <SelectItem value="SSH">SSH</SelectItem>
    <SelectItem value="RDP">RDP</SelectItem>
    <SelectItem value="VNC">VNC</SelectItem>
    </SelectContent>
    </Select>
    </div>
    <div className="space-y-1.5"><Label className="text-xs">Note (optional)</Label><Textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Any additional info for the student..." rows={2} /></div>
    </div>
    <DialogFooter>
    <Button variant="outline" onClick={() => setApproveDialogReq(null)}>Cancel</Button>
    <Button variant="default" onClick={handleApproveVM}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
    </DialogFooter>
    </DialogContent>
    </Dialog>

    <Dialog open={rejectDialogReq !== null} onOpenChange={(open) => { if (!open) setRejectDialogReq(null); }}>
    <DialogContent>
    <DialogHeader>
    <DialogTitle>Reject VM Request</DialogTitle>
    <DialogDescription>Reject VM for <strong>{rejectDialogReq?.studentName}</strong> ({rejectDialogReq?.templateName})</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
    <div className="space-y-1.5"><Label className="text-xs">Reason / Note</Label><Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Provide a reason for rejection..." rows={3} /></div>
    </div>
    <DialogFooter>
    <Button variant="outline" onClick={() => setRejectDialogReq(null)}>Cancel</Button>
    <Button variant="destructive" onClick={handleRejectVM}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
    </DialogFooter>
    </DialogContent>
    </Dialog>

    {resetPwTarget && (
      <AdminResetPasswordDialog
      open={resetPwTarget !== null}
      onOpenChange={(open) => { if (!open) setResetPwTarget(null); }}
      userId={resetPwTarget.userId}
      userRole={resetPwTarget.userRole}
      userName={resetPwTarget.userName}
      />
    )}
    </motion.div>
  );
}
