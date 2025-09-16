import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Franchise {
  id: string;
  name: string;
  franchise_id: string;
}

interface ProfitSharing {
  franchise_id: string;
  admin_percentage: number;
  franchise_percentage: number;
}

const ProfitSharingPage = () => {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('');
  const [adminPercentage, setAdminPercentage] = useState<number>(20);
  const [franchisePercentage, setFranchisePercentage] = useState<number>(80);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFranchises();
  }, []);

  useEffect(() => {
    if (selectedFranchise) {
      fetchProfitSharing();
    }
  }, [selectedFranchise]);

  const fetchFranchises = async () => {
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('id, name, franchise_id')
        .order('name');

      if (error) throw error;
      setFranchises(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data franchise",
        variant: "destructive",
      });
    }
  };

  const fetchProfitSharing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('franchise_profit_settings')
        .select('admin_percentage, franchise_percentage')
        .eq('franchise_id', selectedFranchise)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAdminPercentage(Number(data.admin_percentage));
        setFranchisePercentage(Number(data.franchise_percentage));
      } else {
        // Default values
        setAdminPercentage(20);
        setFranchisePercentage(80);
      }
    } catch (error) {
      console.error('Fetch profit settings error:', error);
      toast({
        title: "Error",
        description: "Gagal memuat pengaturan bagi hasil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPercentageChange = (value: number) => {
    if (value >= 0 && value <= 100) {
      setAdminPercentage(value);
      setFranchisePercentage(100 - value);
    }
  };

  const handleFranchisePercentageChange = (value: number) => {
    if (value >= 0 && value <= 100) {
      setFranchisePercentage(value);
      setAdminPercentage(100 - value);
    }
  };

  const saveProfitSharing = async () => {
    if (!selectedFranchise) {
      toast({
        title: "Error",
        description: "Pilih franchise terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('franchise_profit_settings')
        .upsert({
          franchise_id: selectedFranchise,
          admin_percentage: adminPercentage,
          franchise_percentage: franchisePercentage,
          created_by: userData.user?.id
        }, {
          onConflict: 'franchise_id'
        });

      if (error) throw error;

      // Trigger recalculation for current month to apply new settings
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { error: calcError } = await supabase
        .rpc('calculate_franchise_profit_sharing', {
          target_month_year: currentMonth
        });

      if (calcError) {
        console.error('Calculation error:', calcError);
        // Don't fail the save, but log the error
      }

      toast({
        title: "Berhasil",
        description: "Pengaturan bagi hasil berhasil disimpan dan diterapkan",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan bagi hasil",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Bagi Hasil Global</h1>
      </div>
      
      <div className="bg-info/10 border border-info/20 rounded-lg p-4 mb-4">
        <p className="text-sm text-info-foreground">
          ℹ️ Pengaturan ini akan berlaku untuk semua bulan dan tahun. Sekali mengubah persentase, maka akan langsung diterapkan pada semua perhitungan bagi hasil.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Percent className="h-5 w-5 text-primary" />
            Atur Persentase Global Bagi Hasil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Franchise Selection */}
          <div className="space-y-2">
            <Label htmlFor="franchise">Pilih Franchise</Label>
            <Select value={selectedFranchise} onValueChange={setSelectedFranchise}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih franchise..." />
              </SelectTrigger>
              <SelectContent>
                {franchises.map((franchise) => (
                  <SelectItem key={franchise.id} value={franchise.id}>
                    {franchise.name} ({franchise.franchise_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Percentage Settings */}
          {selectedFranchise && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-percentage">Persentase Super Admin (%)</Label>
                  <Input
                    id="admin-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={adminPercentage}
                    onChange={(e) => handleAdminPercentageChange(Number(e.target.value))}
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{adminPercentage}%</div>
                    <div className="text-sm text-muted-foreground">Bagian Super Admin</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="franchise-percentage">Persentase Franchise (%)</Label>
                  <Input
                    id="franchise-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={franchisePercentage}
                    onChange={(e) => handleFranchisePercentageChange(Number(e.target.value))}
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="p-4 bg-success/5 rounded-lg border border-success/10">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">{franchisePercentage}%</div>
                    <div className="text-sm text-muted-foreground">Bagian Franchise</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedFranchise && (
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground">Pengaturan Berlaku untuk Semua Bulan</div>
                <div className="text-lg font-bold text-foreground">
                  Admin: {adminPercentage}% | Franchise: {franchisePercentage}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Persentase ini akan diterapkan pada semua perhitungan bagi hasil
                </div>
                {adminPercentage + franchisePercentage !== 100 && (
                  <div className="text-sm text-destructive">
                    ⚠️ Total harus 100%
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          {selectedFranchise && (
            <div className="flex justify-end">
              <Button 
                onClick={saveProfitSharing}
                disabled={saving || loading || adminPercentage + franchisePercentage !== 100}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan Global'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitSharingPage;