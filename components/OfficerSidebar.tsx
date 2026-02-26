'use client';

import { Shield, Home, ScanLine, ClipboardCheck, Users, Activity, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficerGate } from '@/hooks/useOfficerGate';

type ActivePage = 'home' | 'scan' | 'attendance' | 'lookup' | 'feed';

interface OfficerSidebarProps {
  activePage?: ActivePage;
}

const navItems: { label: string; href: string; icon: React.ReactNode; page: ActivePage }[] = [
  { label: 'Overview',       href: '/officer',            icon: <Home className="w-5 h-5" />,          page: 'home'       },
  { label: 'Scan / Check-in',href: '/officer/scan',       icon: <ScanLine className="w-5 h-5" />,      page: 'scan'       },
  { label: 'Tracker Log',    href: '/officer/attendance', icon: <ClipboardCheck className="w-5 h-5" />,page: 'attendance' },
  { label: 'People Lookup',  href: '/officer/lookup',     icon: <Users className="w-5 h-5" />,         page: 'lookup'     },
  { label: 'Live Feed',      href: '/officer/feed',       icon: <Activity className="w-5 h-5" />,      page: 'feed'       },
];

export default function OfficerSidebar({ activePage }: OfficerSidebarProps) {
  const { user, logout } = useAuth();
  const { selectedGate } = useOfficerGate();

  return (
    <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0">
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
          {navItems.map((item) => {
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
  );
}
