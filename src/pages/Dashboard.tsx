import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { exportToExcel } from '@/utils/excelUtils';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users,
  CreditCard,
  Wallet,
  BarChart3,
  Calendar,
  Percent,
  Search,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DashboardStats {
  totalFranchises?: number;
  totalWorkerIncome?: number;
  totalAdminIncome?: number;
  totalExpenses?: number;
  totalWorkers?: number;
  totalSalaryWithdrawals?: number;
  thisMonthWorkerIncome?: number;
  thisMonthAdminIncome?: number;
  thisMonthExpenses?: number;
  profitSharingPercentage?: number;
  adminProfitShare?: number;
  thisMonthProfitSharing?: number;
  thisMonthTotalExpenses?: number;
}

interface MonthlySummary {
  month: string;
  adminIncome: number;
  workerIncome: number;
  expenses: number;
  omset?: number;
  profitSharing?: number;
}

const Dashboard = () => {
  const { userRole, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchDashboardStats();
    fetchMonthlySummary();
  }, [userRole]);

  const fetchDashboardStats = async () => {
    if (!userRole || !user) return;

    setLoading(true);
    try {
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const newStats: DashboardStats = {};

      if (userRole.role === 'super_admin') {
        // Fetch all franchises
        const { data: franchises } = await supabase
          .from('franchises')
          .select('id');
        newStats.totalFranchises = franchises?.length || 0;

        // Fetch global stats
        const { data: workerIncome } = await supabase
          .from('worker_income')
          .select('fee');
        newStats.totalWorkerIncome = workerIncome?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;

        const { data: adminIncome } = await supabase
          .from('admin_income')
          .select('nominal');
        newStats.totalAdminIncome = adminIncome?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

        const { data: expenses } = await supabase
          .from('expenses')
          .select('nominal');
        newStats.totalExpenses = expenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

        const { data: workers } = await supabase
          .from('workers')
          .select('id');
        newStats.totalWorkers = workers?.length || 0;

        // Fetch current month profit sharing from all franchises
        const currentMonthYear = format(new Date(), 'yyyy-MM');
        const { data: profitSharing } = await supabase
          .from('franchise_profit_sharing')
          .select('share_nominal')
          .eq('month_year', currentMonthYear);
        newStats.thisMonthProfitSharing = profitSharing?.reduce((sum, item) => sum + Number(item.share_nominal), 0) || 0;

        // Fetch current month expenses from all franchises
        const { data: thisMonthExpenses } = await supabase
          .from('expenses')
          .select('nominal, tanggal')
          .gte('tanggal', startOfMonth.toISOString())
          .lt('tanggal', endOfMonth.toISOString());
        newStats.thisMonthTotalExpenses = thisMonthExpenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
      } else {
        // Franchise-scoped stats
        const franchiseId = userRole.franchise_id;

        if (franchiseId) {
          const { data: workerIncome } = await supabase
            .from('worker_income')
            .select('fee, tanggal')
            .eq('franchise_id', franchiseId);
          
          newStats.totalWorkerIncome = workerIncome?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;
          newStats.thisMonthWorkerIncome = workerIncome?.filter(item => {
            const date = new Date(item.tanggal);
            return date >= startOfMonth && date <= endOfMonth;
          }).reduce((sum, item) => sum + Number(item.fee), 0) || 0;

          const { data: adminIncome } = await supabase
            .from('admin_income')
            .select('nominal, tanggal')
            .eq('franchise_id', franchiseId);
          
          newStats.totalAdminIncome = adminIncome?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
          newStats.thisMonthAdminIncome = adminIncome?.filter(item => {
            const date = new Date(item.tanggal);
            return date >= startOfMonth && date <= endOfMonth;
          }).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          const { data: expenses } = await supabase
            .from('expenses')
            .select('nominal, tanggal')
            .eq('franchise_id', franchiseId);
          
          newStats.totalExpenses = expenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
          newStats.thisMonthExpenses = expenses?.filter(item => {
            const date = new Date(item.tanggal);
            return date >= startOfMonth && date <= endOfMonth;
          }).reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          const { data: workers } = await supabase
            .from('workers')
            .select('id')
            .eq('franchise_id', franchiseId);
          newStats.totalWorkers = workers?.length || 0;

          const { data: salaryWithdrawals } = await supabase
            .from('salary_withdrawals')
            .select('amount')
            .eq('franchise_id', franchiseId);
          newStats.totalSalaryWithdrawals = salaryWithdrawals?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

          // Fetch profit sharing settings
          const currentMonthYear = format(new Date(), 'yyyy-MM');
          const { data: profitSharing } = await supabase
            .rpc('get_franchise_profit_sharing', {
              target_franchise_id: franchiseId,
              target_month: currentMonthYear
            });
          
          if (profitSharing && profitSharing.length > 0) {
            newStats.profitSharingPercentage = profitSharing[0].admin_percentage;
            const monthlyRevenue = (newStats.thisMonthWorkerIncome || 0) + (newStats.thisMonthAdminIncome || 0);
            newStats.adminProfitShare = monthlyRevenue * (profitSharing[0].admin_percentage / 100);
          }
        }
      }

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlySummary = async () => {
    if (!userRole || !user) return;

    setSummaryLoading(true);
    try {
      if (userRole.role === 'super_admin') {
        // Fetch monthly summary for all franchises
        const { data: adminIncome } = await supabase
          .from('admin_income')
          .select('nominal, tanggal');
        
        const { data: workerIncome } = await supabase
          .from('worker_income')
          .select('fee, tanggal');
        
        const { data: expenses } = await supabase
          .from('expenses')
          .select('nominal, tanggal');

        // Fetch profit sharing data
        const { data: profitSharing } = await supabase
          .from('franchise_profit_sharing')
          .select('share_nominal, month_year');

        // Group by month
        const monthlyData: { [key: string]: MonthlySummary } = {};

        adminIncome?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, profitSharing: 0 };
          }
          monthlyData[month].adminIncome += Number(item.nominal);
        });

        workerIncome?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, profitSharing: 0 };
          }
          monthlyData[month].workerIncome += Number(item.fee);
        });

        expenses?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, profitSharing: 0 };
          }
          monthlyData[month].expenses += Number(item.nominal);
        });

        profitSharing?.forEach(item => {
          const month = item.month_year;
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, profitSharing: 0 };
          }
          monthlyData[month].profitSharing += Number(item.share_nominal);
        });

        const summaryArray = Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month));
        setMonthlySummary(summaryArray);

      } else if (userRole.franchise_id && (userRole.role === 'franchise' || userRole.role === 'admin_keuangan')) {
        // Fetch monthly summary for specific franchise
        const franchiseId = userRole.franchise_id;

        const { data: adminIncome } = await supabase
          .from('admin_income')
          .select('nominal, tanggal')
          .eq('franchise_id', franchiseId);
        
        const { data: workerIncome } = await supabase
          .from('worker_income')
          .select('fee, tanggal')
          .eq('franchise_id', franchiseId);
        
        const { data: expenses } = await supabase
          .from('expenses')
          .select('nominal, tanggal')
          .eq('franchise_id', franchiseId);

        // Group by month
        const monthlyData: { [key: string]: MonthlySummary } = {};

        adminIncome?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, omset: 0 };
          }
          monthlyData[month].adminIncome += Number(item.nominal);
        });

        workerIncome?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, omset: 0 };
          }
          monthlyData[month].workerIncome += Number(item.fee);
        });

        expenses?.forEach(item => {
          const month = format(new Date(item.tanggal), 'yyyy-MM');
          if (!monthlyData[month]) {
            monthlyData[month] = { month, adminIncome: 0, workerIncome: 0, expenses: 0, omset: 0 };
          }
          monthlyData[month].expenses += Number(item.nominal);
        });

        // Calculate omset and get profit sharing for each month
        for (const monthKey in monthlyData) {
          const data = monthlyData[monthKey];
          const totalRevenue = data.adminIncome + data.workerIncome;
          
          // Get profit sharing for this month
          const { data: profitSharing } = await supabase
            .rpc('get_franchise_profit_sharing', {
              target_franchise_id: franchiseId,
              target_month: monthKey
            });
          
          const profitShareAmount = profitSharing && profitSharing.length > 0 
            ? totalRevenue * (profitSharing[0].admin_percentage / 100) 
            : totalRevenue * 0.2; // default 20%

          data.omset = totalRevenue - data.expenses - profitShareAmount;
          data.profitSharing = profitShareAmount;
        }

        const summaryArray = Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month));
        setMonthlySummary(summaryArray);
      }
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      super_admin: 'Super Admin',
      franchise: 'Pemilik Franchise',
      admin_keuangan: 'Admin Keuangan',
      admin_marketing: 'Admin Marketing',
      user: 'User'
    };
    return roleNames[role as keyof typeof roleNames] || role;
  };

  const handleExportSummary = () => {
    const exportData = filteredSummary.map(item => ({
      'Bulan': new Date(item.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      'Pendapatan Admin': item.adminIncome,
      'Pendapatan Worker': item.workerIncome,
      'Pengeluaran': item.expenses,
      ...(userRole?.role === 'super_admin' && { 'Total Bagi Hasil': item.profitSharing || 0 }),
      ...(userRole?.role !== 'super_admin' && { 'Omset': item.omset || 0 })
    }));

    exportToExcel(exportData, 'ringkasan_bulanan_dashboard', 'Ringkasan Bulanan');
  };

  // Filter and pagination logic
  const filteredSummary = monthlySummary.filter(item => {
    const monthName = new Date(item.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return monthName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredSummary.length / itemsPerPage);
  const paginatedSummary = filteredSummary.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const shouldShowTable = userRole?.role === 'super_admin' || 
    userRole?.role === 'franchise' || 
    userRole?.role === 'admin_keuangan';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
            <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              Selamat datang, {user?.email}
            </p>
            <Badge variant="secondary">
              {userRole ? getRoleDisplayName(userRole.role) : 'Loading...'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">
            {new Date().toLocaleDateString('id-ID', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {userRole?.role === 'super_admin' ? (
          <>
            <Card className="card-hover bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800">Total Franchise</CardTitle>
                <div className="p-2 bg-blue-500 text-white rounded-full">
                  <Building2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">{stats.totalFranchises || 0}</div>
                <p className="text-xs text-blue-600">Franchise terdaftar</p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Total Pendapatan Worker</CardTitle>
                <div className="p-2 bg-green-500 text-white rounded-full">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalWorkerIncome || 0)}</div>
                <p className="text-xs text-green-600">Keseluruhan franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-800">Total Pendapatan Admin</CardTitle>
                <div className="p-2 bg-purple-500 text-white rounded-full">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalAdminIncome || 0)}</div>
                <p className="text-xs text-purple-600">Keseluruhan franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-800">Total Worker</CardTitle>
                <div className="p-2 bg-orange-500 text-white rounded-full">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">{stats.totalWorkers || 0}</div>
                <p className="text-xs text-orange-600">Worker aktif</p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800">Total Bagi Hasil (Bulan Ini)</CardTitle>
                <div className="p-2 bg-emerald-500 text-white rounded-full">
                  <Percent className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-900">{formatCurrency(stats.thisMonthProfitSharing || 0)}</div>
                <p className="text-xs text-emerald-600">Berdasarkan seluruh franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Total Pengeluaran (Bulan Ini)</CardTitle>
                <div className="p-2 bg-red-500 text-white rounded-full">
                  <CreditCard className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">{formatCurrency(stats.thisMonthTotalExpenses || 0)}</div>
                <p className="text-xs text-red-600">Berdasarkan seluruh franchise</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="card-hover bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800">Pendapatan Worker</CardTitle>
                <div className="p-2 bg-blue-500 text-white rounded-full">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalWorkerIncome || 0)}</div>
                <p className="text-xs text-blue-600">
                  Bulan ini: {formatCurrency(stats.thisMonthWorkerIncome || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-800">Pendapatan Admin</CardTitle>
                <div className="p-2 bg-purple-500 text-white rounded-full">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalAdminIncome || 0)}</div>
                <p className="text-xs text-purple-600">
                  Bulan ini: {formatCurrency(stats.thisMonthAdminIncome || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Pengeluaran</CardTitle>
                <div className="p-2 bg-red-500 text-white rounded-full">
                  <CreditCard className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-900">{formatCurrency(stats.totalExpenses || 0)}</div>
                <p className="text-xs text-red-600">
                  Bulan ini: {formatCurrency(stats.thisMonthExpenses || 0)}
                </p>
              </CardContent>
            </Card>

            {(userRole?.role === 'franchise' || userRole?.role === 'admin_keuangan') && (
              <Card className="card-hover bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-800">Penarikan Gaji</CardTitle>
                  <div className="p-2 bg-green-500 text-white rounded-full">
                    <Wallet className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalSalaryWithdrawals || 0)}</div>
                  <p className="text-xs text-green-600">Total penarikan</p>
                </CardContent>
              </Card>
            )}

            {userRole?.role === 'admin_marketing' && (
              <Card className="card-hover bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-800">Total Worker</CardTitle>
                  <div className="p-2 bg-orange-500 text-white rounded-full">
                    <Users className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-900">{stats.totalWorkers || 0}</div>
                  <p className="text-xs text-orange-600">Worker aktif</p>
                </CardContent>
              </Card>
            )}

            {userRole?.role === 'franchise' && (
              <Card className="card-hover bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-800">Bagi Hasil Owner</CardTitle>
                  <div className="p-2 bg-emerald-500 text-white rounded-full">
                    <Percent className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-900">{formatCurrency(stats.adminProfitShare || 0)}</div>
                  <p className="text-xs text-emerald-600">
                    Persentase: {stats.profitSharingPercentage || 20}% dari pendapatan bulanan
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Ringkasan Bulan Ini
          </CardTitle>
          <CardDescription>
            Performa keuangan franchise untuk bulan {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {userRole?.role !== 'super_admin' && (
              <>
                <div className="text-center p-4 bg-secondary/20 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency((stats.thisMonthWorkerIncome || 0) + (stats.thisMonthAdminIncome || 0))}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Pendapatan</p>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg">
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(stats.thisMonthExpenses || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(((stats.thisMonthWorkerIncome || 0) + (stats.thisMonthAdminIncome || 0)) - (stats.thisMonthExpenses || 0))}
                  </div>
                  <p className="text-sm text-muted-foreground">Keuntungan Bersih</p>
                </div>
              </>
            )}
            {userRole?.role === 'super_admin' && (
              <div className="col-span-3 text-center p-8">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Management Franchise</h3>
                <p className="text-muted-foreground">
                  Kelola semua franchise dari dashboard ini. Lihat laporan global dan atur user access.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary Table */}
      {shouldShowTable && (
        <Card className="card-hover">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Ringkasan Bulanan
                </CardTitle>
                <CardDescription>
                  {userRole?.role === 'super_admin' 
                    ? 'Ringkasan pendapatan dan pengeluaran seluruh franchise per bulan'
                    : 'Ringkasan pendapatan, pengeluaran, dan omset franchise per bulan'
                  }
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari bulan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <Button onClick={handleExportSummary} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-blue-50">
                      <TableRow>
                        <TableHead className="font-semibold text-blue-900">Bulan</TableHead>
                        <TableHead className="font-semibold text-blue-900 text-right">Pendapatan Admin</TableHead>
                        <TableHead className="font-semibold text-blue-900 text-right">Pendapatan Worker</TableHead>
                        <TableHead className="font-semibold text-blue-900 text-right">Pengeluaran</TableHead>
                        {userRole?.role === 'super_admin' && (
                          <TableHead className="font-semibold text-blue-900 text-right">Total Bagi Hasil</TableHead>
                        )}
                        {userRole?.role !== 'super_admin' && (
                          <TableHead className="font-semibold text-blue-900 text-right">Omset</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSummary.map((item, index) => (
                        <TableRow key={item.month} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <TableCell className="font-medium">
                            {new Date(item.month + '-01').toLocaleDateString('id-ID', { 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(item.adminIncome)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">
                            {formatCurrency(item.workerIncome)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {formatCurrency(item.expenses)}
                          </TableCell>
                          {userRole?.role === 'super_admin' && (
                            <TableCell className="text-right text-purple-600 font-medium">
                              {formatCurrency(item.profitSharing || 0)}
                            </TableCell>
                          )}
                          {userRole?.role !== 'super_admin' && (
                            <TableCell className="text-right text-emerald-600 font-semibold">
                              {formatCurrency(item.omset || 0)}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      
                      {/* Footer with totals */}
                      {paginatedSummary.length > 0 && (
                        <TableRow className="bg-blue-100 font-semibold">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right text-green-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.adminIncome, 0))}
                          </TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.workerIncome, 0))}
                          </TableCell>
                          <TableCell className="text-right text-red-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.expenses, 0))}
                          </TableCell>
                          {userRole?.role === 'super_admin' && (
                            <TableCell className="text-right text-purple-700 font-bold">
                              {formatCurrency(paginatedSummary.reduce((sum, item) => sum + (item.profitSharing || 0), 0))}
                            </TableCell>
                          )}
                          {userRole?.role !== 'super_admin' && (
                            <TableCell className="text-right text-emerald-700 font-bold">
                              {formatCurrency(paginatedSummary.reduce((sum, item) => sum + (item.omset || 0), 0))}
                            </TableCell>
                          )}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredSummary.length)} dari {filteredSummary.length} data
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {filteredSummary.length === 0 && !summaryLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Tidak ada data yang sesuai dengan pencarian' : 'Belum ada data ringkasan bulanan'}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;