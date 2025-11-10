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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  const [cardFilterMonth, setCardFilterMonth] = useState('all');
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
    <div className="touch-spacing space-y-4">
      {/* Header with Total Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b">
        <div>
          <h1 className="text-2xl font-bold">Rekap Worker Wara</h1>
          <p className="text-sm text-muted-foreground">Data pendapatan worker dari semua franchise</p>
        </div>
        <div className="flex gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total Data</p>
            <p className="text-xl font-bold">{totalData}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total Fee</p>
            <p className="text-xl font-bold text-green-600">Rp {totalFee.toLocaleString('id-ID')}</p>
          </Card>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      {Object.keys(groupedData).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter Ringkasan:</span>
            <MonthSelector
              value={cardFilterMonth}
              onValueChange={setCardFilterMonth}
              tables={['worker_income']}
              placeholder="Semua Bulan"
              label=""
              showSearch={false}
              includeAll={true}
            />
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-4">
              {Object.entries(groupedData)
                .sort(([a], [b]) => b.localeCompare(a))
                .filter(([month]) => cardFilterMonth === 'all' || month === cardFilterMonth)
                .map(([month, data]) => (
                <Card key={month} className="hover:shadow-md transition-shadow flex-shrink-0 w-[200px]">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">{data.label}</p>
                    <p className="text-lg font-bold text-green-600">
                      Rp {data.total.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-muted-foreground">{data.items.length} transaksi</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan code, jobdesk, nama worker, franchise..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <MonthSelector
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            tables={['worker_income']}
            placeholder="Semua Bulan"
            label=""
            showSearch={true}
            includeAll={true}
          />
        </div>
        <Button onClick={handleExport} variant="outline" className="whitespace-nowrap">
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">

          {Object.keys(paginatedGroupedData).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada data ditemukan
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(paginatedGroupedData).map(([date, group]) => (
                <div key={date} className="py-3">
                  {/* Date Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 bg-muted/30 p-2 rounded">
                    <div>
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <p className="text-xs text-muted-foreground">{group.items.length} transaksi</p>
                    </div>
                    <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-right">
                      <p className="text-xs">Total</p>
                      <p className="text-sm font-bold">
                        Rp {group.total.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Table for Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="py-2">Kode</TableHead>
                          <TableHead className="py-2">Job Desk</TableHead>
                          <TableHead className="py-2">Worker</TableHead>
                          <TableHead className="py-2">Franchise</TableHead>
                          <TableHead className="py-2 text-right">Fee</TableHead>
                          <TableHead className="py-2">Waktu</TableHead>
                          <TableHead className="py-2 text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item) => (
                          <TableRow key={item.id} className="text-sm">
                            <TableCell className="py-2 font-medium">{item.code}</TableCell>
                            <TableCell className="py-2">{item.jobdesk}</TableCell>
                            <TableCell className="py-2">{item.worker_name}</TableCell>
                            <TableCell className="py-2">
                              <div className="text-xs">
                                <div className="font-medium">{item.franchises?.name || '-'}</div>
                                <div className="text-muted-foreground">
                                  {item.franchises?.franchise_id || '-'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-right font-semibold text-green-600">
                              Rp {item.fee.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              {format(new Date(item.tanggal), 'HH:mm')}
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(item.id)}
                                className="h-7 w-7 text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cards for Mobile */}
                  <div className="md:hidden space-y-2">
                    {group.items.map((item) => (
                      <Card key={item.id} className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs mb-1">
                              <span className="font-medium">{item.code}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground truncate">{item.franchises?.name}</span>
                            </div>
                            <div className="text-sm font-medium mb-1">{item.jobdesk}</div>
                            <div className="text-xs text-muted-foreground">{item.worker_name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-green-600 text-sm">
                              Rp {item.fee.toLocaleString('id-ID')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(item.tanggal), 'HH:mm')}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                              className="h-6 w-6 mt-1 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
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
        </CardContent>
      </Card>

      {/* Pagination */}
      {flattenedData.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={flattenedData.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
