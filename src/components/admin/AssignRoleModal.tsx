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
    if (selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing') {
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

  const handleAssignRole = async () => {
    if (!email || !selectedRole) {
      toast({
        title: "Error",
        description: "Email dan role harus diisi",
        variant: "destructive",
      });
      return;
    }

    if ((selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing') && !franchiseId) {
      toast({
        title: "Error", 
        description: "Franchise harus dipilih untuk role ini",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Calling assign-role function with:', { email, role: selectedRole, franchise_id: franchiseId || null });
      
      const { data, error } = await supabase.functions.invoke('assign-role', {
        body: {
          email: email.trim(),
          role: selectedRole,
          franchise_id: franchiseId || null,
        },
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('Function response:', data);

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Berhasil",
        description: `Role ${selectedRole} berhasil ditetapkan untuk ${email}. User harus login ulang agar role aktif.`,
      });

      // Reset form
      setEmail('');
      setSelectedRole('');
      setFranchiseId('');
      setOpen(false);
      
      onRoleAssigned?.();
    } catch (error: any) {
      console.error('Error assigning role:', error);
      toast({
        title: "Error",
        description: error.message || 'Gagal menetapkan role',
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

          {(selectedRole === 'franchise' || selectedRole === 'admin_keuangan' || selectedRole === 'admin_marketing') && (
            <div>
              <Label htmlFor="franchise">Franchise</Label>
              <Select value={franchiseId} onValueChange={setFranchiseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih franchise" />
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