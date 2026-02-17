import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Search, TrendingUp, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { MonthSelector } from '@/components/ui/month-selector';
import { exportToExcel } from '@/utils/excelUtils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface NetIncomeRow {
  franchise_id: string;
  franchise_name: string;
  franchise_code: string;
  month_year: string;
  month_display: string;
  admin_income: number;
  expenses: number;
  profit_sharing: number;
  net_income: number;
}

const FranchiseNetIncomePage = () => {
  const [adminIncomeData, setAdminIncomeData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [profitSharingData, setProfitSharingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const isMobile = useIsMobile();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [aiRes, expRes, psRes] = await Promise.all([
        supabase
          .from('admin_income')
          .select('nominal, tanggal, franchise_id, franchises!admin_income_franchise_id_fkey(id, name, franchise_id)')
          .order('tanggal', { ascending: false }),
        supabase
          .from('expenses')
          .select('nominal, tanggal, franchise_id, franchises!expenses_franchise_id_fkey(id, name, franchise_id)')
          .order('tanggal', { ascending: false }),
        supabase
          .from('franchise_profit_sharing')
          .select('franchise_id, month_year, share_nominal, franchises!franchise_profit_sharing_franchise_id_fkey(id, name, franchise_id)'),
      ]);

      if (aiRes.error) throw aiRes.error;
      if (expRes.error) throw expRes.error;
      if (psRes.error) throw psRes.error;

      setAdminIncomeData(aiRes.data || []);
      setExpensesData(expRes.data || []);
      setProfitSharingData(psRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeData({ table: 'admin_income', onInsert: fetchData, onUpdate: fetchData, onDelete: fetchData });
  useRealtimeData({ table: 'expenses', onInsert: fetchData, onUpdate: fetchData, onDelete: fetchData });
  useRealtimeData({ table: 'franchise_profit_sharing', onInsert: fetchData, onUpdate: fetchData, onDelete: fetchData });

  const netIncomeData = useMemo(() => {
    const grouped: Record<string, NetIncomeRow> = {};

    // Group admin income
    adminIncomeData.forEach((item) => {
      if (!item.tanggal) return;
      const monthKey = format(new Date(item.tanggal), 'yyyy-MM');
      const key = `${item.franchise_id}_${monthKey}`;
      if (!grouped[key]) {
        grouped[key] = {
          franchise_id: item.franchise_id,
          franchise_name: item.franchises?.name || 'Unknown',
          franchise_code: item.franchises?.franchise_id || '-',
          month_year: monthKey,
          month_display: format(new Date(item.tanggal), 'MMMM yyyy', { locale: id }),
          admin_income: 0,
          expenses: 0,
          profit_sharing: 0,
          net_income: 0,
        };
      }
      grouped[key].admin_income += Number(item.nominal);
    });

    // Group expenses
    expensesData.forEach((item) => {
      if (!item.tanggal) return;
      const monthKey = format(new Date(item.tanggal), 'yyyy-MM');
      const key = `${item.franchise_id}_${monthKey}`;
      if (!grouped[key]) {
        grouped[key] = {
          franchise_id: item.franchise_id,
          franchise_name: item.franchises?.name || 'Unknown',
          franchise_code: item.franchises?.franchise_id || '-',
          month_year: monthKey,
          month_display: format(new Date(item.tanggal), 'MMMM yyyy', { locale: id }),
          admin_income: 0,
          expenses: 0,
          profit_sharing: 0,
          net_income: 0,
        };
      }
      grouped[key].expenses += Number(item.nominal);
    });

    // Group profit sharing
    profitSharingData.forEach((item) => {
      if (!item.month_year) return;
      const key = `${item.franchise_id}_${item.month_year}`;
      if (!grouped[key]) {
        grouped[key] = {
          franchise_id: item.franchise_id,
          franchise_name: item.franchises?.name || 'Unknown',
          franchise_code: item.franchises?.franchise_id || '-',
          month_year: item.month_year,
          month_display: (() => {
            const [y, m] = item.month_year.split('-');
            return format(new Date(parseInt(y), parseInt(m) - 1), 'MMMM yyyy', { locale: id });
          })(),
          admin_income: 0,
          expenses: 0,
          profit_sharing: 0,
          net_income: 0,
        };
      }
      grouped[key].profit_sharing += Number(item.share_nominal || 0);
    });

    // Calculate net income
    Object.values(grouped).forEach((row) => {
      row.net_income = row.admin_income - row.expenses - row.profit_sharing;
    });

    return Object.values(grouped);
  }, [adminIncomeData, expensesData, profitSharingData]);

  const filteredData = useMemo(() => {
    let filtered = netIncomeData;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.franchise_name.toLowerCase().includes(term) ||
          item.franchise_code.toLowerCase().includes(term)
      );
    }

    if (selectedMonth !== 'all') {
      filtered = filtered.filter((item) => item.month_year === selectedMonth);
    }

    return filtered.sort((a, b) => {
      if (b.month_year !== a.month_year) return b.month_year.localeCompare(a.month_year);
      return a.franchise_name.localeCompare(b.franchise_name);
    });
  }, [netIncomeData, searchTerm, selectedMonth]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / Math.max(1, pageSize)));

  const totalNetIncome = useMemo(() => filteredData.reduce((sum, item) => sum + item.net_income, 0), [filteredData]);
  const totalFranchises = useMemo(() => new Set(filteredData.map((i) => i.franchise_id)).size, [filteredData]);

  const handleExport = () => {
    const exportData = filteredData.map((item) => ({
      Franchise: item.franchise_name,
      'Kode Franchise': item.franchise_code,
      Bulan: item.month_display,
      'Pendapatan Admin': item.admin_income,
      Pengeluaran: item.expenses,
      'Bagi Hasil Owner': item.profit_sharing,
      'Laba Bersih': item.net_income,
    }));
    exportToExcel(exportData, 'laba_bersih_franchise', 'Laba Bersih');
  };

  const formatCurrency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

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
          <h1 className="text-3xl font-bold">Laba Bersih Franchise</h1>
          <p className="text-muted-foreground mt-2">
            Pendapatan bersih per franchise per bulan (Admin - Pengeluaran - Bagi Hasil)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Laba Bersih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalNetIncome >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(totalNetIncome)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Jumlah Franchise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFranchises}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Detail Laba Bersih per Franchise</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cari franchise..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-9"
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MonthSelector
                  value={selectedMonth}
                  onValueChange={(v) => { setSelectedMonth(v); setCurrentPage(1); }}
                  tables={['admin_income', 'expenses', 'franchise_profit_sharing']}
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
                      <th className="h-12 px-4 text-right align-middle font-medium">Pendapatan Admin</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Pengeluaran</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Bagi Hasil Owner</th>
                      <th className="h-12 px-4 text-right align-middle font-medium">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-24 text-center text-muted-foreground">
                          Tidak ada data
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item) => (
                        <tr key={`${item.franchise_id}_${item.month_year}`} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.franchise_name}</div>
                            <div className="text-sm text-muted-foreground">{item.franchise_code}</div>
                          </td>
                          <td className="px-4 py-3">{item.month_display}</td>
                          <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(item.admin_income)}</td>
                          <td className="px-4 py-3 text-right text-destructive">{formatCurrency(item.expenses)}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.profit_sharing)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${item.net_income >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {formatCurrency(item.net_income)}
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
                  <div className="text-center py-8 text-muted-foreground">Tidak ada data</div>
                ) : (
                  paginatedData.map((item) => (
                    <Card key={`${item.franchise_id}_${item.month_year}`} className="p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="font-medium">{item.franchise_name}</div>
                          <div className="text-sm text-muted-foreground">{item.franchise_code} • {item.month_display}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
                          <div>
                            <span className="text-muted-foreground">Pendapatan Admin</span>
                            <div className="text-blue-600 font-medium">{formatCurrency(item.admin_income)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pengeluaran</span>
                            <div className="text-destructive font-medium">{formatCurrency(item.expenses)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bagi Hasil</span>
                            <div className="text-orange-600 font-medium">{formatCurrency(item.profit_sharing)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Laba Bersih</span>
                            <div className={`font-bold ${item.net_income >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                              {formatCurrency(item.net_income)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {filteredData.length > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
};

export default FranchiseNetIncomePage;
