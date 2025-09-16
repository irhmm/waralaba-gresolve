import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Check, ChevronsUpDown } from "lucide-react";
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
          toast({
            title: "Error",
            description: "Failed to fetch profit sharing data: " + error.message,
            variant: "destructive",
          });
          throw error;
        }

        return data?.map((item: any) => ({
          franchise_id: item.franchise_id,
          franchise_name: item.franchise_name,
          monthly_revenue: item.total_revenue || 0,
          admin_percentage: item.admin_percentage || 20,
          profit_share_amount: item.share_nominal || (item.total_revenue * item.admin_percentage / 100) || 0,
          payment_status: item.payment_status as 'paid' | 'unpaid'
        })) || [];
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
      toast({ title: 'Error', description: 'Gagal menghitung ulang: ' + error.message, variant: 'destructive' });
    },
  });

  const togglePaymentStatus = useMutation({
    mutationFn: async (args: { franchise_id: string; newStatus: 'paid' | 'unpaid' }) => {
      const { error } = await supabase
        .from('franchise_profit_sharing')
        .update({ payment_status: args.newStatus })
        .eq('franchise_id', args.franchise_id)
        .eq('month_year', selectedMonth);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Status pembayaran diperbarui.' });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing', selectedMonth] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateAdminPercentage = useMutation({
    mutationFn: async (args: { franchise_id: string; newPercentage: number; monthlyRevenue: number }) => {
      const newShare = Math.round((args.monthlyRevenue * args.newPercentage) / 100);
      const { error } = await supabase
        .from('franchise_profit_sharing')
        .update({ admin_percentage: args.newPercentage, share_nominal: newShare })
        .eq('franchise_id', args.franchise_id)
        .eq('month_year', selectedMonth);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Berhasil', description: 'Persentase admin diperbarui.' });
      queryClient.invalidateQueries({ queryKey: ['franchise-profit-sharing', selectedMonth] });
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
            <p>• Persentase dapat diatur di halaman "Pengaturan Bagi Hasil"</p>
            <p>• Klik "Hitung Ulang" untuk memperbarui data berdasarkan transaksi terbaru</p>
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
                <Popover open={monthSearchOpen} onOpenChange={setMonthSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={monthSearchOpen}
                      className="w-48 justify-between"
                    >
                      {selectedMonth
                        ? availableMonths.find((month) => month.value === selectedMonth)?.label
                        : "Pilih bulan..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-0 bg-background border shadow-md z-50">
                    <Command>
                      <CommandInput placeholder="Cari bulan..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Tidak ada bulan ditemukan.</CommandEmpty>
                        <CommandGroup>
                          {availableMonths.map((month) => (
                            <CommandItem
                              key={month.value}
                              value={month.label}
                              onSelect={() => {
                                setSelectedMonth(month.value);
                                setMonthSearchOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedMonth === month.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {month.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => recalcMutation.mutate()}
                className="hover:opacity-90"
                title="Menghitung ulang total pendapatan dan nominal bagi hasil berdasarkan data admin_income + worker_income terbaru"
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
                      <TableCell className="text-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            togglePaymentStatus.mutate({
                              franchise_id: item.franchise_id,
                              newStatus: item.payment_status === 'paid' ? 'unpaid' : 'paid',
                            })
                          }
                        >
                          {item.payment_status === 'paid' ? 'Tandai Belum' : 'Tandai Dibayar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const input = window.prompt('Persentase admin (%)', String(item.admin_percentage));
                            if (input === null) return;
                            const num = Number(input);
                            if (isNaN(num) || num < 0 || num > 100) {
                              toast({ title: 'Input tidak valid', description: 'Masukkan angka 0-100', variant: 'destructive' });
                              return;
                            }
                            updateAdminPercentage.mutate({ franchise_id: item.franchise_id, newPercentage: num, monthlyRevenue: item.monthly_revenue });
                          }}
                        >
                          Ubah %
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm('Hapus data bagi hasil ini?')) {
                              deleteRow.mutate({ franchise_id: item.franchise_id });
                            }
                          }}
                        >
                          Hapus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}