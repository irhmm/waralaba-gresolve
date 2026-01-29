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
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { Plus, Edit, Trash2, Search, Download, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { groupDataByMonth, calculateMonthlyTotals, getAvailableMonths } from '@/utils/dateUtils';
import { exportAdminIncomeToExcel } from '@/utils/excelUtils';

interface AdminIncome {
  id: string;
  code: string;
  nominal: number;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

interface Franchise {
  id: string;
  name: string;
  franchise_id: string;
}

export default function AdminIncomePage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [adminIncomes, setAdminIncomes] = useState<AdminIncome[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminIncome | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nominal: '',
    franchise_code: '',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [codeFilter, setCodeFilter] = useState('all');

  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan', 'admin_marketing'].includes(userRole.role);
  const isSuperAdmin = userRole?.role === 'super_admin';

  // Realtime subscription
  const { connectionStatus, reconnect } = useRealtimeData({
    table: 'admin_income',
    franchiseId: isSuperAdmin && selectedFranchise ? selectedFranchise : userRole?.franchise_id,
    onInsert: () => fetchAdminIncomes(),
    onUpdate: () => fetchAdminIncomes(),
    onDelete: () => fetchAdminIncomes()
  });

  useEffect(() => {
    fetchAdminIncomes();
    if (isSuperAdmin) {
      fetchFranchises();
    }
  }, [userRole]);

  useEffect(() => {
    if (isSuperAdmin && selectedFranchise) {
      fetchAdminIncomes();
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

  const fetchAdminIncomes = async () => {
    if (!userRole) return;

    try {
      // Determine franchise_id to filter by
      let franchiseId = userRole.franchise_id;
      if (isSuperAdmin && selectedFranchise) {
        franchiseId = selectedFranchise;
      }

      let query = supabase
        .from('admin_income')
        .select('*')
        .order('tanggal', { ascending: false });

      if (franchiseId) {
        query = query.eq('franchise_id', franchiseId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAdminIncomes(data || []);
    } catch (error) {
      console.error('Error fetching admin incomes:', error);
      toast({
        title: "Error",
        description: "Failed to load admin income data",
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
        code: formData.code,
        nominal: parseFloat(formData.nominal),
        franchise_id: franchise.id,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('admin_income')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Admin income updated successfully!" });
      } else {
        const { error } = await supabase
          .from('admin_income')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Admin income added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ code: '', nominal: '', franchise_code: '' });
      fetchAdminIncomes();
    } catch (error) {
      console.error('Error saving admin income:', error);
      toast({
        title: "Error",
        description: "Failed to save admin income",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (item: AdminIncome) => {
    // Get franchise code from franchise_id
    const { data: franchise } = await supabase
      .from('franchises')
      .select('franchise_id')
      .eq('id', item.franchise_id)
      .single();

    setEditingItem(item);
    setFormData({
      code: item.code,
      nominal: item.nominal.toString(),
      franchise_code: franchise?.franchise_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_income')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Admin income deleted successfully!" });
      fetchAdminIncomes();
    } catch (error) {
      console.error('Error deleting admin income:', error);
      toast({
        title: "Error",
        description: "Failed to delete admin income",
        variant: "destructive",
      });
    }
  };

  // Filtered and grouped data
  const filteredData = useMemo(() => {
    let filtered = adminIncomes;

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Month filter
    if (selectedMonth && selectedMonth !== 'all') {
      filtered = filtered.filter(item => {
        const itemMonth = format(new Date(item.tanggal), 'yyyy-MM');
        return itemMonth === selectedMonth;
      });
    }

    // Code filter
    if (codeFilter && codeFilter !== 'all') {
      filtered = filtered.filter(item =>
        item.code.toLowerCase().includes(codeFilter.toLowerCase())
      );
    }

    return filtered;
  }, [adminIncomes, searchTerm, selectedMonth, codeFilter]);

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
  }, [searchTerm, selectedMonth, codeFilter]);

  const availableMonths = useMemo(() => getAvailableMonths(adminIncomes), [adminIncomes]);

  const availableCodes = useMemo(() => {
    const codes = adminIncomes.map(item => item.code);
    return [...new Set(codes)].sort();
  }, [adminIncomes]);

  const handleExport = () => {
    exportAdminIncomeToExcel(filteredData);
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">

      {/* Card Total Bulan Ini */}
      {(() => {
        const currentMonth = format(new Date(), 'yyyy-MM');
        const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: id });
        const currentMonthData = groupedData[currentMonth];
        
        return (
          <Card className="bg-gradient-to-r from-blue-50 to-white border-blue-200 max-w-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">
                    Total Pendapatan Admin - {currentMonthLabel}
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    Rp {(currentMonthData?.total || 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-blue-500">
                    {currentMonthData?.items?.length || 0} transaksi bulan ini
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan code..."
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
                          tables={['admin_income']}
                          label="Bulan"
                          placeholder="Semua Bulan"
                          showSearch={true}
                          includeAll={true}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="code-filter">Code</Label>
                        <Select value={codeFilter} onValueChange={setCodeFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Semua Code" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-white">
                            <SelectItem value="all">Semua Code</SelectItem>
                            {availableCodes.map((code) => (
                              <SelectItem key={code} value={code}>
                                {code}
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
                          setCodeFilter('all');
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
                      setFormData({ code: '', nominal: '', franchise_code: '' });
                    }} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4" />
                      Tambah Data
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pendapatan Admin' : 'Tambah Pendapatan Admin'}
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
                      <Label htmlFor="nominal">Nominal</Label>
                      <Input
                        id="nominal"
                        type="number"
                        value={formData.nominal}
                        onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                        required
                      />
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
          
          <div>
            <CardTitle>Pendapatan Admin</CardTitle>
            <CardDescription>
              Kelola data pendapatan admin franchise
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id} className="hover:bg-blue-50/50">
                  <TableCell>{item.code}</TableCell>
                  <TableCell>Rp {item.nominal.toLocaleString('id-ID')}</TableCell>
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
                    {searchTerm || (selectedMonth && selectedMonth !== 'all') || (codeFilter && codeFilter !== 'all')
                      ? 'Tidak ada data yang sesuai dengan filter' 
                      : 'Belum ada data pendapatan admin'
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