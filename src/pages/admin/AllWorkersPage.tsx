import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Filter, Download, Search } from 'lucide-react';
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
  franchises: {
    name: string;
    franchise_id: string;
  };
}

export default function AllWorkersPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [franchiseFilter, setFranchiseFilter] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Access control
  const isSuperAdmin = userRole?.role === 'super_admin';

  // Real-time subscription
  const { isConnected, connectionStatus, reconnect } = useRealtimeData({
    table: 'workers',
    onInsert: () => fetchWorkers(),
    onUpdate: () => fetchWorkers(),
    onDelete: () => fetchWorkers(),
  });

  useEffect(() => {
    if (isSuperAdmin) {
      fetchWorkers();
    }
  }, [isSuperAdmin]);

  const fetchWorkers = async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          id,
          nama,
          rekening,
          wa,
          role,
          status,
          franchise_id,
          created_at,
          franchises:franchise_id (
            name,
            franchise_id
          )
        `)
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

  // Filtered data
  const filteredData = useMemo(() => {
    let filtered = workers;

    // Global search (nama, rekening, wa, role, franchise name)
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.rekening && item.rekening.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.wa && item.wa.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.role && item.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.franchises?.name && item.franchises.name.toLowerCase().includes(searchTerm.toLowerCase()))
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

    // Franchise filter
    if (franchiseFilter && franchiseFilter !== 'all') {
      filtered = filtered.filter(item => item.franchise_id === franchiseFilter);
    }

    return filtered;
  }, [workers, searchTerm, statusFilter, roleFilter, franchiseFilter]);

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
  }, [searchTerm, statusFilter, roleFilter, franchiseFilter]);

  // Get available options for filter dropdowns
  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(workers.map(w => w.status))].filter(Boolean);
    return statuses;
  }, [workers]);

  const availableRoles = useMemo(() => {
    const roles = [...new Set(workers.map(w => w.role))].filter(Boolean);
    return roles;
  }, [workers]);

  const availableFranchises = useMemo(() => {
    const franchises = [...new Map(
      workers
        .filter(w => w.franchises)
        .map(w => [w.franchise_id, { id: w.franchise_id, name: w.franchises.name }])
    ).values()];
    return franchises.sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Franchise': item.franchises?.name || '-',
      'Franchise ID': item.franchises?.franchise_id || '-',
      'Nama': item.nama,
      'Rekening': item.rekening || '-',
      'WhatsApp': item.wa || '-',
      'Role': item.role || '-',
      'Status': item.status,
      'Created At': new Date(item.created_at).toLocaleDateString('id-ID')
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Workers Data');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `all_workers_data_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRoleFilter('all');
    setFranchiseFilter('all');
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page. Only super admins can view all workers data.
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
                placeholder="Cari nama, rekening, WA, role, franchise..."
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

                    {/* Franchise Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="franchise">Franchise</Label>
                      <Select value={franchiseFilter} onValueChange={setFranchiseFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Semua Franchise" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-white">
                          <SelectItem value="all">Semua Franchise</SelectItem>
                          {availableFranchises.map(franchise => (
                            <SelectItem key={franchise.id} value={franchise.id}>
                              {franchise.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Worker - Semua Franchise</CardTitle>
              <CardDescription>
                Total: {filteredData.length} worker dari semua franchise
              </CardDescription>
            </div>
            <RealtimeStatus status={connectionStatus} onReconnect={reconnect} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Franchise</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Rekening</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item) => (
                <TableRow key={item.id} className="hover:bg-blue-50/50">
                  <TableCell>
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      {item.franchises?.name || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.nama}</TableCell>
                  <TableCell>{item.rekening || '-'}</TableCell>
                  <TableCell>{item.wa || '-'}</TableCell>
                  <TableCell>{item.role || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' || franchiseFilter !== 'all'
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
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
