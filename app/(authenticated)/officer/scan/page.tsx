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
  event_id?: string;
  user?: {
    id: string;
    full_name: string;
    email: string | null;
    tag_id: string;
  };
  attendance?: {
    id: string;
    marked_at: string;
    is_member: boolean;
  };
  error?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const [lastResult, setLastResult] = useState<OfficerScanResult | null>(null);

  const selectedGate = useMemo(() => gates.find((gate) => gate.id === gateId) ?? null, [gates, gateId]);

  const addLog = useCallback((entry: string, details?: unknown) => {
    const time = new Date().toISOString();
    const suffix = details ? ` | ${typeof details === "string" ? details : JSON.stringify(details)}` : "";
    const line = `${time} | ${entry}${suffix}`;
    setLogs((prev) => [line, ...prev].slice(0, 40));
  }, []);

  const submitScan = useCallback(
    async (params: { tagId: string; scanMethod: "NFC" | "QR" | "Manual" }) => {
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
          tag_id: params.tagId,
          event_id: gateId,
          scan_method: params.scanMethod,
        }),
      });

      const result = (await response.json()) as OfficerScanResult;

      if (!response.ok) {
        setLastResult(result);
        setMessage(result.error || "Scan verification failed.");
        addLog("submitScan:error", { status: response.status, result });
        setIsSubmitting(false);
        return;
      }

      setLastResult(result);
      setMessage("Scan verified and attendance marked.");
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
        const firstRecord = event.message?.records?.[0];
        const payload = decodeRecordPayload(firstRecord)?.trim().toLowerCase() || "";

        if (!payload || !uuidPattern.test(payload)) {
          setMessage("Scanned tag payload is invalid. Expected UUID tag_id in NDEF text record.");
          addLog("startNfcScan:invalid-tag-id", { payload, serialNumber: event.serialNumber });
          setIsScanning(false);
          return;
        }

        void submitScan({ tagId: payload, scanMethod: "NFC" });

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
  }, [addLog, gateId, submitScan]);

  const submitManualScan = useCallback(() => {
    const tagId = manualUid.trim().toLowerCase();

    if (!tagId) {
      setMessage("Manual tag_id is required.");
      return;
    }

    if (!uuidPattern.test(tagId)) {
      setMessage("Manual tag_id must be a valid UUID.");
      return;
    }

    void submitScan({ tagId, scanMethod: "Manual" });
  }, [manualUid, submitScan]);

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
            <p className="text-[#64748b]">Scan a tag to resolve `tag_id` and mark attendance.</p>
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
              <div className="grid grid-cols-1 gap-3 md:max-w-md">
                <input
                  type="text"
                  value={manualUid}
                  onChange={(event) => setManualUid(event.target.value)}
                  placeholder="tag_id UUID"
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
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Event:</span> {lastResult.event_id || "N/A"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Person:</span> {lastResult.user?.full_name || "Unknown"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Tag ID:</span> {lastResult.user?.tag_id || "N/A"}</p>
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Marked at:</span> {lastResult.attendance?.marked_at ? new Date(lastResult.attendance.marked_at).toLocaleString() : "N/A"}</p>
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
