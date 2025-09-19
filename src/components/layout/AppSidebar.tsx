import React, { useState } from 'react';
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
  Menu,
  X
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { state } = useSidebar();
  const { userRole, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!userRole) {
    return null;
  }

  const items = menuItems[userRole.role] || [];
  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";

  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-50 p-2 rounded-md bg-background border border-border shadow-sm md:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Mobile Overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <Sidebar className={`
          fixed left-0 top-0 h-full w-64 z-50 transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:z-0 md:w-64
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          border-r border-border bg-background
        `}>
          <SidebarContent className="bg-card border-r">
            <div className="p-4 pt-16">
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
                            onClick={() => setIsOpen(false)}
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
                          onClick={() => {
                            signOut();
                            setIsOpen(false);
                          }}
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
            </div>
          </SidebarContent>
        </Sidebar>
      </>
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      className="hidden md:flex"
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