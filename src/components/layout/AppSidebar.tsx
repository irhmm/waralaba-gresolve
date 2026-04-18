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
  Wallet,
} from 'lucide-react';

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: Record<string, MenuGroup[]> = {
  super_admin: [
    {
      label: 'Keuangan',
      items: [
        { title: 'Dashboard', url: '/', icon: BarChart3 },
        { title: 'Laba Bersih Franchise', url: '/admin/franchise-net-income', icon: DollarSign },
        { title: 'Pengaturan Profit', url: '/admin/profit-sharing', icon: Percent },
        { title: 'Data Bagi Hasil Franchise', url: '/admin/franchise-profit-sharing', icon: TrendingUp },
      ],
    },
    {
      label: 'Franchise',
      items: [
        { title: 'List Franchise', url: '/admin/franchises', icon: Building2 },
        { title: 'Add Franchise', url: '/admin/franchises/new', icon: Plus },
      ],
    },
    {
      label: 'Admin',
      items: [
        { title: 'Rekap Admin Wara', url: '/admin/admin-rekap', icon: DollarSign },
      ],
    },
    {
      label: 'Worker',
      items: [
        { title: 'Rekap Worker Wara', url: '/admin/worker-rekap', icon: FileText },
        { title: 'Data Worker', url: '/admin/all-workers', icon: Users },
      ],
    },
  ],
  franchise: [
    {
      label: 'Keuangan',
      items: [
        { title: 'Dashboard', url: '/', icon: BarChart3 },
        { title: 'Pengeluaran', url: '/expenses', icon: CreditCard },
      ],
    },
    {
      label: 'Admin',
      items: [
        { title: 'Pendapatan Admin', url: '/admin-income', icon: TrendingUp },
      ],
    },
    {
      label: 'Worker',
      items: [
        { title: 'Pendapatan Worker', url: '/worker-income', icon: DollarSign },
        { title: 'Sisa Gaji Worker', url: '/worker-salary-balance', icon: Wallet },
        { title: 'Data Worker', url: '/workers', icon: UserCheck },
      ],
    },
  ],
  admin_keuangan: [
    {
      label: 'Keuangan',
      items: [
        { title: 'Dashboard', url: '/', icon: BarChart3 },
        { title: 'Pengeluaran', url: '/expenses', icon: CreditCard },
      ],
    },
    {
      label: 'Admin',
      items: [
        { title: 'Pendapatan Admin', url: '/admin-income', icon: TrendingUp },
      ],
    },
    {
      label: 'Worker',
      items: [
        { title: 'Pendapatan Worker', url: '/worker-income', icon: DollarSign },
        { title: 'Data Worker', url: '/workers', icon: UserCheck },
      ],
    },
  ],
  admin_marketing: [
    {
      label: 'Menu Utama',
      items: [
        { title: 'Pendapatan Admin', url: '/admin-income', icon: TrendingUp },
        { title: 'Pendapatan Worker', url: '/worker-income', icon: DollarSign },
      ],
    },
  ],
  user: [
    {
      label: 'Menu Utama',
      items: [
        { title: 'Pendapatan Worker', url: '/worker-income', icon: DollarSign },
      ],
    },
  ],
};

export function AppSidebar() {
  const { userRole, signOut } = useAuth();
  const location = useLocation();

  if (!userRole) {
    return null;
  }

  const groups = menuGroups[userRole.role] || [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-card border-r">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground font-medium">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}

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
