
import React, { useState } from 'react';
import { 
  Home, 
  Cpu, 
  ToggleLeft, 
  Calendar, 
  Users, 
  Settings, 
  Shield,
  ChevronLeft,
  ChevronRight,
  Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', icon: Home, href: '/', current: false },
  { name: 'Devices', icon: Cpu, href: '/devices', current: false },
  { name: 'Switches', icon: ToggleLeft, href: '/switches', current: false },
  { name: 'Master Control', icon: Power, href: '/master', current: false },
  { name: 'Schedule', icon: Calendar, href: '/schedule', current: false },
  { name: 'Users', icon: Users, href: '/users', current: false, adminOnly: true },
  { name: 'Settings', icon: Settings, href: '/settings', current: false },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = true; // This would come from auth context

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  return (
    <div className={cn(
      "glass border-r flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo/Brand */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg">IoT Control</h1>
              <p className="text-xs text-muted-foreground">Home Automation</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          
          const Icon = item.icon;
          const isCurrentPage = location.pathname === item.href;
          
          return (
            <Button
              key={item.name}
              variant={isCurrentPage ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-11 px-3",
                isCurrentPage && "bg-primary text-primary-foreground shadow-lg",
                collapsed && "px-3 justify-center"
              )}
              onClick={() => handleNavigation(item.href)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
