import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, Search, Trash2, TrendingUp, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MonthSelector } from '@/components/ui/month-selector';
import { exportAdminRekapToExcel } from '@/utils/excelUtils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminIncomeData {
  id: string;
  code: string;
  nominal: number;
  tanggal: string;
  franchise_id: string;
  franchises: {
    name: string;
    franchise_id: string;
  };
}

interface GroupedData {
  date: string;
  items: AdminIncomeData[];
  totalNominal: number;
}

interface MonthSummary {
  month: string;
  totalNominal: number;
  totalTransactions: number;
}

const AdminRekapPage = () => {
  const [data, setData] = useState<AdminIncomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: adminIncomeData, error } = await supabase
        .from('admin_income')
        .select(`
          id,
          code,
          nominal,
          tanggal,
          franchise_id,
          franchises!admin_income_franchise_id_fkey(
            name,
            franchise_id
          )
        `)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setData(adminIncomeData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeData({
    table: 'admin_income',
    onInsert: fetchData,
    onUpdate: fetchData,
    onDelete: fetchData,
  });

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = 
        item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.franchises?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.franchises?.franchise_id?.toLowerCase().includes(searchTerm.toLowerCase());

      const itemMonth = format(new Date(item.tanggal), 'yyyy-MM');
      const matchesMonth = selectedMonth === 'all' || itemMonth === selectedMonth;

      return matchesSearch && matchesMonth;
    });
  }, [data, searchTerm, selectedMonth]);

  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: AdminIncomeData[] } = {};
    
    filteredData.forEach((item) => {
      const dateKey = format(new Date(item.tanggal), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    const result: GroupedData[] = Object.entries(groups).map(([date, items]) => ({
      date,
      items,
      totalNominal: items.reduce((sum, item) => sum + Number(item.nominal), 0),
    }));

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedByDate.slice(startIndex, endIndex);
  }, [groupedByDate, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(groupedByDate.length / itemsPerPage);

  const monthSummaries = useMemo(() => {
    const summaries: { [key: string]: MonthSummary } = {};
    
    data.forEach((item) => {
      const monthKey = format(new Date(item.tanggal), 'MMMM yyyy', { locale: id });
      if (!summaries[monthKey]) {
        summaries[monthKey] = {
          month: monthKey,
          totalNominal: 0,
          totalTransactions: 0,
        };
      }
      summaries[monthKey].totalNominal += Number(item.nominal);
      summaries[monthKey].totalTransactions += 1;
    });

    return Object.values(summaries)
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3);
  }, [data]);

  const totalData = filteredData.length;
  const totalNominal = filteredData.reduce((sum, item) => sum + Number(item.nominal), 0);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('admin_income')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data berhasil dihapus",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    exportAdminRekapToExcel(filteredData);
    toast({
      title: "Export Berhasil",
      description: "Data telah diexport ke file Excel",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-3 border-b">
        <div>
          <h1 className="text-2xl font-bold">Rekap Admin Wara</h1>
          <p className="text-sm text-muted-foreground">Data pendapatan admin dari semua franchise</p>
        </div>
        <div className="flex gap-2">
          <Card className="p-3 flex items-center gap-2 flex-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Data</p>
              <p className="text-lg font-semibold">{totalData}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-2 flex-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Nominal</p>
              <p className="text-lg font-semibold text-green-600">
                Rp {totalNominal.toLocaleString('id-ID')}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      {monthSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {monthSummaries.map((summary, index) => (
            <Card key={index} className="p-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground capitalize">{summary.month}</p>
                <p className="text-lg font-semibold text-green-600">
                  Rp {summary.totalNominal.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalTransactions} transaksi
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau franchise..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <MonthSelector
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            tables={['admin_income']}
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

      {/* Data Display */}
      {paginatedGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Tidak ada data</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {paginatedGroups.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {format(new Date(group.date), 'dd MMMM yyyy', { locale: id })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({group.items.length} transaksi)
                  </span>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  Total: Rp {group.totalNominal.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Desktop Table */}
              {!isMobile && (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left p-2 font-medium">Kode</th>
                          <th className="text-left p-2 font-medium">Franchise</th>
                          <th className="text-right p-2 font-medium">Nominal</th>
                          <th className="text-center p-2 font-medium">Waktu</th>
                          <th className="text-center p-2 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0 text-sm hover:bg-muted/50">
                            <td className="p-2">{item.code || '-'}</td>
                            <td className="p-2">
                              <div>
                                <p className="font-medium">{item.franchises?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.franchises?.franchise_id}
                                </p>
                              </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-green-600">
                              Rp {Number(item.nominal).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2 text-center text-muted-foreground">
                              {format(new Date(item.tanggal), 'HH:mm')}
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(item.id)}
                                className="h-7 w-7 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Mobile Cards */}
              {isMobile && (
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.franchises?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.franchises?.franchise_id}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Kode: {item.code || '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold text-green-600">
                            Rp {Number(item.nominal).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.tanggal), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(item.id)}
                        className="w-full text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Hapus
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={itemsPerPage}
          totalItems={groupedByDate.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRekapPage;
