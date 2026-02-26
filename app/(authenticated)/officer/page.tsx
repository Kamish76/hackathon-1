'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScanLine, ClipboardCheck, Users, Activity, UserCheck, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';
import { useOfficerGate } from '@/hooks/useOfficerGate';

const quickActions = [
  {
    icon: <ScanLine className="w-6 h-6 text-[#2563eb]" />,
    bg: 'bg-[#dbeafe]',
    title: 'Scan / Check-in',
    description: 'Scan NFC tags or QR codes to record entry and exit events.',
    href: '/officer/scan',
    status: 'Ready',
  },
  {
    icon: <ClipboardCheck className="w-6 h-6 text-[#7c3aed]" />,
    bg: 'bg-[#ddd6fe]',
    title: 'Tracker Log',
    description: 'View and verify attendance records for your assigned checkpoint.',
    status: 'Coming soon',
  },
  {
    icon: <Users className="w-6 h-6 text-[#f59e0b]" />,
    bg: 'bg-[#fef3c7]',
    title: 'People Lookup',
    description: 'Search registered people to manually verify identity.',
    status: 'Coming soon',
  },
  {
    icon: <Activity className="w-6 h-6 text-[#16a34a]" />,
    bg: 'bg-[#dcfce7]',
    title: 'Live Feed',
    description: 'Monitor real-time access events at your gate.',
    status: 'Coming soon',
  },
];

interface Stats {
  todayIn: number | null;
  currentInside: number | null;
  lastScanName: string | null;
  lastScanTime: string | null;
}

function getStartOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OfficerPage() {
  const { user } = useAuth();
  const { selectedGate } = useOfficerGate();
  const supabase = createClient();

  const [stats, setStats] = useState<Stats>({
    todayIn: null,
    currentInside: null,
    lastScanName: null,
    lastScanTime: null,
  });
  const [loading, setLoading] = useState(true);

  // Emergency state
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencySessionId, setEmergencySessionId] = useState<string | null>(null);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const [declaringEmergency, setDeclaringEmergency] = useState(false);

  useEffect(() => {
    async function checkEmergency() {
      const { data } = await supabase
        .from('emergency_sessions')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      setEmergencyActive(!!data);
      setEmergencySessionId(data?.id ?? null);
    }
    checkEmergency();
    const interval = setInterval(checkEmergency, 15_000);
    return () => clearInterval(interval);
  }, []);

  async function handleDeclareEmergency() {
    if (!user || declaringEmergency) return;
    setDeclaringEmergency(true);
    const { data: sess } = await supabase
      .from('emergency_sessions')
      .insert({ triggered_by: user.id })
      .select('id')
      .single();
    if (sess) {
      // Snapshot current_population_inside → emergency_roll_call
      const { data: insideRows } = await supabase
        .from('current_population_inside')
        .select('person_id');
      const ids = (insideRows ?? []).map((r: { person_id: string }) => r.person_id);
      if (ids.length > 0) {
        const { data: lastEvents } = await supabase
          .from('access_events')
          .select('person_id, gate_id, event_timestamp')
          .in('person_id', ids)
          .order('event_timestamp', { ascending: false });
        const gateMap = new Map<string, string>();
        for (const ev of lastEvents ?? []) {
          if (!gateMap.has(ev.person_id)) gateMap.set(ev.person_id, ev.gate_id);
        }
        await supabase.from('emergency_roll_call').insert(
          ids.map((pid: string) => ({
            session_id: sess.id,
            person_id: pid,
            status: 'UNKNOWN',
            last_seen_gate_id: gateMap.get(pid) ?? null,
            last_updated_by: user.id,
            last_updated_at: new Date().toISOString(),
          }))
        );
      }
      setEmergencyActive(true);
      setEmergencySessionId(sess.id);
    }
    setConfirmEmergency(false);
    setDeclaringEmergency(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);

      const startOfDay = getStartOfDayIso();

      // 1. Today's IN count — filtered by gate if one is selected
      const todayInQuery = supabase
        .from('access_events')
        .select('*', { count: 'exact', head: true })
        .eq('direction', 'IN')
        .gte('event_timestamp', startOfDay);
      if (selectedGate) todayInQuery.eq('gate_id', selectedGate.id);
      const { count: todayIn } = await todayInQuery;

      // 2. Current population inside (school-wide)
      const { count: currentInside } = await supabase
        .from('current_population_inside')
        .select('*', { count: 'exact', head: true });

      // 3. Most recent scan — filtered by gate if one is selected
      const lastScanQuery = supabase
        .from('access_events')
        .select('event_timestamp, person_registry!inner(full_name)')
        .order('event_timestamp', { ascending: false })
        .limit(1);
      if (selectedGate) lastScanQuery.eq('gate_id', selectedGate.id);
      const { data: lastScanRows } = await lastScanQuery;

      if (cancelled) return;

      const lastRow = lastScanRows?.[0] as
        | { event_timestamp: string; person_registry: { full_name: string } | null }
        | undefined;

      setStats({
        todayIn: todayIn ?? 0,
        currentInside: currentInside ?? 0,
        lastScanName: lastRow?.person_registry?.full_name ?? null,
        lastScanTime: lastRow ? formatTime(lastRow.event_timestamp) : null,
      });
      setLoading(false);
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [selectedGate?.id]);

  const statCards = [
    {
      bg: 'bg-[#dbeafe]',
      icon: <UserCheck className="w-6 h-6 text-[#2563eb]" />,
      value: loading ? '…' : (stats.todayIn ?? 0).toString(),
      label: selectedGate
        ? `Checked In Today (${selectedGate.gate_code})`
        : 'Checked In Today (All Gates)',
    },
    {
      bg: 'bg-[#dcfce7]',
      icon: <Activity className="w-6 h-6 text-[#16a34a]" />,
      value: loading ? '…' : (stats.currentInside ?? 0).toString(),
      label: 'Current Population Inside',
    },
    {
      bg: 'bg-[#fef3c7]',
      icon: <Clock className="w-6 h-6 text-[#f59e0b]" />,
      value: loading ? '…' : (stats.lastScanTime ?? '—'),
      label: stats.lastScanName
        ? `Last Scan — ${stats.lastScanName}`
        : selectedGate
          ? `Last Scan at ${selectedGate.gate_code}`
          : 'Last Scan',
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <OfficerSidebar activePage="home" />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
        {/* Emergency banner / trigger */}
          {emergencyActive ? (
            <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">
              <AlertTriangle className="w-5 h-5 text-[#dc2626] animate-pulse shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#dc2626]">Emergency Active</p>
                <p className="text-xs text-[#b91c1c]">An emergency has been declared. Roll call is in progress.</p>
              </div>
            </div>
          ) : confirmEmergency ? (
            <div className="mb-6 px-5 py-4 rounded-xl bg-[#fef2f2] border-2 border-[#dc2626]">
              <p className="text-sm font-semibold text-[#0f172a] mb-1">Confirm Emergency Declaration</p>
              <p className="text-xs text-[#64748b] mb-3">This will snapshot everyone currently inside and start a roll call. Use only in a genuine emergency.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeclareEmergency}
                  disabled={declaringEmergency}
                  className="px-4 py-2 rounded-lg bg-[#dc2626] text-white text-sm font-semibold hover:bg-[#b91c1c] transition-colors disabled:opacity-60"
                >
                  {declaringEmergency ? 'Declaring…' : '🚨 Confirm Emergency'}
                </button>
                <button
                  onClick={() => setConfirmEmergency(false)}
                  className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#64748b] text-sm hover:bg-[#f1f5f9] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <button
                onClick={() => setConfirmEmergency(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#fecaca] text-[#dc2626] text-sm font-medium hover:bg-[#fef2f2] transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Declare Emergency
              </button>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-[#64748b]">
              You&apos;re logged in as an{' '}
              <span className="font-medium text-[#1e293b]">Attendance Officer</span>. Use the tools below to manage checkpoint access.
            </p>

            {/* Gate badge */}
            {selectedGate ? (
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-[#dbeafe] text-[#2563eb] text-xs font-medium">
                <MapPin className="w-3.5 h-3.5" />
                Assigned: {selectedGate.gate_name}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-[#fef3c7] text-[#f59e0b] text-xs font-medium">
                <MapPin className="w-3.5 h-3.5" />
                No gate selected — go to Scan to assign your gate
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center mb-4`}>
                  {card.icon}
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{card.value}</h3>
                <p className="text-sm text-[#64748b]">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action) => {
                const content = (
                  <>
                    <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-[#0f172a]">{action.title}</h4>
                        <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full whitespace-nowrap">
                          {action.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b]">{action.description}</p>
                    </div>
                  </>
                );

                if (action.href) {
                  return (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="flex items-start gap-4 p-4 rounded-lg border border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={action.title}
                    className="flex items-start gap-4 p-4 rounded-lg border border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
