'use client';

import { ScanLine, Wifi, CheckCircle2, XCircle, Clock } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';

const recentScans = [
  { name: 'Maria Santos',   type: 'Student', direction: 'IN',  gate: 'Main Gate', time: '2 min ago',  status: 'granted' },
  { name: 'Carlos Reyes',   type: 'Staff',   direction: 'IN',  gate: 'Main Gate', time: '5 min ago',  status: 'granted' },
  { name: 'Ana Gonzalez',   type: 'Student', direction: 'OUT', gate: 'Side Gate', time: '9 min ago',  status: 'granted' },
  { name: 'Unknown Tag',    type: '—',       direction: 'IN',  gate: 'Main Gate', time: '12 min ago', status: 'denied'  },
  { name: 'Jose Dela Cruz', type: 'Visitor', direction: 'IN',  gate: 'Main Gate', time: '15 min ago', status: 'granted' },
];

export default function ScanPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="scan" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Scan / Check-in</h2>
            <p className="text-[#64748b]">Scan NFC tags or QR codes to record entry and exit events at your checkpoint.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Scanner Panel */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col items-center justify-center gap-4 min-h-[260px]">
              <div className="w-20 h-20 rounded-full bg-[#dbeafe] flex items-center justify-center">
                <ScanLine className="w-10 h-10 text-[#2563eb]" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-[#0f172a] mb-1">NFC / QR Scanner</p>
                <p className="text-sm text-[#64748b]">Tap an NFC tag or present a QR code to record access.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#64748b] bg-[#f1f5f9] px-3 py-1.5 rounded-full">
                <Wifi className="w-4 h-4" />
                Waiting for scan…
              </div>
              <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">Coming soon</span>
            </div>

            {/* Stats */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">48</h3>
                <p className="text-sm text-[#64748b]">Granted Today</p>
              </div>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#fee2e2] flex items-center justify-center mb-3">
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">3</h3>
                <p className="text-sm text-[#64748b]">Denied Today</p>
              </div>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#fef3c7] flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">2m ago</h3>
                <p className="text-sm text-[#64748b]">Last Scan</p>
              </div>
            </div>
          </div>

          {/* Recent Scans */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Recent Scans</h3>
            <div className="space-y-2">
              {recentScans.map((scan, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-[#f8f9fa] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${scan.status === 'granted' ? 'bg-[#16a34a]' : 'bg-[#ef4444]'}`} />
                    <div>
                      <p className="text-sm font-medium text-[#0f172a]">{scan.name}</p>
                      <p className="text-xs text-[#64748b]">{scan.type} • {scan.gate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      scan.direction === 'IN' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#ef4444]'
                    }`}>{scan.direction}</span>
                    <p className="text-xs text-[#64748b] w-16 text-right">{scan.time}</p>
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
