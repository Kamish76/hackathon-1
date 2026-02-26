'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Clock, MapPin, Users } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';
import { useOfficerGate } from '@/hooks/useOfficerGate';

interface EventRow {
  id: string;
  direction: 'IN' | 'OUT';
  event_timestamp: string;
  verification_method: string;
  person_registry: {
    full_name: string;
    person_type: string;
  };
}

const typeColors: Record<string, string> = {
  Student:       'bg-[#dbeafe] text-[#2563eb]',
  Staff:         'bg-[#ddd6fe] text-[#7c3aed]',
  Visitor:       'bg-[#fef3c7] text-[#f59e0b]',
  'Special Guest':'bg-[#f0fdf4] text-[#16a34a]',
};

const methodLabel: Record<string, string> = {
  QR:              'QR',
  NFC:             'NFC',
  MANUAL_OVERRIDE: 'Manual',
  MANIFEST:        'Manifest',
};

export default function TrackerLogPage() {
  const { selectedGate } = useOfficerGate();
  // null = not yet fetched; [] = fetched but empty
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    if (!selectedGate?.id) return;
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    supabase
      .from('access_events')
      .select('id, direction, event_timestamp, verification_method, person_registry!inner(full_name, person_type)')
      .eq('gate_id', selectedGate.id)
      .gte('event_timestamp', todayStart.toISOString())
      .order('event_timestamp', { ascending: false })
      .then(({ data }: { data: EventRow[] | null }) => {
        setEvents(data ?? []);
      });
  }, [selectedGate?.id]);

  const loading = selectedGate && events === null;

  const insideCount  = (() => {
    // Latest event per person — count those where it's IN
    const latest = new Map<string, EventRow>();
    [...(events ?? [])].reverse().forEach((e) => {
      const key = (e.person_registry as { full_name: string }).full_name;
      latest.set(key, e);
    });
    return [...latest.values()].filter((e) => e.direction === 'IN').length;
  })();

  const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa]">
      <OfficerSidebar activePage="attendance" />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Tracker Log</h2>
            <div className="flex items-center gap-2">
              <p className="text-[#64748b]">Live record of all IN/OUT events at your checkpoint today.</p>
              {selectedGate ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-[#dbeafe] text-[#2563eb] px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3" />{selectedGate.gate_name}
                </span>
              ) : (
                <span className="text-xs text-[#f59e0b] font-medium bg-[#fef3c7] px-2 py-0.5 rounded-full">No gate selected</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-3">
                <Activity className="w-5 h-5 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{loading ? '—' : (events?.length ?? 0)}</h3>
              <p className="text-sm text-[#64748b]">Total Events Today</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{loading ? '—' : insideCount}</h3>
              <p className="text-sm text-[#64748b]">Currently Inside</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#fef3c7] flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-[#f59e0b]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                {loading || !events?.length
                  ? '—'
                  : new Date(events[0].event_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                }
              </h3>
              <p className="text-sm text-[#64748b]">Last Event</p>
            </div>
          </div>

          {/* Event Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-lg font-semibold text-[#0f172a]">Today&apos;s Events</h3>
              <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                {todayDate}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#94a3b8] text-sm">
                Loading…
              </div>
            ) : !selectedGate ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#94a3b8]">
                <MapPin className="w-8 h-8" />
                <p className="text-sm">Go to Scan / Check-in and select a gate first.</p>
              </div>
            ) : (events?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#94a3b8]">
                <Activity className="w-8 h-8" />
                <p className="text-sm">No events recorded today.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Type</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Direction</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Time</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {(events ?? []).map((e) => {
                      const pr = e.person_registry;
                      return (
                        <tr key={e.id} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="px-6 py-4 font-medium text-[#0f172a]">{pr.full_name}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[pr.person_type] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
                              {pr.person_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              e.direction === 'IN'
                                ? 'bg-[#dcfce7] text-[#16a34a]'
                                : 'bg-[#fee2e2] text-[#ef4444]'
                            }`}>
                              {e.direction === 'IN'
                                ? <ArrowDown className="w-3 h-3" />
                                : <ArrowUp className="w-3 h-3" />}
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