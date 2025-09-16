import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthSelector } from '@/components/ui/month-selector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface FranchiseProfitData {
  franchise_id: string;
  franchise_name: string;
  monthly_revenue: number;
  admin_percentage: number;
  profit_share_amount: number;
  payment_status: 'paid' | 'unpaid';
}

export default function FranchiseProfitSharingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [monthSearchOpen, setMonthSearchOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FranchiseProfitData | null>(null);
  const [editPercentage, setEditPercentage] = useState(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const { toast } = useToast();

  // Get available months that have data from franchise_profit_sharing
  const { data: availableMonths = [] } = useQuery({
    queryKey: ["franchise-profit-sharing-months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchise_profit_sharing")
        .select("month_year")
        .not("month_year", "is", null)
        .order("month_year", { ascending: false });

      if (error) throw error;

      const monthsSet = new Set<string>();
      data?.forEach((item) => {
        if (item.month_year) {
          monthsSet.add(item.month_year);
        }
      });

      const months = Array.from(monthsSet).map(monthYear => ({
        value: monthYear,
        label: format(new Date(monthYear + "-01"), "MMMM yyyy")
      })).sort((a, b) => b.value.localeCompare(a.value));

      // If no months found, still allow current month to be selected
      if (months.length === 0) {
        const currentMonth = format(new Date(), "yyyy-MM");
        return [{
          value: currentMonth,
          label: format(new Date(currentMonth + "-01"), "MMMM yyyy")
        }];
      }

      return months;
    },
  });

  const { data: profitSharingData = [], isLoading } = useQuery({
    queryKey: ["franchise-profit-sharing", selectedMonth],
    queryFn: async () => {
      try {
        // Use the database function to get calculated profit sharing data
        const { data, error } = await supabase.rpc('get_franchise_profit_sharing_data', {
          target_month_year: selectedMonth
        });

        if (error) {
          console.error("RPC Error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          toast({
            title: "Error",
            description: "Failed to fetch profit sharing data: " + error.message,
            variant: "destructive",
          });
          throw error;
        }

        console.log("Profit sharing data:", data);
        return data?.map((item: any) => ({
          franchise_id: item.franchise_id,
          franchise_name: item.franchise_name,
          monthly_revenue: item.total_revenue ?? 0,
          admin_percentage: item.admin_percentage ?? 20,
          profit_share_amount: item.share_nominal ?? (item.total_revenue * item.admin_percentage / 100) ?? 0,
          payment_status: item.payment_status as 'paid' | 'unpaid'
        })) ?? [];
      } catch (error) {
        console.error("Query Error:", error);
        return [];
      }
    },
    enabled: !!selectedMonth,
  });

  const filteredData = profitSharingData.filter(item =>
    item.franchise_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProfitShare = filteredData.reduce((sum, item) => sum + item.profit_share_amount, 0);
  const paidCount = filteredData.filter(item => item.payment_status === 'paid').length;
  const unpaidCount = filteredData.filter(item => item.payment_status === 'unpaid').length;

  const queryClient = useQueryClient();

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('calculate_franchise_profit_sharing', { target_month_year: selectedMonth });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Data bagi hasil telah dihitung ulang.' });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing-months'] });
    },
    onError: (error: any) => {
      console.error('Recalculate error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({ 
        title: 'Error', 
        description: error?.message || 'Gagal menghitung ulang data bagi hasil', 
        variant: 'destructive' 
      });
    },
  });

  // Helper functions for edit modal
  const openEditModal = (item: FranchiseProfitData) => {
    setEditingItem(item);
    setEditPercentage(item.admin_percentage);
    setEditPaymentStatus(item.payment_status);
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    updateFranchiseData.mutate({
      franchise_id: editingItem.franchise_id,
      newPercentage: editPercentage,
      newPaymentStatus: editPaymentStatus,
      monthlyRevenue: editingItem.monthly_revenue
    });
  };

  const updateFranchiseData = useMutation({
    mutationFn: async (args: { 
      franchise_id: string; 
      newPercentage: number; 
      newPaymentStatus: 'paid' | 'unpaid';
      monthlyRevenue: number 
    }) => {
      const newShare = Math.round((args.monthlyRevenue * args.newPercentage) / 100);
      const newFranchisePercentage = 100 - args.newPercentage;
      const { error } = await supabase
        .from('franchise_profit_sharing')
        .update({ 
          admin_percentage: args.newPercentage, 
          franchise_percentage: newFranchisePercentage,
          share_nominal: newShare,
          payment_status: args.newPaymentStatus
        })
        .eq('franchise_id', args.franchise_id)
        .eq('month_year', selectedMonth);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Data franchise berhasil diperbarui.' });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing', selectedMonth] });
      setEditModalOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (args: { franchise_id: string }) => {
      const { error } = await supabase
        .from('franchise_profit_sharing')
        .delete()
        .eq('franchise_id', args.franchise_id)
        .eq('month_year', selectedMonth);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Data dihapus.' });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing-months'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      "Nama Franchise": item.franchise_name,
      "Total Pendapatan Bulanan": item.monthly_revenue,
      "Persentase Bagi Hasil (%)": item.admin_percentage,
      "Nominal Bagi Hasil": item.profit_share_amount,
      "Status Pembayaran": item.payment_status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar'
    }));

    // TODO: Implement Excel export functionality
    toast({
      title: "Export Excel",
      description: "Export Excel akan segera tersedia",
    });
  };

  const formatCurrency = (amount: number) => {
    // Handle NaN or invalid numbers
    if (isNaN(amount) || amount === null || amount === undefined) {
      amount = 0;
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Bagi Hasil Franchise</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Kalkulasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Total Pendapatan = Pendapatan Admin + Pendapatan Worker</p>
            <p>• Nominal Bagi Hasil = Total Pendapatan × Persentase Admin</p>
            <p>• Persentase menggunakan: Pengaturan Franchise → Pengaturan Global → Default (20%)</p>
            <p>• Klik "Hitung Ulang" untuk memperbarui data berdasarkan transaksi dan pengaturan terbaru</p>
            <p>• Ubah persentase di halaman "Pengaturan Bagi Hasil" untuk memengaruhi semua perhitungan</p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bagi Hasil Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalProfitShare)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sudah Dibayar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {paidCount} Franchise
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Belum Dibayar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {unpaidCount} Franchise
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cari franchise..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4 text-primary" />
                <MonthSelector
                  value={selectedMonth}
                  onValueChange={setSelectedMonth}
                  tables={['franchise_profit_sharing']}
                  label=""
                  placeholder="Pilih bulan..."
                  showSearch={true}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => recalcMutation.mutate()}
                className="hover:opacity-90"
                title="Menghitung ulang total pendapatan dan nominal bagi hasil berdasarkan data admin_income + worker_income terbaru serta pengaturan persentase terkini"
              >
                Hitung Ulang Data
              </Button>
              <Button onClick={exportToExcel} className="bg-primary hover:bg-primary/90">
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Franchise</TableHead>
                  <TableHead className="text-right">Total Pendapatan (Admin + Worker)</TableHead>
                  <TableHead className="text-center">Persentase Admin (%)</TableHead>
                  <TableHead className="text-right">Nominal Bagi Hasil Admin</TableHead>
                  <TableHead className="text-center">Status Pembayaran</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading data...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Tidak ada data bagi hasil untuk bulan ini
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.franchise_id}>
                      <TableCell className="font-medium">
                        {item.franchise_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.monthly_revenue)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.admin_percentage}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.profit_share_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={item.payment_status === 'paid' ? 'default' : 'secondary'}
                          className={item.payment_status === 'paid' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}
                        >
                          {item.payment_status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Hapus data bagi hasil ini?')) {
                                deleteRow.mutate({ franchise_id: item.franchise_id });
                              }
                            }}
                            className="h-8 w-8 p-0 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              Edit Data Bagi Hasil - {editingItem?.franchise_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="percentage" className="text-card-foreground">
                Persentase Admin (%)
              </Label>
              <Input
                id="percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={editPercentage}
                onChange={(e) => setEditPercentage(parseFloat(e.target.value) || 0)}
                className="bg-background border-border text-card-foreground"
              />
              <p className="text-sm text-muted-foreground">
                Franchise akan mendapat: {(100 - editPercentage).toFixed(2)}%
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-status" className="text-card-foreground">
                Status Pembayaran
              </Label>
              <Select value={editPaymentStatus} onValueChange={(value: 'paid' | 'unpaid') => setEditPaymentStatus(value)}>
                <SelectTrigger className="bg-background border-border text-card-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="unpaid" className="text-card-foreground hover:bg-accent">
                    Belum Dibayar
                  </SelectItem>
                  <SelectItem value="paid" className="text-card-foreground hover:bg-accent">
                    Sudah Dibayar
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingItem && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Pendapatan:</span>
                  <span className="font-medium text-card-foreground">
                    {formatCurrency(editingItem.monthly_revenue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nominal Bagi Hasil (Baru):</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency((editingItem.monthly_revenue * editPercentage) / 100)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSaveEdit}
                disabled={editPercentage < 0 || editPercentage > 100}
                className="flex-1"
              >
                Simpan Perubahan
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditModalOpen(false)}
                className="flex-1"
              >
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}