export class NfcApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "NfcApiError";
    this.status = status;
    this.data = data;
  }
}

export function getNfcApiBaseUrl() {
  const baseUrl = process.env.NFC_API_BASE_URL ?? process.env.NEXT_PUBLIC_NFC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing NFC_API_BASE_URL (or NEXT_PUBLIC_NFC_API_BASE_URL) environment variable.");
  }

  return baseUrl.replace(/\/$/, "");
}

export async function callNfcApi<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getNfcApiBaseUrl();
  const apiKey = process.env.NFC_API_KEY;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    throw new NfcApiError(`Unable to reach NFC API: ${message}`, 503, {
      path,
      baseUrl,
      cause: message,
    });
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : `NFC API request failed (${response.status}).`;
    throw new NfcApiError(message, response.status, data);
  }

  return data as T;
}
