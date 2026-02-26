'use client';

import { useState } from 'react';
import { Shield, BarChart3, Users, Activity, Settings, LogOut, Bug, ChevronDown, ChevronRight, DoorOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type ActivePage = 'dashboard' | 'people' | 'events' | 'gates' | 'checkpoints';

interface AdminSidebarProps {
  activePage?: ActivePage;
}

const navItems: { label: string; href: string; icon: React.ReactNode; page: ActivePage }[] = [
  { label: 'Dashboard',     href: '/admin/dashboard',   icon: <BarChart3 className="w-5 h-5" />, page: 'dashboard'   },
  { label: 'People',        href: '/people',            icon: <Users className="w-5 h-5" />,     page: 'people'      },
  { label: 'Access Events', href: '/events',            icon: <Activity className="w-5 h-5" />,  page: 'events'      },
  { label: 'Gates',         href: '/admin/gates',        icon: <DoorOpen className="w-5 h-5" />,   page: 'gates'       },
  { label: 'Checkpoints',   href: '/admin/checkpoints', icon: <Settings className="w-5 h-5" />,  page: 'checkpoints' },
];

export default function AdminSidebar({ activePage }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col shrink-0">
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
  );
}
