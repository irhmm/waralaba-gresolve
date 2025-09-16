import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

interface FranchiseProfitSettings {
  franchise_id: string;
  franchise_name: string;
  admin_percentage: number;
  franchise_percentage: number;
}

export default function ProfitSharingSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPercentages, setEditingPercentages] = useState<{[key: string]: number}>({});

  // Fetch all franchises and their current profit sharing settings
  const { data: franchiseSettings = [], isLoading } = useQuery({
    queryKey: ["franchise-profit-settings"],
    queryFn: async () => {
      // Get all franchises
      const { data: franchises, error: franchiseError } = await supabase
        .from("franchises")
        .select("id, name")
        .order("name");

      if (franchiseError) throw franchiseError;

      // Get current profit sharing settings (using latest month as reference)
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const { data: settings, error: settingsError } = await supabase
        .from("franchise_profit_sharing")
        .select("franchise_id, admin_percentage, franchise_percentage")
        .eq("month_year", currentMonth);

      if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw settingsError;
      }

      // Combine franchises with their settings (default to 20/80 if no settings exist)
      return franchises.map(franchise => {
        const setting = settings?.find(s => s.franchise_id === franchise.id);
        return {
          franchise_id: franchise.id,
          franchise_name: franchise.name,
          admin_percentage: setting?.admin_percentage || 20,
          franchise_percentage: setting?.franchise_percentage || 80,
        };
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { franchise_id: string; admin_percentage: number }) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const franchise_percentage = 100 - data.admin_percentage;

      // Insert or update the settings for current month
      const { error } = await supabase
        .from("franchise_profit_sharing")
        .upsert({
          franchise_id: data.franchise_id,
          month_year: currentMonth,
          admin_percentage: data.admin_percentage,
          franchise_percentage: franchise_percentage,
          total_revenue: 0,
          share_nominal: 0,
          payment_status: 'unpaid',
          created_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'franchise_id,month_year'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Berhasil",
        description: "Pengaturan bagi hasil telah diperbarui.",
      });
      queryClient.invalidateQueries({ queryKey: ["franchise-profit-settings"] });
      setEditingPercentages({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Gagal memperbarui pengaturan: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handlePercentageChange = (franchiseId: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setEditingPercentages(prev => ({
        ...prev,
        [franchiseId]: numValue
      }));
    }
  };

  const savePercentage = (franchiseId: string) => {
    const newPercentage = editingPercentages[franchiseId];
    if (newPercentage !== undefined) {
      updateSettingsMutation.mutate({
        franchise_id: franchiseId,
        admin_percentage: newPercentage
      });
    }
  };

  const resetEditing = (franchiseId: string) => {
    setEditingPercentages(prev => {
      const newState = { ...prev };
      delete newState[franchiseId];
      return newState;
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Pengaturan Bagi Hasil Franchise</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Persentase Bagi Hasil per Franchise</CardTitle>
          <p className="text-muted-foreground">
            Atur persentase bagi hasil untuk setiap franchise. Persentase admin + franchise harus = 100%.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Franchise</TableHead>
                  <TableHead className="text-center">Admin (%)</TableHead>
                  <TableHead className="text-center">Franchise (%)</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : franchiseSettings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Tidak ada franchise ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  franchiseSettings.map((setting) => {
                    const isEditing = editingPercentages[setting.franchise_id] !== undefined;
                    const displayAdminPercentage = isEditing 
                      ? editingPercentages[setting.franchise_id] 
                      : setting.admin_percentage;
                    const displayFranchisePercentage = 100 - displayAdminPercentage;

                    return (
                      <TableRow key={setting.franchise_id}>
                        <TableCell className="font-medium">
                          {setting.franchise_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={displayAdminPercentage}
                              onChange={(e) => handlePercentageChange(setting.franchise_id, e.target.value)}
                              className="w-20 mx-auto text-center"
                            />
                          ) : (
                            <span>{displayAdminPercentage}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={displayFranchisePercentage < 0 ? 'text-red-500' : ''}>
                            {displayFranchisePercentage}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center space-x-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => savePercentage(setting.franchise_id)}
                                disabled={displayFranchisePercentage < 0 || displayFranchisePercentage > 100}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Simpan
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetEditing(setting.franchise_id)}
                              >
                                Batal
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePercentageChange(setting.franchise_id, String(setting.admin_percentage))}
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Pengaturan ini akan berlaku untuk perhitungan bagi hasil bulan depan</p>
            <p>• Total pendapatan dihitung dari: Pendapatan Admin + Pendapatan Worker</p>
            <p>• Nominal bagi hasil = Total Pendapatan × Persentase Admin</p>
            <p>• Persentase default: Admin 20%, Franchise 80%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}