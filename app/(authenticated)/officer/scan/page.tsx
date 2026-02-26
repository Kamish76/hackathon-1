'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  ScanLine, Wifi, CheckCircle2, XCircle, Clock, QrCode, User, AlertCircle,
} from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';

const QRScannerCamera = dynamic(() => import('@/components/QRScannerCamera'), { ssr: false });

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error';

interface ScanEntry {
  id: string;
  name: string;
  type: string;
  direction: 'IN';
  gate: string;
  time: string;
  status: 'granted' | 'denied';
}

interface LastResult {
  name: string;
  type: string;
  refId: string;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  return `${mins} min ago`;
}

export default function ScanPage() {
  const [activeTab, setActiveTab] = useState<'qr' | 'nfc'>('qr');
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToScanning = useCallback(() => {
    processingRef.current = false;
    setScanStatus('scanning');
    setLastResult(null);
    setErrorMsg('');
  }, []);

  const handleDecode = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanStatus('idle'); // pause camera re-decode while processing

    const PREFIX = 'REFERENCE_ID:';
    if (!text.startsWith(PREFIX)) {
      setErrorMsg('Invalid QR code — not a system credential.');
      setScanStatus('error');
      timerRef.current = setTimeout(resetToScanning, 2000);
      return;
    }

    const refId = text.slice(PREFIX.length).trim();

    const supabase = createClient();
    const { data, error } = await supabase
      .from('person_registry')
      .select('full_name, person_type')
      .eq('linked_user_id', refId)
      .single();

    if (error || !data) {
      // Try matching by id directly (some QRs may encode person id)
      const { data: byId, error: idErr } = await supabase
        .from('person_registry')
        .select('full_name, person_type')
        .eq('id', refId)
        .single();

      if (idErr || !byId) {
        setErrorMsg('Person not found in the registry.');
        setScanStatus('error');
        timerRef.current = setTimeout(resetToScanning, 2500);
        return;
      }

      const result: LastResult = { name: byId.full_name, type: byId.person_type, refId };
      setLastResult(result);
      setRecentScans((prev) => [
        {
          id: crypto.randomUUID(),
          name: byId.full_name,
          type: byId.person_type,
          direction: 'IN',
          gate: 'Main Gate',
          time: timeAgo(new Date()),
          status: 'granted',
        },
        ...prev,
      ]);
      setScanStatus('success');
      timerRef.current = setTimeout(resetToScanning, 3000);
      return;
    }

    const result: LastResult = { name: data.full_name, type: data.person_type, refId };
    setLastResult(result);
    setRecentScans((prev) => [
      {
        id: crypto.randomUUID(),
        name: data.full_name,
        type: data.person_type,
        direction: 'IN',
        gate: 'Main Gate',
        time: timeAgo(new Date()),
        status: 'granted',
      },
      ...prev,
    ]);
    setScanStatus('success');
    timerRef.current = setTimeout(resetToScanning, 3000);
  }, [resetToScanning]);

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
    setActiveTab(tab);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="scan" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Scan / Check-in</h2>
            <p className="text-[#64748b]">Scan QR codes or NFC tags to record entry and exit events at your checkpoint.</p>
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

                {/* Success card */}
                {scanStatus === 'success' && lastResult && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-[#dcfce7] flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-[#16a34a]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-[#0f172a]">{lastResult.name}</p>
                      <p className="text-sm text-[#64748b]">{lastResult.type}</p>
                    </div>
                    <span className="text-xs font-semibold bg-[#dcfce7] text-[#16a34a] px-3 py-1 rounded-full">
                      ✓ Logged IN
                    </span>
                    <p className="text-xs text-[#94a3b8]">Resuming scanner…</p>
                  </div>
                )}

                {/* Error card */}
                {scanStatus === 'error' && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-[#fee2e2] flex items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-[#ef4444]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-[#0f172a]">Scan Failed</p>
                      <p className="text-sm text-[#64748b]">{errorMsg}</p>
                    </div>
                    <p className="text-xs text-[#94a3b8]">Resuming scanner…</p>
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
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      scanStatus === 'scanning'
                        ? 'bg-[#fee2e2] text-[#ef4444] hover:bg-[#fecaca]'
                        : 'bg-[#1e293b] text-white hover:bg-[#0f172a]'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    {scanStatus === 'scanning' ? 'Stop Scanner' : 'Start Scanner'}
                  </button>
                )}
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
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{recentScans.filter(s => s.status === 'granted').length}</h3>
                <p className="text-sm text-[#64748b]">Granted This Session</p>
              </div>
              <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#fee2e2] flex items-center justify-center mb-3">
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{recentScans.filter(s => s.status === 'denied').length}</h3>
                <p className="text-sm text-[#64748b]">Denied This Session</p>
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
            <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Recent Scans</h3>
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
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#16a34a]">
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
