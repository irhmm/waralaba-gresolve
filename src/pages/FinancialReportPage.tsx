import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter, Download, Calendar, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { getAvailableMonths } from '@/utils/dateUtils';
import { exportToExcel } from '@/utils/excelUtils';
import { toast } from 'sonner';

interface FranchiseData {
  id: string;
  name: string;
  admin_income: number;
  worker_income: number;
  expenses: number;
  revenue: number;
  profit_sharing?: {
    admin_percentage: number;
    share_nominal: number;
  };
}

interface FinancialSummary {
  total_revenue: number;
  total_admin_income: number;
  total_worker_income: number;
  total_expenses: number;
  total_profit_sharing: number;
}

const FinancialReportPage = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedFranchise, setSelectedFranchise] = useState<string>('all');
  const [franchises, setFranchises] = useState<any[]>([]);
  const [reportData, setReportData] = useState<FranchiseData[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    total_revenue: 0,
    total_admin_income: 0,
    total_worker_income: 0,
    total_expenses: 0,
    total_profit_sharing: 0
  });
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);

  const isSuperAdmin = userRole?.role === 'super_admin';
  const isFranchise = userRole?.role === 'franchise';
  const isAdminKeuangan = userRole?.role === 'admin_keuangan';

  useEffect(() => {
    loadInitialData();
  }, [userRole]);

  useEffect(() => {
    if (selectedMonth) {
      loadReportData();
    }
  }, [selectedMonth, selectedFranchise, userRole]);

  const loadInitialData = async () => {
    if (!userRole) return;

    try {
      // Load franchises for super admin
      if (isSuperAdmin) {
        const { data: franchisesData } = await supabase
          .from('franchises')
          .select('id, name')
          .order('name');
        setFranchises(franchisesData || []);
      }

      // Load available months from admin_income
      const { data: adminIncomeData } = await supabase
        .from('admin_income')
        .select('tanggal')
        .order('tanggal', { ascending: false });

      if (adminIncomeData) {
        const months = getAvailableMonths(adminIncomeData);
        setAvailableMonths(months);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Gagal memuat data awal');
    }
  };

  const loadReportData = async () => {
    if (!userRole || !selectedMonth) return;

    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().split('T')[0];

      let franchiseFilter = '';
      if (isSuperAdmin && selectedFranchise !== 'all') {
        franchiseFilter = selectedFranchise;
      } else if (!isSuperAdmin && userRole.franchise_id) {
        franchiseFilter = userRole.franchise_id;
      }

      // Build base query conditions
      const baseConditions = `tanggal >= '${startDate}' AND tanggal < '${endDate}'`;
      const franchiseCondition = franchiseFilter ? ` AND franchise_id = '${franchiseFilter}'` : '';

      // Load admin income
      const { data: adminIncomeData } = await supabase
        .from('admin_income')
        .select('franchise_id, nominal, franchises(name)')
        .filter('tanggal', 'gte', startDate)
        .filter('tanggal', 'lt', endDate)
        .then(result => {
          if (franchiseFilter) {
            return supabase
              .from('admin_income')
              .select('franchise_id, nominal, franchises(name)')
              .filter('tanggal', 'gte', startDate)
              .filter('tanggal', 'lt', endDate)
              .eq('franchise_id', franchiseFilter);
          }
          return result;
        });

      // Load worker income
      const { data: workerIncomeData } = await supabase
        .from('worker_income')
        .select('franchise_id, fee, franchises(name)')
        .filter('tanggal', 'gte', startDate)
        .filter('tanggal', 'lt', endDate)
        .then(result => {
          if (franchiseFilter) {
            return supabase
              .from('worker_income')
              .select('franchise_id, fee, franchises(name)')
              .filter('tanggal', 'gte', startDate)
              .filter('tanggal', 'lt', endDate)
              .eq('franchise_id', franchiseFilter);
          }
          return result;
        });

      // Load expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('franchise_id, nominal, franchises(name)')
        .filter('tanggal', 'gte', startDate)
        .filter('tanggal', 'lt', endDate)
        .then(result => {
          if (franchiseFilter) {
            return supabase
              .from('expenses')
              .select('franchise_id, nominal, franchises(name)')
              .filter('tanggal', 'gte', startDate)
              .filter('tanggal', 'lt', endDate)
              .eq('franchise_id', franchiseFilter);
          }
          return result;
        });

      // Load profit sharing data
      let profitSharingData = null;
      if (isSuperAdmin || isFranchise) {
        const { data } = await supabase
          .from('franchise_profit_sharing')
          .select('franchise_id, admin_percentage, share_nominal, franchises(name)')
          .eq('month_year', selectedMonth);
        profitSharingData = data;
      }

      // Process data by franchise
      const franchiseMap = new Map();

      // Process admin income
      adminIncomeData?.forEach(item => {
        const franchiseId = item.franchise_id;
        if (!franchiseMap.has(franchiseId)) {
          franchiseMap.set(franchiseId, {
            id: franchiseId,
            name: item.franchises?.name || 'Unknown',
            admin_income: 0,
            worker_income: 0,
            expenses: 0,
            revenue: 0
          });
        }
        franchiseMap.get(franchiseId).admin_income += Number(item.nominal);
      });

      // Process worker income
      workerIncomeData?.forEach(item => {
        const franchiseId = item.franchise_id;
        if (!franchiseMap.has(franchiseId)) {
          franchiseMap.set(franchiseId, {
            id: franchiseId,
            name: item.franchises?.name || 'Unknown',
            admin_income: 0,
            worker_income: 0,
            expenses: 0,
            revenue: 0
          });
        }
        franchiseMap.get(franchiseId).worker_income += Number(item.fee);
      });

      // Process expenses
      expensesData?.forEach(item => {
        const franchiseId = item.franchise_id;
        if (!franchiseMap.has(franchiseId)) {
          franchiseMap.set(franchiseId, {
            id: franchiseId,
            name: item.franchises?.name || 'Unknown',
            admin_income: 0,
            worker_income: 0,
            expenses: 0,
            revenue: 0
          });
        }
        franchiseMap.get(franchiseId).expenses += Number(item.nominal);
      });

      // Calculate revenue and add profit sharing
      const processedData: FranchiseData[] = Array.from(franchiseMap.values()).map(franchise => {
        const revenue = franchise.admin_income + franchise.worker_income - franchise.expenses;
        const result = { ...franchise, revenue };

        // Add profit sharing info for applicable roles
        if ((isSuperAdmin || isFranchise) && profitSharingData) {
          const profitShare = profitSharingData.find(ps => ps.franchise_id === franchise.id);
          if (profitShare) {
            result.profit_sharing = {
              admin_percentage: profitShare.admin_percentage,
              share_nominal: profitShare.share_nominal
            };
          }
        }

        return result;
      });

      // Calculate summary
      const newSummary = processedData.reduce((acc, franchise) => ({
        total_revenue: acc.total_revenue + franchise.revenue,
        total_admin_income: acc.total_admin_income + franchise.admin_income,
        total_worker_income: acc.total_worker_income + franchise.worker_income,
        total_expenses: acc.total_expenses + franchise.expenses,
        total_profit_sharing: acc.total_profit_sharing + (franchise.profit_sharing?.share_nominal || 0)
      }), {
        total_revenue: 0,
        total_admin_income: 0,
        total_worker_income: 0,
        total_expenses: 0,
        total_profit_sharing: 0
      });

      setReportData(processedData);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = reportData.map(item => {
      const baseData = {
        'Nama Franchise': item.name,
        'Pendapatan Admin': item.admin_income,
        'Pendapatan Worker': item.worker_income,
        'Total Pengeluaran': item.expenses,
        'Omset': item.revenue
      };

      if (item.profit_sharing && (isSuperAdmin || isFranchise)) {
        return {
          ...baseData,
          'Persentase Admin (%)': item.profit_sharing.admin_percentage,
          'Nominal Bagi Hasil': item.profit_sharing.share_nominal
        };
      }

      return baseData;
    });

    const filename = `laporan_keuangan_${selectedMonth}${selectedFranchise !== 'all' ? `_${selectedFranchise}` : ''}`;
    exportToExcel(exportData, filename, 'Laporan Keuangan');
    toast.success('Laporan berhasil diexport ke Excel');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getSelectedMonthLabel = () => {
    const monthObj = availableMonths.find(m => m.value === selectedMonth);
    return monthObj ? monthObj.label : selectedMonth;
  };

  if (!userRole) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Laporan Keuangan</h1>
        <div className="flex gap-2">
          {/* Filter Button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bulan</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSuperAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Franchise</label>
                  <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih franchise" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Franchise</SelectItem>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id}>
                          {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Export Button */}
          <Button onClick={handleExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm border border-border/50 rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Omset
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(summary.total_revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getSelectedMonthLabel()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-border/50 rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pengeluaran
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(summary.total_expenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getSelectedMonthLabel()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border border-border/50 rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendapatan Admin
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(summary.total_admin_income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getSelectedMonthLabel()}
            </p>
          </CardContent>
        </Card>

        {(isSuperAdmin || isFranchise) && (
          <Card className="bg-white shadow-sm border border-border/50 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Bagi Hasil
              </CardTitle>
              <Percent className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(summary.total_profit_sharing)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {getSelectedMonthLabel()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Report Table */}
      <Card className="bg-white shadow-sm border border-border/50 rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detail Laporan Keuangan - {getSelectedMonthLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Memuat data...</div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Franchise</TableHead>
                    <TableHead className="text-right">Pendapatan Admin</TableHead>
                    <TableHead className="text-right">Pendapatan Worker</TableHead>
                    <TableHead className="text-right">Pengeluaran</TableHead>
                    <TableHead className="text-right">Omset</TableHead>
                    {(isSuperAdmin || isFranchise) && (
                      <>
                        <TableHead className="text-right">Admin %</TableHead>
                        <TableHead className="text-right">Bagi Hasil</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin || isFranchise ? 7 : 5} className="text-center py-8 text-muted-foreground">
                        Tidak ada data untuk periode ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.admin_income)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.worker_income)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.expenses)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.revenue)}</TableCell>
                        {(isSuperAdmin || isFranchise) && (
                          <>
                            <TableCell className="text-right">
                              {item.profit_sharing ? `${item.profit_sharing.admin_percentage}%` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.profit_sharing ? formatCurrency(item.profit_sharing.share_nominal) : '-'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialReportPage;