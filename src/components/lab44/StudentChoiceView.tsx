'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { AppView, ResourceLink, SousGroupe } from '@/types';
import { SessionLiveCard } from '@/components/lab44/SessionLiveCard';

import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  BarChart3, Monitor, CalendarCheck, ArrowRight, Megaphone,
  CheckCircle2, Sun, Moon, Clock,
  FlaskConical, Plus, Lock, Loader2,
  X, Users,
  Link2, FileText, BookOpen, Wrench, Library, Video, ExternalLink,
  Download, File, ClipboardCheck, RefreshCw,
} from 'lucide-react';

import {
  fadeSlide, fmtDate,
  timeAgo, StudentAvatar, BreadcrumbNav,
} from '@/lib/helpers';


// ─── Student Groups Section ────────────────────────────────────────────────────

function StudentGroupsSection({ studentId, labIds }: { studentId?: number; labIds: number[] }) {
  const [groups, setGroups] = useState<SousGroupe[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number | null>(null);

  const loadGroups = async () => {
    try {
      // Fetch once using the first labId — the API returns all groups the student
      // is eligible to see. No loop needed, avoids duplicates from multiple fetches.
      if (!labIds.length) { setLoading(false); return; }
      const res = await fetch(`/api/sous-groupes?labId=${labIds[0]}`);
      const data = await res.json();
      if (data.sousGroupes && Array.isArray(data.sousGroupes)) {
        // Deduplicate by id just in case
        const seen = new Set<number>();
        const unique = (data.sousGroupes as SousGroupe[]).filter(g => {
          if (seen.has(g.id)) return false;
          seen.add(g.id);
          return true;
        });
        setGroups(unique);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, [labIds.length]);

  const myGroup = studentId ? groups.find(g => g.members.some(m => m.studentId === studentId)) : null;

  const handleJoin = async (groupId: number) => {
    if (!studentId) return;
    setJoining(groupId);
    try {
      const res = await fetch(`/api/sous-groupes/${groupId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.existingGroup) {
          toast.error(data.error || 'You are already in a group for this lab');
        } else {
          toast.error(data.error || 'Failed to join group');
        }
        setJoining(null);
        return;
      }
      toast.success('Joined group successfully!');
      await loadGroups();
    } catch {
      toast.error('Connection error');
    }
    setJoining(null);
  };



  if (loading) return <Skeleton className="h-24 rounded-xl mb-8" />;
  if (groups.length === 0) return null;

  return (
    <motion.div {...fadeSlide} transition={{ delay: 0.05 }} className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> My Groups
        </h3>
        {myGroup && (
          <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            Joined
          </Badge>
        )}
      </div>
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-2">
            {groups.map(group => {
              const isMember = studentId ? group.members.some(m => m.studentId === studentId) : false;
              const memberCount = group.members.length;
              return (
                <div key={group.id} className={`flex items-center justify-between p-3 rounded-lg ${isMember ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-muted/30 hover:bg-muted/50 transition-colors'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isMember ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-violet-100 dark:bg-violet-900/30'}`}>
                      <Users className={`h-4 w-4 ${isMember ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
                    </div>
                    {isMember && (
                      <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                        Your group
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isMember ? (
                      <Badge className="text-[9px] px-2 py-0.5 h-6 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Joined
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        onClick={() => handleJoin(group.id)}
                        disabled={!!myGroup || joining === group.id}
                        title={myGroup ? 'You are already in a group' : 'Join this group'}
                      >
                        {joining === group.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {myGroup && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 px-1 flex items-center gap-1">
              <Lock className="h-3 w-3" /> You can only join one group. Contact your instructor to change groups.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Student Choice Dashboard (exported) ──────────────────────────────────────

function getTimeBasedGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: <Sun className="h-3.5 w-3.5" /> };
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', icon: <Sun className="h-3.5 w-3.5" /> };
  if (hour >= 17 && hour < 21) return { text: 'Good evening', icon: <Clock className="h-3.5 w-3.5" /> };
  return { text: 'Good night', icon: <Moon className="h-3.5 w-3.5" /> };
}

// ─── Student Choice Dashboard ─────────────────────────────────────────────────

export default function StudentChoiceView() {
  const { auth, setView, columns, grades, attendance, vmRequests, studentLabs, labs, setStudentLabs, setLabs, resourceLinks, setResourceLinks } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [dataFetchedAt, setDataFetchedAt] = useState<string>('');
  const student = auth.student;
  const greeting = useMemo(() => getTimeBasedGreeting(), []);
  const name = student?.firstName || 'Student';
  const fullName = student ? `${student.firstName} ${student.lastName}` : '';

  // Get student's enrolled lab IDs
  const myLabIds = student ? (studentLabs || []).filter(sl => sl.studentId === student.id).map(sl => sl.labId) : [];

  // Leave Lab state
  const [leaveLabId, setLeaveLabId] = useState<number | null>(null);
  const [leaveLabLoading, setLeaveLabLoading] = useState(false);

  // Join Lab dialog state
  const [joinLabOpen, setJoinLabOpen] = useState(false);
  const [joinLabId, setJoinLabId] = useState<number | null>(null);
  const [joinLabPassword, setJoinLabPassword] = useState('');
  const [joinLabLoading, setJoinLabLoading] = useState(false);

  // Attendance session state
  const [attendanceSessionOpen, setAttendanceSessionOpen] = useState(false);
  const [attendanceSessionDate, setAttendanceSessionDate] = useState<string | null>(null);


  // Resource links - fetch for student's enrolled labs
  const [studentResourceLinks, setStudentResourceLinks] = useState<ResourceLink[]>([]);

  // Lab documents - fetch for student's enrolled labs (only visible ones)
  const [studentLabDocuments, setStudentLabDocuments] = useState<Array<{ id: number; title: string; description: string | null; fileType: string | null; filePath: string | null; imageUrl: string | null; imageType: string | null; linkUrl: string | null; linkTitle: string | null; visibleToStudents: boolean; createdAt: string; labId: number }>>([]);

  // Fetch data on mount - labs and studentLabs
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch labs
        const labsRes = await fetch('/api/labs');
        const labsData = await labsRes.json();
        if (Array.isArray(labsData)) setLabs(labsData);

        // Fetch student-lab memberships
        const studentLabsRes = await fetch('/api/data');
        const studentLabsData = await studentLabsRes.json();
        if (studentLabsData.studentLabs) setStudentLabs(studentLabsData.studentLabs);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    
    // Only load if data hasn't been loaded yet
    if (labs.length === 0) {
      loadData();
    }

    // Fetch resource links and documents for student's enrolled labs
    if (student) {
      (async () => {
        try {
          const myLabIds = (studentLabs || []).filter(sl => sl.studentId === student.id).map(sl => sl.labId);
          if (myLabIds.length > 0) {
            const allLinks: ResourceLink[] = [];
            const allDocs: typeof studentLabDocuments = [];
            for (const labId of myLabIds) {
              const [rlRes, docsRes] = await Promise.all([
                fetch(`/api/resource-links?labId=${labId}`),
                fetch(`/api/labs/${labId}/documents`),
              ]);
              const rlData = await rlRes.json();
              const docsData = await docsRes.json();
              if (rlData.links && Array.isArray(rlData.links)) allLinks.push(...rlData.links);
              if (docsData.documents && Array.isArray(docsData.documents)) {
                // API already filters visible docs for students; just push all
                allDocs.push(...docsData.documents);
              }
            }
            setStudentResourceLinks(allLinks);
            setStudentLabDocuments(allDocs);
          }
        } catch { /* ignore */ }
      })();
    }

    // Also fetch attendance session state
    (async () => {
      try {
        const sessionRes = await fetch('/api/attendance/session');
        const sessionData = await sessionRes.json();
        const sessions = sessionData.sessions || [];
        if (sessions.length > 0) {
          setAttendanceSessionOpen(true);
          setAttendanceSessionDate(sessions[0].date);
        }
      } catch { /* ignore */ }
    })();
  }, [labs.length, setLabs, setStudentLabs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setDataFetchedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Labs: cross-reference studentLabs with labs
  const joinedLabs = useMemo(() => {
    const joinedIds = studentLabs.filter(sl => sl.studentId === student?.id).map(sl => sl.labId);
    return labs.filter(lab => joinedIds.includes(lab.id));
  }, [studentLabs, labs, student]);

  const availableLabs = useMemo(() => {
    const joinedIds = studentLabs.filter(sl => sl.studentId === student?.id).map(sl => sl.labId);
    return labs.filter(lab => !joinedIds.includes(lab.id));
  }, [studentLabs, labs, student]);

  // Refresh data after joining a lab
  const refreshData = async () => {
    try {
      const dataRes = await fetch('/api/data');
      const allData = await dataRes.json();
      setStudentLabs(allData.studentLabs || []);
      // Also refresh labs list
      const labsRes = await fetch('/api/labs');
      const labsData = await labsRes.json();
      if (Array.isArray(labsData)) setLabs(labsData);
    } catch { /* ignore */ }
  };

  const handleLeaveLab = async () => {
    if (!leaveLabId || !student) return;
    setLeaveLabLoading(true);
    try {
      const res = await fetch(`/api/labs/${leaveLabId}?studentId=${student.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to leave lab');
        setLeaveLabLoading(false);
        return;
      }
      toast.success('Left lab successfully!');
      setLeaveLabId(null);
      await refreshData();
    } catch {
      toast.error('Connection error');
    }
    setLeaveLabLoading(false);
  };

  const handleJoinLab = async () => {
    if (!joinLabId || !student) return;
    const selectedLab = labs.find(l => l.id === joinLabId);
    if (!selectedLab) return;

    if (selectedLab.hasPassword && !joinLabPassword.trim()) {
      toast.error('This lab requires a password');
      return;
    }

    setJoinLabLoading(true);
    try {
      const res = await fetch('/api/labs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId: joinLabId,
          studentId: student.id,
          password: selectedLab.hasPassword ? joinLabPassword.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to join lab');
        setJoinLabLoading(false);
        return;
      }
      toast.success(`Joined "${data.labName || selectedLab.name}" successfully!`);
      setJoinLabOpen(false);
      setJoinLabId(null);
      setJoinLabPassword('');
      await refreshData();
    } catch {
      toast.error('Connection error');
    }
    setJoinLabLoading(false);
  };

  const handleRefreshMaterials = async () => {
    if (!student) return;
    const myLabIds = (studentLabs || []).filter(sl => sl.studentId === student.id).map(sl => sl.labId);
    try {
      const allLinks: ResourceLink[] = [];
      const allDocs: typeof studentLabDocuments = [];
      for (const labId of myLabIds) {
        const [rlRes, docsRes] = await Promise.all([
          fetch(`/api/resource-links?labId=${labId}`),
          fetch(`/api/labs/${labId}/documents`),
        ]);
        const rlData = await rlRes.json();
        const docsData = await docsRes.json();
        if (rlData.links && Array.isArray(rlData.links)) allLinks.push(...rlData.links);
        if (docsData.documents && Array.isArray(docsData.documents)) allDocs.push(...docsData.documents);
      }
      setStudentResourceLinks(allLinks);
      setStudentLabDocuments(allDocs);
    } catch { toast.error('Failed to refresh'); }
  };

  const dashCards = [
    {
      view: 'student-grades' as AppView,
      icon: <BarChart3 className="h-5 w-5" />,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      title: 'My Grades',
      desc: 'View your grades, track progress, and see class statistics',
      count: columns.length > 0 ? `${columns.length} Columns` : undefined,
    },
  {
    view: 'student-vms' as AppView,
    icon: <Monitor className="h-5 w-5" />,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'My VMs',
    desc: 'Request virtual machines, view access details, and manage VMs',
    count: vmRequests.length > 0 ? `${vmRequests.length} VM${vmRequests.length !== 1 ? 's' : ''}` : undefined,
  },
  {
    view: 'student-exams' as AppView,
    icon: <ClipboardCheck className="h-5 w-5" />,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'Exams',
    desc: 'Take exams, view results, and track your performance',
  },

];

if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16 space-y-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <BreadcrumbNav items={[{ label: 'Dashboard' }]} />
      {/* Profile Card with gradient mesh background */}
      {student && (
        <motion.div {...fadeSlide} className="mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-primary/20 blur-[2px] animate-pulse" />
                <StudentAvatar firstName={student.firstName} lastName={student.lastName} size="xl" className="relative" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold truncate cursor-pointer hover:text-primary hover:underline underline-offset-2 transition-colors" onClick={() => setView('student-profile')}>{fullName}</h2>
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" style={{ animationDuration: '2s' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-mono">ID: {student.studentId}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Registered {fmtDate(student.createdAt)}</p>
                <div className="flex items-center gap-3 mt-1">
                  {dataFetchedAt && <p className="text-[10px] text-muted-foreground/70">Last updated {dataFetchedAt}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Attendance Session Live (instructor "Session Live" style) ──── */}
      {attendanceSessionOpen && (
        <motion.div {...fadeSlide} transition={{ delay: 0.01 }}>
          <SessionLiveCard
            date={attendanceSessionDate}
            subtitle={
              <>
                Session open for <span className="font-mono font-medium">{attendanceSessionDate}</span> &mdash; tap to mark
                yourself present
              </>
            }
            onClick={() => setView('student-attendance')}
          />
        </motion.div>
      )}

      {/* My Labs Section */}
      <motion.div {...fadeSlide} transition={{ delay: 0.04 }} className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5" /> My Labs
            {joinedLabs.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 text-[10px] px-1.5">{joinedLabs.length}</Badge>
            )}
          </h3>
          <Dialog open={joinLabOpen} onOpenChange={(open) => {
            setJoinLabOpen(open);
            if (!open) { setJoinLabId(null); setJoinLabPassword(''); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={availableLabs.length === 0}>
                <Plus className="h-3 w-3 mr-1" /> Join a Lab
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" /> Join a Lab
                </DialogTitle>
                <DialogDescription>
                  Select a lab to join. Some labs may require a password.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
                {availableLabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No labs available to join</p>
                ) : (
                  availableLabs.map(lab => (
                    <button
                      key={lab.id}
                      onClick={() => setJoinLabId(joinLabId === lab.id ? null : lab.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        joinLabId === lab.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{lab.name}</p>
                            {lab.level && (
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 shrink-0">
                                {lab.level}
                              </Badge>
                            )}
                          </div>
                          {lab.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{lab.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {lab.hasPassword && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30">
                              <Lock className="h-2.5 w-2.5" /> Password
                            </Badge>
                          )}
                          {lab.studentCount !== undefined && (
                            <span className="text-[10px] text-muted-foreground">{lab.studentCount} student{lab.studentCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {joinLabId !== null && (() => {
                const selectedLab = labs.find(l => l.id === joinLabId);
                return selectedLab?.hasPassword ? (
                  <div className="mt-3 space-y-2">
                    <label htmlFor="join-lab-password" className="text-xs font-medium text-muted-foreground">
                      Lab Password
                    </label>
                    <Input
                      id="join-lab-password"
                      type="password"
                      placeholder="Enter lab password..."
                      value={joinLabPassword}
                      onChange={(e) => setJoinLabPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinLab()}
                      className="text-sm"
                    />
                  </div>
                ) : null;
              })()}
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => { setJoinLabOpen(false); setJoinLabId(null); setJoinLabPassword(''); }}>
                  Cancel
                </Button>
                <Button onClick={handleJoinLab} disabled={joinLabId === null || joinLabLoading}>
                  {joinLabLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Joining...</>
                  ) : (
                    'Join Lab'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {joinedLabs.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-8 text-center">
              <FlaskConical className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You haven&apos;t joined any labs yet</p>
              {availableLabs.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Click &quot;Join a Lab&quot; to get started</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {joinedLabs.map(lab => (
              <Card key={lab.id} className="shadow-sm hover:shadow-md transition-shadow group relative">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0 mt-0.5">
                      <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold truncate">{lab.name}</p>
                        <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                          Joined
                        </Badge>
                        {lab.level && (
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5">
                            {lab.level}
                          </Badge>
                        )}
                      </div>
                      {lab.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{lab.description}</p>
                      )}
                      {lab.studentCount !== undefined && (
                        <p className="text-[10px] text-muted-foreground mt-1">{lab.studentCount} student{lab.studentCount !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0"
                      onClick={(e) => { e.stopPropagation(); setLeaveLabId(lab.id); }}
                      title="Leave lab"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* My Groups Section */}
      {myLabIds.length > 0 && <StudentGroupsSection studentId={student?.id} labIds={myLabIds} />}

      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
      <BookOpen className="h-3.5 w-3.5" /> My Materials
      <Button variant="outline" size="icon" className=" ml-auto  " onClick={handleRefreshMaterials} title="Refresh">
        <RefreshCw className="h-4 w-4" />
      </Button>
      </h3>
      {studentLabDocuments.length === 0 && studentResourceLinks.length === 0 && joinedLabs.length > 0 && (
        <motion.div {...fadeSlide} transition={{ delay: 0.04 }} className="mb-8">
        <Card className="shadow-sm mt-3">
        <CardContent className="py-8 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No lab materials available yet</p>
        <p className="text-xs text-muted-foreground mt-1">Your instructor hasn&apos;t shared any posts or resources yet</p>
        </CardContent>
        </Card>
        </motion.div>
      )}
      {/* Lab Materials (Posts + Resource Links) */}
      {(studentLabDocuments.length > 0 || studentResourceLinks.length > 0) && (() => {



        // Group by lab
        const labGroups: Record<number, { labName: string; docs: typeof studentLabDocuments; links: ResourceLink[] }> = {};

        for (const doc of studentLabDocuments) {
          const labName = labs.find(l => l.id === doc.labId)?.name || 'Unknown Lab';
          if (!labGroups[doc.labId]) labGroups[doc.labId] = { labName, docs: [], links: [] };
          labGroups[doc.labId].docs.push(doc);
        }

        for (const link of studentResourceLinks) {
          const labName = labs.find(l => l.id === link.labId)?.name || 'Unknown Lab';
          if (!labGroups[link.labId]) labGroups[link.labId] = { labName, docs: [], links: [] };
          labGroups[link.labId].links.push(link);
        }

        const totalItems = studentLabDocuments.length + studentResourceLinks.length;

        return (
          <motion.div {...fadeSlide} transition={{ delay: 0.04 }} className="mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 ">



                </div>
                <div className="space-y-5">
                  {Object.entries(labGroups).map(([labIdStr, group]) => {
                    const showLabHeader = Object.keys(labGroups).length > 1;
                    return (
                      <div key={labIdStr}>
                        {showLabHeader && (
                          <div className="flex items-center gap-2 mb-2.5">
                            <FlaskConical className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.labName}</span>
                          </div>
                        )}
                        <div className="space-y-3">


                          {/* Resource Links (standalone) */}
                          {group.links.sort((a, b) => a.order - b.order || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((link) => {
                            return (
                              <a
                                key={`link-${link.id}`}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group/link"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted shrink-0">
                                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate group-hover/link:text-primary transition-colors">{link.title}</p>
                                    <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 rounded shrink-0">{group.labName}</span>
                                  </div>
                                  {link.description ? (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">{link.description}</p>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1 truncate">{link.url}</p>
                                  )}
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/link:text-primary shrink-0 transition-colors" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      <div className="my-6"><Separator /></div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dashCards.map((card) => (
          <div key={card.view}>
            <Card className="group cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden" onClick={() => setView(card.view)}>
              <div className="sm:hidden absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.iconBg} mb-2`}>
                    <span className={`${card.iconColor}`}>{card.icon}</span>
                  </div>
                  {card.count && (
                    <Badge variant="secondary" className="text-[10px] font-mono">{card.count}</Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.desc}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="ghost" className="p-0 h-auto text-primary">
                  View <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        ))}
      </div>

      {/* Leave Lab AlertDialog */}
      <AlertDialog open={leaveLabId !== null} onOpenChange={(open) => { if (!open) setLeaveLabId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Lab</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave &quot;{labs.find(l => l.id === leaveLabId)?.name}&quot;? You can rejoin later if the lab is still available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveLab} disabled={leaveLabLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {leaveLabLoading ? 'Leaving...' : 'Leave Lab'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
