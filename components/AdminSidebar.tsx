'use client';

import { useEffect, useState } from 'react';
import { Shield, BarChart3, Users, Activity, Settings, LogOut, Bug, ChevronDown, ChevronRight, DoorOpen, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type ActivePage = 'dashboard' | 'people' | 'events' | 'gates' | 'checkpoints' | 'emergency';

interface AdminSidebarProps {
  activePage?: ActivePage;
}

const desktopNavItems: { label: string; href: string; icon: React.ReactNode; page: ActivePage }[] = [
  { label: 'Dashboard',     href: '/admin/dashboard',   icon: <BarChart3 className="w-5 h-5" />,   page: 'dashboard'   },
  { label: 'People',        href: '/people',            icon: <Users className="w-5 h-5" />,       page: 'people'      },
  { label: 'Access Events', href: '/events',            icon: <Activity className="w-5 h-5" />,    page: 'events'      },
  { label: 'Gates',         href: '/admin/gates',       icon: <DoorOpen className="w-5 h-5" />,    page: 'gates'       },
  { label: 'Checkpoints',   href: '/admin/checkpoints', icon: <Settings className="w-5 h-5" />,    page: 'checkpoints' },
];

type MobileNavItem = { label: string; href: string; Icon: React.ComponentType<{ className?: string }>; page: ActivePage };
const mobileNavItems: MobileNavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard',  Icon: BarChart3,     page: 'dashboard' },
  { label: 'People',    href: '/people',           Icon: Users,         page: 'people'    },
  { label: 'Events',    href: '/events',           Icon: Activity,      page: 'events'    },
  { label: 'Gates',     href: '/admin/gates',      Icon: DoorOpen,      page: 'gates'     },
  { label: 'Emergency', href: '/admin/emergency',  Icon: AlertTriangle, page: 'emergency' },
];

const pageTitles: Record<ActivePage, string> = {
  dashboard: 'Dashboard',
  people: 'People',
  events: 'Access Events',
  gates: 'Gates',
  checkpoints: 'Checkpoints',
  emergency: 'Emergency',
};

export default function AdminSidebar({ activePage }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const supabase = createClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);

  useEffect(() => {
    async function checkEmergency() {
      const { data } = await supabase
        .from('emergency_sessions')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      setEmergencyActive(!!data);
    }
    checkEmergency();
    const interval = setInterval(checkEmergency, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* ── Mobile topbar ─────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1e293b]" />
          <span className="font-semibold text-[#0f172a] text-sm">
            {activePage ? pageTitles[activePage] : 'Admin Portal'}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-[#ef4444] border border-[#fecaca] px-2.5 py-1.5 rounded-lg hover:bg-[#fef2f2] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </header>

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-[#e2e8f0] flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#1e293b]" />
            <div>
              <h1 className="text-lg font-semibold text-[#0f172a]">NFC Access</h1>
              <p className="text-xs text-[#64748b]">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {desktopNavItems.map((item) => {
              const isActive = activePage === item.page;
              return (
                <a
                  key={item.page}
                  href={item.href}
                  className={
                    isActive
                      ? 'flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f1f5f9] text-[#1e293b] font-medium'
                      : 'flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors'
                  }
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            })}

            {/* Emergency */}
            <a
              href="/admin/emergency"
              className={
                activePage === 'emergency'
                  ? 'flex items-center gap-3 px-3 py-2 rounded-lg bg-[#fef2f2] text-[#dc2626] font-medium'
                  : emergencyActive
                    ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-[#dc2626] bg-[#fef2f2] animate-pulse'
                    : 'flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors'
              }
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="flex-1">Emergency</span>
              {emergencyActive && activePage !== 'emergency' && (
                <span className="w-2 h-2 rounded-full bg-[#dc2626] shrink-0" />
              )}
            </a>
          </div>

          {/* Settings */}
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="flex-1 text-left">Settings</span>
              {settingsOpen
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />}
            </button>
            {settingsOpen && (
              <div className="ml-4 mt-1 space-y-1">
                <a
                  href="/admin/settings/debug"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors text-sm"
                >
                  <Bug className="w-4 h-4" />
                  Debug
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* User + Logout */}
        <div className="p-4 border-t border-[#e2e8f0] space-y-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-white text-sm font-medium shrink-0">
              {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0f172a] truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-xs text-[#64748b]">{user?.role ?? 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#ef4444] border border-[#fecaca] hover:bg-[#fef2f2] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e2e8f0] flex">
        {mobileNavItems.map(({ label, href, Icon, page }) => {
          const isActive = activePage === page;
          const isEmergency = page === 'emergency';
          return (
            <a
              key={page}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? isEmergency ? 'text-[#dc2626]' : 'text-[#1e293b]'
                  : isEmergency && emergencyActive
                  ? 'text-[#dc2626]'
                  : 'text-[#94a3b8]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isEmergency && emergencyActive && activePage !== 'emergency' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#dc2626]" />
                )}
              </div>
              {label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
