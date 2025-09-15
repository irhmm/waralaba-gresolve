import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const AddFranchisePage = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    franchise_id: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Only super_admin can access this page
  if (userRole?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

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
    
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: '' }));
    }
  };

  const handleSlugChange = (slug: string) => {
    const cleanSlug = generateSlug(slug);
    setFormData(prev => ({
      ...prev,
      slug: cleanSlug
    }));
    
    if (errors.slug) {
      setErrors(prev => ({ ...prev, slug: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nama franchise harus diisi';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug harus diisi';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkSlugExists = async (slug: string) => {
    const { data, error } = await supabase
      .from('franchises')
      .select('id')
      .eq('slug', slug)
      .single();

    return !error && data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Check if slug already exists
      const slugExists = await checkSlugExists(formData.slug);
      if (slugExists) {
        setErrors({ slug: 'Slug sudah digunakan, silakan pilih yang lain' });
        setSubmitting(false);
        return;
      }

      // Insert franchise
      const insertData: any = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        address: formData.address.trim() || null
      };

      // Add franchise_id if provided
      if (formData.franchise_id.trim()) {
        insertData.franchise_id = formData.franchise_id.trim();
      }

      const { data, error } = await supabase
        .from('franchises')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Franchise "${formData.name}" berhasil ditambahkan`,
      });

      // Navigate to franchise management or list
      navigate('/admin/franchises');

    } catch (error: any) {
      console.error('Error adding franchise:', error);
      
      if (error.message?.includes('duplicate key value')) {
        if (error.message.includes('slug')) {
          setErrors({ slug: 'Slug sudah digunakan' });
        } else if (error.message.includes('franchise_id')) {
          setErrors({ franchise_id: 'Franchise ID sudah digunakan' });
        } else {
          toast({
            title: "Error",
            description: "Data sudah ada, silakan gunakan data yang berbeda",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error.message || "Gagal menambahkan franchise",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/franchises')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </Button>
        
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Add New Franchise</h1>
          <p className="text-muted-foreground">
            Create a new franchise in the system
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Franchise Information
          </CardTitle>
          <CardDescription>
            Fill in the details for the new franchise. Required fields are marked with *.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Franchise Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Franchise Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Franchise Jakarta Selatan"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={`input-field ${errors.name ? 'border-destructive' : ''}`}
                required
              />
              {errors.name && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </div>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-sm font-medium">
                Slug (URL) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                type="text"
                placeholder="franchise-jakarta-selatan"
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className={`input-field ${errors.slug ? 'border-destructive' : ''}`}
                required
              />
              {formData.slug && !errors.slug && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="w-4 h-4" />
                  Public URL: /{formData.slug}/pendapatan-worker
                </div>
              )}
              {errors.slug && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {errors.slug}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Slug akan digunakan untuk URL publik dan harus unik. Akan otomatis dibuat dari nama.
              </p>
            </div>

            {/* Franchise ID (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="franchise_id" className="text-sm font-medium">
                Franchise ID (Optional)
              </Label>
              <Input
                id="franchise_id"
                type="text"
                placeholder="FR-001 (akan dibuat otomatis jika kosong)"
                value={formData.franchise_id}
                onChange={(e) => setFormData(prev => ({ ...prev, franchise_id: e.target.value }))}
                className={`input-field ${errors.franchise_id ? 'border-destructive' : ''}`}
              />
              {errors.franchise_id && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {errors.franchise_id}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Jika dikosongkan, ID akan dibuat otomatis dengan format FR-001, FR-002, dst.
              </p>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Address (Optional)
              </Label>
              <Textarea
                id="address"
                placeholder="Complete franchise address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="input-field"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Alamat lengkap lokasi franchise
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/admin/franchises')}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              
              <Button 
                type="submit" 
                className="btn-primary flex-1 sm:flex-none" 
                disabled={submitting || !formData.name.trim() || !formData.slug.trim()}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Franchise
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>After creating the franchise, you can:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Assign users to manage this franchise</li>
            <li>Set up workers and income tracking</li>
            <li>Configure expense management</li>
            <li>View financial reports</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddFranchisePage;