import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonthSelector } from '@/components/ui/month-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Plus, Edit, Trash2, Wallet, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { z } from 'zod';
import { cn } from '@/lib/utils';

interface WorkerIncome {
  id: string;
  code: string | null;
  jobdesk: string | null;
  fee: number;
  worker_name: string | null;
  tanggal: string;
}

interface Withdrawal {
  id: string;
  worker_name: string;
  jumlah: number;
  catatan: string | null;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

interface WorkerRow {
  key: string;
  name: string;
  pendapatan: number;
  pengambilan: number;
  sisa: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const toTitleCase = (s: string) =>
  s.toLowerCase().trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const normalizeKey = (s: string) => s.toLowerCase().trim();

const withdrawalSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  jumlah: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  catatan: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
  worker_name: z.string().min(1, 'Worker wajib dipilih'),
});

export default function WorkerSalaryBalancePage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();

  const franchiseId = userRole?.franchise_id;
  const isFranchise = userRole?.role === 'franchise';

  const [incomes, setIncomes] = useState<WorkerIncome[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Withdrawal | null>(null);
  const [formData, setFormData] = useState({
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    jumlah: '',
    catatan: '',
    worker_name: '',
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Realtime
  useRealtimeData({
    table: 'worker_income',
    franchiseId,
    onInsert: () => fetchData(),
    onUpdate: () => fetchData(),
    onDelete: () => fetchData(),
  });
  useRealtimeData({
    table: 'worker_salary_withdrawals' as any,
    franchiseId,
    onInsert: () => fetchData(),
    onUpdate: () => fetchData(),
    onDelete: () => fetchData(),
  });

  useEffect(() => {
    if (franchiseId) fetchData();
  }, [franchiseId]);

  const fetchData = async () => {
    if (!franchiseId) return;
    setLoading(true);
    try {
      const [incomeRes, wdRes] = await Promise.all([
        supabase
          .from('worker_income')
          .select('id, code, jobdesk, fee, worker_name, tanggal')
          .eq('franchise_id', franchiseId)
          .order('tanggal', { ascending: false }),
        (supabase as any)
          .from('worker_salary_withdrawals')
          .select('*')
          .eq('franchise_id', franchiseId)
          .order('tanggal', { ascending: false }),
      ]);
      if (incomeRes.error) throw incomeRes.error;
      if (wdRes.error) throw wdRes.error;
      setIncomes((incomeRes.data || []) as WorkerIncome[]);
      setWithdrawals((wdRes.data || []) as Withdrawal[]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Gagal memuat data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Month-filtered raw data
  const monthIncomes = useMemo(
    () => incomes.filter(i => i.tanggal && format(new Date(i.tanggal), 'yyyy-MM') === selectedMonth),
    [incomes, selectedMonth]
  );
  const monthWithdrawals = useMemo(
    () => withdrawals.filter(w => w.tanggal && format(new Date(w.tanggal), 'yyyy-MM') === selectedMonth),
    [withdrawals, selectedMonth]
  );

  // Aggregated rows per worker (union of incomes & withdrawals)
  const workerRows = useMemo<WorkerRow[]>(() => {
    const map = new Map<string, WorkerRow>();
    monthIncomes.forEach(i => {
      if (!i.worker_name) return;
      const key = normalizeKey(i.worker_name);
      const r = map.get(key) || { key, name: toTitleCase(i.worker_name), pendapatan: 0, pengambilan: 0, sisa: 0 };
      r.pendapatan += Number(i.fee || 0);
      map.set(key, r);
    });
    monthWithdrawals.forEach(w => {
      const key = normalizeKey(w.worker_name);
      const r = map.get(key) || { key, name: toTitleCase(w.worker_name), pendapatan: 0, pengambilan: 0, sisa: 0 };
      r.pengambilan += Number(w.jumlah || 0);
      map.set(key, r);
    });
    const rows = Array.from(map.values()).map(r => ({ ...r, sisa: r.pendapatan - r.pengambilan }));
    return rows.sort((a, b) => b.sisa - a.sisa || a.name.localeCompare(b.name));
  }, [monthIncomes, monthWithdrawals]);

  // Worker filter options
  const workerOptions = useMemo(() => workerRows.map(r => r.name), [workerRows]);

  // Auto-reset filter if worker no longer in list
  useEffect(() => {
    if (selectedWorker !== 'all' && !workerOptions.some(w => normalizeKey(w) === normalizeKey(selectedWorker))) {
      setSelectedWorker('all');
    }
  }, [workerOptions, selectedWorker]);

  // Visible rows after filter
  const visibleRows = useMemo(() => {
    if (selectedWorker === 'all') return workerRows;
    return workerRows.filter(r => normalizeKey(r.name) === normalizeKey(selectedWorker));
  }, [workerRows, selectedWorker]);

  // Aggregate for summary cards (matches visible rows)
  const totalPendapatan = useMemo(() => visibleRows.reduce((s, r) => s + r.pendapatan, 0), [visibleRows]);
  const totalPengambilan = useMemo(() => visibleRows.reduce((s, r) => s + r.pengambilan, 0), [visibleRows]);
  const sisaSaldo = totalPendapatan - totalPengambilan;

  // Detail data for expanded row
  const getIncomesForWorker = (key: string) =>
    monthIncomes.filter(i => i.worker_name && normalizeKey(i.worker_name) === key);
  const getWithdrawalsForWorker = (key: string) =>
    monthWithdrawals.filter(w => normalizeKey(w.worker_name) === key);

  // Sisa saldo for a specific worker (used by dialog validation)
  const getSisaForWorker = (workerName: string) => {
    const row = workerRows.find(r => normalizeKey(r.name) === normalizeKey(workerName));
    return row ? row.sisa : 0;
  };

  const openCreateDialog = (presetWorker?: string) => {
    setEditing(null);
    setFormData({
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      jumlah: '',
      catatan: '',
      worker_name: presetWorker || (selectedWorker !== 'all' ? selectedWorker : ''),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (w: Withdrawal) => {
    setEditing(w);
    setFormData({
      tanggal: format(new Date(w.tanggal), 'yyyy-MM-dd'),
      jumlah: String(w.jumlah),
      catatan: w.catatan || '',
      worker_name: w.worker_name,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchiseId || !user?.id) {
      toast({ title: 'Sesi tidak valid', variant: 'destructive' });
      return;
    }

    const parsed = withdrawalSchema.safeParse(formData);
    if (!parsed.success) {
      toast({ title: 'Validasi gagal', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }

    const jumlahNum = parsed.data.jumlah;
    const workerName = parsed.data.worker_name;
    const sisaForWorker = getSisaForWorker(workerName);

    const previousAmount = editing ? Number(editing.jumlah) : 0;
    const projectedSisa = sisaForWorker + previousAmount - jumlahNum;
    if (projectedSisa < 0) {
      toast({
        title: 'Jumlah melebihi sisa saldo',
        description: `Sisa saldo tersedia: ${formatCurrency(sisaForWorker + previousAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      franchise_id: franchiseId,
      worker_name: toTitleCase(workerName),
      jumlah: jumlahNum,
      catatan: parsed.data.catatan || null,
      tanggal: new Date(parsed.data.tanggal).toISOString(),
      created_by: user.id,
    };

    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from('worker_salary_withdrawals')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Pengambilan gaji diperbarui' });
      } else {
        const { error } = await (supabase as any)
          .from('worker_salary_withdrawals')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Pengambilan gaji ditambahkan' });
      }
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Gagal menyimpan', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any)
        .from('worker_salary_withdrawals')
        .delete()
        .eq('id', deleteId);
      if (error) throw error;
      toast({ title: 'Berhasil', description: 'Pengambilan gaji dihapus' });
      setDeleteId(null);
      fetchData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Gagal menghapus', variant: 'destructive' });
    }
  };

  // Dialog worker options: union of month workers + (if editing) the worker being edited
  const dialogWorkerOptions = useMemo(() => {
    const set = new Set(workerOptions.map(w => toTitleCase(w)));
    if (editing) set.add(toTitleCase(editing.worker_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workerOptions, editing]);

  if (!isFranchise) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Halaman ini hanya dapat diakses oleh role Franchise.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Sisa Gaji Worker</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pantau sisa saldo gaji setiap worker per bulan.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <MonthSelector
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              tables={['worker_income']}
              label="Bulan"
            />
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Worker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Worker</SelectItem>
                  {workerOptions.map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => openCreateDialog()}
              disabled={dialogWorkerOptions.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Pengambilan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="rounded-xl border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pendapatan</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPendapatan)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-emerald-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pengambilan</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalPengambilan)}</p>
              </div>
              <TrendingDown className="h-7 w-7 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn('rounded-xl border-l-4 shadow-sm', sisaSaldo >= 0 ? 'border-l-emerald-500' : 'border-l-destructive')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sisa Saldo</p>
                <p className={cn('text-2xl font-bold mt-1', sisaSaldo >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                  {formatCurrency(sisaSaldo)}
                </p>
              </div>
              <Wallet className={cn('h-7 w-7', sisaSaldo >= 0 ? 'text-emerald-500/40' : 'text-destructive/40')} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Sisa Gaji per Worker
            <span className="text-xs font-normal text-muted-foreground ml-1">
              · {format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: localeId })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                  <TableHead className="text-right">Total Pengambilan</TableHead>
                  <TableHead className="text-right">Sisa Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Tidak ada data worker di bulan ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map(row => {
                    const isExpanded = expandedKey === row.key;
                    const detailIncomes = isExpanded ? getIncomesForWorker(row.key) : [];
                    const detailWithdrawals = isExpanded ? getWithdrawalsForWorker(row.key) : [];
                    return (
                      <React.Fragment key={row.key}>
                        <TableRow
                          className="cursor-pointer transition-colors"
                          onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                        >
                          <TableCell className="w-10">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">
                            {formatCurrency(row.pendapatan)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">
                            {formatCurrency(row.pengambilan)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                'font-semibold border-0',
                                row.sisa >= 0
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-destructive/10 text-destructive'
                              )}
                            >
                              {formatCurrency(row.sisa)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={5} className="p-4">
                              <div className="flex justify-end mb-3">
                                <Button
                                  size="sm"
                                  onClick={() => openCreateDialog(row.name)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                                  Tambah untuk {row.name}
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Income detail */}
                                <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                                  <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Rincian Pendapatan
                                    </p>
                                  </div>
                                  <div className="overflow-x-auto max-h-64">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="h-9">Tanggal</TableHead>
                                          <TableHead className="h-9">Kode</TableHead>
                                          <TableHead className="h-9">Jobdesk</TableHead>
                                          <TableHead className="h-9 text-right">Fee</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {detailIncomes.length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">
                                              Tidak ada pendapatan
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          detailIncomes.map(i => (
                                            <TableRow key={i.id}>
                                              <TableCell className="whitespace-nowrap py-2 text-sm">
                                                {format(new Date(i.tanggal), 'dd MMM', { locale: localeId })}
                                              </TableCell>
                                              <TableCell className="py-2">
                                                {i.code ? <Badge variant="secondary" className="text-xs">{i.code}</Badge> : <span className="text-muted-foreground">-</span>}
                                              </TableCell>
                                              <TableCell className="py-2 max-w-[160px] truncate text-sm">{i.jobdesk || '-'}</TableCell>
                                              <TableCell className="py-2 text-right font-medium text-sm">{formatCurrency(Number(i.fee))}</TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>

                                {/* Withdrawal detail */}
                                <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                                  <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Rincian Pengambilan
                                    </p>
                                  </div>
                                  <div className="overflow-x-auto max-h-64">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="h-9">Tanggal</TableHead>
                                          <TableHead className="h-9 text-right">Jumlah</TableHead>
                                          <TableHead className="h-9">Catatan</TableHead>
                                          <TableHead className="h-9 text-right">Aksi</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {detailWithdrawals.length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">
                                              Belum ada pengambilan
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          detailWithdrawals.map(w => (
                                            <TableRow key={w.id}>
                                              <TableCell className="whitespace-nowrap py-2 text-sm">
                                                {format(new Date(w.tanggal), 'dd MMM', { locale: localeId })}
                                              </TableCell>
                                              <TableCell className="py-2 text-right font-medium text-blue-600 text-sm">
                                                {formatCurrency(Number(w.jumlah))}
                                              </TableCell>
                                              <TableCell className="py-2 max-w-[140px] truncate text-sm">{w.catatan || '-'}</TableCell>
                                              <TableCell className="py-2 text-right">
                                                <div className="flex justify-end gap-1">
                                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(w); }}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(w.id); }}>
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengambilan Gaji' : 'Tambah Pengambilan Gaji'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Worker</Label>
              <Select
                value={formData.worker_name}
                onValueChange={(v) => setFormData({ ...formData, worker_name: v })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih worker..." />
                </SelectTrigger>
                <SelectContent>
                  {dialogWorkerOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada worker bulan ini</div>
                  ) : (
                    dialogWorkerOptions.map(w => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Jumlah (Rp)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={formData.jumlah}
                onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                required
              />
              {formData.worker_name && (
                <p className="text-xs text-muted-foreground">
                  Sisa saldo tersedia: <span className="font-medium">
                    {formatCurrency(getSisaForWorker(formData.worker_name) + (editing ? Number(editing.jumlah) : 0))}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder="Misal: transfer BCA, cash, dll."
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {editing ? 'Simpan Perubahan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengambilan gaji?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data pengambilan akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
