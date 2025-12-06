import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  Grid3X3,
  List,
  Download,
  UserPlus,
  Settings,
  Eye,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  AlertTriangle,
  Save,
  Filter,
  X,
  Clock,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { AssignRoleModal } from '@/components/admin/AssignRoleModal';
import { SyncRolesButton } from '@/components/admin/SyncRolesButton';

interface LastActivity {
  activity_type: 'Admin Income' | 'Worker Income' | 'Expenses';
  created_at: string;
  detail: string;
}

interface Franchise {
  id: string;
  franchise_id: string;
  name: string;
  slug: string;
  address: string;
  created_at: string;
  // Financial data
  worker_count?: number;
  total_admin_income?: number;
  total_worker_income?: number;
  total_expenses?: number;
  revenue?: number; // total_admin_income + total_worker_income - total_expenses
  last_activity?: LastActivity;
}

interface User {
  id: string;
  email: string;
}

const ListFranchisePage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortField, setSortField] = useState<keyof Franchise>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [revenueFilter, setRevenueFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Assign User Modal
  const [assignUserModal, setAssignUserModal] = useState<{
    isOpen: boolean;
    franchise: Franchise | null;
  }>({ isOpen: false, franchise: null });
  const [userEmail, setUserEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'franchise' | 'admin_keuangan' | 'admin_marketing'>('franchise');
  const [assignLoading, setAssignLoading] = useState(false);

  // Edit Modal
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    franchise: Franchise | null;
  }>({ isOpen: false, franchise: null });
  const [editFormData, setEditFormData] = useState({
    name: '',
    slug: '',
    address: '',
    franchise_id: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Delete Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    franchise: Franchise | null;
  }>({ isOpen: false, franchise: null });
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Only super_admin can access this page
  if (userRole?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchFranchisesWithMetrics();
  }, []);

  const fetchFranchisesWithMetrics = async () => {
    setLoading(true);
    try {
      // Fetch franchises
      const { data: franchiseData, error: franchiseError } = await supabase
        .from('franchises')
        .select('*')
        .order('created_at', { ascending: false });

      if (franchiseError) throw franchiseError;

      // Fetch metrics for each franchise
      const franchisesWithMetrics = await Promise.all(
        (franchiseData || []).map(async (franchise) => {
          // Get worker count
          const { count: workerCount } = await supabase
            .from('workers')
            .select('id', { count: 'exact' })
            .eq('franchise_id', franchise.id)
            .eq('status', 'active');

          // Get admin income total
          const { data: adminIncomeData } = await supabase
            .from('admin_income')
            .select('nominal')
            .eq('franchise_id', franchise.id);
          
          const totalAdminIncome = adminIncomeData?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          // Get worker income total
          const { data: workerIncomeData } = await supabase
            .from('worker_income')
            .select('fee')
            .eq('franchise_id', franchise.id);
          
          const totalWorkerIncome = workerIncomeData?.reduce((sum, item) => sum + Number(item.fee), 0) || 0;

          // Get expenses total
          const { data: expensesData } = await supabase
            .from('expenses')
            .select('nominal')
            .eq('franchise_id', franchise.id);
          
          const totalExpenses = expensesData?.reduce((sum, item) => sum + Number(item.nominal), 0) || 0;

          const revenue = totalAdminIncome + totalWorkerIncome - totalExpenses;

          // Get last activity for this franchise
          const [lastAdmin, lastWorker, lastExpense] = await Promise.all([
            supabase
              .from('admin_income')
              .select('created_at, code')
              .eq('franchise_id', franchise.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('worker_income')
              .select('created_at, code')
              .eq('franchise_id', franchise.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('expenses')
              .select('created_at, keterangan')
              .eq('franchise_id', franchise.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          ]);

          // Find the most recent activity
          const activities: { type: 'Admin Income' | 'Worker Income' | 'Expenses'; data: any }[] = [];
          if (lastAdmin.data) activities.push({ type: 'Admin Income', data: lastAdmin.data });
          if (lastWorker.data) activities.push({ type: 'Worker Income', data: lastWorker.data });
          if (lastExpense.data) activities.push({ type: 'Expenses', data: lastExpense.data });

          const mostRecent = activities.sort((a, b) => 
            new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
          )[0];

          return {
            ...franchise,
            worker_count: workerCount || 0,
            total_admin_income: totalAdminIncome,
            total_worker_income: totalWorkerIncome,
            total_expenses: totalExpenses,
            revenue,
            last_activity: mostRecent ? {
              activity_type: mostRecent.type,
              created_at: mostRecent.data.created_at,
              detail: mostRecent.data.code || mostRecent.data.keterangan || ''
            } : undefined
          };
        })
      );

      setFranchises(franchisesWithMetrics);
    } catch (error) {
      console.error('Error fetching franchises:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data franchise",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Franchise) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAssignUser = async () => {
    if (!assignUserModal.franchise || !userEmail || !selectedRole) return;

    setAssignLoading(true);
    try {
      // For now, we'll assume the user provides an existing user's email
      // In production, you would need to use Supabase Admin API with service role key
      // from a backend endpoint for security reasons
      
      // Try to find if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', 'placeholder'); // This would need the actual user ID
      
      // For demo purposes, we'll show a message that admin needs to set this up manually
      toast({
        title: "Admin Setup Required",
        description: `Please manually assign user ${userEmail} to franchise ${assignUserModal.franchise.name} through Supabase dashboard or backend endpoint.`,
        variant: "default",
      });

      setAssignUserModal({ isOpen: false, franchise: null });
      setUserEmail('');
      setSelectedRole('franchise');

    } catch (error: any) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal assign user",
        variant: "destructive",
      });
    } finally {
      setAssignLoading(false);
    }
  };

  // Edit functions
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleEditFranchise = (franchise: Franchise) => {
    setEditFormData({
      name: franchise.name,
      slug: franchise.slug,
      address: franchise.address || '',
      franchise_id: franchise.franchise_id || ''
    });
    setEditModal({ isOpen: true, franchise });
    setEditErrors({});
  };

  const handleEditNameChange = (name: string) => {
    setEditFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
    
    if (editErrors.name) {
      setEditErrors(prev => ({ ...prev, name: '' }));
    }
  };

  const validateEditForm = () => {
    const newErrors: Record<string, string> = {};

    if (!editFormData.name.trim()) {
      newErrors.name = 'Nama franchise harus diisi';
    }

    if (!editFormData.slug.trim()) {
      newErrors.slug = 'Slug harus diisi';
    } else if (!/^[a-z0-9-]+$/.test(editFormData.slug)) {
      newErrors.slug = 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung';
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditSubmit = async () => {
    if (!editModal.franchise || !validateEditForm()) return;

    setEditLoading(true);
    try {
      // Check if slug already exists (excluding current franchise)
      const { data: existingSlug } = await supabase
        .from('franchises')
        .select('id')
        .eq('slug', editFormData.slug.trim())
        .neq('id', editModal.franchise.id)
        .single();

      if (existingSlug) {
        setEditErrors({ slug: 'Slug sudah digunakan oleh franchise lain' });
        setEditLoading(false);
        return;
      }

      const updateData: any = {
        name: editFormData.name.trim(),
        slug: editFormData.slug.trim(),
        address: editFormData.address.trim() || null
      };

      if (editFormData.franchise_id.trim()) {
        updateData.franchise_id = editFormData.franchise_id.trim();
      }

      const { error } = await supabase
        .from('franchises')
        .update(updateData)
        .eq('id', editModal.franchise.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Franchise "${editFormData.name}" berhasil diupdate`,
      });

      setEditModal({ isOpen: false, franchise: null });
      fetchFranchisesWithMetrics();

    } catch (error: any) {
      console.error('Error updating franchise:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal mengupdate franchise",
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete functions
  const handleDeleteFranchise = (franchise: Franchise) => {
    setDeleteModal({ isOpen: true, franchise });
    setDeleteConfirmName('');
  };

  const handleDeleteSubmit = async () => {
    if (!deleteModal.franchise || deleteConfirmName !== deleteModal.franchise.name) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Start transaction-like cascade delete
      const franchiseId = deleteModal.franchise.id;

      // Delete in correct order to avoid constraint errors
      
      // 1. Delete worker income records
      const { error: workerIncomeError } = await supabase
        .from('worker_income')
        .delete()
        .eq('franchise_id', franchiseId);
      
      if (workerIncomeError) throw workerIncomeError;

      // 2. Delete workers
      const { error: workersError } = await supabase
        .from('workers')
        .delete()
        .eq('franchise_id', franchiseId);
      
      if (workersError) throw workersError;

      // 4. Delete admin income
      const { error: adminIncomeError } = await supabase
        .from('admin_income')
        .delete()
        .eq('franchise_id', franchiseId);
      
      if (adminIncomeError) throw adminIncomeError;

      // 5. Delete expenses
      const { error: expensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('franchise_id', franchiseId);
      
      if (expensesError) throw expensesError;

      // 6. Delete user roles associated with this franchise
      const { error: userRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('franchise_id', franchiseId);
      
      if (userRolesError) throw userRolesError;

      // 7. Finally delete the franchise
      const { error: franchiseError } = await supabase
        .from('franchises')
        .delete()
        .eq('id', franchiseId);
      
      if (franchiseError) throw franchiseError;

      toast({
        title: "Success",
        description: `Franchise "${deleteModal.franchise.name}" dan semua data terkait berhasil dihapus`,
      });

      setDeleteModal({ isOpen: false, franchise: null });
      fetchFranchisesWithMetrics();

    } catch (error: any) {
      console.error('Error deleting franchise:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus franchise",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Franchise ID', 'Name', 'Slug', 'Address', 'Workers', 'Admin Income', 'Worker Income', 'Expenses', 'Revenue'];
    const csvContent = [
      headers.join(','),
      ...filteredFranchises.map(f => [
        f.franchise_id,
        `"${f.name}"`,
        f.slug,
        `"${f.address || ''}"`,
        f.worker_count || 0,
        f.total_admin_income || 0,
        f.total_worker_income || 0,
        f.total_expenses || 0,
        f.revenue || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `franchises_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredFranchises = franchises
    .filter(franchise => {
      const matchesSearch = franchise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        franchise.franchise_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        franchise.slug.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && (franchise.worker_count || 0) > 0) ||
        (statusFilter === 'inactive' && (franchise.worker_count || 0) === 0);

      const matchesRevenue = revenueFilter === 'all' ||
        (revenueFilter === 'positive' && (franchise.revenue || 0) > 0) ||
        (revenueFilter === 'negative' && (franchise.revenue || 0) < 0) ||
        (revenueFilter === 'zero' && (franchise.revenue || 0) === 0);

      return matchesSearch && matchesStatus && matchesRevenue;
    })
    .sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setRevenueFilter('all');
  };

  // Pagination
  const totalPages = Math.ceil(filteredFranchises.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFranchises = filteredFranchises.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
            <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
          </div>
          <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl"></div>
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
          <h1 className="text-3xl font-bold text-foreground">List Franchise</h1>
          <p className="text-muted-foreground">
            Kelola semua franchise yang terdaftar dalam sistem
          </p>
        </div>
        
        <div className="flex gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 text-blue-500 mr-2" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-white border rounded-lg shadow-lg">
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter Data</h4>
                  <Button variant="ghost" size="sm" onClick={() => setFilterOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="active">Active (Has Workers)</SelectItem>
                      <SelectItem value="inactive">Inactive (No Workers)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Revenue Filter */}
                <div className="space-y-2">
                  <Label htmlFor="revenue">Revenue</Label>
                  <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Revenue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Revenue</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="zero">Zero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setFilterOpen(false)}
                    className="flex-1"
                  >
                    Terapkan Filter
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <SyncRolesButton onSyncCompleted={fetchFranchisesWithMetrics} />
          
          <AssignRoleModal onRoleAssigned={fetchFranchisesWithMetrics} />
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="hidden sm:flex"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          
          <Button 
            onClick={() => navigate('/admin/franchises/new')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Franchise
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          {/* Search Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, franchise ID, slug..."
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
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filter</h4>
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
                          <SelectItem value="active">Active (Worker &gt; 0)</SelectItem>
                          <SelectItem value="inactive">Inactive (Worker = 0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Revenue Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="revenue">Revenue</Label>
                      <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Semua Revenue" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-white">
                          <SelectItem value="all">Semua Revenue</SelectItem>
                          <SelectItem value="positive">Positive (&gt; 0)</SelectItem>
                          <SelectItem value="negative">Negative (&lt; 0)</SelectItem>
                          <SelectItem value="zero">Zero (= 0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatusFilter('all');
                          setRevenueFilter('all');
                          setSearchTerm('');
                        }}
                        className="flex-1"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" onClick={exportToCSV} className="text-blue-600">
                <Download className="h-4 w-4" />
                Export
              </Button>
              
              <Select value={viewMode} onValueChange={(value: 'grid' | 'table') => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4" />
                      Grid
                    </div>
                  </SelectItem>
                  <SelectItem value="table">
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      Table
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Button onClick={() => navigate('/admin/franchises/new')} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Tambah Data
              </Button>
            </div>
          </div>
          
          <div>
            <CardTitle>Data Franchise</CardTitle>
            <CardDescription>
              Kelola data franchise dan lihat ringkasan finansial
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Franchise</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{franchises.length}</div>
            <p className="text-xs text-muted-foreground">Franchise terdaftar</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {franchises.reduce((sum, f) => sum + (f.worker_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all franchises</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(franchises.reduce((sum, f) => sum + (f.revenue || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">Net revenue</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filter Results</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredFranchises.length}</div>
            <p className="text-xs text-muted-foreground">From {franchises.length} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedFranchises.map((franchise) => (
            <Card key={franchise.id} className="card-hover">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{franchise.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {franchise.franchise_id}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        /{franchise.slug}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/30 p-2 rounded-lg">
                    <div className="font-medium text-success">Revenue</div>
                    <div className="text-sm font-semibold">{formatCurrency(franchise.revenue || 0)}</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-lg">
                    <div className="font-medium">Workers</div>
                    <div className="text-sm font-semibold">{franchise.worker_count || 0}</div>
                  </div>
                </div>

                {franchise.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{franchise.address}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(franchise.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Last Activity */}
                {franchise.last_activity && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Activity className="h-3 w-3" />
                      <span>Aktivitas terakhir:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {franchise.last_activity.activity_type}
                      </Badge>
                      <span className="text-xs font-medium">
                        {format(new Date(franchise.last_activity.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                      </span>
                    </div>
                    {franchise.last_activity.detail && (
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {franchise.last_activity.detail}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setAssignUserModal({ isOpen: true, franchise })}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Assign User
                  </Button>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditFranchise(franchise)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteFranchise(franchise)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('franchise_id')}
                  >
                    Franchise ID
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    Name
                  </TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('revenue')}
                  >
                    Revenue
                  </TableHead>
                  <TableHead>Aktivitas Terakhir</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFranchises.map((franchise) => (
                  <TableRow key={franchise.id}>
                    <TableCell>
                      <Badge variant="outline">{franchise.franchise_id}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{franchise.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">/{franchise.slug}</Badge>
                    </TableCell>
                    <TableCell>{franchise.worker_count || 0}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatCurrency((franchise.total_admin_income || 0) + (franchise.total_worker_income || 0))}</div>
                        <div className="text-xs text-muted-foreground">
                          Admin: {formatCurrency(franchise.total_admin_income || 0)} |
                          Worker: {formatCurrency(franchise.total_worker_income || 0)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-destructive">
                      {formatCurrency(franchise.total_expenses || 0)}
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${(franchise.revenue || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(franchise.revenue || 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {franchise.last_activity ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {franchise.last_activity.activity_type}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(franchise.last_activity.created_at), 'dd/MM/yy HH:mm', { locale: id })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setAssignUserModal({ isOpen: true, franchise })}
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEditFranchise(franchise)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteFranchise(franchise)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
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
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {filteredFranchises.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No franchises found' : 'No franchises yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm 
                ? 'Try changing your search keywords' 
                : 'Add your first franchise to get started'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => navigate('/admin/franchises/new')} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add First Franchise
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assign User Modal */}
      <Dialog 
        open={assignUserModal.isOpen} 
        onOpenChange={(open) => setAssignUserModal({ isOpen: open, franchise: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Franchise</DialogTitle>
            <DialogDescription>
              Assign a user to franchise: <strong>{assignUserModal.franchise?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="userEmail" className="text-sm font-medium">
                User Email
              </label>
              <Input
                id="userEmail"
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-muted-foreground">
                If user doesn't exist, a new account will be created
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="franchise">Franchise Owner</SelectItem>
                  <SelectItem value="admin_keuangan">Admin Keuangan</SelectItem>
                  <SelectItem value="admin_marketing">Admin Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAssignUserModal({ isOpen: false, franchise: null })}
              disabled={assignLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignUser} 
              className="btn-primary"
              disabled={!userEmail || assignLoading}
            >
              {assignLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />}
              Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Franchise Modal */}
      <Dialog 
        open={editModal.isOpen} 
        onOpenChange={(open) => setEditModal({ isOpen: open, franchise: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Franchise</DialogTitle>
            <DialogDescription>
              Update franchise information for: <strong>{editModal.franchise?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Franchise Name</Label>
              <Input
                id="editName"
                value={editFormData.name}
                onChange={(e) => handleEditNameChange(e.target.value)}
                className={`input-field ${editErrors.name ? 'border-destructive' : ''}`}
                placeholder="Franchise name"
              />
              {editErrors.name && (
                <p className="text-sm text-destructive">{editErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSlug">Slug (URL)</Label>
              <Input
                id="editSlug"
                value={editFormData.slug}
                onChange={(e) => setEditFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                className={`input-field ${editErrors.slug ? 'border-destructive' : ''}`}
                placeholder="franchise-slug"
              />
              {editErrors.slug && (
                <p className="text-sm text-destructive">{editErrors.slug}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFranchiseId">Franchise ID</Label>
              <Input
                id="editFranchiseId"
                value={editFormData.franchise_id}
                onChange={(e) => setEditFormData(prev => ({ ...prev, franchise_id: e.target.value }))}
                className="input-field"
                placeholder="FR-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Textarea
                id="editAddress"
                value={editFormData.address}
                onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                className="input-field"
                placeholder="Franchise address"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditModal({ isOpen: false, franchise: null })}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              className="btn-primary"
              disabled={!editFormData.name.trim() || !editFormData.slug.trim() || editLoading}
            >
              {editLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />}
              <Save className="w-4 h-4 mr-2" />
              Update Franchise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog 
        open={deleteModal.isOpen} 
        onOpenChange={(open) => setDeleteModal({ isOpen: open, franchise: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Franchise
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete franchise <strong>{deleteModal.franchise?.name}</strong> and 
                <strong className="text-destructive"> ALL associated data</strong> including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All worker records and income data</li>
                <li>All admin income records</li>
                <li>All expense records</li>
                <li>All user role assignments</li>
              </ul>
              <p className="font-medium">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmName">
                Type <strong>{deleteModal.franchise?.name}</strong> to confirm:
              </Label>
              <Input
                id="confirmName"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteModal.franchise?.name || ''}
                className="input-field"
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteModal({ isOpen: false, franchise: null })}
              disabled={deleteLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubmit}
              disabled={deleteConfirmName !== deleteModal.franchise?.name || deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />}
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ListFranchisePage;