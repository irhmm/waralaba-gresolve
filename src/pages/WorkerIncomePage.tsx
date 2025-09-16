import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { groupDataByMonth, calculateMonthlyTotals, getAvailableMonths } from '@/utils/dateUtils';
import { exportWorkerIncomeToExcel } from '@/utils/excelUtils';

interface WorkerIncome {
  id: string;
  code: string;
  jobdesk: string;
  fee: number;
  worker_id: string;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

interface Worker {
  id: string;
  nama: string;
}

interface Franchise {
  id: string;
  name: string;
  franchise_id: string;
}

export default function WorkerIncomePage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [workerIncomes, setWorkerIncomes] = useState<WorkerIncome[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkerIncome | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    jobdesk: '',
    fee: '',
    worker_id: '',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWorker, setSelectedWorker] = useState('all');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');

  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role);
  const isSuperAdmin = userRole?.role === 'super_admin';

  useEffect(() => {
    fetchData();
    if (isSuperAdmin) {
      fetchFranchises();
    }
  }, [userRole]);

  useEffect(() => {
    if (isSuperAdmin && selectedFranchise) {
      fetchData();
    }
  }, [selectedFranchise]);

  const fetchFranchises = async () => {
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('id, name, franchise_id')
        .order('name');

      if (error) throw error;
      setFranchises(data || []);
    } catch (error) {
      console.error('Error fetching franchises:', error);
    }
  };

  const fetchData = async () => {
    if (!userRole) return;

    try {
      // Determine franchise_id to filter by
      let franchiseId = userRole.franchise_id;
      if (isSuperAdmin && selectedFranchise) {
        franchiseId = selectedFranchise;
      }

      // Fetch worker incomes
      let incomeQuery = supabase
        .from('worker_income')
        .select('*')
        .order('tanggal', { ascending: false });

      if (franchiseId) {
        incomeQuery = incomeQuery.eq('franchise_id', franchiseId);
      }

      const { data: incomeData, error: incomeError } = await incomeQuery;

      if (incomeError) throw incomeError;
      setWorkerIncomes(incomeData || []);

      // Fetch workers for the dropdown
      let workersQuery = supabase
        .from('workers')
        .select('id, nama')
        .eq('status', 'active');

      if (franchiseId) {
        workersQuery = workersQuery.eq('franchise_id', franchiseId);
      }

      const { data: workersData, error: workersError } = await workersQuery;

      if (workersError) throw workersError;
      setWorkers(workersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker?.nama || 'Unknown Worker';
  };

  // Filtered and grouped data
  const filteredData = useMemo(() => {
    let filtered = workerIncomes;

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobdesk.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getWorkerName(item.worker_id).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Month filter
    if (selectedMonth && selectedMonth !== 'all') {
      filtered = filtered.filter(item => {
        const itemMonth = format(new Date(item.tanggal), 'yyyy-MM');
        return itemMonth === selectedMonth;
      });
    }

    // Worker filter
    if (selectedWorker && selectedWorker !== 'all') {
      filtered = filtered.filter(item => item.worker_id === selectedWorker);
    }

    return filtered;
  }, [workerIncomes, searchTerm, selectedMonth, selectedWorker, workers]);

  const groupedData = useMemo(() => {
    const grouped = groupDataByMonth(filteredData);
    return calculateMonthlyTotals(grouped, 'fee');
  }, [filteredData]);

  const availableMonths = useMemo(() => getAvailableMonths(workerIncomes), [workerIncomes]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearchTerm) return workers;
    return workers.filter(worker => 
      worker.nama.toLowerCase().includes(workerSearchTerm.toLowerCase())
    );
  }, [workers, workerSearchTerm]);

  const handleExport = () => {
    exportWorkerIncomeToExcel(filteredData, workers);
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const franchiseId = isSuperAdmin && selectedFranchise ? selectedFranchise : userRole?.franchise_id;
    if (!franchiseId) return;

    try {
      const payload = {
        code: formData.code,
        jobdesk: formData.jobdesk,
        fee: parseFloat(formData.fee),
        worker_id: formData.worker_id,
        franchise_id: franchiseId,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('worker_income')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker income updated successfully!" });
      } else {
        const { error } = await supabase
          .from('worker_income')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker income added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ code: '', jobdesk: '', fee: '', worker_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving worker income:', error);
      toast({
        title: "Error",
        description: "Failed to save worker income",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: WorkerIncome) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      jobdesk: item.jobdesk,
      fee: item.fee.toString(),
      worker_id: item.worker_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_income')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Worker income deleted successfully!" });
      fetchData();
    } catch (error) {
      console.error('Error deleting worker income:', error);
      toast({
        title: "Error",
        description: "Failed to delete worker income",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Super Admin Franchise Selector */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Pilih Franchise</CardTitle>
            <CardDescription>Pilih franchise untuk melihat data pendapatan worker</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih franchise" />
              </SelectTrigger>
              <SelectContent>
                {franchises.map((franchise) => (
                  <SelectItem key={franchise.id} value={franchise.id}>
                    {franchise.name} ({franchise.franchise_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary Cards */}
      {Object.keys(groupedData).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedData)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, data]) => (
            <Card key={month} className="bg-gradient-to-r from-blue-50 to-white border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">{data.label}</p>
                    <p className="text-2xl font-bold text-blue-900">
                      Rp {data.total.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-blue-500">{data.items.length} transaksi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pendapatan Worker</CardTitle>
              <CardDescription>
                Kelola data pendapatan worker franchise
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              {canWrite && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingItem(null);
                      setFormData({ code: '', jobdesk: '', fee: '', worker_id: '' });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Pendapatan
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pendapatan Worker' : 'Tambah Pendapatan Worker'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="code">Kode</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="jobdesk">Job Desk</Label>
                      <Input
                        id="jobdesk"
                        value={formData.jobdesk}
                        onChange={(e) => setFormData({ ...formData, jobdesk: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="fee">Fee</Label>
                      <Input
                        id="fee"
                        type="number"
                        value={formData.fee}
                        onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="worker">Worker</Label>
                      <Select 
                        value={formData.worker_id} 
                        onValueChange={(value) => setFormData({ ...formData, worker_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih worker" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">
                      {editingItem ? 'Update' : 'Tambah'} Pendapatan
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Cari (Kode, Job Desk, Worker)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Cari data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="month-filter">Filter Bulan</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua bulan" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-white">
                  <SelectItem value="all">Semua bulan</SelectItem>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="worker-filter">Filter Worker</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua worker" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-white">
                  <SelectItem value="all">Semua worker</SelectItem>
                  <div className="p-2">
                    <Input
                      placeholder="Cari worker..."
                      value={workerSearchTerm}
                      onChange={(e) => setWorkerSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {filteredWorkers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Job Desk</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id} className="hover:bg-blue-50/50">
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.jobdesk}</TableCell>
                  <TableCell>{getWorkerName(item.worker_id)}</TableCell>
                  <TableCell>Rp {item.fee.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                    {searchTerm || (selectedMonth && selectedMonth !== 'all') || (selectedWorker && selectedWorker !== 'all')
                      ? 'Tidak ada data yang sesuai dengan filter' 
                      : 'Belum ada data pendapatan worker'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}