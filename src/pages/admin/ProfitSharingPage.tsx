import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, Percent, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ProfitSharingPage = () => {
  const [adminPercentage, setAdminPercentage] = useState<number>(20);
  const [franchisePercentage, setFranchisePercentage] = useState<number>(80);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGlobalProfitSettings();
  }, []);

  const fetchGlobalProfitSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_global_profit_settings');

      if (error) throw error;
      
      if (data && data.length > 0) {
        setAdminPercentage(data[0].admin_percentage);
        setFranchisePercentage(data[0].franchise_percentage);
      } else {
        // Default values
        setAdminPercentage(20);
        setFranchisePercentage(80);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat pengaturan bagi hasil global",
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

  const saveGlobalProfitSettings = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Delete old settings first
      await supabase.from('global_profit_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Insert new settings
      const { error } = await supabase
        .from('global_profit_settings')
        .insert({
          admin_percentage: adminPercentage,
          franchise_percentage: franchisePercentage,
          created_by: userData.user?.id
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengaturan bagi hasil global berhasil disimpan dan akan berlaku untuk semua franchise",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan bagi hasil global",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Bagi Hasil Global</h1>
      </div>
      
      <div className="bg-info/10 border border-info/20 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-info mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-info-foreground">
              Pengaturan Global untuk Semua Franchise
            </p>
            <p className="text-xs text-info-foreground/80">
              • Pengaturan ini berlaku untuk <strong>semua franchise</strong> tanpa kecuali<br/>
              • Sekali mengubah persentase, semua franchise akan mengikuti pengaturan yang sama<br/>
              • Berlaku untuk semua bulan dan tahun (masa lalu, sekarang, dan masa depan)
            </p>
          </div>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Percent className="h-5 w-5 text-primary" />
            Atur Persentase Bagi Hasil Global
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Percentage Settings */}
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
                  disabled={loading}
                />
              </div>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{adminPercentage}%</div>
                  <div className="text-sm text-muted-foreground">Bagian Super Admin</div>
                  <div className="text-xs text-muted-foreground mt-1">Berlaku untuk semua franchise</div>
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
                  disabled={loading}
                />
              </div>
              <div className="p-4 bg-success/5 rounded-lg border border-success/10">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{franchisePercentage}%</div>
                  <div className="text-sm text-muted-foreground">Bagian Franchise</div>
                  <div className="text-xs text-muted-foreground mt-1">Berlaku untuk semua franchise</div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Pengaturan Global Aktif</div>
              <div className="text-lg font-bold text-foreground">
                Super Admin: {adminPercentage}% | Semua Franchise: {franchisePercentage}%
              </div>
              <div className="text-xs text-muted-foreground">
                Persentase ini akan diterapkan pada <strong>SEMUA</strong> franchise dan perhitungan bagi hasil
              </div>
              {adminPercentage + franchisePercentage !== 100 && (
                <div className="text-sm text-destructive">
                  ⚠️ Total harus 100%
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={saveGlobalProfitSettings}
              disabled={saving || loading || adminPercentage + franchisePercentage !== 100}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Global'}
            </Button>
          </div>

          {/* Warning */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-warning text-lg">⚠️</div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-warning-foreground">
                  Perhatian: Pengaturan Global
                </p>
                <p className="text-xs text-warning-foreground/80">
                  Sekali Anda menyimpan pengaturan ini, <strong>SEMUA franchise</strong> akan menggunakan persentase yang sama. 
                  Tidak ada pengaturan individual per franchise lagi.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitSharingPage;