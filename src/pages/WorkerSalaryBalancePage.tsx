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
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Plus, Edit, Trash2, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { z } from 'zod';

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

const withdrawalSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  jumlah: z.coerce.number().positive('Jumlah harus lebih dari 0'),
  catatan: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Withdrawal | null>(null);
  const [formData, setFormData] = useState({
    tanggal: format(new Date(), 'yyyy-MM-dd'),
    jumlah: '',
    catatan: '',
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Pagination for withdrawals table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Worker options derived from worker_income filtered by selected month
  const workerOptions = useMemo(() => {
    const map = new Map<string, string>();
    const source = incomes.filter(i =>
      i.tanggal && i.worker_name && format(new Date(i.tanggal), 'yyyy-MM') === selectedMonth
    );
    source.forEach(i => {
      const key = i.worker_name!.toLowerCase().trim();
      if (!map.has(key)) map.set(key, i.worker_name!.trim());
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [incomes, selectedMonth]);

  // Auto-reset selected worker if not in current month list
  useEffect(() => {
    if (selectedWorker && !workerOptions.some(w => w.toLowerCase().trim() === selectedWorker.toLowerCase().trim())) {
      setSelectedWorker('');
    }
  }, [workerOptions, selectedWorker]);

  // Filtered data per selected worker + month (exact match)
  const matches = (a?: string | null, b?: string) =>
    !!a && !!b && a.toLowerCase().trim() === b.toLowerCase().trim();

  const filteredIncomes = useMemo(() => {
    if (!selectedWorker) return [];
    return incomes.filter(i =>
      matches(i.worker_name, selectedWorker) &&
      i.tanggal && format(new Date(i.tanggal), 'yyyy-MM') === selectedMonth
    );
  }, [incomes, selectedWorker, selectedMonth]);

  const filteredWithdrawals = useMemo(() => {
    if (!selectedWorker) return [];
    return withdrawals.filter(w =>
      matches(w.worker_name, selectedWorker) &&
      w.tanggal && format(new Date(w.tanggal), 'yyyy-MM') === selectedMonth
    );
  }, [withdrawals, selectedWorker, selectedMonth]);

  const totalPendapatan = useMemo(() => filteredIncomes.reduce((s, i) => s + Number(i.fee || 0), 0), [filteredIncomes]);
  const totalPengambilan = useMemo(() => filteredWithdrawals.reduce((s, w) => s + Number(w.jumlah || 0), 0), [filteredWithdrawals]);
  const sisaSaldo = totalPendapatan - totalPengambilan;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredWithdrawals.length / pageSize));
  const paginatedWithdrawals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWithdrawals.slice(start, start + pageSize);
  }, [filteredWithdrawals, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [selectedWorker, selectedMonth]);

  const openCreateDialog = () => {
    setEditing(null);
    setFormData({
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      jumlah: '',
      catatan: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (w: Withdrawal) => {
    setEditing(w);
    setFormData({
      tanggal: format(new Date(w.tanggal), 'yyyy-MM-dd'),
      jumlah: String(w.jumlah),
      catatan: w.catatan || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) {
      toast({ title: 'Pilih worker dulu', variant: 'destructive' });
      return;
    }
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

    // Validate vs sisa saldo (only when not editing OR when increasing)
    const previousAmount = editing ? Number(editing.jumlah) : 0;
    const projectedSisa = sisaSaldo + previousAmount - jumlahNum;
    if (projectedSisa < 0) {
      toast({
        title: 'Jumlah melebihi sisa saldo',
        description: `Sisa saldo tersedia: ${formatCurrency(sisaSaldo + previousAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      franchise_id: franchiseId,
      worker_name: toTitleCase(selectedWorker),
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sisa Gaji Worker</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola pengambilan gaji worker dan pantau sisa saldo per bulan.
        </p>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Pilih Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder={workerOptions.length ? 'Pilih worker...' : 'Tidak ada worker bulan ini'} />
                </SelectTrigger>
                <SelectContent>
                  {workerOptions.map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
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
              disabled={!selectedWorker}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Pengambilan Gaji
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedWorker ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPendapatan)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-500/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pengambilan</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalPengambilan)}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-blue-500/40" />
                </div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${sisaSaldo >= 0 ? 'border-l-emerald-500' : 'border-l-destructive'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sisa Saldo</p>
                    <p className={`text-2xl font-bold mt-1 ${sisaSaldo >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatCurrency(sisaSaldo)}
                    </p>
                  </div>
                  <Wallet className={`h-8 w-8 ${sisaSaldo >= 0 ? 'text-emerald-500/40' : 'text-destructive/40'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Income detail */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rincian Pendapatan — {selectedWorker}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead>Jobdesk</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIncomes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Tidak ada pendapatan di bulan ini
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredIncomes.map(i => (
                          <TableRow key={i.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(i.tanggal), 'dd MMM yyyy', { locale: localeId })}
                            </TableCell>
                            <TableCell>
                              {i.code ? <Badge variant="secondary">{i.code}</Badge> : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{i.jobdesk || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(Number(i.fee))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Withdrawals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rincian Pengambilan Gaji</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Catatan</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedWithdrawals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Belum ada pengambilan gaji bulan ini
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedWithdrawals.map(w => (
                          <TableRow key={w.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(w.tanggal), 'dd MMM yyyy', { locale: localeId })}
                            </TableCell>
                            <TableCell className="text-right font-medium text-blue-600">
                              {formatCurrency(Number(w.jumlah))}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{w.catatan || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditDialog(w)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteId(w.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredWithdrawals.length > 0 && (
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={filteredWithdrawals.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Pilih worker dari dropdown di atas untuk melihat rincian sisa gaji.
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengambilan Gaji' : 'Tambah Pengambilan Gaji'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label>Worker</Label>
              <Input value={selectedWorker} readOnly className="bg-muted" />
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
              <p className="text-xs text-muted-foreground">
                Sisa saldo tersedia: <span className="font-medium">{formatCurrency(sisaSaldo + (editing ? Number(editing.jumlah) : 0))}</span>
              </p>
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
