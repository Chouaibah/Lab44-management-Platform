'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Instructor, Lab } from '@/types';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Users, Plus, Pencil, Trash2, RefreshCw, ShieldCheck,
  Search, KeyRound, Mail, ChevronDown, ChevronUp,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav, getInitials, getAvatarColor } from '@/lib/helpers';

// ─── Sort Icon (static, defined outside render) ─────────────────────────────────
function SortIcon({ field, currentField, direction }: { field: string; currentField: string; direction: 'asc' | 'desc' }) {
  if (currentField !== field) return null;
  return direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
}

// ─── Instructor Form Type ────────────────────────────────────────────────────
interface InstructorFormData {
  username: string;
  displayName: string;
  email: string;
  password: string;
  labId: number | '';
  labIds: number[];
}

const emptyInstructorForm: InstructorFormData = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  labId: '',
  labIds: [],
};

export default function AdminInstructorsView() {
  const { instructors, setInstructors, labs, setLabs } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editInstructor, setEditInstructor] = useState<Instructor | null>(null);
  const [deleteInstructor, setDeleteInstructor] = useState<Instructor | null>(null);
  const [resetPwInstructor, setResetPwInstructor] = useState<Instructor | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState<InstructorFormData>(emptyInstructorForm);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'displayName' | 'username' | 'createdAt'>('displayName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [instructorsRes, labsRes] = await Promise.all([
        fetch('/api/instructors'),
        fetch('/api/labs'),
      ]);
      const instructorsData = await instructorsRes.json();
      const labsData = await labsRes.json();

      if (Array.isArray(instructorsData)) setInstructors(instructorsData);
      else if (instructorsData.instructors) setInstructors(instructorsData.instructors);

      if (Array.isArray(labsData)) setLabs(labsData);
      else if (labsData.labs) setLabs(labsData.labs);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  }, [setInstructors, setLabs]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtered & Sorted Instructors ────────────────────────────────────────
  const filteredInstructors = useMemo(() => {
    let result = [...instructors];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.displayName.toLowerCase().includes(q) ||
        i.username.toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'displayName') cmp = a.displayName.localeCompare(b.displayName);
      else if (sortField === 'username') cmp = a.username.localeCompare(b.username);
      else if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [instructors, searchQuery, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ─── Get lab names for an instructor ───────────────────────────────────────
  const getLabNames = useCallback((instructor: Instructor): string[] => {
    const allLabIds = instructor.labIds || [instructor.labId];
    return allLabIds
      .map(id => labs.find(l => l.id === id)?.name)
      .filter(Boolean) as string[];
  }, [labs]);

  // ─── Create Instructor ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.username.trim()) { toast.error('Username is required'); return; }
    if (!formData.displayName.trim()) { toast.error('Display name is required'); return; }
    if (!formData.password) { toast.error('Password is required'); return; }
    if (!formData.labId) { toast.error('Primary lab is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          displayName: formData.displayName,
          email: formData.email || null,
          password: formData.password,
          labId: formData.labId,
          labIds: formData.labIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to create instructor'); setSaving(false); return; }
      toast.success(`Instructor "${formData.displayName}" created`);
      setCreateOpen(false);
      setFormData(emptyInstructorForm);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Edit Instructor ───────────────────────────────────────────────────────
  const openEdit = (instructor: Instructor) => {
    const allLabIds = instructor.labIds || [instructor.labId];
    setEditInstructor(instructor);
    setFormData({
      username: instructor.username,
      displayName: instructor.displayName,
      email: instructor.email || '',
      password: '',
      labId: instructor.labId,
      labIds: allLabIds,
    });
  };

  const handleEdit = async () => {
    if (!editInstructor) return;
    if (!formData.displayName.trim()) { toast.error('Display name is required'); return; }
    setSaving(true);
    try {
      const updateBody: Record<string, unknown> = {
        displayName: formData.displayName,
        email: formData.email || null,
        labIds: formData.labIds,
      };
      if (formData.labId) updateBody.labId = formData.labId;

      const res = await fetch(`/api/instructors/${editInstructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update instructor'); setSaving(false); return; }
      toast.success(`Instructor "${formData.displayName}" updated`);
      setEditInstructor(null);
      setFormData(emptyInstructorForm);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Delete Instructor ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteInstructor) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${deleteInstructor.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete instructor'); setSaving(false); return; }
      toast.success(`Instructor "${deleteInstructor.displayName}" deleted`);
      setDeleteInstructor(null);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Reset Password ───────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetPwInstructor) return;
    if (!newPassword || newPassword.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/instructors/${resetPwInstructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to reset password'); setSaving(false); return; }
      toast.success(`Password reset for "${resetPwInstructor.displayName}"`);
      setResetPwInstructor(null);
      setNewPassword('');
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Toggle lab selection in form ──────────────────────────────────────────
  const toggleLab = (labId: number) => {
    setFormData(prev => {
      const currentLabIds = prev.labIds;
      const newLabIds = currentLabIds.includes(labId)
        ? currentLabIds.filter(id => id !== labId)
        : [...currentLabIds, labId];
      // If primary lab is being removed, set the first available as primary
      let newPrimaryLabId = prev.labId;
      if (prev.labId === labId && !newLabIds.includes(labId)) {
        newPrimaryLabId = newLabIds[0] || '';
      }
      // Ensure primary lab is always in labIds
      if (newPrimaryLabId && !newLabIds.includes(newPrimaryLabId as number)) {
        newLabIds.push(newPrimaryLabId as number);
      }
      return { ...prev, labIds: newLabIds, labId: newPrimaryLabId };
    });
  };

  // ─── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ─── Instructor Form Dialog (shared for Create/Edit) ───────────────────────
  const renderFormDialog = (isOpen: boolean, onOpenChange: (open: boolean) => void, onSubmit: () => void, title: string, isEdit: boolean) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update instructor details and lab assignments.' : 'Create a new instructor account.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Username */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Username *</Label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="e.g. jdoe"
              disabled={isEdit}
            />
            {isEdit && <p className="text-[10px] text-muted-foreground">Username cannot be changed after creation</p>}
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Display Name *</Label>
            <Input
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g. Dr. John Doe"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="e.g. jdoe@usthb.edu.dz"
            />
          </div>

          {/* Password (only for create) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Initial password"
              />
            </div>
          )}

          {/* Primary Lab */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Primary Lab *</Label>
            <Select
              value={String(formData.labId)}
              onValueChange={(value) => {
                const labId = parseInt(value);
                setFormData(prev => {
                  const newLabIds = prev.labIds.includes(labId) ? prev.labIds : [...prev.labIds, labId];
                  return { ...prev, labId, labIds: newLabIds };
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select primary lab" />
              </SelectTrigger>
              <SelectContent>
                {labs.map(lab => (
                  <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lab Assignments (multi-select) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Lab Assignments</Label>
            <p className="text-[10px] text-muted-foreground">Select all labs this instructor should have access to</p>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {labs.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">No labs available</div>
              ) : (
                <div className="divide-y divide-border">
                  {labs.map(lab => {
                    const isSelected = formData.labIds.includes(lab.id);
                    const isPrimary = formData.labId === lab.id;
                    return (
                      <label
                        key={lab.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleLab(lab.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{lab.name}</p>
                          {lab.level && (
                            <p className="text-[10px] text-muted-foreground">{lab.level}</p>
                          )}
                        </div>
                        {isPrimary && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                            Primary
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {formData.labIds.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{formData.labIds.length} lab(s) assigned</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Instructor' : 'Create Instructor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <BreadcrumbNav items={[{ label: 'Admin', view: 'admin-panel' }, { label: 'Instructors' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Instructor Management
          </h1>
          <p className="text-sm text-muted-foreground">Create, edit, and manage instructor accounts and lab assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setFormData(emptyInstructorForm); setCreateOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Instructor
          </Button>
        </div>
      </div>


      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search instructors by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Instructors Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> All Instructors
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5">{filteredInstructors.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInstructors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold mb-1">No Instructors Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No instructors match your search.' : 'No instructors have been created yet.'}
              </p>
              {!searchQuery && (
                <Button size="sm" className="mt-4" onClick={() => { setFormData(emptyInstructorForm); setCreateOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Your First Instructor
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-4">
                      <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('displayName')}>
                        Instructor <SortIcon field="displayName" currentField={sortField} direction={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort('username')}>
                        Username <SortIcon field="username" currentField={sortField} direction={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Labs</TableHead>
                    <TableHead className="pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstructors.map((instructor, idx) => {
                    const labNames = getLabNames(instructor);
                    const allLabIds = instructor.labIds || [instructor.labId];
                    const initials = getInitials(
                      instructor.displayName.split(' ')[0] || '',
                      instructor.displayName.split(' ').slice(-1)[0] || ''
                    );
                    const avatarBg = getAvatarColor(instructor.displayName);
                    return (
                      <TableRow key={instructor.id} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${avatarBg}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{instructor.displayName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-muted-foreground">{instructor.username}</span>
                        </TableCell>
                        <TableCell>
                          {instructor.email ? (
                            <span className="text-xs text-muted-foreground">{instructor.email}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {allLabIds.map(labId => {
                              const lab = labs.find(l => l.id === labId);
                              const isPrimary = labId === instructor.labId;
                              return lab ? (
                                <Badge
                                  key={labId}
                                  variant="outline"
                                  className={`text-[10px] h-5 px-1.5 ${
                                    isPrimary
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                      : 'bg-muted/50 text-muted-foreground'
                                  }`}
                                >
                                  {isPrimary && '★ '}{lab.name}
                                </Badge>
                              ) : null;
                            })}
                            {allLabIds.length === 0 && (
                              <span className="text-xs text-muted-foreground">No labs</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(instructor)}
                              title="Edit instructor"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700"
                              onClick={() => { setResetPwInstructor(instructor); setNewPassword(''); }}
                              title="Reset password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog open={deleteInstructor?.id === instructor.id} onOpenChange={(open) => { if (!open) setDeleteInstructor(null); }}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                  onClick={() => setDeleteInstructor(instructor)}
                                  title="Delete instructor"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete &quot;{instructor.displayName}&quot;?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this instructor account. If they are the only instructor
                                    for a lab, student memberships for that lab will also be removed. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
                                    {saving ? 'Deleting...' : 'Delete Instructor'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {renderFormDialog(createOpen, setCreateOpen, handleCreate, 'Create New Instructor', false)}

      {/* Edit Dialog */}
      {renderFormDialog(editInstructor !== null, (open) => { if (!open) setEditInstructor(null); }, handleEdit, `Edit Instructor: ${editInstructor?.displayName || ''}`, true)}

      {/* Reset Password Dialog */}
      <Dialog open={resetPwInstructor !== null} onOpenChange={(open) => { if (!open) setResetPwInstructor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetPwInstructor?.displayName}</strong> ({resetPwInstructor?.username})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <p className="text-[10px] text-muted-foreground">Must be at least 4 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwInstructor(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={saving || !newPassword}>
              {saving ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
