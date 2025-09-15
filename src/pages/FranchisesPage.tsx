import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Calendar,
  Edit,
  Trash2,
  Search
} from 'lucide-react';

interface Franchise {
  id: string;
  franchise_id: string;
  name: string;
  slug: string;
  address: string;
  created_at: string;
}

const FranchisesPage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Only super_admin can access this page
  if (userRole?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFranchises(data || []);
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

  const handleAddFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('franchises')
        .insert([{
          name: formData.name,
          slug: formData.slug,
          address: formData.address
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Franchise berhasil ditambahkan",
      });

      setIsAddDialogOpen(false);
      setFormData({ name: '', slug: '', address: '' });
      fetchFranchises();
    } catch (error: any) {
      console.error('Error adding franchise:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menambahkan franchise",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const filteredFranchises = franchises.filter(franchise =>
    franchise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franchise.franchise_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franchise.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-foreground">Management Franchise</h1>
          <p className="text-muted-foreground">
            Kelola semua franchise yang terdaftar dalam sistem
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Franchise
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Franchise Baru</DialogTitle>
              <DialogDescription>
                Tambahkan franchise baru ke dalam sistem. ID franchise akan dibuat otomatis.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddFranchise} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Franchise</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Contoh: Franchise Jakarta Selatan"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  type="text"
                  placeholder="franchise-jakarta-selatan"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="input-field"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL untuk akses publik: /{formData.slug}/pendapatan-worker
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Alamat (Opsional)</Label>
                <Textarea
                  id="address"
                  placeholder="Alamat lengkap franchise"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="input-field"
                  rows={3}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {submitting ? 'Menambahkan...' : 'Tambah Franchise'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari franchise berdasarkan nama, ID, atau slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-field"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Franchise Aktif</CardTitle>
            <Building2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{franchises.length}</div>
            <p className="text-xs text-muted-foreground">Semua franchise aktif</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filter Hasil</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredFranchises.length}</div>
            <p className="text-xs text-muted-foreground">Dari {franchises.length} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Franchises Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredFranchises.map((franchise) => (
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
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {franchise.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{franchise.address}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Dibuat {new Date(franchise.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>

              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open(`/${franchise.slug}/pendapatan-worker`, '_blank')}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Lihat Public Page
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFranchises.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'Tidak ada franchise yang ditemukan' : 'Belum ada franchise'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm 
                ? 'Coba ubah kata kunci pencarian Anda' 
                : 'Tambahkan franchise pertama untuk memulai'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Franchise Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FranchisesPage;