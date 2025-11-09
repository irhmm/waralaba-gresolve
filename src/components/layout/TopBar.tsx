import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Building2, LogOut, Settings, User } from 'lucide-react';

const roleDisplayNames = {
  super_admin: 'Super Admin',
  franchise: 'Pemilik Franchise',
  admin_keuangan: 'Admin Keuangan',
  admin_marketing: 'Admin Marketing',
  user: 'User'
};

const roleColors = {
  super_admin: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  franchise: 'bg-primary/10 text-primary hover:bg-primary/20',
  admin_keuangan: 'bg-success/10 text-success hover:bg-success/20',
  admin_marketing: 'bg-warning/10 text-warning hover:bg-warning/20',
  user: 'bg-muted text-muted-foreground hover:bg-muted/80'
};

export const TopBar = () => {
  const { user, userRole, signOut } = useAuth();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 h-14 sm:h-16 border-b border-border bg-card flex items-center justify-between px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <SidebarTrigger className="flex-shrink-0" />
        
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate">
              Gresolve Waralaba
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Franchise Management System
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {userRole && (
          <Badge 
            variant="secondary" 
            className={`${roleColors[userRole.role]} transition-colors duration-150 text-xs hidden sm:inline-flex`}
          >
            {roleDisplayNames[userRole.role]}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full p-0">
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                  {user?.email ? getInitials(user.email) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">
                  {user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userRole ? roleDisplayNames[userRole.role] : 'Loading...'}
                </p>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};