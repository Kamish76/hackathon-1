'use client';

import { Shield, Home, ScanLine, ClipboardCheck, Users, Activity, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficerGate } from '@/hooks/useOfficerGate';

type ActivePage = 'home' | 'scan' | 'attendance' | 'lookup' | 'feed';

interface OfficerSidebarProps {
  activePage?: ActivePage;
}

const desktopNavItems: { label: string; href: string; icon: React.ReactNode; page: ActivePage }[] = [
  { label: 'Overview',        href: '/officer',            icon: <Home className="w-5 h-5" />,           page: 'home'       },
  { label: 'Scan / Check-in', href: '/officer/scan',       icon: <ScanLine className="w-5 h-5" />,       page: 'scan'       },
  { label: 'Tracker Log',     href: '/officer/attendance', icon: <ClipboardCheck className="w-5 h-5" />, page: 'attendance' },
  { label: 'People Lookup',   href: '/officer/lookup',     icon: <Users className="w-5 h-5" />,          page: 'lookup'     },
  { label: 'Live Feed',       href: '/officer/feed',       icon: <Activity className="w-5 h-5" />,       page: 'feed'       },
];

type MobileNavItem = { label: string; href: string; Icon: React.ComponentType<{ className?: string }>; page: ActivePage };
const mobileNavItems: MobileNavItem[] = [
  { label: 'Home',   href: '/officer',            Icon: Home,           page: 'home'       },
  { label: 'Scan',   href: '/officer/scan',       Icon: ScanLine,       page: 'scan'       },
  { label: 'Log',    href: '/officer/attendance', Icon: ClipboardCheck, page: 'attendance' },
  { label: 'Lookup', href: '/officer/lookup',     Icon: Users,          page: 'lookup'     },
  { label: 'Feed',   href: '/officer/feed',       Icon: Activity,       page: 'feed'       },
];

const pageTitles: Record<ActivePage, string> = {
  home: 'Overview',
  scan: 'Scan / Check-in',
  attendance: 'Tracker Log',
  lookup: 'People Lookup',
  feed: 'Live Feed',
};

export default function OfficerSidebar({ activePage }: OfficerSidebarProps) {
  const { user, logout } = useAuth();
  const { selectedGate } = useOfficerGate();

  return (
    <>
      {/* ── Mobile topbar ─────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-5 h-5 text-[#1e293b] shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-[#0f172a] text-sm">{activePage ? pageTitles[activePage] : 'Officer Portal'}</p>
            {selectedGate && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#64748b] shrink-0" />
                <span className="text-xs text-[#64748b] truncate">{selectedGate.gate_name}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="shrink-0 flex items-center gap-1.5 text-xs text-[#ef4444] border border-[#fecaca] px-2.5 py-1.5 rounded-lg hover:bg-[#fef2f2] transition-colors"
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
              <p className="text-xs text-[#64748b]">Officer Portal</p>
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
          </div>
        </nav>

        {/* User + Logout */}
        <div className="p-4 border-t border-[#e2e8f0] space-y-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-white text-sm font-medium shrink-0">
              {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'O'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0f172a] truncate">{user?.name ?? 'Officer'}</p>
              <p className="text-xs text-[#64748b]">{user?.role ?? 'Officer'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#ef4444] border border-[#fecaca] hover:bg-[#fef2f2] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
          {/* Gate indicator */}
          <div className="px-3 py-2 rounded-lg bg-[#f1f5f9] flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#64748b]" />
            {selectedGate ? (
              <span className="text-xs font-medium text-[#1e293b] truncate">{selectedGate.gate_name}</span>
            ) : (
              <span className="text-xs text-[#94a3b8]">No gate selected</span>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e2e8f0] flex">
        {mobileNavItems.map(({ label, href, Icon, page }) => {
          const isActive = activePage === page;
          return (
            <a
              key={page}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#1e293b]' : 'text-[#94a3b8]'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
