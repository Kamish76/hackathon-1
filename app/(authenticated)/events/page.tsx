'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Activity, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import AdminSidebar from '@/components/AdminSidebar';

interface AccessEvent {
  id: string;
  event_timestamp: string;
  person_name: string;
  person_type: string;
  nfc_tag_id: string | null;
  direction: 'IN' | 'OUT';
  gate_name: string;
  is_manual_override: boolean;
}

interface Gate {
  id: string;
  gate_name: string;
}

interface Stats {
  total: number;
  entries: number;
  exits: number;
  activeGates: number;
}

const personTypes = ['All', 'Student', 'Staff', 'Visitor', 'Special Guest'];
const directions = ['All', 'IN', 'OUT'];

function getStartOfDayIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function AccessEventsContent() {
  const [events, setEvents] = useState<AccessEvent[] | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, entries: 0, exits: 0, activeGates: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDirection, setSelectedDirection] = useState('All');
  const [selectedGate, setSelectedGate] = useState('All');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showDirectionFilter, setShowDirectionFilter] = useState(false);
  const [showGateFilter, setShowGateFilter] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const startOfDay = getStartOfDayIso();

    const [eventsResult, gatesResult, todayInResult, todayOutResult, activeGatesResult] =
      await Promise.all([
        supabase
          .from('access_events')
          .select(
            `
              id,
              event_timestamp,
              direction,
              is_manual_override,
              person_registry(full_name, person_type, nfc_tag_id),
              gates(gate_name)
            `
          )
          .order('event_timestamp', { ascending: false })
          .limit(500),
        supabase.from('gates').select('id, gate_name').eq('is_active', true).order('gate_name'),
        supabase
          .from('access_events')
          .select('id', { count: 'exact', head: true })
          .eq('direction', 'IN')
          .gte('event_timestamp', startOfDay),
        supabase
          .from('access_events')
          .select('id', { count: 'exact', head: true })
          .eq('direction', 'OUT')
          .gte('event_timestamp', startOfDay),
        supabase.from('gates').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

    const rawEvents = (eventsResult.data ?? []) as Array<{
      id: string;
      event_timestamp: string;
      direction: 'IN' | 'OUT';
      is_manual_override: boolean;
      person_registry: { full_name: string; person_type: string; nfc_tag_id: string | null } | null;
      gates: { gate_name: string } | null;
    }>;

    const normalized: AccessEvent[] = rawEvents.map((e) => ({
      id: e.id,
      event_timestamp: e.event_timestamp,
      person_name: e.person_registry?.full_name ?? 'Unknown',
      person_type: e.person_registry?.person_type ?? 'Unknown',
      nfc_tag_id: e.person_registry?.nfc_tag_id ?? null,
      direction: e.direction,
      gate_name: e.gates?.gate_name ?? 'Unknown Gate',
      is_manual_override: e.is_manual_override,
    }));

    setEvents(normalized);
    setGates(gatesResult.data ?? []);
    setStats({
      total: normalized.length,
      entries: todayInResult.count ?? 0,
      exits: todayOutResult.count ?? 0,
      activeGates: activeGatesResult.count ?? 0,
    });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const gateOptions = ['All', ...gates.map((g) => g.gate_name)];

  // Filter and search logic
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((event) => {
      const matchesSearch =
        event.person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.nfc_tag_id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.gate_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'All' || event.person_type === selectedType;
      const matchesDirection = selectedDirection === 'All' || event.direction === selectedDirection;
      const matchesGate = selectedGate === 'All' || event.gate_name === selectedGate;

      return matchesSearch && matchesType && matchesDirection && matchesGate;
    });
  }, [events, searchQuery, selectedType, selectedDirection, selectedGate]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExport = () => {
    if (!filteredEvents.length) return;
    const headers = ['Timestamp', 'Person', 'Type', 'Direction', 'Gate', 'NFC Tag ID', 'Override'];
    const rows = filteredEvents.map((e) => [
      new Date(e.event_timestamp).toLocaleString(),
      e.person_name,
      e.person_type,
      e.direction,
      e.gate_name,
      e.nfc_tag_id ?? '',
      e.is_manual_override ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = events === null;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa]">
      <AdminSidebar activePage="events" />

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-[#0f172a]">Access Events</h2>
              <button
                onClick={handleExport}
                disabled={isLoading || filteredEvents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-[#334155] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                <span>Export CSV</span>
              </button>
            </div>
            <p className="text-[#64748b]">Monitor and track all access events in real-time</p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Total Events</p>
              <p className="text-2xl font-bold text-[#0f172a]">{isLoading ? '—' : stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Entries Today</p>
              <p className="text-2xl font-bold text-[#10b981]">{isLoading ? '—' : stats.entries}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Exits Today</p>
              <p className="text-2xl font-bold text-[#ef4444]">{isLoading ? '—' : stats.exits}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Active Gates</p>
              <p className="text-2xl font-bold text-[#0f172a]">{isLoading ? '—' : stats.activeGates}</p>
            </div>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                  <input
                    type="text"
                    placeholder="Search by person, NFC tag, or gate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
              </div>

              {/* Direction Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDirectionFilter(!showDirectionFilter);
                    setShowTypeFilter(false);
                    setShowGateFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Direction: {selectedDirection}</span>
                </button>
                {showDirectionFilter && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {directions.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => {
                          setSelectedDirection(dir);
                          setShowDirectionFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedDirection === dir
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowTypeFilter(!showTypeFilter);
                    setShowDirectionFilter(false);
                    setShowGateFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Type: {selectedType}</span>
                </button>
                {showTypeFilter && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {personTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedType(type);
                          setShowTypeFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedType === type
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Gate Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGateFilter(!showGateFilter);
                    setShowTypeFilter(false);
                    setShowDirectionFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Gate: {selectedGate}</span>
                </button>
                {showGateFilter && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {gateOptions.map((gate) => (
                      <button
                        key={gate}
                        onClick={() => {
                          setSelectedGate(gate);
                          setShowGateFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedGate === gate
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {gate}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-[#64748b]">
            {isLoading
              ? 'Loading events…'
              : `Showing ${filteredEvents.length} of ${events?.length ?? 0} events`}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Timestamp</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Person</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Direction</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Gate</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">NFC Tag ID</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <p className="text-[#64748b]">Loading events…</p>
                      </td>
                    </tr>
                  ) : filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => (
                      <tr key={event.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors">
                        <td className="px-6 py-4 text-sm text-[#0f172a]">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatTime(event.event_timestamp)}</span>
                            <span className="text-xs text-[#64748b]">{formatDate(event.event_timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-[#0f172a]">
                          <div className="flex flex-col">
                            <span>{event.person_name}</span>
                            {event.is_manual_override && (
                              <span className="text-xs text-amber-600 font-normal">Override</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">
                          <span className="inline-block px-3 py-1 bg-[#f1f5f9] text-[#0f172a] rounded-full text-xs font-medium">
                            {event.person_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                              event.direction === 'IN'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            )}
                          >
                            {event.direction === 'IN' ? (
                              <ArrowDownCircle className="w-3 h-3" />
                            ) : (
                              <ArrowUpCircle className="w-3 h-3" />
                            )}
                            {event.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">{event.gate_name}</td>
                        <td className="px-6 py-4 text-sm font-mono text-[#0f172a]">
                          {event.nfc_tag_id ?? '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Activity className="w-12 h-12 text-[#cbd5e1] mb-3" />
                          <p className="text-[#64748b] font-medium">No events found</p>
                          <p className="text-[#94a3b8] text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AccessEvents() {
  return <AccessEventsContent />;
}
