import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  Clock,
  Headphones,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PhoneCall,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../features/authentication/AuthContext';
import { apiRequest } from '../services/api';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permissions?: string[];
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/live-call': 'Live Call Desk',
  '/calls': 'Call Management',
  '/customers': 'Customer Directory',
  '/requests': 'Customer & Medicine Requests',
  '/followups': 'Follow-ups & Escalations',
  '/employees': 'Employee Performance',
  '/branches': 'Branches',
  '/zones': 'Zones',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/administration': 'System Administration',
  '/system-health': 'System Health & Diagnostics',
  '/settings': 'Account Settings',
};

export function AppLayout() {
  const { user, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiRequest<{ unread_count: number }>('/api/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const navItems: NavItem[] = [
    { to: '/', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" />, permissions: ['dashboard:view'] },
    { to: '/live-call', label: 'Live Call Desk', icon: <Headphones className="h-4 w-4" />, permissions: ['live_call:use'] },
    {
      to: '/calls',
      label: 'Calls',
      icon: <PhoneCall className="h-4 w-4" />,
      permissions: ['calls:read_own', 'calls:read_branch', 'calls:read_zone', 'calls:read_org'],
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: <UserRound className="h-4 w-4" />,
      permissions: ['customers:read'],
    },
    {
      to: '/requests',
      label: 'Customer Requests',
      icon: <ClipboardList className="h-4 w-4" />,
      permissions: ['requests:read_own', 'requests:read_branch', 'requests:read_zone', 'requests:read_org'],
    },
    {
      to: '/followups',
      label: 'Follow-ups',
      icon: <Clock className="h-4 w-4" />,
      permissions: ['followups:read_own', 'followups:read_branch', 'followups:read_zone', 'followups:read_org'],
    },
    {
      to: '/employees',
      label: 'Employees',
      icon: <Users className="h-4 w-4" />,
      permissions: ['performance:read_own', 'performance:read_branch', 'performance:read_zone', 'performance:read_org'],
    },
    {
      to: '/branches',
      label: 'Branches',
      icon: <Building2 className="h-4 w-4" />,
      permissions: ['branches:read', 'admin:branches'],
    },
    {
      to: '/zones',
      label: 'Zones',
      icon: <MapPin className="h-4 w-4" />,
      permissions: ['zones:read', 'admin:zones'],
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      permissions: ['reports:branch', 'reports:zone', 'reports:org'],
    },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      permissions: ['notifications:read'],
    },
    {
      to: '/administration',
      label: 'Administration',
      icon: <ShieldCheck className="h-4 w-4" />,
      permissions: ['admin:users', 'admin:roles', 'admin:integrations', 'admin:audit_logs', 'admin:settings'],
    },
    {
      to: '/system-health',
      label: 'System Health',
      icon: <HeartPulse className="h-4 w-4" />,
      permissions: ['admin:audit_logs', 'admin:settings', 'admin:integrations'],
    },
    { to: '/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const visibleNav = navItems.filter((item) => !item.permissions || hasPermission(...item.permissions));

  const baseSegment = '/' + (location.pathname.split('/')[1] || '');
  const currentTitle = ROUTE_TITLES[baseSegment] || 'ThulasiConnect';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#112D4E] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3F72AF] font-bold text-white shadow-xs">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">ThulasiConnect</div>
            <div className="text-[11px] text-[#DBE2EF]/80">Pharmacy Supervision</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-[#3F72AF] text-white shadow-xs' : 'text-[#DBE2EF]/85 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <span className="flex items-center gap-2.5">
              {item.icon}
              <span>{item.label}</span>
            </span>
            {item.to === '/notifications' && (unreadData?.unread_count || 0) > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadData?.unread_count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-lg bg-white/8 px-3 py-2.5 text-xs">
          <div className="truncate font-semibold text-white">{user?.full_name}</div>
          <div className="mt-0.5 truncate text-[#DBE2EF]/75">{user?.primary_role.replace('_', ' ')}</div>
          {user?.branch_name && <div className="mt-0.5 truncate text-[11px] text-[#DBE2EF]/60">{user.branch_name}</div>}
          {!user?.branch_name && user?.zone_name && (
            <div className="mt-0.5 truncate text-[11px] text-[#DBE2EF]/60">{user.zone_name}</div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-[#DBE2EF] hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F9F7F7]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 shrink-0 shadow-2xl">{sidebarContent}</div>
          <div className="flex-1 bg-[#112D4E]/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between border-b border-[#DBE2EF] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-[#112D4E] hover:bg-[#F9F7F7] lg:hidden cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-[#112D4E]/60">
              <span className="font-semibold text-[#3F72AF]">ThulasiConnect</span>
              <span>/</span>
              <span className="font-semibold text-[#112D4E]">{currentTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#DBE2EF] bg-[#F9F7F7] px-2.5 py-1 text-[11px] font-medium text-[#112D4E]/80 sm:inline-flex">
              Audio Storage: Disabled (Transcript-Only)
            </span>
            <Link
              to="/notifications"
              className="relative rounded-lg border border-[#DBE2EF] p-2 text-[#112D4E] hover:bg-[#F9F7F7]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {(unreadData?.unread_count || 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unreadData?.unread_count}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
