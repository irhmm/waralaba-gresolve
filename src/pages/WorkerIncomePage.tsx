import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface WorkerIncome {
  id: string;
  code: string;
  jobdesk: string;
  fee: number;
  worker_id: string;
  tanggal: string;
  franchise_id: string;
  created_by: string;
}

interface Worker {
  id: string;
  nama: string;
}

export default function WorkerIncomePage() {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [workerIncomes, setWorkerIncomes] = useState<WorkerIncome[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkerIncome | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    jobdesk: '',
    fee: '',
    worker_id: '',
  });

  const canWrite = userRole?.role && ['super_admin', 'franchise', 'admin_keuangan'].includes(userRole.role);

  useEffect(() => {
    fetchData();
  }, [userRole]);

  const fetchData = async () => {
    if (!userRole) return;

    try {
      // Fetch worker incomes
      const { data: incomeData, error: incomeError } = await supabase
        .from('worker_income')
        .select('*')
        .order('tanggal', { ascending: false });

      if (incomeError) throw incomeError;
      setWorkerIncomes(incomeData || []);

      // Fetch workers for the dropdown
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('id, nama')
        .eq('status', 'active');

      if (workersError) throw workersError;
      setWorkers(workersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker?.nama || 'Unknown Worker';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole?.franchise_id) return;

    try {
      const payload = {
        code: formData.code,
        jobdesk: formData.jobdesk,
        fee: parseFloat(formData.fee),
        worker_id: formData.worker_id,
        franchise_id: userRole.franchise_id,
        created_by: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('worker_income')
          .update(payload)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker income updated successfully!" });
      } else {
        const { error } = await supabase
          .from('worker_income')
          .insert(payload);
        
        if (error) throw error;
        toast({ title: "Success", description: "Worker income added successfully!" });
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({ code: '', jobdesk: '', fee: '', worker_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving worker income:', error);
      toast({
        title: "Error",
        description: "Failed to save worker income",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: WorkerIncome) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      jobdesk: item.jobdesk,
      fee: item.fee.toString(),
      worker_id: item.worker_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_income')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Worker income deleted successfully!" });
      fetchData();
    } catch (error) {
      console.error('Error deleting worker income:', error);
      toast({
        title: "Error",
        description: "Failed to delete worker income",
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
              <CardTitle>Pendapatan Worker</CardTitle>
              <CardDescription>
                Kelola data pendapatan worker franchise
              </CardDescription>
            </div>
            {canWrite && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingItem(null);
                    setFormData({ code: '', jobdesk: '', fee: '', worker_id: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Pendapatan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Pendapatan Worker' : 'Tambah Pendapatan Worker'}
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
                      <Label htmlFor="jobdesk">Job Desk</Label>
                      <Input
                        id="jobdesk"
                        value={formData.jobdesk}
                        onChange={(e) => setFormData({ ...formData, jobdesk: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="fee">Fee</Label>
                      <Input
                        id="fee"
                        type="number"
                        value={formData.fee}
                        onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="worker">Worker</Label>
                      <Select 
                        value={formData.worker_id} 
                        onValueChange={(value) => setFormData({ ...formData, worker_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih worker" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                <TableHead>Job Desk</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Tanggal</TableHead>
                {canWrite && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerIncomes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.jobdesk}</TableCell>
                  <TableCell>{getWorkerName(item.worker_id)}</TableCell>
                  <TableCell>Rp {item.fee.toLocaleString('id-ID')}</TableCell>
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
              {workerIncomes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground">
                    Belum ada data pendapatan worker
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