import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

interface SyncRolesButtonProps {
  onSyncCompleted?: () => void;
}

export const SyncRolesButton: React.FC<SyncRolesButtonProps> = ({ onSyncCompleted }) => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSyncRoles = async () => {
    setLoading(true);
    try {
      console.log('Calling sync-roles function');
      
      const { data, error } = await supabase.functions.invoke('sync-roles', {
        body: {},
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('Sync response:', data);

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Berhasil",
        description: data?.message || `Sinkronisasi berhasil: ${data?.synced_count || 0} user diperbarui`,
      });
      
      onSyncCompleted?.();
    } catch (error: any) {
      console.error('Error syncing roles:', error);
      toast({
        title: "Error",
        description: error.message || 'Gagal melakukan sinkronisasi roles',
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
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleSyncRoles} 
      disabled={loading}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync Roles'}
    </Button>
  );
};