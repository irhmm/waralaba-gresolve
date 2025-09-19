import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RouteGuardProps {
  children: React.ReactNode;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { userRole, roleLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Wait for role loading to complete
    if (roleLoading) return;

    // Default to 'user' role if no role is set
    const effectiveRole = userRole?.role || 'user';

    // If user role is 'user', they can only access worker-income page
    if (effectiveRole === 'user' && location.pathname !== '/worker-income') {
      toast({
        title: "Akses Terbatas",
        description: "Anda hanya dapat melihat data Pendapatan Worker.",
        variant: "default",
      });
      navigate('/worker-income', { replace: true });
      return;
    }
  }, [userRole?.role, roleLoading, location.pathname, navigate, toast]);

  return <>{children}</>;
};

export default RouteGuard;