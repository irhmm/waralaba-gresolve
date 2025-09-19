import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonthSelector } from '@/components/ui/month-selector';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { Plus, Edit, Trash2, Search, Download, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { groupDataByMonth, calculateMonthlyTotals, getAvailableMonths } from '@/utils/dateUtils';
import { exportExpensesToExcel } from '@/utils/excelUtils';

interface Expense {
  id: string;
  nominal: number;
  keterangan: string;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

export default function ExpensesPage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    nominal: '',
    keterangan: '',
    franchise_code: '',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Only super_admin, franchise, and admin_keuangan can access expenses
  const canAccess = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role);
  const canWrite = canAccess;

  // Realtime subscription
  const { connectionStatus, reconnect } = useRealtimeData({
    table: 'expenses',
    franchiseId: userRole?.franchise_id,
    onInsert: () => fetchExpenses(),
    onUpdate: () => fetchExpenses(),
    onDelete: () => fetchExpenses()
  });

  useEffect(() => {
    if (canAccess) {
      fetchExpenses();
    }
  }, [userRole, canAccess]);

  const fetchExpenses = async () => {
    if (!userRole || !canAccess) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: "Error",
        description: "Failed to load expenses data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
        nominal: parseFloat(formData.nominal),
        keterangan: formData.keterangan,
        franchise_id: franchise.id,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Expense updated successfully!" });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Expense added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ nominal: '', keterangan: '', franchise_code: '' });
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: "Error",
        description: "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (item: Expense) => {
    // Get franchise code from franchise_id
    const { data: franchise } = await supabase
      .from('franchises')
      .select('franchise_id')
      .eq('id', item.franchise_id)
      .single();

    setEditingItem(item);
    setFormData({
      nominal: item.nominal.toString(),
      keterangan: item.keterangan,
      franchise_code: franchise?.franchise_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted successfully!" });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  // Filtered and grouped data
  const filteredData = useMemo(() => {
    let filtered = expenses;

    // Global search (by keterangan)
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.keterangan.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Month filter
    if (selectedMonth && selectedMonth !== 'all') {
      filtered = filtered.filter(item => {
        const itemMonth = format(new Date(item.tanggal), 'yyyy-MM');
        return itemMonth === selectedMonth;
      });
    }

    return filtered;
  }, [expenses, searchTerm, selectedMonth]);

  const groupedData = useMemo(() => {
    const grouped = groupDataByMonth(filteredData);
    return calculateMonthlyTotals(grouped, 'nominal');
  }, [filteredData]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth]);

  const availableMonths = useMemo(() => getAvailableMonths(expenses), [expenses]);

  const handleExport = () => {
    exportExpensesToExcel(filteredData);
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access expenses data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Monthly Summary Cards */}
      {Object.keys(groupedData).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedData)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, data]) => (
            <Card key={month} className="bg-gradient-to-r from-red-50 to-white border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">{data.label}</p>
                    <p className="text-2xl font-bold text-red-900">
                      Rp {data.total.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-red-500">{data.items.length} transaksi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan keterangan..."
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
                          tables={['expenses']}
                          label="Bulan"
                          placeholder="Semua Bulan"
                          showSearch={true}
                          includeAll={true}
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedMonth('all');
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
              
              {canWrite && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingItem(null);
                      setFormData({ nominal: '', keterangan: '', franchise_code: '' });
                    }} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4" />
                      Tambah Data
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                    </DialogTitle>
                  </DialogHeader>
                   <form onSubmit={handleSubmit} className="space-y-4">
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
                      <Label htmlFor="nominal">Nominal</Label>
                      <Input
                        id="nominal"
                        type="number"
                        value={formData.nominal}
                        onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="keterangan">Keterangan</Label>
                      <Textarea
                        id="keterangan"
                        value={formData.keterangan}
                        onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      {editingItem ? 'Update' : 'Tambah'} Pengeluaran
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pengeluaran</CardTitle>
              <CardDescription>
                Kelola data pengeluaran franchise
              </CardDescription>
            </div>
            <RealtimeStatus status={connectionStatus} onReconnect={reconnect} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nominal</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id} className="hover:bg-red-50/50">
                  <TableCell>Rp {item.nominal.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{item.keterangan}</TableCell>
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
              {paginatedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 4 : 3} className="text-center text-muted-foreground">
                    {searchTerm || (selectedMonth && selectedMonth !== 'all')
                      ? 'Tidak ada data yang sesuai dengan filter' 
                      : 'Belum ada data pengeluaran'
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}