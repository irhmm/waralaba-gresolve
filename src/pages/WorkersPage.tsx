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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Filter, Download, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Worker {
  id: string;
  nama: string;
  rekening: string;
  wa: string;
  role: string;
  status: string;
  franchise_id: string;
  created_at: string;
}

export default function WorkersPage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Worker | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
    rekening: '',
    wa: '',
    role: '',
    status: 'active',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Access control based on user role
  const canAccess = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan', 'admin_marketing'].includes(userRole.role);
  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role);

  useEffect(() => {
    if (canAccess) {
      fetchWorkers();
    }
  }, [userRole, canAccess]);

  const fetchWorkers = async () => {
    if (!userRole || !canAccess) return;

    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to load workers data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole?.franchise_id) return;

    try {
      const payload = {
        nama: formData.nama,
        rekening: formData.rekening,
        wa: formData.wa,
        role: formData.role,
        status: formData.status,
        franchise_id: userRole.franchise_id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('workers')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker updated successfully!" });
      } else {
        const { error } = await supabase
          .from('workers')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ nama: '', rekening: '', wa: '', role: '', status: 'active' });
      fetchWorkers();
    } catch (error) {
      console.error('Error saving worker:', error);
      toast({
        title: "Error",
        description: "Failed to save worker",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: Worker) => {
    setEditingItem(item);
    setFormData({
      nama: item.nama,
      rekening: item.rekening || '',
      wa: item.wa || '',
      role: item.role || '',
      status: item.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Worker deleted successfully!" });
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast({
        title: "Error",
        description: "Failed to delete worker",
        variant: "destructive",
      });
    }
  };

  // Filtered data
  const filteredData = useMemo(() => {
    let filtered = workers;

    // Global search (nama, rekening, wa, role)
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.rekening && item.rekening.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.wa && item.wa.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.role && item.role.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Role filter
    if (roleFilter && roleFilter !== 'all') {
      filtered = filtered.filter(item => item.role === roleFilter);
    }

    return filtered;
  }, [workers, searchTerm, statusFilter, roleFilter]);

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
  }, [searchTerm, statusFilter, roleFilter]);

  // Get available statuses and roles for filter dropdowns
  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(workers.map(w => w.status))].filter(Boolean);
    return statuses;
  }, [workers]);

  const availableRoles = useMemo(() => {
    const roles = [...new Set(workers.map(w => w.role))].filter(Boolean);
    return roles;
  }, [workers]);

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Nama': item.nama,
      'Rekening': item.rekening || '-',
      'WhatsApp': item.wa || '-',
      'Role': item.role || '-',
      'Status': item.status,
      'Created At': new Date(item.created_at).toLocaleDateString('id-ID')
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Workers Data');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `workers_data_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRoleFilter('all');
  };

  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access workers data.
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
      <Card>
        <CardHeader>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, rekening, WA, role..."
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

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Semua Status" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-white">
                          <SelectItem value="all">Semua Status</SelectItem>
                          {availableStatuses.map(status => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Role Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Semua Role" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-white">
                          <SelectItem value="all">Semua Role</SelectItem>
                          {availableRoles.map(role => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
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
                      setFormData({ nama: '', rekening: '', wa: '', role: '', status: 'active' });
                    }} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4" />
                      Tambah Data
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Worker' : 'Tambah Worker'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="nama">Nama</Label>
                      <Input
                        id="nama"
                        value={formData.nama}
                        onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="rekening">Rekening</Label>
                      <Input
                        id="rekening"
                        value={formData.rekening}
                        onChange={(e) => setFormData({ ...formData, rekening: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="wa">WhatsApp</Label>
                      <Input
                        id="wa"
                        value={formData.wa}
                        onChange={(e) => setFormData({ ...formData, wa: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Input
                        id="role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">
                      {editingItem ? 'Update' : 'Tambah'} Worker
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
          
          <div>
            <CardTitle>Data Worker</CardTitle>
            <CardDescription>
              Kelola data worker franchise
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Rekening</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id} className="hover:bg-blue-50/50">
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>{item.rekening || '-'}</TableCell>
                  <TableCell>{item.wa || '-'}</TableCell>
                  <TableCell>{item.role || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
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
                  <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' || roleFilter !== 'all'
                      ? 'Tidak ada data yang sesuai dengan filter' 
                      : 'Belum ada data worker'
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