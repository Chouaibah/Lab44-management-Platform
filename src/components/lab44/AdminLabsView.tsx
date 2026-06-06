'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Lab, Instructor } from '@/types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

import {
  FlaskConical, Plus, Pencil, Trash2, RefreshCw, Users, ShieldCheck,
  Search, Lock, ChevronDown, ChevronUp, GraduationCap, BookOpen,
} from 'lucide-react';

import { fadeSlide, BreadcrumbNav, getInitials, getAvatarColor } from '@/lib/helpers';

// ─── Sort Icon ─────────────────────────────────────────────────────────────
function SortIcon({ field, currentField, direction }: { field: string; currentField: string; direction: 'asc' | 'desc' }) {
  if (currentField !== field) return null;
  return direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface Level {
  id: number;
  year: string;
  specialty: string;
  label: string;
}

interface LabFormData {
  name: string;
  description: string;
  level: string;
  password: string;
  autoApprove: boolean;
  instructorIds: number[];
}

const emptyLabForm: LabFormData = {
  name: '',
  description: '',
  level: '',
  password: '',
  autoApprove: false,
  instructorIds: [],
};

export default function AdminLabsView() {
  const { labs, setLabs, instructors, setInstructors } = useLab44Store();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editLab, setEditLab] = useState<Lab | null>(null);
  const [deleteLab, setDeleteLab] = useState<Lab | null>(null);
  const [formData, setFormData] = useState<LabFormData>(emptyLabForm);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'studentCount' | 'instructorCount'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ─── Levels state ────────────────────────────────────────────────────────
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [newLevelYear, setNewLevelYear] = useState('');
  const [newLevelSpecialty, setNewLevelSpecialty] = useState('');
  const [addingLevel, setAddingLevel] = useState(false);

  // ─── Fetch levels ────────────────────────────────────────────────────────
  const fetchLevels = useCallback(async () => {
    setLevelsLoading(true);
    try {
      const res = await fetch('/api/levels');
      const data = await res.json();
      if (Array.isArray(data)) setLevels(data);
    } catch { /* ignore */ }
    setLevelsLoading(false);
  }, []);

  useEffect(() => { fetchLevels(); }, [fetchLevels]);

  // ─── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [labsRes, instructorsRes] = await Promise.all([
        fetch('/api/labs'),
                                                          fetch('/api/instructors'),
      ]);
      const labsData = await labsRes.json();
      const instructorsData = await instructorsRes.json();

      if (Array.isArray(labsData)) setLabs(labsData);
      else if (labsData.labs) setLabs(labsData.labs);

      if (Array.isArray(instructorsData)) setInstructors(instructorsData);
      else if (instructorsData.instructors) setInstructors(instructorsData.instructors);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  }, [setLabs, setInstructors]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtered & Sorted Labs ────────────────────────────────────────────────
  const filteredLabs = useMemo(() => {
    let result = [...labs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q) ||
      (l.level || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'studentCount') cmp = (a.studentCount || 0) - (b.studentCount || 0);
      else if (sortField === 'instructorCount') cmp = (a.instructorCount || 0) - (b.instructorCount || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [labs, searchQuery, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const getInstructorsForLab = useCallback((labId: number): Instructor[] => {
    return instructors.filter(i => i.labIds?.includes(labId) || i.labId === labId);
  }, [instructors]);

  // ─── Level helpers ────────────────────────────────────────────────────────
  const addLevel = async () => {
    if (!newLevelYear.trim() || !newLevelSpecialty.trim()) {
      toast.error('Year and specialty are required');
      return;
    }
    setAddingLevel(true);
    try {
      const res = await fetch('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newLevelYear.trim(), specialty: newLevelSpecialty.trim() }),
      });
      if (res.ok) {
        toast.success('Level added');
        setNewLevelYear('');
        setNewLevelSpecialty('');
        fetchLevels();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add level');
      }
    } catch {
      toast.error('Connection error');
    }
    setAddingLevel(false);
  };

  const deleteLevel = async (id: number) => {
    try {
      const res = await fetch(`/api/levels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Level deleted');
        fetchLevels();
      } else {
        toast.error('Failed to delete level');
      }
    } catch {
      toast.error('Connection error');
    }
  };

  // ─── Create Lab ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.name.trim()) { toast.error('Lab name is required'); return; }
    // Password is mandatory for new labs
    if (!formData.password.trim()) { toast.error('Password is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          level: formData.level || null,
          password: formData.password,
          autoApprove: formData.autoApprove,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to create lab'); setSaving(false); return; }

      if (formData.instructorIds.length > 0) {
        for (const instId of formData.instructorIds) {
          const inst = instructors.find(i => i.id === instId);
          if (inst) {
            const newLabIds = [...(inst.labIds || [inst.labId]), data.id];
            await fetch(`/api/instructors/${instId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labIds: newLabIds }),
            });
          }
        }
      }

      toast.success(`Lab "${formData.name}" created`);
      setCreateOpen(false);
      setFormData(emptyLabForm);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  // ─── Edit Lab ──────────────────────────────────────────────────────────────
  const openEdit = (lab: Lab) => {
    const labInstructors = getInstructorsForLab(lab.id);
    setEditLab(lab);
    setFormData({
      name: lab.name,
      description: lab.description || '',
      level: lab.level || '',
      password: '', // leave empty to keep current
      autoApprove: (lab as Lab & { autoApprove?: boolean }).autoApprove || false,
                instructorIds: labInstructors.map(i => i.id),
    });
  };

  const handleEdit = async () => {
    if (!editLab) return;
    if (!formData.name.trim()) { toast.error('Lab name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/labs/${editLab.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          level: formData.level || null,
          ...(formData.password ? { password: formData.password } : {}),
                             autoApprove: formData.autoApprove,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to update lab'); setSaving(false); return; }

      const currentInstructors = getInstructorsForLab(editLab.id);
      const currentIds = new Set(currentInstructors.map(i => i.id));
      const newIds = new Set(formData.instructorIds);

      for (const instId of formData.instructorIds) {
        if (!currentIds.has(instId)) {
          const inst = instructors.find(i => i.id === instId);
          if (inst) {
            const updatedLabIds = [...(inst.labIds || [inst.labId]), editLab.id];
            await fetch(`/api/instructors/${instId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labIds: updatedLabIds }),
            });
          }
        }
      }

      for (const instId of currentIds) {
        if (!newIds.has(instId)) {
          const inst = instructors.find(i => i.id === instId);
          if (inst) {
            const updatedLabIds = (inst.labIds || [inst.labId]).filter((id: number) => id !== editLab.id);
            await fetch(`/api/instructors/${instId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labIds: updatedLabIds }),
            });
          }
        }
      }

      toast.success(`Lab "${formData.name}" updated`);
      setEditLab(null);
      setFormData(emptyLabForm);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteLab) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/labs/${deleteLab.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) { toast.error(data.error || 'Failed to delete lab'); setSaving(false); return; }
      toast.success(`Lab "${deleteLab.name}" deleted`);
      setDeleteLab(null);
      loadData();
    } catch {
      toast.error('Connection error');
    }
    setSaving(false);
  };

  const toggleInstructor = (instId: number) => {
    setFormData(prev => ({
      ...prev,
      instructorIds: prev.instructorIds.includes(instId)
      ? prev.instructorIds.filter(id => id !== instId)
      : [...prev.instructorIds, instId],
    }));
  };

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

  const renderFormDialog = (isOpen: boolean, onOpenChange: (open: boolean) => void, onSubmit: () => void, title: string, isEdit: boolean) => (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
    <DialogHeader>
    <DialogTitle className="flex items-center gap-2">
     {title}
    </DialogTitle>
    <DialogDescription>
    {isEdit ? 'Update lab details and instructor assignments.' : 'Create a new lab for the platform.'}
    </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-2">
    <div className="space-y-1.5">
    <Label className="text-xs font-medium">Lab Name *</Label>
    <Input
    value={formData.name}
    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
    placeholder="e.g. Network Administration"
    />
    </div>

    <div className="space-y-1.5">
    <Label className="text-xs font-medium">Level</Label>
    <Select
    value={formData.level}
    onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
    >
    <SelectTrigger>
    <SelectValue placeholder="Select a level..." />
    </SelectTrigger>
    <SelectContent>
    {levels.map((lvl) => (
      <SelectItem key={lvl.id} value={lvl.id.toString()}>
      {lvl.label}
      </SelectItem>
    ))}
    </SelectContent>
    </Select>
    </div>

    <div className="space-y-1.5">
    <Label className="text-xs font-medium">Description</Label>
    <Textarea
    value={formData.description}
    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
    placeholder="Brief description of this lab..."
    rows={3}
    />
    </div>

    <div className="space-y-1.5">
    <Label className="text-xs font-medium">
    {isEdit ? 'New Password' : 'Password *'}
    </Label>
    <Input
    type="password"
    value={formData.password}
    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
    placeholder={isEdit ? 'Leave blank to keep current' : 'Set a join password'}
    />
    {isEdit && (
      <p className="text-[10px] text-muted-foreground">Leave blank to keep current password</p>
    )}
    </div>

    <div className="space-y-1.5">
    <Label className="text-xs font-medium">Assigned Instructors</Label>
    <div className="border rounded-lg max-h-48 overflow-y-auto">
    {instructors.length === 0 ? (
      <div className="p-3 text-sm text-muted-foreground text-center">No instructors available</div>
    ) : (
      <div className="divide-y divide-border">
      {instructors.map(inst => {
        const isSelected = formData.instructorIds.includes(inst.id);
        return (
          <label
          key={inst.id}
          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
          >
          <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleInstructor(inst.id)}
          />
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0 ${getAvatarColor(inst.displayName)}`}>
          {getInitials(inst.displayName.split(' ')[0] || '', inst.displayName.split(' ').slice(-1)[0] || '')}
          </div>
          <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{inst.displayName}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{inst.username}</p>
          </div>
          </label>
        );
      })}
      </div>
    )}
    </div>
    {formData.instructorIds.length > 0 && (
      <p className="text-[11px] text-muted-foreground">{formData.instructorIds.length} instructor(s) selected</p>
    )}
    </div>
    </div>

    <DialogFooter>
    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
    <Button onClick={onSubmit} disabled={saving}>
    {saving ? 'Saving...' : isEdit ? 'Update Lab' : 'Create Lab'}
    </Button>
    </DialogFooter>
    </DialogContent>
    </Dialog>
  );

  return (
    <motion.div {...fadeSlide} className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
    <BreadcrumbNav items={[{ label: 'Admin', view: 'admin-panel' }, { label: 'Labs & Levels' }]} />

    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
    Lab Management
    </h1>
    <p className="text-sm text-muted-foreground">Manage labs, levels, and instructor assignments</p>
    </div>
    <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" onClick={loadData}>
    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
    </Button>
    <Button size="sm" onClick={() => { setFormData(emptyLabForm); setCreateOpen(true); }}>
    <Plus className="h-3.5 w-3.5 mr-1" /> New Lab
    </Button>
    </div>
    </div>

    <Tabs defaultValue="labs" className="space-y-6">
    <TabsList>
    <TabsTrigger value="labs">Labs</TabsTrigger>
    <TabsTrigger value="levels">Levels</TabsTrigger>
    </TabsList>

    <TabsContent value="labs" className="space-y-4">
    <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
    placeholder="Search labs by name, description, or level..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9 h-9"
    />
    </div>

    <Card className="shadow-sm">
    <CardHeader className="pb-3">
    <CardTitle className="text-base">All Labs
    <Badge variant="secondary" className="ml-2 h-5 text-[10px] px-1.5 align-middle">{filteredLabs.length}</Badge>
    </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
    {filteredLabs.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 text-center">
      <FlaskConical className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="font-semibold mb-1">No Labs Found</h3>
      <p className="text-sm text-muted-foreground">
      {searchQuery ? 'No labs match your search.' : 'No labs have been created yet.'}
      </p>
      {!searchQuery && (
        <Button size="sm" className="mt-4" onClick={() => { setFormData(emptyLabForm); setCreateOpen(true); }}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Create Your First Lab
        </Button>
      )}
      </div>
    ) : (
      <div className="max-h-[600px] overflow-auto">
      <Table>
      <TableHeader>
      <TableRow className="bg-muted/50">
      <TableHead className="pl-4 w-[25%]">
      <button className="flex items-center hover:text-foreground" onClick={() => toggleSort('name')}>
      Lab <SortIcon field="name" currentField={sortField} direction={sortDir} />
      </button>
      </TableHead>
      <TableHead className="w-[10%]">Level</TableHead>
      <TableHead className="w-[12%]">
      <button className="flex items-center hover:text-foreground" onClick={() => toggleSort('instructorCount')}>
      Instructors <SortIcon field="instructorCount" currentField={sortField} direction={sortDir} />
      </button>
      </TableHead>
      <TableHead className="w-[10%]">
      <button className="flex items-center hover:text-foreground" onClick={() => toggleSort('studentCount')}>
      Students <SortIcon field="studentCount" currentField={sortField} direction={sortDir} />
      </button>
      </TableHead>
      <TableHead className="w-[12%] sticky right-0 bg-muted/50 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
      Actions
      </TableHead>
      </TableRow>
      </TableHeader>
      <TableBody>
      {filteredLabs.map((lab, idx) => {
        const labInstructors = getInstructorsForLab(lab.id);
        return (
          <TableRow key={lab.id} className={`transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}>
          <TableCell className="pl-4">
          <div className="min-w-0 max-w-[360px]">
          <p className="font-medium text-sm truncate">{lab.name}</p>
          {lab.description && (
            <p className="text-xs text-muted-foreground truncate" title={lab.description}>{lab.description}</p>
          )}
          </div>
          </TableCell>
          <TableCell>
          {lab.level ? (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800">
            {levels.find(l => l.id.toString() === lab.level)?.label || lab.level}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          </TableCell>
          <TableCell>
          <div className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-medium">{lab.instructorCount || 0}</span>
          {labInstructors.length > 0 && (
            <div className="flex -space-x-1.5 ml-1">
            {labInstructors.slice(0, 3).map(inst => (
              <div
              key={inst.id}
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-background ${getAvatarColor(inst.displayName)}`}
              title={inst.displayName}
              >
              {getInitials(inst.displayName.split(' ')[0] || '', inst.displayName.split(' ').slice(-1)[0] || '')}
              </div>
            ))}
            {labInstructors.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold bg-muted ring-2 ring-background">
              +{labInstructors.length - 3}
              </div>
            )}
            </div>
          )}
          </div>
          </TableCell>
          <TableCell>
          <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-sm font-medium">{lab.studentCount || 0}</span>
          </div>
          </TableCell>
          <TableCell
          className={`sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${
            idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
          }`}
          >
          <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lab)} title="Edit lab">
          <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog open={deleteLab?.id === lab.id} onOpenChange={(open) => { if (!open) setDeleteLab(null); }}>
          <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => setDeleteLab(lab)} title="Delete lab">
          <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{lab.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
          This will permanently delete this lab along with {lab.studentCount || 0} student memberships.
          This action cannot be undone.
          </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
          {saving ? 'Deleting...' : 'Delete Lab'}
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
      </div>
    )}
    </CardContent>
    </Card>
    </TabsContent>

    <TabsContent value="levels" className="space-y-4">
    <div className="flex flex-col sm:flex-row gap-3">
    <Input
    placeholder="Year (e.g. 4th Year)"
    value={newLevelYear}
    onChange={(e) => setNewLevelYear(e.target.value)}
    className="sm:max-w-[200px]"
    />
    <Input
    placeholder="Specialty (e.g. Computer Science)"
    value={newLevelSpecialty}
    onChange={(e) => setNewLevelSpecialty(e.target.value)}
    className="flex-1"
    />
    <Button onClick={addLevel} disabled={addingLevel || !newLevelYear.trim() || !newLevelSpecialty.trim()}>
    {addingLevel ? 'Adding...' : <><Plus className="h-4 w-4 mr-1" /> Add Level</>}
    </Button>
    </div>

    {levels.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground border rounded-lg">
      <p className="text-sm">No levels defined yet.</p>
      </div>
    ) : (
      <div className="space-y-1">
      {levels.map((level) => (
        <div key={level.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
        <span className="text-sm">{level.year} - {level.specialty}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => deleteLevel(level.id)}>
        <Trash2 className="h-3.5 w-3.5" />
        </Button>
        </div>
      ))}
      </div>
    )}
    </TabsContent>


    </Tabs>

    {renderFormDialog(createOpen, setCreateOpen, handleCreate, 'Create New Lab', false)}
    {renderFormDialog(editLab !== null, (open) => { if (!open) setEditLab(null); }, handleEdit, `Edit Lab: ${editLab?.name || ''}`, true)}
    </motion.div>
  );
}
