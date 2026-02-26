'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';

interface FeedRow {
  id: string;
  direction: 'IN' | 'OUT';
  event_timestamp: string;
  verification_method: string;
  person_registry: { full_name: string; person_type: string };
  gates: { gate_name: string; gate_code: string };
}

const typeColors: Record<string, string> = {
  Student:        'bg-[#dbeafe] text-[#2563eb]',
  Staff:          'bg-[#ddd6fe] text-[#7c3aed]',
  Visitor:        'bg-[#fef3c7] text-[#f59e0b]',
  'Special Guest':'bg-[#f0fdf4] text-[#16a34a]',
};

const methodLabel: Record<string, string> = {
  QR: 'QR', NFC: 'NFC', MANUAL_OVERRIDE: 'Manual', MANIFEST: 'Manifest',
};

export default function LiveFeedPage() {
  const [events, setEvents] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchEvents = useCallback(async () => {
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('access_events')
      .select('id, direction, event_timestamp, verification_method, person_registry!inner(full_name, person_type), gates!inner(gate_name, gate_code)')
      .gte('event_timestamp', todayStart.toISOString())
      .order('event_timestamp', { ascending: false })
      .limit(200);
    if (data) setEvents(data as unknown as FeedRow[]);
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => {
    const t = setInterval(fetchEvents, 30_000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  const gateGroups = events.reduce<Record<string, number>>((acc, e) => {
    const label = e.gates.gate_name;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa]">
      <OfficerSidebar activePage="feed" />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Live Feed</h2>
              <p className="text-[#64748b]">All IN/OUT events across every gate today.</p>
            </div>
            <button
              onClick={fetchEvents}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{loading ? '—' : events.length}</h3>
              <p className="text-sm text-[#64748b]">Total Events Today</p>
            </div>
            {Object.entries(gateGroups).map(([name, count]) => (
              <div key={name} className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] flex items-center justify-center mb-3">
                  <Activity className="w-5 h-5 text-[#64748b]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{count}</h3>
                <p className="text-sm text-[#64748b]">{name}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-lg font-semibold text-[#0f172a]">All Events</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">{todayDate}</span>
                <span className="text-xs text-[#94a3b8]">
                  Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#94a3b8] text-sm">Loading…</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#94a3b8]">
                <Activity className="w-8 h-8" />
                <p className="text-sm">No events recorded today.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                      {['Name','Type','Gate','Direction','Time','Method'].map((h) => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {events.map((e) => {
                      const pr = e.person_registry;
                      const g = e.gates;
                      return (
                        <tr key={e.id} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="px-6 py-4 font-medium text-[#0f172a]">{pr.full_name}</td>
                          <td className="px-6 py-4">
                            <span className={`whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full ${typeColors[pr.person_type] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
                              {pr.person_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full bg-[#f1f5f9] text-[#64748b]">
                              {g.gate_name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`whitespace-nowrap inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                              e.direction === 'IN' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#ef4444]'
                            }`}>
                              {e.direction === 'IN' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                              {e.direction}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#64748b]">
                            {new Date(e.event_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-[#64748b]">
                            {methodLabel[e.verification_method] ?? e.verification_method}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}