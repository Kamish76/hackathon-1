'use client';

import { ScanLine, ClipboardCheck, Users, Activity, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import OfficerSidebar from '@/components/OfficerSidebar';

const quickActions = [
  {
    icon: <ScanLine className="w-6 h-6 text-[#2563eb]" />,
    bg: 'bg-[#dbeafe]',
    title: 'Scan / Check-in',
    description: 'Scan NFC tags or QR codes to record entry and exit events.',
  },
  {
    icon: <ClipboardCheck className="w-6 h-6 text-[#7c3aed]" />,
    bg: 'bg-[#ddd6fe]',
    title: 'Attendance Log',
    description: 'View and verify attendance records for your assigned checkpoint.',
  },
  {
    icon: <Users className="w-6 h-6 text-[#f59e0b]" />,
    bg: 'bg-[#fef3c7]',
    title: 'People Lookup',
    description: 'Search registered people to manually verify identity.',
  },
  {
    icon: <Activity className="w-6 h-6 text-[#16a34a]" />,
    bg: 'bg-[#dcfce7]',
    title: 'Live Feed',
    description: 'Monitor real-time access events at your gate.',
  },
];

export default function OfficerPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="home" />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-[#64748b]">
              You&apos;re logged in as an{' '}
              <span className="font-medium text-[#1e293b]">Attendance Officer</span>. Use the tools below to manage checkpoint access.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">—</h3>
              <p className="text-sm text-[#64748b]">People Checked In Today</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">—</h3>
              <p className="text-sm text-[#64748b]">Current Population Inside</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#fef3c7] flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-[#f59e0b]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">—</h3>
              <p className="text-sm text-[#64748b]">Last Scan</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <div
                  key={action.title}
                  className="flex items-start gap-4 p-4 rounded-lg border border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[#0f172a]">{action.title}</h4>
                      <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full whitespace-nowrap">
                        Coming soon
                      </span>
                    </div>
                    <p className="text-xs text-[#64748b]">{action.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
