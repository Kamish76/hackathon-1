"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OfficerSidebar from "@/components/OfficerSidebar";

type GateOption = {
  id: string;
  gate_code: string;
  gate_name: string;
};

type OfficerScanResult = {
  verdict?: "allowed" | "blocked";
  scan?: {
    status: "first_scan" | "valid" | "skipped_scans" | "clone_detected";
    message: string;
    expected_counter: number;
    received_counter: number;
    scan_count: number;
    uid: string;
  };
  gate?: {
    id: string;
    gate_code: string;
    gate_name: string;
  };
  person?: {
    id: string;
    full_name: string;
    person_type: string;
    member_code: string | null;
    nfc_tag_status: string;
  };
  account?: {
    is_linked: boolean;
    auth_user_id: string | null;
  };
  access_event?: {
    id: string;
    gate_id: string;
    direction: "IN" | "OUT";
    event_timestamp: string;
  };
  error?: string;
};

type NdefRecord = {
  data?: BufferSource;
  recordType?: string;
};

type NdefMessage = {
  records?: NdefRecord[];
};

type NdefReadingEventLike = {
  serialNumber?: string;
  message?: NdefMessage;
};

type NdefReaderLike = {
  scan: () => Promise<void>;
  onreading: ((event: NdefReadingEventLike) => void) | null;
  onreadingerror: ((event: unknown) => void) | null;
};

function decodeRecordPayload(record?: NdefRecord) {
  if (!record?.data) {
    return null;
  }

  let bytes: Uint8Array;
  if (record.data instanceof ArrayBuffer) {
    bytes = new Uint8Array(record.data);
  } else if (ArrayBuffer.isView(record.data)) {
    bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
  } else {
    return null;
  }

  if (bytes.length === 0) {
    return null;
  }

  if (record.recordType === "url") {
    const uriPrefixes = ["", "http://www.", "https://www.", "http://", "https://"];
    const looksLikePrefixCode = bytes[0] <= 0x23;

    if (looksLikePrefixCode) {
      const prefix = uriPrefixes[bytes[0]] ?? "";
      const suffix = new TextDecoder().decode(bytes.slice(1));
      return `${prefix}${suffix}`;
    }
  }

  return new TextDecoder().decode(bytes);
}

