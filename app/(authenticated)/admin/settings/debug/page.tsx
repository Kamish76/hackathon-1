'use client';

import { ArrowLeft, Bug, FlaskConical, Terminal, Wifi } from 'lucide-react';
import AdminSidebar from '@/components/AdminSidebar';

export default function DebugPage() {
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <AdminSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center gap-4 shrink-0">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-[#64748b] hover:text-[#1e293b] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-[#1e293b]" />
            <h1 className="text-lg font-semibold text-[#0f172a]">Debug</h1>
          </div>
          <span className="ml-auto text-xs bg-[#fef9c3] text-[#854d0e] px-2 py-1 rounded-full font-medium">
            Mock — no functionality
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-[#64748b] mb-8">
              Debug tools and diagnostics will appear here. No options are configured yet.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-2">
                  <FlaskConical className="w-5 h-5 text-[#64748b]" />
                  <h2 className="font-medium text-[#0f172a]">System Diagnostics</h2>
                  <span className="ml-auto text-xs text-[#94a3b8]">Coming soon</span>
                </div>
                <p className="text-sm text-[#64748b]">Run health checks on database connections and auth services.</p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-2">
                  <Terminal className="w-5 h-5 text-[#64748b]" />
                  <h2 className="font-medium text-[#0f172a]">Event Log</h2>
                  <span className="ml-auto text-xs text-[#94a3b8]">Coming soon</span>
                </div>
                <p className="text-sm text-[#64748b]">Inspect raw system events and NFC scan payloads.</p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-2">
                  <Wifi className="w-5 h-5 text-[#64748b]" />
                  <h2 className="font-medium text-[#0f172a]">Device Status</h2>
                  <span className="ml-auto text-xs text-[#94a3b8]">Coming soon</span>
                </div>
                <p className="text-sm text-[#64748b]">View connectivity status of registered access devices.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
