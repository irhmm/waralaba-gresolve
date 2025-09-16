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
  Settings,
  BarChart3,
  Wallet,
  UserCheck,
  Receipt,
  Plus,
  Percent
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
      title: 'Pengaturan Bagi Hasil',
      url: '/admin/profit-sharing',
      icon: Percent,
    },
    {
      title: 'Data Bagi Hasil Franchise',
      url: '/admin/franchise-profit-sharing',
      icon: TrendingUp,
    },
    {
      title: 'User Management',
      url: '/users',
      icon: Users,
    },
    {
      title: 'Laporan Global',
      url: '/reports',
      icon: FileText,
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
    {
      title: 'Penarikan Gaji',
      url: '/salary-withdrawals',
      icon: Wallet,
    },
    {
      title: 'Laporan',
      url: '/reports',
      icon: FileText,
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
    {
      title: 'Penarikan Gaji',
      url: '/salary-withdrawals',
      icon: Wallet,
    },
    {
      title: 'Rekap Gaji',
      url: '/salary-recap',
      icon: Receipt,
    },
  ],
  admin_marketing: [
    {
      title: 'Dashboard',
      url: '/',
      icon: BarChart3,
    },
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
      title: 'Dashboard',
      url: '/',
      icon: BarChart3,
    },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { userRole } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  if (!userRole) {
    return null;
  }

  const items = menuItems[userRole.role] || [];
  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
    >
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
                  <NavLink to="/settings" className="sidebar-item">
                    <Settings className="h-4 w-4" />
                    <span>Pengaturan</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}