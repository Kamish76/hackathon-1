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
  testing_mode?: boolean;
  scan?: {
    status: "first_scan" | "valid" | "skipped_scans" | "clone_detected" | "cnt_missing_testing_mode";
    message: string;
    expected_counter?: number;
    received_counter?: number;
    scan_count?: number;
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
  const [manualCounter, setManualCounter] = useState("");
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
    async (params: { uid: string; counter?: number; memberCode?: string | null; payload?: string | null }) => {
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
          : result.testing_mode || result.scan?.status === "cnt_missing_testing_mode"
            ? "Scan logged in testing mode (cnt missing)."
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
          if (Number.isInteger(manual) && manual >= 0) {
            addLog("startNfcScan:manual-counter-fallback", { uid, counter: manual });
            void submitScan({ uid, counter: manual, memberCode, payload });
          } else {
            addLog("startNfcScan:counter-missing-testing-mode", { uid, payload });
            void submitScan({ uid, memberCode, payload });
          }
        } else {
          void submitScan({ uid, counter, memberCode, payload });
        }

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
    const counterRaw = manualCounter.trim();
    const counter = counterRaw === "" ? Number.NaN : Number(counterRaw);

    if (!uid) {
      setMessage("Manual UID is required.");
      return;
    }

    void submitScan({
      uid,
      counter: Number.isInteger(counter) && counter >= 0 ? counter : undefined,
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
            <p className="text-[#64748b]">Scan a tag to verify status, account link, and write access logs. Missing cnt is allowed in testing mode.</p>
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
                  placeholder="Counter (optional in testing mode)"
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
                <p className="text-sm text-[#1e293b]"><span className="font-semibold">Testing mode:</span> {lastResult.testing_mode || lastResult.scan?.status === "cnt_missing_testing_mode" ? "Yes (cnt ignored)" : "No"}</p>
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
