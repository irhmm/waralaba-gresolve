import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users } from 'lucide-react';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'admin_keuangan', label: 'Admin Keuangan' },
  { value: 'admin_marketing', label: 'Admin Marketing' },
  { value: 'user', label: 'User' },
];

interface AssignRoleModalProps {
  onRoleAssigned?: () => void;
}

export const AssignRoleModal: React.FC<AssignRoleModalProps> = ({ onRoleAssigned }) => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [franchiseId, setFranchiseId] = useState('');
  const [franchises, setFranchises] = useState<any[]>([]);

  // Load franchises when role requires franchise scope
  React.useEffect(() => {
    if (selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing' || selectedRole === 'user') {
      loadFranchises();
    }
  }, [selectedRole]);

  const loadFranchises = async () => {
    try {
      const { data } = await supabase.from('franchises').select('id, name, franchise_id');
      setFranchises(data || []);
    } catch (error) {
      console.error('Error loading franchises:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkUserExists = async (email: string): Promise<boolean> => {
    try {
      // Check if user exists in auth.users via admin endpoint
      const { data, error } = await supabase.functions.invoke('check-user-exists', {
        body: { email: email.trim() }
      });
      
      if (error) {
        console.warn('Could not verify user existence:', error);
        return true; // Proceed anyway if check fails
      }
      
      return data?.exists === true;
    } catch (error) {
      console.warn('Error checking user existence:', error);
      return true; // Proceed anyway if check fails
    }
  };

  const handleAssignRole = async () => {
    // Basic validation
    if (!email || !selectedRole) {
      toast({
        title: "Error",
        description: "Email dan role harus diisi",
        variant: "destructive",
      });
      return;
    }

    // Email format validation
    if (!validateEmail(email.trim())) {
      toast({
        title: "Error",
        description: "Format email tidak valid",
        variant: "destructive",
      });
      return;
    }

    // Franchise validation for specific roles
    if ((selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing' || selectedRole === 'user') && !franchiseId) {
      toast({
        title: "Error", 
        description: "Franchise harus dipilih untuk role ini",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Validating user and assigning role:', { email: email.trim(), role: selectedRole, franchise_id: franchiseId || null });
      
      // Check if user exists first
      const userExists = await checkUserExists(email.trim());
      if (!userExists) {
        toast({
          title: "User Tidak Ditemukan",
          description: `Email ${email.trim()} belum terdaftar di sistem. User harus mendaftar terlebih dahulu melalui halaman registrasi.`,
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('assign-role', {
        body: {
          email: email.trim(),
          role: selectedRole,
          franchise_id: franchiseId || null,
        },
      });

      if (error) {
        console.error('Function error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('AuthSessionMissingError') || error.message?.includes('Invalid authentication')) {
          toast({
            title: "Session Error",
            description: "Sesi Anda telah berakhir. Silakan logout dan login kembali untuk melanjutkan.",
            variant: "destructive",
          });
          return;
        }
        
        if (error.message?.includes('Access denied')) {
          toast({
            title: "Akses Ditolak",
            description: "Anda tidak memiliki permission untuk melakukan assign role.",
            variant: "destructive",
          });
          return;
        }
        
        throw error;
      }

      console.log('Function response:', data);

      if (data?.error) {
        // Handle specific API errors
        if (data.error.includes('User not found')) {
          toast({
            title: "User Tidak Ditemukan",
            description: `Email ${email.trim()} belum terdaftar di sistem. User harus mendaftar terlebih dahulu.`,
            variant: "destructive",
          });
          return;
        }
        
        if (data.error.includes('Access denied')) {
          toast({
            title: "Akses Ditolak", 
            description: "Anda tidak memiliki permission untuk melakukan assign role.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(data.error);
      }

      toast({
        title: "Berhasil",
        description: `Role ${selectedRole} berhasil ditetapkan untuk ${email.trim()}. User harus logout dan login kembali agar role aktif.`,
      });

      // Reset form
      setEmail('');
      setSelectedRole('');
      setFranchiseId('');
      setOpen(false);
      
      onRoleAssigned?.();
    } catch (error: any) {
      console.error('Error assigning role:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Gagal menetapkan role';
      
      if (error.message?.includes('fetch')) {
        errorMessage = 'Koneksi bermasalah. Coba lagi dalam beberapa saat.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timeout. Coba lagi dalam beberapa saat.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show to super_admin
  if (!userRole || userRole.role !== 'super_admin') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Assign Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign User Role</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email User</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing' || selectedRole === 'user') && (
            <div>
              <Label htmlFor="franchise">Franchise</Label>
              <Select value={franchiseId} onValueChange={setFranchiseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih franchise" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-white">
                  {franchises.map((franchise) => (
                    <SelectItem key={franchise.id} value={franchise.id}>
                      {franchise.name} ({franchise.franchise_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button onClick={handleAssignRole} disabled={loading}>
              {loading ? 'Memproses...' : 'Assign Role'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};