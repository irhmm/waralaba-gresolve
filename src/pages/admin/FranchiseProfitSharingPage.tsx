import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

  // Get available months that have data from admin_income
  const { data: availableMonths = [] } = useQuery({
    queryKey: ["available-months"],
    queryFn: async () => {
      const { data: adminIncome, error } = await supabase
        .from("admin_income")
        .select("tanggal")
        .not("tanggal", "is", null)
        .order("tanggal", { ascending: false });

      if (error) throw error;

      const monthsSet = new Set<string>();
      adminIncome?.forEach((income) => {
        if (income.tanggal) {
          const monthYear = format(new Date(income.tanggal), "yyyy-MM");
          monthsSet.add(monthYear);
        }
      });

      return Array.from(monthsSet).map(monthYear => ({
        value: monthYear,
        label: format(new Date(monthYear + "-01"), "MMMM yyyy")
      })).sort((a, b) => b.value.localeCompare(a.value));
    },
  });

  const { data: profitSharingData = [] } = useQuery({
    queryKey: ["franchise-profit-sharing", selectedMonth],
    queryFn: async () => {
      // Get all franchises
      const { data: franchises, error: franchiseError } = await supabase
        .from("franchises")
        .select("id, name");

      if (franchiseError) throw franchiseError;

      const profitData: FranchiseProfitData[] = [];

      for (const franchise of franchises) {
        // Get monthly revenue from admin_income for this franchise
        const startDate = `${selectedMonth}-01`;
        const endDate = `${selectedMonth}-31`;
        
        const { data: adminIncome, error: incomeError } = await supabase
          .from("admin_income")
          .select("nominal")
          .eq("franchise_id", franchise.id)
          .gte("tanggal", startDate)
          .lte("tanggal", endDate);

        if (incomeError) throw incomeError;

        const monthlyRevenue = adminIncome?.reduce((sum, income) => sum + income.nominal, 0) || 0;

        // Check if there's existing profit sharing data for this franchise and month
        const { data: existingProfitSharing } = await supabase
          .from("franchise_profit_sharing")
          .select("admin_percentage, share_nominal, payment_status")
          .eq("franchise_id", franchise.id)
          .eq("month_year", selectedMonth)
          .maybeSingle();

        let adminPercentage = 20; // default
        let paymentStatus: 'paid' | 'unpaid' = 'unpaid';

        if (existingProfitSharing) {
          adminPercentage = existingProfitSharing.admin_percentage;
          paymentStatus = existingProfitSharing.payment_status as 'paid' | 'unpaid';
        }

        const profitShareAmount = (monthlyRevenue * adminPercentage) / 100;

        profitData.push({
          franchise_id: franchise.id,
          franchise_name: franchise.name,
          monthly_revenue: monthlyRevenue,
          admin_percentage: adminPercentage,
          profit_share_amount: profitShareAmount,
          payment_status: paymentStatus
        });
      }

      return profitData;
    },
  });

  const filteredData = profitSharingData.filter(item =>
    item.franchise_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProfitShare = filteredData.reduce((sum, item) => sum + item.profit_share_amount, 0);
  const paidCount = filteredData.filter(item => item.payment_status === 'paid').length;
  const unpaidCount = filteredData.filter(item => item.payment_status === 'unpaid').length;

  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      "Nama Franchise": item.franchise_name,
      "Total Pendapatan Bulanan": item.monthly_revenue,
      "Persentase Bagi Hasil (%)": item.admin_percentage,
      "Nominal Bagi Hasil": item.profit_share_amount,
      "Status Pembayaran": item.payment_status === 'paid' ? 'Sudah Dibayar' : 'Belum Dibayar'
    }));

    // TODO: Implement Excel export functionality
    toast.success("Export Excel akan segera tersedia");
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

            <Button onClick={exportToExcel} className="bg-primary hover:bg-primary/90">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Franchise</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                  <TableHead className="text-center">Persentase (%)</TableHead>
                  <TableHead className="text-right">Nominal Bagi Hasil</TableHead>
                  <TableHead className="text-center">Status Pembayaran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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