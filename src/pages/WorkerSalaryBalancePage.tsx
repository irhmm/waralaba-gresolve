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
import { Plus, Edit, Trash2, TrendingUp, ClipboardList, Calculator, Filter } from 'lucide-react';
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
  const [selectedWorker, setSelectedWorker] = useState<string>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Withdrawal | null>(null);
  const [formData, setFormData] = useState({
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    jumlah: '',
    catatan: '',
    worker_name: '',
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  // Worker options = workers with income in selected month
  const workerOptions = useMemo(() => {
    const set = new Map<string, string>();
    monthIncomes.forEach(i => {
      if (!i.worker_name) return;
      const key = normalizeKey(i.worker_name);
      if (!set.has(key)) set.set(key, toTitleCase(i.worker_name));
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [monthIncomes]);

  // Reset selected worker if not in current month list
  useEffect(() => {
    if (selectedWorker && !workerOptions.some(w => normalizeKey(w) === normalizeKey(selectedWorker))) {
      setSelectedWorker('');
    }
  }, [workerOptions, selectedWorker]);

  // Filtered detail data — kalau worker tidak dipilih, tampilkan semua data bulan tsb
  const workerKey = selectedWorker ? normalizeKey(selectedWorker) : null;

  const detailIncomes = useMemo(
    () => workerKey
      ? monthIncomes.filter(i => i.worker_name && normalizeKey(i.worker_name) === workerKey)
      : monthIncomes,
    [monthIncomes, workerKey]
  );
  const detailWithdrawals = useMemo(
    () => workerKey
      ? monthWithdrawals.filter(w => normalizeKey(w.worker_name) === workerKey)
      : monthWithdrawals,
    [monthWithdrawals, workerKey]
  );

  const totalPendapatan = useMemo(() => detailIncomes.reduce((s, i) => s + Number(i.fee || 0), 0), [detailIncomes]);
  const totalPengambilan = useMemo(() => detailWithdrawals.reduce((s, w) => s + Number(w.jumlah || 0), 0), [detailWithdrawals]);
  const sisaSaldo = totalPendapatan - totalPengambilan;

  const getSisaForWorker = (workerName: string) => {
    const key = normalizeKey(workerName);
    const pendapatan = monthIncomes
      .filter(i => i.worker_name && normalizeKey(i.worker_name) === key)
      .reduce((s, i) => s + Number(i.fee || 0), 0);
    const pengambilan = monthWithdrawals
      .filter(w => normalizeKey(w.worker_name) === key)
      .reduce((s, w) => s + Number(w.jumlah || 0), 0);
    return pendapatan - pengambilan;
  };

  const openCreateDialog = () => {
    if (!selectedWorker) return;
    if (sisaSaldo <= 0) {
      toast({
        title: 'Tidak bisa menambah pengambilan',
        description: 'Worker ini tidak punya saldo tersisa di bulan ini.',
        variant: 'destructive',
      });
      return;
    }
    setEditing(null);
    setFormData({
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      jumlah: '',
      catatan: '',
      worker_name: selectedWorker,
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

    if (!editing && sisaForWorker <= 0) {
      toast({
        title: 'Tidak bisa menambah pengambilan',
        description: 'Worker ini tidak punya saldo tersisa di bulan ini.',
        variant: 'destructive',
      });
      return;
    }

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

  const addDisabled = !selectedWorker || sisaSaldo <= 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Rekap Gaji Worker</h1>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pilih Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih worker..." />
                </SelectTrigger>
                <SelectContent>
                  {workerOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada worker bulan ini</div>
                  ) : (
                    workerOptions.map(w => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <MonthSelector
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              tables={['worker_income']}
              label="Pilih Bulan"
            />
            <Button
              onClick={openCreateDialog}
              disabled={addDisabled}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Pengambilan Gaji
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="rounded-xl border-emerald-200/60 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70 font-medium">
                  Total Pendapatan
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatCurrency(totalPendapatan)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600/60 dark:text-emerald-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-blue-200/60 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-blue-700/70 dark:text-blue-400/70 font-medium">
                  Total Pengambilan
                </p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                  {formatCurrency(totalPengambilan)}
                </p>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-600/60 dark:text-blue-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'rounded-xl shadow-sm',
            sisaSaldo >= 0
              ? 'border-emerald-200/60 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/60'
              : 'border-destructive/30 bg-destructive/5'
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-xs uppercase tracking-wide font-medium',
                  sisaSaldo >= 0 ? 'text-emerald-700/70 dark:text-emerald-400/70' : 'text-destructive/80'
                )}>
                  Sisa Saldo
                </p>
                <p className={cn(
                  'text-2xl font-bold mt-1',
                  sisaSaldo >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                )}>
                  {formatCurrency(sisaSaldo)}
                </p>
              </div>
              <Calculator className={cn(
                'h-8 w-8',
                sisaSaldo >= 0 ? 'text-emerald-600/60 dark:text-emerald-500/60' : 'text-destructive/60'
              )} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side detail tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rincian Pendapatan */}
        <Card className="rounded-xl border-border/60 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Rincian Pendapatan
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {detailIncomes.length} data
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-9">Tanggal</TableHead>
                    {!selectedWorker && <TableHead className="h-9">Worker</TableHead>}
                    <TableHead className="h-9">Kode</TableHead>
                    <TableHead className="h-9">Jobdesk</TableHead>
                    <TableHead className="h-9 text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={selectedWorker ? 4 : 5} className="text-center text-muted-foreground py-10 text-sm">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : detailIncomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedWorker ? 4 : 5} className="text-center text-muted-foreground py-10 text-sm">
                        Tidak ada pendapatan di bulan ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detailIncomes.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="whitespace-nowrap py-2 text-sm">
                          {format(new Date(i.tanggal), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        {!selectedWorker && (
                          <TableCell className="py-2 text-sm font-medium">
                            {i.worker_name ? toTitleCase(i.worker_name) : '-'}
                          </TableCell>
                        )}
                        <TableCell className="py-2">
                          {i.code ? <Badge variant="secondary" className="text-xs font-mono">{i.code}</Badge> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="py-2 max-w-[180px] truncate text-sm">{i.jobdesk || '-'}</TableCell>
                        <TableCell className="py-2 text-right font-medium text-sm text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(Number(i.fee))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Rincian Pengambilan Gaji */}
        <Card className="rounded-xl border-border/60 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Rincian Pengambilan Gaji
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {detailWithdrawals.length} data
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-9">Tanggal</TableHead>
                    {!selectedWorker && <TableHead className="h-9">Worker</TableHead>}
                    <TableHead className="h-9 text-right">Jumlah</TableHead>
                    <TableHead className="h-9">Catatan</TableHead>
                    <TableHead className="h-9 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={selectedWorker ? 4 : 5} className="text-center text-muted-foreground py-10 text-sm">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : detailWithdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedWorker ? 4 : 5} className="text-center text-muted-foreground py-10 text-sm">
                        Belum ada pengambilan di bulan ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detailWithdrawals.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="whitespace-nowrap py-2 text-sm">
                          {format(new Date(w.tanggal), 'dd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        {!selectedWorker && (
                          <TableCell className="py-2 text-sm font-medium">
                            {toTitleCase(w.worker_name)}
                          </TableCell>
                        )}
                        <TableCell className="py-2 text-right font-medium text-sm text-blue-700 dark:text-blue-400">
                          {formatCurrency(Number(w.jumlah))}
                        </TableCell>
                        <TableCell className="py-2 max-w-[160px] truncate text-sm">{w.catatan || '-'}</TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(w)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(w.id)}>
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
          </CardContent>
        </Card>
      </div>

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
                  {workerOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada worker bulan ini</div>
                  ) : (
                    workerOptions.map(w => (
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
