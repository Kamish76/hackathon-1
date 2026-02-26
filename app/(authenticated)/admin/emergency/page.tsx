'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  Clock, Users, PhoneCall, Siren,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminSidebar from '@/components/AdminSidebar';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmergencySession {
  id: string;
  triggered_by: string;
  triggered_at: string;
  resolved_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface RollCallEntry {
  id: string;
  person_id: string;
  status: 'UNKNOWN' | 'ACCOUNTED' | 'MISSING';
  last_seen_gate_id: string | null;
  last_updated_at: string;
  person_registry: {
    full_name: string;
    person_type: string;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
  gates?: {
    gate_name: string;
  } | null;
}

type PersonTypeFilter = 'All' | 'Student' | 'Staff' | 'Visitor' | 'Special Guest';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(from: string) {
  const diff = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function statusBg(status: RollCallEntry['status']) {
  if (status === 'ACCOUNTED') return 'bg-[#dcfce7] text-[#16a34a]';
  if (status === 'MISSING') return 'bg-[#fef2f2] text-[#dc2626]';
  return 'bg-[#f1f5f9] text-[#64748b]';
}

function StatusIcon({ status }: { status: RollCallEntry['status'] }) {
  if (status === 'ACCOUNTED') return <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />;
  if (status === 'MISSING') return <XCircle className="w-4 h-4 text-[#dc2626]" />;
  return <HelpCircle className="w-4 h-4 text-[#94a3b8]" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmergencyPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<EmergencySession | null>(null);
  const [rollCall, setRollCall] = useState<RollCallEntry[]>([]);
  const [filter, setFilter] = useState<PersonTypeFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [confirmDeclare, setConfirmDeclare] = useState(false);
  const [notes, setNotes] = useState('');
  const [pastSessions, setPastSessions] = useState<EmergencySession[]>([]);

  // ── Fetch active session ──────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from('emergency_sessions')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    setSession(data ?? null);
    setLoading(false);
  }, [supabase]);

  const fetchPastSessions = useCallback(async () => {
    const { data } = await supabase
      .from('emergency_sessions')
      .select('*')
      .eq('is_active', false)
      .order('triggered_at', { ascending: false })
      .limit(10);
    setPastSessions(data ?? []);
  }, [supabase]);

  // ── Fetch roll call for active session ───────────────────────────────────
  const fetchRollCall = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('emergency_roll_call')
      .select(`
        id, person_id, status, last_seen_gate_id, last_updated_at,
        person_registry ( full_name, person_type, emergency_contact_name, emergency_contact_phone ),
        gates ( gate_name )
      `)
      .eq('session_id', sessionId)
      .order('status')
      .order('person_registry(full_name)');
    setRollCall((data as unknown as RollCallEntry[]) ?? []);
  }, [supabase]);

  // ── Declare emergency ────────────────────────────────────────────────────
  async function declareEmergency() {
    if (!user) return;
    setDeclaring(true);

    // 1. Create session
    const { data: sess, error: sessErr } = await supabase
      .from('emergency_sessions')
      .insert({ triggered_by: user.id, notes: notes || null })
      .select()
      .single();

    if (sessErr || !sess) {
      alert('Failed to declare emergency: ' + (sessErr?.message ?? 'unknown error'));
      setDeclaring(false);
      return;
    }

    // 2. Snapshot who is currently inside from current_population_inside view
    //    joined to person_registry
    const { data: insideRows } = await supabase
      .from('current_population_inside')
      .select('person_id');

    const insidePersonIds: string[] = (insideRows ?? []).map((r: { person_id: string }) => r.person_id);

    if (insidePersonIds.length > 0) {
      // 3. Get last gate for each person (for context)
      const { data: lastEvents } = await supabase
        .from('access_events')
        .select('person_id, gate_id, event_timestamp')
        .in('person_id', insidePersonIds)
        .order('event_timestamp', { ascending: false });

      // Build map: person_id → gate_id of most recent event
      const gateMap = new Map<string, string>();
      for (const ev of lastEvents ?? []) {
        if (!gateMap.has(ev.person_id)) gateMap.set(ev.person_id, ev.gate_id);
      }

      const rollCallRows = insidePersonIds.map((pid) => ({
        session_id: sess.id,
        person_id: pid,
        status: 'UNKNOWN' as const,
        last_seen_gate_id: gateMap.get(pid) ?? null,
        last_updated_by: user.id,
        last_updated_at: new Date().toISOString(),
      }));

      await supabase.from('emergency_roll_call').insert(rollCallRows);
    }

    setSession(sess);
    setConfirmDeclare(false);
    setNotes('');
    setDeclaring(false);
  }

  // ── Resolve emergency ────────────────────────────────────────────────────
  async function resolveEmergency() {
    if (!session) return;
    setResolving(true);
    await supabase
      .from('emergency_sessions')
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq('id', session.id);
    setSession(null);
    setRollCall([]);
    setResolving(false);
    fetchPastSessions();
  }

  // ── Update status ────────────────────────────────────────────────────────
  async function updateStatus(entryId: string, newStatus: RollCallEntry['status']) {
    if (!user) return;
    await supabase
      .from('emergency_roll_call')
      .update({
        status: newStatus,
        last_updated_by: user.id,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);
    // Optimistic update
    setRollCall((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: newStatus } : e))
    );
  }

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      await fetchSession();
      await fetchPastSessions();
    }
    init();
  }, [fetchSession, fetchPastSessions]);

  // ── Load roll call when session changes ──────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;
    const id = session.id;
    async function load() {
      await fetchRollCall(id);
    }
    load();
  }, [session?.id, fetchRollCall]);

  // ── Elapsed time ticker ──────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsedTime(elapsed(session.triggered_at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`emergency-${session.id}`)
      // New scan events → re-fetch roll call (someone may have scanned OUT)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_events' },
        () => fetchRollCall(session.id)
      )
      // Roll call status changes → re-fetch
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_roll_call',
          filter: `session_id=eq.${session.id}`,
        },
        () => fetchRollCall(session.id)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.id, fetchRollCall, supabase]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const total = rollCall.length;
  const accounted = rollCall.filter((e) => e.status === 'ACCOUNTED').length;
  const missing = rollCall.filter((e) => e.status === 'MISSING').length;
  const unknown = rollCall.filter((e) => e.status === 'UNKNOWN').length;

  const personTypes: PersonTypeFilter[] = ['All', 'Student', 'Staff', 'Visitor', 'Special Guest'];

  const filtered = rollCall.filter((e) => {
    const typeMatch = filter === 'All' || e.person_registry.person_type === filter;
    const q = searchQuery.toLowerCase();
    const nameMatch = !q || e.person_registry.full_name.toLowerCase().includes(q);
    return typeMatch && nameMatch;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <AdminSidebar activePage="emergency" />

      <main className="flex-1 overflow-auto">

        {/* ── Active emergency banner ── */}
        {session && (
          <div className="bg-[#dc2626] text-white px-6 py-3 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Siren className="w-5 h-5 animate-pulse" />
              <span className="font-semibold">EMERGENCY ACTIVE</span>
              <span className="text-red-200 text-sm">·</span>
              <div className="flex items-center gap-1 text-red-100 text-sm">
                <Clock className="w-4 h-4" />
                {elapsedTime}
              </div>
            </div>
            <button
              onClick={resolveEmergency}
              disabled={resolving}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-[#dc2626] text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
            >
              {resolving ? 'Resolving…' : 'Resolve Emergency'}
            </button>
          </div>
        )}

        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-1">Emergency Mode</h2>
            <p className="text-[#64748b]">
              Declare an emergency to snapshot who is currently inside and conduct a real-time roll call.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-[#94a3b8]">Loading…</div>
          ) : session ? (
            <>
              {/* ── Summary strip ── */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Inside',   value: total,     bg: 'bg-white',       text: 'text-[#0f172a]', icon: <Users className="w-5 h-5 text-[#64748b]" /> },
                  { label: 'Accounted For',  value: accounted, bg: 'bg-[#dcfce7]',  text: 'text-[#16a34a]', icon: <CheckCircle2 className="w-5 h-5 text-[#16a34a]" /> },
                  { label: 'Missing',        value: missing,   bg: 'bg-[#fef2f2]',  text: 'text-[#dc2626]', icon: <XCircle className="w-5 h-5 text-[#dc2626]" /> },
                  { label: 'Unknown',        value: unknown,   bg: 'bg-[#f1f5f9]',  text: 'text-[#64748b]', icon: <HelpCircle className="w-5 h-5 text-[#94a3b8]" /> },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl border border-[#e2e8f0] p-5 shadow-sm flex items-center gap-4`}>
                    {s.icon}
                    <div>
                      <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                      <p className="text-xs text-[#64748b]">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Progress bar ── */}
              {total > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-[#64748b] mb-1">
                    <span>{accounted} of {total} accounted for</span>
                    <span>{Math.round((accounted / total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#16a34a] rounded-full transition-all"
                      style={{ width: `${(accounted / total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── Filters ── */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {personTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filter === t
                        ? 'bg-[#1e293b] text-white'
                        : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Search name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ml-auto border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] bg-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>

              {/* ── Roll call list ── */}
              {total === 0 ? (
                <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center text-[#94a3b8]">
                  No one was detected inside when the emergency was declared.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-sm">
                  <div className="divide-y divide-[#e2e8f0]">
                    {filtered.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#f8f9fa] transition-colors">
                        {/* Status icon */}
                        <StatusIcon status={entry.status} />

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0f172a] truncate">
                            {entry.person_registry.full_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-[#64748b]">{entry.person_registry.person_type}</span>
                            {entry.gates?.gate_name && (
                              <>
                                <span className="text-[#cbd5e1]">·</span>
                                <span className="text-xs text-[#64748b]">Last seen: {entry.gates.gate_name}</span>
                              </>
                            )}
                            {entry.person_registry.emergency_contact_name && (
                              <>
                                <span className="text-[#cbd5e1]">·</span>
                                <span className="flex items-center gap-1 text-xs text-[#64748b]">
                                  <PhoneCall className="w-3 h-3" />
                                  {entry.person_registry.emergency_contact_name}
                                  {entry.person_registry.emergency_contact_phone && ` — ${entry.person_registry.emergency_contact_phone}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBg(entry.status)}`}>
                          {entry.status}
                        </span>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {entry.status !== 'ACCOUNTED' && (
                            <button
                              onClick={() => updateStatus(entry.id, 'ACCOUNTED')}
                              className="px-3 py-1.5 rounded-lg bg-[#dcfce7] text-[#16a34a] text-xs font-medium hover:bg-[#bbf7d0] transition-colors"
                            >
                              ✓ Accounted
                            </button>
                          )}
                          {entry.status !== 'MISSING' && (
                            <button
                              onClick={() => updateStatus(entry.id, 'MISSING')}
                              className="px-3 py-1.5 rounded-lg bg-[#fef2f2] text-[#dc2626] text-xs font-medium hover:bg-[#fecaca] transition-colors"
                            >
                              ✗ Missing
                            </button>
                          )}
                          {entry.status !== 'UNKNOWN' && (
                            <button
                              onClick={() => updateStatus(entry.id, 'UNKNOWN')}
                              className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[#64748b] text-xs font-medium hover:bg-[#e2e8f0] transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Idle state ── */}
              {!confirmDeclare ? (
                <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center shadow-sm max-w-2xl mx-auto">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[#fef2f2] mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-[#dc2626]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0f172a] mb-2">No Active Emergency</h3>
                  <p className="text-[#64748b] mb-8 text-sm leading-relaxed">
                    When an emergency is declared, the system snapshots everyone currently inside and creates
                    an interactive roll call for real-time tracking.
                  </p>
                  <button
                    onClick={() => setConfirmDeclare(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#dc2626] text-white text-sm font-semibold hover:bg-[#b91c1c] transition-colors shadow-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Declare Emergency
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border-2 border-[#dc2626] p-8 max-w-xl mx-auto shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-[#dc2626]" />
                    <h3 className="text-lg font-bold text-[#0f172a]">Confirm Emergency Declaration</h3>
                  </div>
                  <p className="text-[#64748b] text-sm mb-5">
                    This will snapshot everyone currently inside and notify officers. Only do this in a genuine emergency.
                  </p>
                  <textarea
                    placeholder="Optional notes (e.g. fire alarm, evacuation, lockdown)…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#dc2626] mb-5 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={declareEmergency}
                      disabled={declaring}
                      className="flex-1 py-2.5 rounded-lg bg-[#dc2626] text-white text-sm font-semibold hover:bg-[#b91c1c] transition-colors disabled:opacity-60"
                    >
                      {declaring ? 'Declaring…' : '🚨 Confirm — Declare Emergency'}
                    </button>
                    <button
                      onClick={() => { setConfirmDeclare(false); setNotes(''); }}
                      className="px-5 py-2.5 rounded-lg border border-[#e2e8f0] text-[#64748b] text-sm hover:bg-[#f1f5f9] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Past sessions ── */}
              {pastSessions.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-[#0f172a] mb-4">Past Sessions</h3>
                  <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-sm">
                    <div className="divide-y divide-[#e2e8f0]">
                      {pastSessions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-4 text-sm">
                          <div>
                            <p className="font-medium text-[#0f172a]">
                              {new Date(s.triggered_at).toLocaleString()}
                            </p>
                            {s.notes && <p className="text-[#64748b] text-xs mt-0.5">{s.notes}</p>}
                          </div>
                          <div className="text-right">
                            {s.resolved_at ? (
                              <span className="text-xs text-[#16a34a] font-medium">Resolved</span>
                            ) : (
                              <span className="text-xs text-[#f59e0b] font-medium">Unresolved</span>
                            )}
                            {s.resolved_at && (
                              <p className="text-xs text-[#94a3b8] mt-0.5">
                                {elapsed(s.triggered_at)} duration
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
