'use client';

import { ClipboardCheck, UserCheck, UserX, Users } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';

const records = [
  { name: 'Maria Santos',   type: 'Student', timeIn: '07:42 AM', timeOut: '05:10 PM', status: 'Complete' },
  { name: 'Carlos Reyes',   type: 'Staff',   timeIn: '08:01 AM', timeOut: '—',        status: 'Inside'   },
  { name: 'Ana Gonzalez',   type: 'Student', timeIn: '07:55 AM', timeOut: '04:50 PM', status: 'Complete' },
  { name: 'Jose Dela Cruz', type: 'Visitor', timeIn: '09:30 AM', timeOut: '11:15 AM', status: 'Complete' },
  { name: 'Lena Torres',    type: 'Student', timeIn: '—',        timeOut: '—',        status: 'Absent'   },
  { name: 'Mark Bautista',  type: 'Staff',   timeIn: '08:15 AM', timeOut: '—',        status: 'Inside'   },
  { name: 'Rosa Mendoza',   type: 'Student', timeIn: '07:50 AM', timeOut: '05:00 PM', status: 'Complete' },
];

const statusStyle: Record<string, string> = {
  Complete: 'bg-[#dcfce7] text-[#16a34a]',
  Inside:   'bg-[#dbeafe] text-[#2563eb]',
  Absent:   'bg-[#f1f5f9] text-[#94a3b8]',
};

export default function AttendancePage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="attendance" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Attendance Log</h2>
            <p className="text-[#64748b]">View and verify attendance records for your assigned checkpoint.</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">7</h3>
              <p className="text-sm text-[#64748b]">Total Records Today</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">6</h3>
              <p className="text-sm text-[#64748b]">Present</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] flex items-center justify-center mb-3">
                <UserX className="w-5 h-5 text-[#94a3b8]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">1</h3>
              <p className="text-sm text-[#64748b]">Absent</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-lg font-semibold text-[#0f172a]">
                Today&apos;s Records
              </h3>
              <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                Feb 26, 2026
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Time In</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Time Out</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {records.map((r, i) => (
                    <tr key={i} className="hover:bg-[#f8f9fa] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#0f172a]">{r.name}</td>
                      <td className="px-6 py-4 text-[#64748b]">{r.type}</td>
                      <td className="px-6 py-4 text-[#64748b]">{r.timeIn}</td>
                      <td className="px-6 py-4 text-[#64748b]">{r.timeOut}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#94a3b8]" />
            <p className="text-xs text-[#94a3b8]">Export and filtering coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
