'use client';

import { Activity, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';

const events = [
  { name: 'Maria Santos',   type: 'Student', direction: 'IN',  gate: 'Main Gate', time: '2 min ago',  override: false },
  { name: 'Carlos Reyes',   type: 'Staff',   direction: 'IN',  gate: 'Main Gate', time: '5 min ago',  override: false },
  { name: 'Ana Gonzalez',   type: 'Student', direction: 'OUT', gate: 'Side Gate', time: '9 min ago',  override: false },
  { name: 'Jose Dela Cruz', type: 'Visitor', direction: 'IN',  gate: 'Main Gate', time: '12 min ago', override: false },
  { name: 'Mark Bautista',  type: 'Staff',   direction: 'IN',  gate: 'Main Gate', time: '18 min ago', override: true  },
  { name: 'Rosa Mendoza',   type: 'Student', direction: 'OUT', gate: 'Side Gate', time: '23 min ago', override: false },
  { name: 'Lena Torres',    type: 'Student', direction: 'IN',  gate: 'Main Gate', time: '31 min ago', override: false },
  { name: 'John Hayag',     type: 'Student', direction: 'IN',  gate: 'Main Gate', time: '45 min ago', override: false },
];

export default function FeedPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="feed" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Live Feed</h2>
            <p className="text-[#64748b]">Monitor real-time access events at your gate.</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">51</h3>
              <p className="text-sm text-[#64748b]">Events Today</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">48</h3>
              <p className="text-sm text-[#64748b]">Entries (IN)</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#fee2e2] flex items-center justify-center mb-3">
                <UserX className="w-5 h-5 text-[#ef4444]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">3</h3>
              <p className="text-sm text-[#64748b]">Exits (OUT)</p>
            </div>
          </div>

          {/* Event Feed */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#0f172a]">Recent Events</h3>
              <div className="flex items-center gap-2 text-xs text-[#16a34a] font-medium bg-[#dcfce7] px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
                Live
                <span className="text-[#94a3b8] font-normal ml-1">(Coming soon)</span>
              </div>
            </div>
            <div className="space-y-2">
              {events.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-[#f8f9fa] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      e.direction === 'IN' ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'
                    }`}>
                      {e.direction === 'IN'
                        ? <UserCheck className="w-4 h-4 text-[#16a34a]" />
                        : <UserX className="w-4 h-4 text-[#ef4444]" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#0f172a]">{e.name}</p>
                        {e.override && (
                          <span className="flex items-center gap-1 text-xs text-[#f59e0b] bg-[#fef3c7] px-1.5 py-0.5 rounded-full font-medium">
                            <AlertTriangle className="w-3 h-3" /> Override
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748b]">{e.type} • {e.gate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.direction === 'IN' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#ef4444]'
                    }`}>{e.direction}</span>
                    <p className="text-xs text-[#64748b] w-16 text-right">{e.time}</p>
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
