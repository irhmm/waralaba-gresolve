import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonthSelector } from '@/components/ui/month-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Download, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { groupDataByMonth, calculateMonthlyTotals, getAvailableMonths } from '@/utils/dateUtils';
import { exportWorkerIncomeToExcel } from '@/utils/excelUtils';

interface WorkerIncome {
  id: string;
  code: string;
  jobdesk: string;
  fee: number;
  worker_name: string;
  tanggal: string;
  franchise_id: string;
  created_by: string;
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
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkerIncome | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    jobdesk: '',
    fee: '',
    worker_name: '',
    franchise_code: '',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWorker, setSelectedWorker] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isSuperAdmin = userRole?.role === 'super_admin';
  const isUser = userRole?.role === 'user';
  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role) && !isUser;

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

  // Filtered and grouped data
  const filteredData = useMemo(() => {
    let filtered = workerIncomes;

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobdesk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.worker_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
      filtered = filtered.filter(item => 
        item.worker_name?.toLowerCase().includes(selectedWorker.toLowerCase())
      );
    }

    return filtered;
  }, [workerIncomes, searchTerm, selectedMonth, selectedWorker]);

  const groupedData = useMemo(() => {
    const grouped = groupDataByMonth(filteredData);
    return calculateMonthlyTotals(grouped, 'fee');
  }, [filteredData]);

  // Pagination logic  
  const totalPages = Math.max(1, Math.ceil(filteredData.length / Math.max(1, pageSize)));
  const paginatedData = useMemo(() => {
    const safePageSize = Math.max(1, pageSize);
    const startIndex = (currentPage - 1) * safePageSize;
    const endIndex = startIndex + safePageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, selectedWorker]);

  const availableMonths = useMemo(() => getAvailableMonths(workerIncomes), [workerIncomes]);

  // Get unique worker names for filter
  const uniqueWorkerNames = useMemo(() => {
    const names = workerIncomes
      .filter(item => item.worker_name)
      .map(item => item.worker_name)
      .filter((name, index, arr) => arr.indexOf(name) === index)
      .sort();
    return names;
  }, [workerIncomes]);

  const handleExport = () => {
    exportWorkerIncomeToExcel(filteredData, []);
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.franchise_code.trim()) {
      toast({
        title: "Error",
        description: "Kode franchise harus diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find franchise by code
      const { data: franchise, error: franchiseError } = await supabase
        .from('franchises')
        .select('id')
        .eq('franchise_id', formData.franchise_code.toUpperCase())
        .single();

      if (franchiseError || !franchise) {
        toast({
          title: "Error",
          description: "Kode franchise tidak ditemukan",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        code: formData.code,
        jobdesk: formData.jobdesk,
        fee: parseFloat(formData.fee),
        worker_id: null,
        worker_name: formData.worker_name,
        franchise_id: franchise.id,
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
      setFormData({ code: '', jobdesk: '', fee: '', worker_name: '', franchise_code: '' });
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

  const handleEdit = async (item: WorkerIncome) => {
    // Get franchise code from franchise_id
    const { data: franchise } = await supabase
      .from('franchises')
      .select('franchise_id')
      .eq('id', item.franchise_id)
      .single();

    setEditingItem(item);
    setFormData({
      code: item.code,
      jobdesk: item.jobdesk,
      fee: item.fee.toString(),
      worker_name: item.worker_name || '',
      franchise_code: franchise?.franchise_id || '',
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
      {isSuperAdmin && !isUser && (
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
        userRole?.role !== 'user' || 
        searchTerm || 
        (selectedMonth && selectedMonth !== 'all') || 
        (selectedWorker && selectedWorker !== 'all')
      ) && (
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
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan code, jobdesk, nama worker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-blue-600">
                    <Filter className="h-4 w-4 text-blue-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-white rounded-lg shadow-lg border z-50">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Filter</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <MonthSelector
                          value={selectedMonth}
                          onValueChange={setSelectedMonth}
                          tables={['worker_income']}
                          label="Bulan"
                          placeholder="Semua Bulan"
                          showSearch={true}
                          includeAll={true}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="worker-filter">Worker</Label>
                        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                          <SelectTrigger>
                            <SelectValue placeholder="Semua Worker" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-white">
                            <SelectItem value="all">Semua Worker</SelectItem>
                            {uniqueWorkerNames.map((workerName) => (
                              <SelectItem key={workerName} value={workerName}>
                                {workerName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedMonth('all');
                          setSelectedWorker('all');
                          setSearchTerm('');
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" onClick={handleExport} className="text-blue-600">
                <Download className="h-4 w-4" />
                Export
              </Button>
              
              {canWrite && !isUser && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                     <Button onClick={() => {
                       setEditingItem(null);
                      setFormData({ code: '', jobdesk: '', fee: '', worker_name: '', franchise_code: '' });
                     }} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4" />
                      Tambah Data
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
                       <Label htmlFor="franchise_code">Kode Franchise</Label>
                       <Input
                         id="franchise_code"
                         value={formData.franchise_code}
                         onChange={(e) => setFormData({ ...formData, franchise_code: e.target.value.toUpperCase() })}
                         placeholder="Contoh: FR-001"
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
                      <Label htmlFor="worker_name">Nama Worker</Label>
                      <Input
                        id="worker_name"
                        value={formData.worker_name}
                        onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                        placeholder="Masukkan nama worker"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        {editingItem ? 'Update' : 'Simpan'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Pendapatan Worker</CardTitle>
          <CardDescription>
            Total: {filteredData.length} data | 
            Total Fee: Rp {filteredData.reduce((sum, item) => sum + item.fee, 0).toLocaleString('id-ID')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Job Desk</TableHead>
                  <TableHead>Nama Worker</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Tanggal</TableHead>
                  {canWrite && <TableHead className="w-[100px]">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 6 : 5} className="h-24 text-center">
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.jobdesk}</TableCell>
                      <TableCell>{item.worker_name || 'N/A'}</TableCell>
                      <TableCell>Rp {item.fee.toLocaleString('id-ID')}</TableCell>
                      <TableCell>{format(new Date(item.tanggal), 'dd/MM/yyyy')}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 0 && pageSize > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredData.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  const newSize = Math.max(1, size || 10);
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}