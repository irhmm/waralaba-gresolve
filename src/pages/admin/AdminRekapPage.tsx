import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MonthSelector } from '@/components/ui/month-selector';
import { exportAdminRekapToExcel } from '@/utils/excelUtils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface AdminIncomeData {
  id: string;
  code: string;
  nominal: number;
  tanggal: string;
  franchise_id: string;
  franchises?: {
    id: string;
    name: string;
    franchise_id: string;
  };
}

interface FranchiseMonthlyIncome {
  franchise_id: string;
  franchise_name: string;
  franchise_code: string;
  month_year: string;
  month_display: string;
  total_nominal: number;
  transaction_count: number;
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
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
            id,
            name,
            franchise_id
          )
        `)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setData(adminIncomeData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data: ' + error.message);
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
    let filtered = data;

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.franchises?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.franchises?.franchise_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMonth !== 'all') {
      filtered = filtered.filter(
        (item) => format(new Date(item.tanggal), 'yyyy-MM') === selectedMonth
      );
    }

    return filtered;
  }, [data, searchTerm, selectedMonth]);

  const monthlyData = useMemo(() => {
    const grouped: { [key: string]: FranchiseMonthlyIncome } = {};
    
    filteredData.forEach((item) => {
      const monthKey = format(new Date(item.tanggal), 'yyyy-MM');
      const groupKey = `${item.franchise_id}_${monthKey}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          franchise_id: item.franchise_id,
          franchise_name: item.franchises?.name || 'Unknown',
          franchise_code: item.franchises?.franchise_id || '-',
          month_year: monthKey,
          month_display: format(new Date(item.tanggal), 'MMMM yyyy', { locale: id }),
          total_nominal: 0,
          transaction_count: 0,
        };
      }
      
      grouped[groupKey].total_nominal += Number(item.nominal);
      grouped[groupKey].transaction_count += 1;
    });
    
    return Object.values(grouped).sort((a, b) => {
      if (b.month_year !== a.month_year) {
        return b.month_year.localeCompare(a.month_year);
      }
      return a.franchise_name.localeCompare(b.franchise_name);
    });
  }, [filteredData]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return monthlyData.slice(startIndex, endIndex);
  }, [monthlyData, currentPage, pageSize]);

  const totalPages = Math.ceil(monthlyData.length / pageSize);

  const monthSummaries = useMemo(() => {
    const summaries: { [key: string]: MonthSummary } = {};
    
    data.forEach((item) => {
      const month = format(new Date(item.tanggal), 'MMMM yyyy', { locale: id });
      if (!summaries[month]) {
        summaries[month] = {
          month,
          totalNominal: 0,
          totalTransactions: 0,
        };
      }
      summaries[month].totalNominal += Number(item.nominal);
      summaries[month].totalTransactions += 1;
    });

    return Object.values(summaries)
      .sort((a, b) => b.totalNominal - a.totalNominal)
      .slice(0, 3);
  }, [data]);

  const handleExport = () => {
    exportAdminRekapToExcel(monthlyData);
  };

  const totalFranchises = useMemo(() => {
    const uniqueFranchises = new Set(data.map(item => item.franchise_id));
    return uniqueFranchises.size;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Rekap Admin Wara</h1>
          <p className="text-muted-foreground mt-2">
            Total pendapatan admin per bulan dari setiap franchise
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Franchise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFranchises}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pendapatan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                Rp {filteredData.reduce((sum, item) => sum + Number(item.nominal), 0).toLocaleString('id-ID')}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {monthSummaries.map((summary, index) => (
            <Card key={index} className="bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {summary.month}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-green-600">
                  Rp {summary.totalNominal.toLocaleString('id-ID')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {summary.totalTransactions} transaksi
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Ringkasan Pendapatan Bulanan</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cari franchise..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MonthSelector
                  value={selectedMonth}
                  onValueChange={(value) => {
                    setSelectedMonth(value);
                    setCurrentPage(1);
                  }}
                  tables={['admin_income']}
                  includeAll
                  placeholder="Semua Bulan"
                  label=""
                />
              </div>
              <Button onClick={handleExport} variant="outline" className="sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!isMobile ? (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">Franchise</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Bulan</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Total Pendapatan</th>
                      <th className="h-12 px-4 text-center align-middle font-medium">Jumlah Transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="h-24 text-center text-muted-foreground">
                          Tidak ada data
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item) => (
                        <tr key={`${item.franchise_id}_${item.month_year}`} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium">{item.franchise_name}</div>
                              <div className="text-sm text-muted-foreground">{item.franchise_code}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{item.month_display}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            Rp {item.total_nominal.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {item.transaction_count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Tidak ada data
                  </div>
                ) : (
                  paginatedData.map((item) => (
                    <Card key={`${item.franchise_id}_${item.month_year}`} className="p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="font-medium text-base">{item.franchise_name}</div>
                          <div className="text-sm text-muted-foreground">{item.franchise_code}</div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <div>
                            <div className="text-sm text-muted-foreground">{item.month_display}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.transaction_count} transaksi
                            </div>
                          </div>
                          <div className="font-bold text-lg text-green-600">
                            Rp {item.total_nominal.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={monthlyData.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRekapPage;
