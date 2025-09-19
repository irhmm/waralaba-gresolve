import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserRole {
  role: 'super_admin' | 'franchise' | 'admin_keuangan' | 'admin_marketing' | 'user';
  franchise_id?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  fetchUserRole: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const { toast } = useToast();

  const fetchUserRole = async () => {
    if (!user) {
      setUserRole(null);
      return;
    }

    setRoleLoading(true);
    try {
      console.log('Ensuring user role for:', user.email);
      
      // Primary: Use ensure_default_user_role RPC
      const { data, error } = await supabase
        .rpc('ensure_default_user_role', { target_user_id: user.id });

      if (error) {
        console.error('Error with RPC, attempting fallback:', error);
        // Fallback: Direct insert to user_roles table
        await attemptDirectRoleAssignment();
        return;
      }

      console.log('User role data received:', data);

      if (data && typeof data === 'object' && (data as any).exists) {
        setUserRole({
          role: (data as any).role,
          franchise_id: (data as any).franchise_id
        });
      } else {
        console.log('RPC failed, attempting direct assignment');
        await attemptDirectRoleAssignment();
      }
    } catch (error) {
      console.error('Error ensuring user role, using fallback:', error);
      await attemptDirectRoleAssignment();
    } finally {
      setRoleLoading(false);
    }
  };

  const attemptDirectRoleAssignment = async () => {
    try {
      // First check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role, franchise_id')
        .eq('user_id', user?.id)
        .single();

      if (existingRole) {
        setUserRole(existingRole);
        return;
      }

      // If no role exists, create default 'user' role
      const { data: newRole, error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user?.id,
          role: 'user' as const,
          franchise_id: null
        })
        .select('role, franchise_id')
        .single();

      if (insertError) {
        console.error('Failed to create default role:', insertError);
        // Set default role in state as final fallback
        setUserRole({ role: 'user', franchise_id: null });
        return;
      }

      if (newRole) {
        setUserRole(newRole);
      } else {
        // Final fallback - set user role in state
        setUserRole({ role: 'user', franchise_id: null });
      }
    } catch (fallbackError) {
      console.error('Fallback role assignment failed:', fallbackError);
      // Ultimate fallback - just set user role in state
      setUserRole({ role: 'user', franchise_id: null });
    }
  };

  const refreshRole = async () => {
    console.log('Refreshing user role...');
    await fetchUserRole();
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Immediate role fetching without delay
        if (session?.user) {
          fetchUserRole();
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole();
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Success",
        description: "Signed in successfully!",
      });

      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Success",
        description: "Account created! Please check your email for verification.",
      });

      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear local session first to ensure UI updates immediately
      setUser(null);
      setSession(null);
      setUserRole(null);
      
      // Try to sign out from server, but don't fail if session is already invalid
      await supabase.auth.signOut({ scope: 'local' });
      
      toast({
        title: "Success",
        description: "Signed out successfully!",
      });
    } catch (error) {
      // Even if server signout fails, local state is cleared, so show success
      console.warn('Logout warning:', error);
      toast({
        title: "Success", 
        description: "Signed out successfully!",
      });
    }
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    roleLoading,
    signIn,
    signUp,
    signOut,
    fetchUserRole,
    refreshRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};