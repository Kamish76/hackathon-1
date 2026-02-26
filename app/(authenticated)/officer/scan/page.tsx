'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  ScanLine, Wifi, CheckCircle2, Clock, QrCode, User, AlertCircle,
  ArrowDownCircle, ArrowUpCircle, ShieldAlert,
} from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficerGate } from '@/hooks/useOfficerGate';

const QRScannerCamera = dynamic(() => import('@/components/QRScannerCamera'), { ssr: false });

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error';

interface ScanEntry {
  id: string;
  name: string;
  type: string;
  direction: 'IN' | 'OUT';
  gate: string;
  time: string;
  status: 'granted' | 'denied';
}

interface LastResult {
  name: string;
  type: string;
  refId: string;
  direction: 'IN' | 'OUT';
}

interface OverridePending {
  personName: string;
  personType: string;
  refId: string;
  direction: 'IN' | 'OUT';
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  return `${mins} min ago`;
}

export default function ScanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'qr' | 'nfc'>('qr');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [overridePending, setOverridePending] = useState<OverridePending | null>(null);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const { gates, selectedGate, setSelectedGate } = useOfficerGate();
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gateIdRef = useRef<string | null>(null);
  const directionRef = useRef<'IN' | 'OUT'>('IN');

  // Keep refs in sync
  useEffect(() => {
    gateIdRef.current = selectedGate?.id ?? null;
  }, [selectedGate?.id]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Reload today's scans for this gate whenever gate or user changes
  useEffect(() => {
    if (!user?.id || !selectedGate?.id) { setRecentScans([]); return; }
    const supabase = createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    supabase
      .from('access_events')
      .select('id, direction, event_timestamp, person_registry!inner(full_name, person_type)')
      .eq('operator_user_id', user.id)
      .eq('gate_id', selectedGate.id)
      .gte('event_timestamp', todayStart.toISOString())
      .order('event_timestamp', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data) return;
        setRecentScans(
          data.map((e) => {
            const pr = e.person_registry as { full_name: string; person_type: string };
            return {
              id: e.id,
              name: pr.full_name,
              type: pr.person_type,
              direction: e.direction as 'IN',
              gate: selectedGate.gate_name,
              time: timeAgo(new Date(e.event_timestamp)),
              status: 'granted' as const,
            };
          })
        );
      });
  }, [user?.id, selectedGate?.id]);

  const resetToScanning = useCallback(() => {
    processingRef.current = false;
    setScanStatus('scanning');
    setLastResult(null);
    setErrorMsg('');
    setOverridePending(null);
  }, []);

  const handleDecode = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanStatus('idle'); // pause camera re-decode while processing

    // Capture direction at call time so it's stable inside the async chain
    const currentDirection = directionRef.current;

    const PREFIX = 'REFERENCE_ID:';
    if (!text.startsWith(PREFIX)) {
      setErrorMsg('Invalid QR code — not a system credential.');
      setScanStatus('error');
      timerRef.current = setTimeout(resetToScanning, 2000);
      return;
    }

    const refId = text.slice(PREFIX.length).trim();

    // QR encodes person_registry.id — query it directly
    const supabase = createClient();
    const { data: person, error } = await supabase
      .from('person_registry')
      .select('full_name, person_type')
      .eq('id', refId)
      .single();

    if (error || !person) {
      setErrorMsg('Person not found in the registry.');
      setScanStatus('error');
      timerRef.current = setTimeout(resetToScanning, 2500);
      return;
    }

    // Insert access_event into DB
    let newEventId = crypto.randomUUID();
    if (gateIdRef.current) {
      const supabaseInsert = createClient();
      const { data: inserted, error: insertError } = await supabaseInsert
        .from('access_events')
        .insert({
          person_id: refId,
          gate_id: gateIdRef.current,
          direction: currentDirection,
          verification_method: 'QR',
          entry_mode: 'WALK',
          operator_user_id: user?.id ?? null,
        })
        .select('id')
        .single();
      if (insertError) {
        const errLower = insertError.message?.toLowerCase() ?? '';
        const isPassback = errLower.includes('anti-passback');
        if (isPassback) {
          // Don't auto-dismiss — show override confirmation instead
          if (timerRef.current) clearTimeout(timerRef.current);
          setOverridePending({ personName: person.full_name, personType: person.person_type, refId, direction: currentDirection });
          const msg = currentDirection === 'IN'
            ? `${person.full_name} is already recorded as INSIDE — they haven't exited yet.`
            : `${person.full_name} is already recorded as OUTSIDE — they haven't entered yet.`;
          setErrorMsg(msg);
        } else {
          setErrorMsg('Failed to record event. Please try again.');
          timerRef.current = setTimeout(resetToScanning, 4000);
        }
        setScanStatus('error');
        return;
      }
      if (inserted?.id) newEventId = inserted.id;
    }

    const result: LastResult = { name: person.full_name, type: person.person_type, refId, direction: currentDirection };
    setLastResult(result);
    setOverridePending(null);
    setRecentScans((prev) => [
      {
        id: newEventId,
        name: person.full_name,
        type: person.person_type,
        direction: currentDirection,
        gate: selectedGate?.gate_name ?? 'Unknown Gate',
        time: timeAgo(new Date()),
        status: 'granted',
      },
      ...prev,
    ]);
    setScanStatus('success');
    timerRef.current = setTimeout(resetToScanning, 3000);
  }, [resetToScanning, user?.id, selectedGate]);

  const handleOverride = useCallback(async () => {
    if (!overridePending || !gateIdRef.current) return;
    const { personName, personType, refId, direction: overrideDir } = overridePending;
    setOverridePending(null);
    setScanStatus('idle');

    const supabase = createClient();
    const { data: inserted, error } = await supabase
      .from('access_events')
      .insert({
        person_id: refId,
        gate_id: gateIdRef.current,
        direction: overrideDir,
        verification_method: 'QR',
        entry_mode: 'WALK',
        operator_user_id: user?.id ?? null,
        is_manual_override: true,
        override_reason: `Missed scan correction — officer override (recorded ${overrideDir} despite no matching prior ${overrideDir === 'IN' ? 'OUT' : 'IN'})`,
      })
      .select('id')
      .single();

    if (error) {
      setErrorMsg('Override failed. Please try again.');
      setScanStatus('error');
      timerRef.current = setTimeout(resetToScanning, 3000);
      return;
    }

    const newEventId = inserted?.id ?? crypto.randomUUID();
    setLastResult({ name: personName, type: personType, refId, direction: overrideDir });
    setRecentScans((prev) => [
      {
        id: newEventId,
        name: personName,
        type: personType,
        direction: overrideDir,
        gate: selectedGate?.gate_name ?? 'Unknown Gate',
        time: timeAgo(new Date()),
        status: 'granted',
      },
      ...prev,
    ]);
    setScanStatus('success');
    timerRef.current = setTimeout(resetToScanning, 3000);
  }, [overridePending, resetToScanning, user?.id, selectedGate]);

  const toggleScanning = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (scanStatus === 'scanning') {
      processingRef.current = false;
      setScanStatus('idle');
    } else {
      processingRef.current = false;
      setScanStatus('scanning');
    }
  };

  const switchTab = (tab: 'qr' | 'nfc') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    processingRef.current = false;
    setScanStatus('idle');
    setLastResult(null);
    setErrorMsg('');
    setOverridePending(null);
    setActiveTab(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <OfficerSidebar activePage="scan" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Scan / Check-in</h2>
            <p className="text-[#64748b]">Scan QR codes or NFC tags to record entry and exit events at your checkpoint.</p>
          </div>

          {/* Gate Selector */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide shrink-0">Your Gate:</span>
              {gates.length === 0 ? (
                <span className="text-xs text-[#94a3b8]">Loading gates…</span>
              ) : (
                gates.map((gate) => (
                  <button
                    key={gate.id}
                    onClick={() => setSelectedGate(selectedGate?.id === gate.id ? null : gate)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedGate?.id === gate.id
                        ? 'bg-[#1e293b] text-white'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#1e293b]'
                    }`}
                  >
                    {gate.gate_name}
                    <span className="ml-1.5 text-xs opacity-60">{gate.gate_code}</span>
                  </button>
                ))
              )}
              {selectedGate && (
                <span className="ml-auto text-xs text-[#16a34a] font-medium bg-[#dcfce7] px-2 py-0.5 rounded-full">
                  ✓ Assigned
                </span>
              )}
              {!selectedGate && gates.length > 0 && (
                <span className="ml-auto text-xs text-[#f59e0b] font-medium bg-[#fef3c7] px-2 py-0.5 rounded-full">
                  Select a gate to enable scanning
                </span>
              )}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => switchTab('qr')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'qr'
                  ? 'bg-[#1e293b] text-white'
                  : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              QR Code
            </button>
            <button
              onClick={() => switchTab('nfc')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'nfc'
                  ? 'bg-[#1e293b] text-white'
                  : 'bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
              }`}
            >
              <Wifi className="w-4 h-4" />
              NFC Tag
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Scanner Panel */}
            {activeTab === 'qr' ? (
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col gap-4">
                <p className="text-sm font-semibold text-[#0f172a]">QR Code Scanner</p>

                {/* Direction toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDirection('IN')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      direction === 'IN'
                        ? 'bg-[#dcfce7] text-[#16a34a] ring-2 ring-[#16a34a]/30'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    IN
                  </button>
                  <button
                    onClick={() => setDirection('OUT')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      direction === 'OUT'
                        ? 'bg-[#fee2e2] text-[#ef4444] ring-2 ring-[#ef4444]/30'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    OUT
                  </button>
                </div>

                {/* Success card */}
                {scanStatus === 'success' && lastResult && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                      lastResult.direction === 'IN' ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'
                    }`}>
                      <CheckCircle2 className={`w-7 h-7 ${lastResult.direction === 'IN' ? 'text-[#16a34a]' : 'text-[#ef4444]'}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-[#0f172a]">{lastResult.name}</p>
                      <p className="text-sm text-[#64748b]">{lastResult.type}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      lastResult.direction === 'IN' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#ef4444]'
                    }`}>
                      ✓ Logged {lastResult.direction}
                    </span>
                    <p className="text-xs text-[#94a3b8]">Resuming scanner…</p>
                  </div>
                )}

                {/* Error card */}
                {scanStatus === 'error' && !overridePending && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-[#fee2e2] flex items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-[#ef4444]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-[#0f172a] mb-1">Scan Failed</p>
                      <p className="text-sm text-[#64748b] leading-relaxed max-w-xs">{errorMsg}</p>
                    </div>
                    <p className="text-xs text-[#94a3b8]">Resuming scanner…</p>
                  </div>
                )}

                {/* Override confirmation card */}
                {scanStatus === 'error' && overridePending && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-[#fef3c7] flex items-center justify-center">
                      <ShieldAlert className="w-7 h-7 text-[#f59e0b]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-[#0f172a] mb-1">Missed Scan Detected</p>
                      <p className="text-sm text-[#64748b] leading-relaxed max-w-xs">{errorMsg}</p>
                      <p className="text-xs text-[#94a3b8] mt-1">
                        {overridePending.direction === 'IN'
                          ? 'They may have left without scanning OUT.'
                          : 'They may have entered without scanning IN.'}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-[#f59e0b] bg-[#fef3c7] px-2 py-0.5 rounded-full">
                      Override required
                    </p>
                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={resetToScanning}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleOverride}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#f59e0b] text-white hover:bg-[#d97706] transition-colors"
                      >
                        Override &amp; Log {overridePending.direction}
                      </button>
                    </div>
                  </div>
                )}

                {/* Camera viewfinder */}
                {(scanStatus === 'idle' || scanStatus === 'scanning') && (
                  <QRScannerCamera
                    active={scanStatus === 'scanning'}
                    onDecode={handleDecode}
                    onError={(err) => {
                      setErrorMsg(err);
                      setScanStatus('error');
                      timerRef.current = setTimeout(resetToScanning, 3000);
                    }}
                  />
                )}

                {/* Start / Stop button */}
                {(scanStatus === 'idle' || scanStatus === 'scanning') && (
                  <button
                    onClick={toggleScanning}
                    disabled={!selectedGate}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      !selectedGate
                        ? 'bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed'
                        : scanStatus === 'scanning'
                        ? 'bg-[#fee2e2] text-[#ef4444] hover:bg-[#fecaca]'
                        : 'bg-[#1e293b] text-white hover:bg-[#0f172a]'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    {!selectedGate ? 'Select a gate first' : scanStatus === 'scanning' ? 'Stop Scanner' : 'Start Scanner'}
                  </button>
                )}

                <a
                  href="/officer/test-qr"
                  className="text-xs text-[#94a3b8] hover:text-[#64748b] underline underline-offset-2 text-center transition-colors"
                >
                  Generate a test QR →
                </a>
              </div>
            ) : (
              /* NFC Tab */
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm flex flex-col items-center justify-center gap-4 min-h-65">
                <div className="w-20 h-20 rounded-full bg-[#dbeafe] flex items-center justify-center">
                  <ScanLine className="w-10 h-10 text-[#2563eb]" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-[#0f172a] mb-1">NFC Tag Scanner</p>
                  <p className="text-sm text-[#64748b]">Tap an NFC-enabled card or device to the reader.</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#64748b] bg-[#f1f5f9] px-3 py-1.5 rounded-full">
                  <Wifi className="w-4 h-4" />
                  Waiting for tag…
                </div>
                <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">Coming soon</span>
              </div>
            )}

            {/* Stats */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                  <ArrowDownCircle className="w-5 h-5 text-[#16a34a]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                  {recentScans.filter(s => s.direction === 'IN' && s.status === 'granted').length}
                </h3>
                <p className="text-sm text-[#64748b]">IN This Session</p>
              </div>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#fee2e2] flex items-center justify-center mb-3">
                  <ArrowUpCircle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                  {recentScans.filter(s => s.direction === 'OUT' && s.status === 'granted').length}
                </h3>
                <p className="text-sm text-[#64748b]">OUT This Session</p>
              </div>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#fef3c7] flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                  {recentScans.length > 0 ? recentScans[0].time : '—'}
                </h3>
                <p className="text-sm text-[#64748b]">Last Scan</p>
              </div>
            </div>
          </div>

          {/* Recent Scans */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#0f172a]">Recent Scans</h3>
              <a
                href="/officer/attendance"
                className="text-xs text-[#64748b] hover:text-[#1e293b] underline underline-offset-2 transition-colors"
              >
                View Tracker Log →
              </a>
            </div>
            {recentScans.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-[#94a3b8]">
                <User className="w-8 h-8" />
                <p className="text-sm">No scans yet this session.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-[#f8f9fa] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${scan.status === 'granted' ? 'bg-[#16a34a]' : 'bg-[#ef4444]'}`} />
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">{scan.name}</p>
                        <p className="text-xs text-[#64748b]">{scan.type} • {scan.gate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        scan.direction === 'IN'
                          ? 'bg-[#dcfce7] text-[#16a34a]'
                          : 'bg-[#fee2e2] text-[#ef4444]'
                      }`}>
                        {scan.direction}
                      </span>
                      <p className="text-xs text-[#64748b] w-16 text-right">{scan.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