export default function OfficerScanPage() {
  const [gates, setGates] = useState<GateOption[]>([]);
  const [gateId, setGateId] = useState("");
  const [gateLoading, setGateLoading] = useState(true);

  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const [manualUid, setManualUid] = useState("");
  const [manualCounter, setManualCounter] = useState("0");
  const [manualMemberCode, setManualMemberCode] = useState("");

  const [lastResult, setLastResult] = useState<OfficerScanResult | null>(null);

  const selectedGate = useMemo(() => gates.find((gate) => gate.id === gateId) ?? null, [gates, gateId]);

  const addLog = useCallback((entry: string, details?: unknown) => {
    const time = new Date().toISOString();
    const suffix = details ? ` | ${typeof details === "string" ? details : JSON.stringify(details)}` : "";
    const line = `${time} | ${entry}${suffix}`;
    setLogs((prev) => [line, ...prev].slice(0, 40));
  }, []);

  const submitScan = useCallback(
    async (params: { uid: string; counter: number; memberCode?: string | null; payload?: string | null }) => {
      if (!gateId) {
        setMessage("Select a gate before scanning.");
        return;
      }

      setIsSubmitting(true);
      setMessage("Verifying scan...");
      addLog("submitScan:start", params);

      const response = await fetch("/api/officer/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: params.uid,
          counter: params.counter,
          member_code: params.memberCode || undefined,
          gate_id: gateId,
        }),
      });

      const result = (await response.json()) as OfficerScanResult;

      if (!response.ok && response.status !== 409) {
        setLastResult(result);
        setMessage(result.error || "Scan verification failed.");
        addLog("submitScan:error", { status: response.status, result });
        setIsSubmitting(false);
        return;
      }

      setLastResult(result);
      setMessage(
        response.status === 409 || result.verdict === "blocked"
          ? "Clone-detected scan logged as BLOCKED."
          : "Scan verified and logged."
      );
      addLog("submitScan:success", { status: response.status, result });
      setIsSubmitting(false);
    },
    [addLog, gateId]
  );

  const startNfcScan = useCallback(async () => {
    if (!gateId) {
      setMessage("Select a gate before scanning.");
      return;
    }

    const ndefCtor = (window as unknown as { NDEFReader?: new () => NdefReaderLike }).NDEFReader;

    if (!ndefCtor) {
      setMessage("Web NFC is not supported on this browser/device.");
      addLog("startNfcScan:unsupported");
      return;
    }

    setIsScanning(true);
    setMessage("Tap an NFC tag now...");
    addLog("startNfcScan:start", { gateId });

    try {
      const ndef = new ndefCtor();
      await ndef.scan();

      ndef.onreading = (event) => {
        const uid = event.serialNumber?.trim();
        const firstRecord = event.message?.records?.[0];
        const payload = decodeRecordPayload(firstRecord);

        let counter = Number.NaN;
        let memberCode: string | null = null;

        if (payload) {
          try {
            const parsed = new URL(payload);
            counter = Number(parsed.searchParams.get("cnt"));
            memberCode = parsed.searchParams.get("code");
          } catch {
            addLog("startNfcScan:payload-not-url", { payload });
          }
        }

        if (!uid) {
          setMessage("No NFC UID detected. Try another tap.");
          addLog("startNfcScan:no-uid", { payload });
          setIsScanning(false);
          return;
        }

        if (!Number.isInteger(counter) || counter < 0) {
          const manual = Number(manualCounter);
          if (!Number.isInteger(manual) || manual < 0) {
            setMessage("Counter not found in payload. Set manual counter and try again.");
            addLog("startNfcScan:missing-counter", { uid, payload, manualCounter });
            setIsScanning(false);
            return;
          }

          counter = manual;
          addLog("startNfcScan:manual-counter-fallback", { uid, counter });
        }

        void submitScan({ uid, counter, memberCode, payload });
        setIsScanning(false);
      };

      ndef.onreadingerror = () => {
        setMessage("NFC read error. Tap again.");
        addLog("startNfcScan:read-error");
        setIsScanning(false);
      };
    } catch {
      setMessage("Unable to start NFC scan. Allow NFC permission and try again.");
      addLog("startNfcScan:scan-start-error");
      setIsScanning(false);
    }
  }, [addLog, gateId, manualCounter, submitScan]);

  const submitManualScan = useCallback(() => {
    const uid = manualUid.trim();
    const counter = Number(manualCounter);

    if (!uid) {
      setMessage("Manual UID is required.");
      return;
    }

    if (!Number.isInteger(counter) || counter < 0) {
      setMessage("Manual counter must be a non-negative integer.");
      return;
    }

    void submitScan({
      uid,
      counter,
      memberCode: manualMemberCode.trim() || null,
      payload: null,
    });
  }, [manualCounter, manualMemberCode, manualUid, submitScan]);

  useEffect(() => {
    const loadGates = async () => {
      setGateLoading(true);
      const response = await fetch("/api/officer/gates", { cache: "no-store" });
      const result = (await response.json()) as { gates?: GateOption[]; error?: string };

      if (!response.ok) {
        setMessage(result.error || "Failed to load gates.");
        setGateLoading(false);
        return;
      }

      const list = result.gates ?? [];
      setGates(list);
      if (list.length > 0) {
        setGateId(list[0].id);
      }
      setGateLoading(false);
    };

    void loadGates();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="scan" />

      <main className="flex-1 overflow-auto">
        <div className="p-8 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Scan / Check-in</h2>
            <p className="text-[#64748b]">Scan a tag to verify anti-clone status, account link, and write access logs.</p>
          </div>

          <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm space-y-4">
            <div>
              <label className="text-xs text-[#64748b] uppercase tracking-wide">Gate</label>
              <select
                value={gateId}
                onChange={(event) => setGateId(event.target.value)}
                disabled={gateLoading || isScanning || isSubmitting}
                className="mt-1 w-full md:w-96 border border-[#e2e8f0] rounded px-3 py-2 text-sm"
              >
                {gates.map((gate) => (
                  <option key={gate.id} value={gate.id}>
                    {gate.gate_name} ({gate.gate_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-sm bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-2 rounded-md"
                onClick={() => void startNfcScan()}
                disabled={isScanning || isSubmitting || !gateId}
              >
                {isScanning ? "Waiting for NFC tap..." : "Start NFC Scan"}
              </button>
            </div>

            <div className="pt-2 border-t border-[#e2e8f0]">
              <p className="text-sm font-medium text-[#1e293b] mb-2">Manual fallback</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={manualUid}
                  onChange={(event) => setManualUid(event.target.value)}
                  placeholder="UID (e.g. 04:a1:b2:...)"
                  className="border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={manualCounter}
                  onChange={(event) => setManualCounter(event.target.value)}
                  placeholder="Counter"
                  className="border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={manualMemberCode}
                  onChange={(event) => setManualMemberCode(event.target.value)}
                  placeholder="Member code (optional)"
                  className="border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                className="mt-3 text-sm bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-2 rounded-md"
                onClick={submitManualScan}
                disabled={isSubmitting || isScanning || !gateId}
              >
                {isSubmitting ? "Submitting..." : "Submit Manual Scan"}
              </button>
            </div>

            {message ? <p className="text-sm text-[#475569]">{message}</p> : null}
            {selectedGate ? (
              <p className="text-xs text-[#64748b]">
                Active gate: <span className="font-medium text-[#1e293b]">{selectedGate.gate_name}</span>
              </p>
            ) : null}
          </section>

          <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm space-y-2">
            <h3 className="text-lg font-semibold text-[#0f172a]">Last verification result</h3>
            {!lastResult ? (
              <p className="text-sm text-[#64748b]">No scans yet.</p>
            ) : (
              <>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Verdict:</span> {lastResult.verdict || "N/A"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Scan status:</span> {lastResult.scan?.status || "N/A"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Counter:</span> {lastResult.scan?.expected_counter ?? "-"} / {lastResult.scan?.received_counter ?? "-"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Person:</span> {lastResult.person?.full_name || "Unknown"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Account linked:</span> {lastResult.account?.is_linked ? "Yes" : "No"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Logged direction:</span> {lastResult.access_event?.direction || "N/A"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Logged at:</span> {lastResult.access_event?.event_timestamp ? new Date(lastResult.access_event.event_timestamp).toLocaleString() : "N/A"}</p>
                {lastResult.error ? <p className="text-sm text-[#b91c1c]">{lastResult.error}</p> : null}
              </>
            )}
          </section>

          <section className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-3">Officer scan logs</h3>
            {logs.length === 0 ? (
              <p className="text-sm text-[#64748b]">No logs yet.</p>
            ) : (
              <div className="max-h-60 overflow-auto space-y-1">
                {logs.map((line) => (
                  <p key={line} className="text-xs text-[#475569] break-all">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

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
      .then(({ data }: { data: Array<{ id: string; direction: string; event_timestamp: string; person_registry: { full_name: string; person_type: string } }> | null }) => {
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
