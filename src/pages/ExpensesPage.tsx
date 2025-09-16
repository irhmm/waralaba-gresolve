import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Download, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { groupDataByMonth, calculateMonthlyTotals, getAvailableMonths } from '@/utils/dateUtils';
import { exportExpensesToExcel } from '@/utils/excelUtils';

interface Expense {
  id: string;
  nominal: number;
  keterangan: string;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

export default function ExpensesPage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    nominal: '',
    keterangan: '',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Only super_admin, franchise, and admin_keuangan can access expenses
  const canAccess = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role);
  const canWrite = canAccess;

  useEffect(() => {
    if (canAccess) {
      fetchExpenses();
    }
  }, [userRole, canAccess]);

  const fetchExpenses = async () => {
    if (!userRole || !canAccess) return;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: "Error",
        description: "Failed to load expenses data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole?.franchise_id) return;

    try {
      const payload = {
        nominal: parseFloat(formData.nominal),
        keterangan: formData.keterangan,
        franchise_id: userRole.franchise_id,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Expense updated successfully!" });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Expense added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ nominal: '', keterangan: '' });
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: "Error",
        description: "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: Expense) => {
    setEditingItem(item);
    setFormData({
      nominal: item.nominal.toString(),
      keterangan: item.keterangan,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Expense deleted successfully!" });
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access expenses data.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
          {/* Filters and Actions */}
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pengeluaran</CardTitle>
              <CardDescription>
                Kelola data pengeluaran franchise
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-blue-600">
                    <Filter className="h-4 w-4 mr-2 text-blue-500" />
                    Filter
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-white rounded-lg shadow-lg border z-50">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Filter Data</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="month-filter">Bulan</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger>
                            <SelectValue placeholder="Semua Bulan" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-white">
                            <SelectItem value="all">Semua Bulan</SelectItem>
                            {availableMonths?.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedMonth('all');
                          setSearchTerm('');
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button variant="outline" onClick={() => {}}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              {canWrite && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingItem(null);
                      setFormData({ nominal: '', keterangan: '' });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Pengeluaran
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="nominal">Nominal</Label>
                      <Input
                        id="nominal"
                        type="number"
                        value={formData.nominal}
                        onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="keterangan">Keterangan</Label>
                      <Textarea
                        id="keterangan"
                        value={formData.keterangan}
                        onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      {editingItem ? 'Update' : 'Tambah'} Pengeluaran
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nominal</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>Rp {item.nominal.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{item.keterangan}</TableCell>
                  <TableCell>{format(new Date(item.tanggal), 'dd/MM/yyyy HH:mm')}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 4 : 3} className="text-center text-muted-foreground">
                    Belum ada data pengeluaran
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}