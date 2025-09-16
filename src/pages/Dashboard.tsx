import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users,
  CreditCard,
  Wallet,
  BarChart3,
  Calendar,
  Percent
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

const Dashboard = () => {
  const { userRole, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
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
            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Franchise</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFranchises || 0}</div>
                <p className="text-xs text-muted-foreground">Franchise terdaftar</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendapatan Worker</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalWorkerIncome || 0)}</div>
                <p className="text-xs text-muted-foreground">Keseluruhan franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pendapatan Admin</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalAdminIncome || 0)}</div>
                <p className="text-xs text-muted-foreground">Keseluruhan franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Worker</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalWorkers || 0}</div>
                <p className="text-xs text-muted-foreground">Worker aktif</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bagi Hasil (Bulan Ini)</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthProfitSharing || 0)}</div>
                <p className="text-xs text-muted-foreground">Berdasarkan seluruh franchise</p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pengeluaran (Bulan Ini)</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthTotalExpenses || 0)}</div>
                <p className="text-xs text-muted-foreground">Berdasarkan seluruh franchise</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendapatan Worker</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalWorkerIncome || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Bulan ini: {formatCurrency(stats.thisMonthWorkerIncome || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendapatan Admin</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalAdminIncome || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Bulan ini: {formatCurrency(stats.thisMonthAdminIncome || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pengeluaran</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Bulan ini: {formatCurrency(stats.thisMonthExpenses || 0)}
                </p>
              </CardContent>
            </Card>

            {(userRole?.role === 'franchise' || userRole?.role === 'admin_keuangan') && (
              <Card className="card-hover">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Penarikan Gaji</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalSalaryWithdrawals || 0)}</div>
                  <p className="text-xs text-muted-foreground">Total penarikan</p>
                </CardContent>
              </Card>
            )}

            {userRole?.role === 'admin_marketing' && (
              <Card className="card-hover">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Worker</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalWorkers || 0}</div>
                  <p className="text-xs text-muted-foreground">Worker aktif</p>
                </CardContent>
              </Card>
            )}

            {userRole?.role === 'franchise' && (
              <Card className="card-hover">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bagi Hasil Owner</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.adminProfitShare || 0)}</div>
                  <p className="text-xs text-muted-foreground">
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
    </div>
  );
};

export default Dashboard;