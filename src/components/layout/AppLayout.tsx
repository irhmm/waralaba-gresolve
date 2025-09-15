import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { Button } from '@/components/ui/button';
import { RefreshCw, LogOut } from 'lucide-react';

const AppLayout = () => {
  const { user, loading, userRole, roleLoading, refreshRole, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleRefreshRole = async () => {
    setIsRefreshing(true);
    try {
      await refreshRole();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show loading if still fetching role for the first time
  if (roleLoading && userRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Memuat data role...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but has no role, show role assignment instruction
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-2xl font-semibold mb-4">Akun Belum Disetup</h2>
          <p className="text-muted-foreground mb-4">
            Akun Anda belum memiliki role yang ditetapkan.
          </p>
          <p className="text-muted-foreground mb-6">
            Silakan hubungi administrator untuk mengatur role Anda, atau coba refresh untuk memuat ulang role.
          </p>
          
          <div className="flex gap-3 justify-center mb-6">
            <Button 
              variant="outline" 
              onClick={handleRefreshRole}
              disabled={isRefreshing || roleLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || roleLoading) ? 'animate-spin' : ''}`} />
              {(isRefreshing || roleLoading) ? 'Memuat...' : 'Coba Ambil Ulang Role'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
            <p className="font-medium mb-2">Untuk Administrator:</p>
            <p>Gunakan fitur "Assign Role" di halaman admin untuk menetapkan role kepada user ini.</p>
            <p className="mt-2">Email: <code className="bg-background px-2 py-1 rounded">{user.email}</code></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <TopBar />
          
          <main className="flex-1 p-6 bg-muted/30">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;