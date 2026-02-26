'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { FlaskConical, RefreshCw } from 'lucide-react';

interface PersonInfo {
  full_name: string;
  person_type: string;
}

type LookupState =
  | { status: 'idle' }
  | { status: 'found'; person: PersonInfo }
  | { status: 'error' };

export default function TestQRPage() {
  const { user } = useAuth();
  const [personId, setPersonId] = useState<string | null>(null);
  const [customId, setCustomId] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  // Resolve person_registry.id from auth_users bridge
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    supabase
      .from('auth_users')
      .select('person_id')
      .eq('id', user.id)
      .single()
      .then(({ data }: { data: { person_id: string } | null }) => {
        if (data?.person_id) setPersonId(data.person_id);
      });
  }, [user?.id]);

  // Look up person details whenever the active UUID changes
  const activeId = customId.trim() || personId;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('person_registry')
      .select('full_name, person_type')
      .eq('id', activeId)
      .single()
      .then(({ data, error }: { data: PersonInfo | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (data) setLookup({ status: 'found', person: data });
        else if (error) setLookup({ status: 'error' });
      });
    return () => { cancelled = true; };
  }, [activeId]);

  const qrValue = customId.trim()
    ? `REFERENCE_ID:${customId.trim()}`
    : personId ? `REFERENCE_ID:${personId}` : '';

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-8 gap-6">
      {/* Banner */}
      <div className="flex items-center gap-2 bg-[#fef9c3] text-[#854d0e] text-xs font-medium px-4 py-2 rounded-full border border-[#fde68a]">
        <FlaskConical className="w-4 h-4" />
        Temporary test page — not linked in nav
      </div>

      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8 flex flex-col items-center gap-6 w-full max-w-sm">
        <div>
          <h1 className="text-lg font-semibold text-[#0f172a] text-center">QR Test Generator</h1>
          <p className="text-sm text-[#64748b] text-center mt-1">Scan this with the officer QR scanner.</p>
        </div>

        {/* QR Code */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-inner">
          {qrValue ? (
            <QRCodeSVG value={qrValue} size={200} level="H" fgColor="#0f172a" bgColor="#ffffff" />
          ) : (
            <div className="w-50 h-50 flex items-center justify-center text-sm text-[#94a3b8]">
              Loading…
            </div>
          )}
        </div>

        {/* Encoded value */}
        <div className="w-full bg-[#f1f5f9] rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-[#64748b] font-mono break-all">{qrValue || '—'}</p>
        </div>

        {/* Person info */}
        <div className="text-center">
          {lookup.status === 'found' ? (
            <>
              <p className="text-sm font-medium text-[#0f172a]">{lookup.person.full_name}</p>
              <p className="text-xs text-[#64748b]">{lookup.person.person_type}</p>
              <p className="text-xs text-[#94a3b8] font-mono mt-0.5">{activeId}</p>
            </>
          ) : lookup.status === 'error' ? (
            <p className="text-xs text-[#ef4444]">UUID not found in person_registry</p>
          ) : null}
        </div>

        {/* Divider */}
        <div className="w-full border-t border-[#e2e8f0]" />

        {/* Custom UUID input */}
        <div className="w-full space-y-2">
          <label className="text-xs font-medium text-[#64748b] uppercase tracking-wide">
            Override with custom UUID
          </label>
          <input
            type="text"
            placeholder="Paste any person_registry UUID…"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
          />
          {customId && (
            <button
              onClick={() => setCustomId('')}
              className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#1e293b] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset to my ID
            </button>
          )}
        </div>
      </div>

      <a
        href="/officer/scan"
        className="text-sm text-[#64748b] hover:text-[#1e293b] underline underline-offset-2 transition-colors"
      >
        ← Back to Scan / Check-in
      </a>
    </div>
  );
}
