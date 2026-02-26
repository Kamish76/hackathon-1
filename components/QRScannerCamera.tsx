'use client';

import { useEffect, useRef } from 'react';

interface QRScannerCameraProps {
  active: boolean;
  onDecode: (text: string) => void;
  onError?: (err: string) => void;
}

const MOUNT_ID = 'qr-scanner-mount';

export default function QRScannerCamera({ active, onDecode, onError }: QRScannerCameraProps) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode')['Html5Qrcode']> | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (cancelled) return;

      const scanner = new Html5Qrcode(MOUNT_ID, { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!cancelled) onDecode(decodedText);
          },
          () => { /* frame-level error — silent */ }
        );
        isRunningRef.current = true;
      } catch (err) {
        if (!cancelled && onError) {
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    async function stopScanner() {
      const scanner = scannerRef.current;
      if (scanner && isRunningRef.current) {
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          /* ignore stop errors */
        }
        isRunningRef.current = false;
        scannerRef.current = null;
      }
    }

    if (active) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Camera mount — only in DOM when active so it doesn't show a blank black box */}
      {active && (
        <div
          id={MOUNT_ID}
          className="w-full max-w-sm rounded-xl overflow-hidden bg-black"
          style={{ minHeight: 280 }}
        />
      )}

      {/* Scan-frame overlay */}
      {active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-55 h-55 relative">
            {/* Corner marks */}
            <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#22c55e] rounded-tl" />
            <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#22c55e] rounded-tr" />
            <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#22c55e] rounded-bl" />
            <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#22c55e] rounded-br" />
            {/* Scan line */}
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#22c55e] opacity-70 animate-pulse" />
          </div>
        </div>
      )}

      {!active && (
        <div className="w-full max-w-sm rounded-xl bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center py-6">
          <p className="text-xs text-[#94a3b8]">Camera is off</p>
        </div>
      )}
    </div>
  );
}
