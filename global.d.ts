// Allow importing CSS files without TypeScript errors
declare module '*.css';

declare module '*.module.css';

// Web NFC API (available in Chrome on Android)
interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: {
    records: Array<{
      recordType: string;
      mediaType?: string;
      id?: string;
      data?: DataView;
      encoding?: string;
      lang?: string;
    }>;
  };
}

declare class NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}
