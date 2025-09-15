import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface AdminIncome {
  id: string;
  code: string;
  nominal: number;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

export default function AdminIncomePage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [adminIncomes, setAdminIncomes] = useState<AdminIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminIncome | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nominal: '',
  });

  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan', 'admin_marketing'].includes(userRole.role);

  useEffect(() => {
    fetchAdminIncomes();
  }, [userRole]);

  const fetchAdminIncomes = async () => {
    if (!userRole) return;

    try {
      const { data, error } = await supabase
        .from('admin_income')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setAdminIncomes(data || []);
    } catch (error) {
      console.error('Error fetching admin incomes:', error);
      toast({
        title: "Error",
        description: "Failed to load admin income data",
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
        code: formData.code,
        nominal: parseFloat(formData.nominal),
        franchise_id: userRole.franchise_id,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('admin_income')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Admin income updated successfully!" });
      } else {
        const { error } = await supabase
          .from('admin_income')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Admin income added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ code: '', nominal: '' });
      fetchAdminIncomes();
    } catch (error) {
      console.error('Error saving admin income:', error);
      toast({
        title: "Error",
        description: "Failed to save admin income",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: AdminIncome) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      nominal: item.nominal.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_income')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Admin income deleted successfully!" });
      fetchAdminIncomes();
    } catch (error) {
      console.error('Error deleting admin income:', error);
      toast({
        title: "Error",
        description: "Failed to delete admin income",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pendapatan Admin</CardTitle>
              <CardDescription>
                Kelola data pendapatan admin franchise
              </CardDescription>
            </div>
            {canWrite && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingItem(null);
                    setFormData({ code: '', nominal: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Pendapatan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pendapatan Admin' : 'Tambah Pendapatan Admin'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="code">Kode</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        required
                      />
                    </div>
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
                    <Button type="submit" className="w-full">
                      {editingItem ? 'Update' : 'Tambah'} Pendapatan
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
                <TableHead>Kode</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminIncomes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>Rp {item.nominal.toLocaleString('id-ID')}</TableCell>
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
              {adminIncomes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 4 : 3} className="text-center text-muted-foreground">
                    Belum ada data pendapatan admin
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