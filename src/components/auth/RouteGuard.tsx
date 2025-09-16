import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RouteGuardProps {
  children: React.ReactNode;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!userRole) return;

    // If user role is 'user', they can only access worker-income page
    if (userRole.role === 'user' && location.pathname !== '/worker-income') {
      toast({
        title: "Akses Terbatas",
        description: "Anda hanya dapat melihat data Pendapatan Worker.",
        variant: "default",
      });
      navigate('/worker-income', { replace: true });
      return;
    }

    // If user role is 'user' and on root path, redirect to worker-income
    if (userRole.role === 'user' && location.pathname === '/') {
      navigate('/worker-income', { replace: true });
      return;
    }
  }, [userRole, location.pathname, navigate, toast]);

  return <>{children}</>;
};

export default RouteGuard;