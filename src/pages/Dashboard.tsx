import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format, subMonths, startOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { exportToExcel } from '@/utils/excelUtils';
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users,
  CreditCard,
  BarChart3,
  Calendar,
  Percent,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Activity,
  Clock
} from 'lucide-react';
import { id } from 'date-fns/locale';

interface DashboardStats {
  totalFranchises?: number;
  totalWorkerIncome?: number;
  totalAdminIncome?: number;
  totalExpenses?: number;
  totalWorkers?: number;
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

interface ChartData {
  month: string;
  monthLabel: string;
  adminIncome: number;
  workerIncome: number;
  expenses: number;
  omset: number;
}

interface ProfitSharingChartData {
  month: string;
  monthLabel: string;
  [franchiseName: string]: number | string;
}

interface RecentActivity {
  franchise_name: string;
  activity_type: 'Admin Income' | 'Worker Income' | 'Expenses';
  created_at: string;
  detail: string;
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
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [profitSharingChartData, setProfitSharingChartData] = useState<ProfitSharingChartData[]>([]);
  const [franchiseColors, setFranchiseColors] = useState<{ [key: string]: string }>({});
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchMonthlySummary();
    if (userRole?.role === 'franchise' || userRole?.role === 'admin_keuangan') {
      fetchChartData();
    }
    if (userRole?.role === 'super_admin') {
      fetchProfitSharingChartData();
      fetchRecentActivities();
    }
  }, [userRole]);

  const fetchDashboardStats = async () => {
    if (!userRole || !user) return;

    setLoading(true);
    try {
      // Use proper date filtering like FinancialReportPage
      const currentMonthYear = format(new Date(), 'yyyy-MM');
      const startDate = `${currentMonthYear}-01`;
      const nextMonthDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1));
      const endDate = nextMonthDate.toISOString().split('T')[0];

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
          .select('nominal')
          .gte('tanggal', startDate)
          .lt('tanggal', endDate);
        newStats.thisMonthTotalExpenses = thisMonthExpenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
      } else {
        // Franchise-scoped stats
        const franchiseId = userRole.franchise_id;

        if (franchiseId) {
          // Worker Income - Total
          const { data: allWorkerIncome } = await supabase
            .from('worker_income')
            .select('fee')
            .eq('franchise_id', franchiseId);
          newStats.totalWorkerIncome = allWorkerIncome?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;

          // Worker Income - This Month (with database filter)
          const { data: thisMonthWorkerIncome } = await supabase
            .from('worker_income')
            .select('fee')
            .eq('franchise_id', franchiseId)
            .gte('tanggal', startDate)
            .lt('tanggal', endDate);
          newStats.thisMonthWorkerIncome = thisMonthWorkerIncome?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;

          // Admin Income - Total
          const { data: allAdminIncome } = await supabase
            .from('admin_income')
            .select('nominal')
            .eq('franchise_id', franchiseId);
          newStats.totalAdminIncome = allAdminIncome?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          // Admin Income - This Month (with database filter)
          const { data: thisMonthAdminIncome } = await supabase
            .from('admin_income')
            .select('nominal')
            .eq('franchise_id', franchiseId)
            .gte('tanggal', startDate)
            .lt('tanggal', endDate);
          newStats.thisMonthAdminIncome = thisMonthAdminIncome?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          // Expenses - Total
          const { data: allExpenses } = await supabase
            .from('expenses')
            .select('nominal')
            .eq('franchise_id', franchiseId);
          newStats.totalExpenses = allExpenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          // Expenses - This Month (with database filter)
          const { data: thisMonthExpenses } = await supabase
            .from('expenses')
            .select('nominal')
            .eq('franchise_id', franchiseId)
            .gte('tanggal', startDate)
            .lt('tanggal', endDate);
          newStats.thisMonthExpenses = thisMonthExpenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          const { data: workers } = await supabase
            .from('workers')
            .select('id')
            .eq('franchise_id', franchiseId);
          newStats.totalWorkers = workers?.length || 0;

          // Fetch profit sharing settings
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

          // Debug logging
          console.log('Dashboard Stats Franchise:', {
            franchiseId,
            month: currentMonthYear,
            totalWorkerIncome: newStats.totalWorkerIncome,
            thisMonthWorkerIncome: newStats.thisMonthWorkerIncome,
            totalAdminIncome: newStats.totalAdminIncome,
            thisMonthAdminIncome: newStats.thisMonthAdminIncome,
            totalExpenses: newStats.totalExpenses,
            thisMonthExpenses: newStats.thisMonthExpenses,
            startDate,
            endDate
          });
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
        // Fetch monthly summary for specific franchise - OPTIMIZED: Single batch query
        const franchiseId = userRole.franchise_id;

        // Fetch all data in parallel for this franchise
        const [
          { data: adminIncome },
          { data: workerIncome },
          { data: expenses },
          { data: allProfitSharing }
        ] = await Promise.all([
          supabase
            .from('admin_income')
            .select('nominal, tanggal')
            .eq('franchise_id', franchiseId),
          supabase
            .from('worker_income')
            .select('fee, tanggal')
            .eq('franchise_id', franchiseId),
          supabase
            .from('expenses')
            .select('nominal, tanggal')
            .eq('franchise_id', franchiseId),
          supabase
            .from('franchise_profit_sharing')
            .select('month_year, admin_percentage, franchise_percentage')
            .eq('franchise_id', franchiseId)
        ]);

        // Create profit sharing lookup map
        const profitByMonth: { [key: string]: { admin_percentage: number } } = {};
        allProfitSharing?.forEach(item => {
          profitByMonth[item.month_year] = { admin_percentage: item.admin_percentage };
        });

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

        // Calculate omset using pre-fetched profit sharing data
        for (const monthKey in monthlyData) {
          const data = monthlyData[monthKey];
          const totalRevenue = data.adminIncome + data.workerIncome;
          
          // Use profit sharing from lookup map
          const profitData = profitByMonth[monthKey];
          const profitShareAmount = profitData
            ? totalRevenue * (profitData.admin_percentage / 100) 
            : totalRevenue * 0.2; // default 20%

          // Standardized calculation: omset = revenue (admin + worker - expenses) - profit sharing
          const revenue = totalRevenue - data.expenses;
          data.omset = revenue - profitShareAmount;
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

  const fetchChartData = async () => {
    if (!userRole?.franchise_id) return;

    try {
      const franchiseId = userRole.franchise_id;
      const twelveMonthsAgo = subMonths(new Date(), 11);
      const monthStart = startOfMonth(twelveMonthsAgo);

      // OPTIMIZED: Fetch all data for last 12 months in parallel (4 queries instead of 48)
      const [
        { data: adminIncome },
        { data: workerIncome },
        { data: expenses },
        { data: profitSharing }
      ] = await Promise.all([
        supabase
          .from('admin_income')
          .select('nominal, tanggal')
          .eq('franchise_id', franchiseId)
          .gte('tanggal', monthStart.toISOString()),
        supabase
          .from('worker_income')
          .select('fee, tanggal')
          .eq('franchise_id', franchiseId)
          .gte('tanggal', monthStart.toISOString()),
        supabase
          .from('expenses')
          .select('nominal, tanggal')
          .eq('franchise_id', franchiseId)
          .gte('tanggal', monthStart.toISOString()),
        supabase
          .from('franchise_profit_sharing')
          .select('month_year, admin_percentage')
          .eq('franchise_id', franchiseId)
      ]);

      // Create profit sharing lookup map
      const profitByMonth: { [key: string]: number } = {};
      profitSharing?.forEach(item => {
        profitByMonth[item.month_year] = item.admin_percentage;
      });

      // Group data by month in memory
      const chartData: ChartData[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const targetDate = subMonths(new Date(), i);
        const monthKey = format(targetDate, 'yyyy-MM');
        
        // Filter data for this month
        const monthAdminIncome = adminIncome?.filter(item => 
          format(new Date(item.tanggal), 'yyyy-MM') === monthKey
        );
        const monthWorkerIncome = workerIncome?.filter(item => 
          format(new Date(item.tanggal), 'yyyy-MM') === monthKey
        );
        const monthExpenses = expenses?.filter(item => 
          format(new Date(item.tanggal), 'yyyy-MM') === monthKey
        );
        
        // Calculate totals
        const adminTotal = monthAdminIncome?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
        const workerTotal = monthWorkerIncome?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;
        const expensesTotal = monthExpenses?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;
        
        // Only include months that have data
        if (adminTotal > 0 || workerTotal > 0 || expensesTotal > 0) {
          const totalRevenue = adminTotal + workerTotal;
          const adminPercentage = profitByMonth[monthKey] || 20; // default 20%
          const profitShareAmount = totalRevenue * (adminPercentage / 100);
          
          chartData.push({
            month: monthKey,
            monthLabel: format(targetDate, 'MMM yyyy'),
            adminIncome: adminTotal,
            workerIncome: workerTotal,
            expenses: expensesTotal,
            omset: Math.max(0, totalRevenue - expensesTotal - profitShareAmount)
          });
        }
      }

      setChartData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const fetchProfitSharingChartData = async () => {
    try {
      // OPTIMIZED: Fetch franchises and all profit sharing data in parallel (2 queries instead of 24+)
      const twelveMonthsAgo = format(subMonths(startOfMonth(new Date()), 11), 'yyyy-MM');
      
      const [
        { data: franchises },
        { data: allProfitSharing }
      ] = await Promise.all([
        supabase
          .from('franchises')
          .select('id, name'),
        supabase
          .from('franchise_profit_sharing')
          .select('franchise_id, month_year, share_nominal')
          .gte('month_year', twelveMonthsAgo)
      ]);

      if (!franchises || franchises.length === 0) {
        setProfitSharingChartData([]);
        return;
      }

      // Generate colors for each franchise
      const colors = [
        '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
      ];
      const colorMap: { [key: string]: string } = {};
      franchises.forEach((franchise, index) => {
        colorMap[franchise.name] = colors[index % colors.length];
      });
      setFranchiseColors(colorMap);

      // Group data by month and franchise in memory
      const monthlyData: ProfitSharingChartData[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const targetDate = subMonths(startOfMonth(new Date()), i);
        const monthKey = format(targetDate, 'yyyy-MM');
        
        const monthData: ProfitSharingChartData = {
          month: monthKey,
          monthLabel: format(targetDate, 'MMM yyyy')
        };

        let hasData = false;

        // Use pre-fetched data to populate each franchise's share
        franchises.forEach(franchise => {
          const shareData = allProfitSharing?.find(item => 
            item.franchise_id === franchise.id && item.month_year === monthKey
          );
          const shareAmount = shareData?.share_nominal || 0;
          monthData[franchise.name] = shareAmount;
          if (shareAmount > 0) hasData = true;
        });

        // Only include months that have data
        if (hasData) {
          monthlyData.push(monthData);
        }
      }

      setProfitSharingChartData(monthlyData);
    } catch (error) {
      console.error('Error fetching profit sharing chart data:', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      // Fetch franchises first
      const { data: franchises } = await supabase
        .from('franchises')
        .select('id, name');

      if (!franchises) return;

      // Fetch recent activities from all tables
      const [adminIncomeRes, workerIncomeRes, expensesRes] = await Promise.all([
        supabase
          .from('admin_income')
          .select('franchise_id, created_at, code')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('worker_income')
          .select('franchise_id, created_at, code')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('expenses')
          .select('franchise_id, created_at, keterangan')
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const franchiseMap = new Map(franchises.map(f => [f.id, f.name]));

      const allActivities: RecentActivity[] = [];

      adminIncomeRes.data?.forEach(item => {
        allActivities.push({
          franchise_name: franchiseMap.get(item.franchise_id) || 'Unknown',
          activity_type: 'Admin Income',
          created_at: item.created_at,
          detail: item.code || ''
        });
      });

      workerIncomeRes.data?.forEach(item => {
        allActivities.push({
          franchise_name: franchiseMap.get(item.franchise_id) || 'Unknown',
          activity_type: 'Worker Income',
          created_at: item.created_at,
          detail: item.code || ''
        });
      });

      expensesRes.data?.forEach(item => {
        allActivities.push({
          franchise_name: franchiseMap.get(item.franchise_id) || 'Unknown',
          activity_type: 'Expenses',
          created_at: item.created_at,
          detail: item.keterangan || ''
        });
      });

      // Sort by created_at and take top 10
      allActivities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecentActivities(allActivities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleExportSummary = () => {
    const exportData = filteredSummary.map(item => ({
      'Bulan': new Date(item.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      'Pendapatan Admin': item.adminIncome,
      'Pendapatan Worker': item.workerIncome,
      'Pengeluaran': item.expenses,
      ...(userRole?.role === 'super_admin' && { 'Total Bagi Hasil': item.profitSharing || 0 }),
      ...(userRole?.role !== 'super_admin' && { 
        'Bagi Hasil Owner': item.profitSharing || 0,
        'Omset': item.omset || 0 
      })
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
                <div className="text-2xl font-bold text-blue-900">{formatCurrency(stats.thisMonthWorkerIncome || 0)}</div>
                <p className="text-xs text-blue-600">
                  Total akumulasi: {formatCurrency(stats.totalWorkerIncome || 0)}
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
                <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.thisMonthAdminIncome || 0)}</div>
                <p className="text-xs text-purple-600">
                  Total akumulasi: {formatCurrency(stats.totalAdminIncome || 0)}
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
                <div className="text-2xl font-bold text-red-900">{formatCurrency(stats.thisMonthExpenses || 0)}</div>
                <p className="text-xs text-red-600">
                  Total akumulasi: {formatCurrency(stats.totalExpenses || 0)}
                </p>
              </CardContent>
            </Card>

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
                    Bagi hasil bulan ini ({stats.profitSharingPercentage || 20}% dari pendapatan)
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Profit Sharing Chart for Super Admin */}
      {userRole?.role === 'super_admin' && (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Grafik Bagi Hasil Franchise (Per Bulan)
            </CardTitle>
            <CardDescription>
              Tren bagi hasil dari setiap franchise dalam 12 bulan terakhir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitSharingChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="monthLabel" 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  {Object.keys(franchiseColors).map((franchiseName) => (
                    <Line
                      key={franchiseName}
                      type="monotone"
                      dataKey={franchiseName}
                      stroke={franchiseColors[franchiseName]}
                      strokeWidth={2}
                      name={franchiseName}
                      dot={{ fill: franchiseColors[franchiseName], strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5, fill: franchiseColors[franchiseName] }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Widget for Super Admin */}
      {userRole?.role === 'super_admin' && recentActivities.length > 0 && (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Aktivitas Terbaru
            </CardTitle>
            <CardDescription>
              10 aktivitas terakhir dari semua franchise
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="shrink-0">{activity.franchise_name}</Badge>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          activity.activity_type === 'Admin Income' ? 'default' :
                          activity.activity_type === 'Worker Income' ? 'outline' : 'destructive'
                        } className="text-xs">
                          {activity.activity_type}
                        </Badge>
                      </div>
                      {activity.detail && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-1">
                          {activity.detail}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activity.created_at), 'dd MMM yyyy', { locale: id })}
                    </div>
                    <div>{format(new Date(activity.created_at), 'HH:mm:ss')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Chart for Franchise and Admin Keuangan */}
      {(userRole?.role === 'franchise' || userRole?.role === 'admin_keuangan') && (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Grafik Keuangan (12 Bulan Terakhir)
            </CardTitle>
            <CardDescription>
              Tren pendapatan, pengeluaran, dan omset franchise dalam 1 tahun terakhir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="monthLabel" 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="adminIncome" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Pendapatan Admin"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="workerIncome" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Pendapatan Worker"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#10b981' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expenses" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    name="Pengeluaran"
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#ef4444' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="omset" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    name="Omset"
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
                          <>
                            <TableHead className="font-semibold text-blue-900 text-right">Bagi Hasil Owner</TableHead>
                            <TableHead className="font-semibold text-blue-900 text-right">Omset</TableHead>
                          </>
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
                          <TableCell className="text-right text-purple-600 font-medium">
                            {formatCurrency(item.adminIncome)}
                          </TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">
                            {formatCurrency(item.workerIncome)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {formatCurrency(item.expenses)}
                          </TableCell>
                          {userRole?.role === 'super_admin' && (
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(item.profitSharing || 0)}
                            </TableCell>
                          )}
                          {userRole?.role !== 'super_admin' && (
                            <>
                              <TableCell className="text-right text-orange-600 font-medium">
                                {formatCurrency(item.profitSharing || 0)}
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 font-semibold">
                                {formatCurrency(item.omset || 0)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                      
                      {/* Footer with totals */}
                      {paginatedSummary.length > 0 && (
                        <TableRow className="bg-blue-100 font-semibold">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right text-purple-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.adminIncome, 0))}
                          </TableCell>
                          <TableCell className="text-right text-blue-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.workerIncome, 0))}
                          </TableCell>
                          <TableCell className="text-right text-red-700 font-bold">
                            {formatCurrency(paginatedSummary.reduce((sum, item) => sum + item.expenses, 0))}
                          </TableCell>
                          {userRole?.role === 'super_admin' && (
                            <TableCell className="text-right text-green-700 font-bold">
                              {formatCurrency(paginatedSummary.reduce((sum, item) => sum + (item.profitSharing || 0), 0))}
                            </TableCell>
                          )}
                          {userRole?.role !== 'super_admin' && (
                            <>
                              <TableCell></TableCell>
                              <TableCell className="text-right text-emerald-700 font-bold">
                                {formatCurrency(paginatedSummary.reduce((sum, item) => sum + (item.omset || 0), 0))}
                              </TableCell>
                            </>
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