import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

const AppLayout = () => {
  const { user, loading, userRole } = useAuth();

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <TopBar />
          
          <main className="flex-1 p-6 bg-muted/30">
            <div className="max-w-7xl mx-auto">
              {userRole ? (
                <Outlet />
              ) : (
                <div className="min-h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold mb-4">Akun Belum Disetup</h2>
                    <p className="text-muted-foreground mb-4">
                      Akun Anda belum memiliki role yang ditetapkan.
                    </p>
                    <p className="text-muted-foreground">
                      Silakan hubungi administrator untuk mengatur role Anda.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;