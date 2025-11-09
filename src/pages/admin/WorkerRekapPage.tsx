import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MonthSelector } from '@/components/ui/month-selector';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { RealtimeStatus } from '@/components/ui/realtime-status';
import { Search, Download, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { groupDataByMonth, calculateMonthlyTotals } from '@/utils/dateUtils';
import { exportWorkerRekapToExcel } from '@/utils/excelUtils';

interface WorkerIncome {
  id: string;
  code: string;
  jobdesk: string;
  fee: number;
  worker_name: string;
  tanggal: string;
  franchise_id: string;
  franchises?: {
    name: string;
    franchise_id: string;
  };
}

export default function WorkerRekapPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [workerIncomes, setWorkerIncomes] = useState<WorkerIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isSuperAdmin = userRole?.role === 'super_admin';

  // Realtime subscription
  const { connectionStatus, reconnect } = useRealtimeData({
    table: 'worker_income',
    onInsert: () => fetchData(),
    onUpdate: () => fetchData(),
    onDelete: () => fetchData()
  });

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
    }
  }, [isSuperAdmin]);

  const fetchData = async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('worker_income')
        .select(`
          *,
          franchises!worker_income_franchise_id_fkey(
            name,
            franchise_id
          )
        `)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setWorkerIncomes(data || []);
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

  // Filtered data
  const filteredData = useMemo(() => {
    let filtered = workerIncomes;

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jobdesk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.worker_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.franchises?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.franchises?.franchise_id?.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [workerIncomes, searchTerm, selectedMonth]);

  // Monthly summary
  const groupedData = useMemo(() => {
    const grouped = groupDataByMonth(filteredData);
    return calculateMonthlyTotals(grouped, 'fee');
  }, [filteredData]);

  // Group data by date for daily display
  const groupedByDate = useMemo(() => {
    const grouped = filteredData.reduce((acc, item) => {
      const date = format(new Date(item.tanggal), 'yyyy-MM-dd');
      const dateLabel = format(new Date(item.tanggal), 'dd MMMM yyyy');
      
      if (!acc[date]) {
        acc[date] = {
          label: dateLabel,
          items: [],
          total: 0
        };
      }
      
      acc[date].items.push(item);
      acc[date].total += item.fee;
      
      return acc;
    }, {} as Record<string, { label: string; items: WorkerIncome[]; total: number }>);

    // Sort by date descending
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
    return Object.fromEntries(sortedEntries);
  }, [filteredData]);

  // Calculate totals
  const totalData = filteredData.length;
  const totalFee = filteredData.reduce((sum, item) => sum + item.fee, 0);

  // Pagination logic
  const flattenedData = Object.values(groupedByDate).flatMap(group => group.items);
  const totalPages = Math.max(1, Math.ceil(flattenedData.length / Math.max(1, pageSize)));
  
  const paginatedGroupedData = useMemo(() => {
    const safePageSize = Math.max(1, pageSize);
    const startIndex = (currentPage - 1) * safePageSize;
    const endIndex = startIndex + safePageSize;
    
    let currentIndex = 0;
    const result: Record<string, { label: string; items: WorkerIncome[]; total: number }> = {};
    
    for (const [date, group] of Object.entries(groupedByDate)) {
      const groupEndIndex = currentIndex + group.items.length;
      
      if (groupEndIndex > startIndex && currentIndex < endIndex) {
        const itemsStartIndex = Math.max(0, startIndex - currentIndex);
        const itemsEndIndex = Math.min(group.items.length, endIndex - currentIndex);
        
        if (itemsStartIndex < itemsEndIndex) {
          result[date] = {
            ...group,
            items: group.items.slice(itemsStartIndex, itemsEndIndex)
          };
        }
      }
      
      currentIndex = groupEndIndex;
      if (currentIndex >= endIndex) break;
    }
    
    return result;
  }, [groupedByDate, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth]);

  const handleExport = () => {
    exportWorkerRekapToExcel(filteredData);
    toast({ title: "Success", description: "Data exported to Excel successfully!" });
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

  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Akses ditolak. Halaman ini hanya untuk Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="touch-spacing space-y-6">
      {/* Header with Total Stats */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl text-white">Rekap Worker Wara</CardTitle>
              <CardDescription className="text-blue-100">
                Data pendapatan worker dari semua franchise
              </CardDescription>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-sm text-blue-100">Total Data</p>
                <p className="text-2xl font-bold">{totalData}</p>
              </div>
              <div>
                <p className="text-sm text-blue-100">Total Fee</p>
                <p className="text-2xl font-bold">Rp {totalFee.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Monthly Summary Cards */}
      {Object.keys(groupedData).length > 0 && (
        <div className="responsive-grid sm-2 lg-3">
          {Object.entries(groupedData)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, data]) => (
            <Card key={month} className="bg-gradient-to-r from-blue-50 to-white border-blue-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">{data.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-900">
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
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan code, jobdesk, nama worker, franchise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <MonthSelector
                value={selectedMonth}
                onValueChange={setSelectedMonth}
                tables={['worker_income']}
                placeholder="Semua Bulan"
                showSearch={true}
                includeAll={true}
              />
              <Button onClick={handleExport} variant="outline" className="mobile-btn">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Export Excel</span>
              </Button>
            </div>
          </div>
          <RealtimeStatus status={connectionStatus} onReconnect={reconnect} />
        </CardHeader>

        <CardContent>
          {Object.keys(paginatedGroupedData).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada data ditemukan
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(paginatedGroupedData).map(([date, group]) => (
                <div key={date} className="space-y-4">
                  {/* Date Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{group.label}</h3>
                      <p className="text-sm text-muted-foreground">{group.items.length} transaksi</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">TOTAL HARI INI</p>
                      <p className="text-xl font-bold text-blue-600">
                        Rp {group.total.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Table for Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kode</TableHead>
                          <TableHead>Job Desk</TableHead>
                          <TableHead>Worker</TableHead>
                          <TableHead>Franchise</TableHead>
                          <TableHead className="text-right">Fee</TableHead>
                          <TableHead>Waktu</TableHead>
                          <TableHead className="text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.code}</TableCell>
                            <TableCell>{item.jobdesk}</TableCell>
                            <TableCell>{item.worker_name}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.franchises?.name || '-'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.franchises?.franchise_id || '-'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              Rp {item.fee.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(item.tanggal), 'HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(item.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cards for Mobile */}
                  <div className="md:hidden space-y-3">
                    {group.items.map((item) => (
                      <Card key={item.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{item.code}</div>
                              <div className="text-sm text-muted-foreground">{item.jobdesk}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600">
                                Rp {item.fee.toLocaleString('id-ID')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(item.tanggal), 'HH:mm')}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <div>
                              <div className="text-sm">{item.worker_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.franchises?.name} ({item.franchises?.franchise_id})
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {flattenedData.length > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={flattenedData.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
