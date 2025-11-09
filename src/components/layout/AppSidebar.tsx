import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  Building2, 
  DollarSign, 
  Users, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  LogOut,
  BarChart3,
  UserCheck,
  Plus,
  Percent,
} from 'lucide-react';

const menuItems = {
  super_admin: [
    {
      title: 'Dashboard',
      url: '/',
      icon: BarChart3,
    },
    {
      title: 'List Franchise',
      url: '/admin/franchises',
      icon: Building2,
    },
    {
      title: 'Add Franchise',
      url: '/admin/franchises/new',
      icon: Plus,
    },
    {
      title: 'Pengaturan Profit',
      url: '/admin/profit-sharing',
      icon: Percent,
    },
    {
      title: 'Data Bagi Hasil Franchise',
      url: '/admin/franchise-profit-sharing',
      icon: TrendingUp,
    },
    {
      title: 'Rekap Worker Wara',
      url: '/admin/worker-rekap',
      icon: FileText,
    },
    {
      title: 'Rekap Admin Wara',
      url: '/admin/admin-rekap',
      icon: DollarSign,
    },
  ],
  franchise: [
    {
      title: 'Dashboard',
      url: '/',
      icon: BarChart3,
    },
    {
      title: 'Pendapatan Worker',
      url: '/worker-income',
      icon: DollarSign,
    },
    {
      title: 'Pendapatan Admin',
      url: '/admin-income',
      icon: TrendingUp,
    },
    {
      title: 'Pengeluaran',
      url: '/expenses',
      icon: CreditCard,
    },
    {
      title: 'Data Worker',
      url: '/workers',
      icon: UserCheck,
    },
  ],
  admin_keuangan: [
    {
      title: 'Dashboard',
      url: '/',
      icon: BarChart3,
    },
    {
      title: 'Pendapatan Worker',
      url: '/worker-income',
      icon: DollarSign,
    },
    {
      title: 'Pendapatan Admin',
      url: '/admin-income',
      icon: TrendingUp,
    },
    {
      title: 'Pengeluaran',
      url: '/expenses',
      icon: CreditCard,
    },
    {
      title: 'Data Worker',
      url: '/workers',
      icon: UserCheck,
    },
  ],
  admin_marketing: [
    {
      title: 'Pendapatan Admin',
      url: '/admin-income',
      icon: TrendingUp,
    },
    {
      title: 'Pendapatan Worker',
      url: '/worker-income',
      icon: DollarSign,
    },
  ],
  user: [
    {
      title: 'Pendapatan Worker',
      url: '/worker-income',
      icon: DollarSign,
    },
  ],
};

export function AppSidebar() {
  const { userRole, signOut } = useAuth();
  const location = useLocation();

  if (!userRole) {
    return null;
  }

  const items = menuItems[userRole.role] || [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-card border-r">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium">
            Menu Utama
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `sidebar-item ${isActive ? 'sidebar-item-active' : ''}`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button 
                    onClick={signOut}
                    className="sidebar-item w-full text-left text-destructive hover:text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Keluar</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}