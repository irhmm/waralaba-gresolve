import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { Button } from '@/components/ui/button';
import { RefreshCw, LogOut } from 'lucide-react';

const AppLayout = () => {
  const { user, loading, userRole, roleLoading, refreshRole, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();

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
          <p className="text-muted-foreground">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  // If user doesn't have role yet, default to 'user' role and continue
  const effectiveUserRole = userRole || { role: 'user' as const, franchise_id: null };

  // Role-based redirection from root path
  if (location.pathname === '/') {
    if (effectiveUserRole.role === 'admin_marketing') {
      return <Navigate to="/admin-income" replace />;
    }
    if (effectiveUserRole.role === 'user') {
      return <Navigate to="/worker-income" replace />;
    }
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