import { NextRequest, NextResponse } from "next/server";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import { getMemberCode, normalizeUid, resolveMemberContext } from "../_helpers";

type ScanPayload = {
  uid?: string;
  counter?: number;
};

type ScanResponse = {
  status: "first_scan" | "valid" | "skipped_scans" | "clone_detected";
  message: string;
  expected_counter: number;
  received_counter: number;
  scan_count: number;
  uid: string;
};

export async function POST(request: NextRequest) {
  const context = await resolveMemberContext();

  if ("error" in context) {
    return context.error;
  }

  const { person } = context;
  const payload = (await request.json()) as ScanPayload;
  const rawUid = payload.uid?.trim() || person.nfc_tag_id || "";
  const counter = Number(payload.counter);

  if (!rawUid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (!Number.isInteger(counter) || counter < 0) {
    return NextResponse.json({ error: "counter must be a non-negative integer." }, { status: 400 });
  }

  const normalizedUid = normalizeUid(rawUid);
  const memberCode = getMemberCode(person);

  try {
    const result = await callNfcApi<ScanResponse>("/api/scan", {
      method: "POST",
      body: JSON.stringify({
        uid: normalizedUid,
        counter,
        member_code: memberCode,
      }),
    });

    return NextResponse.json(result, { status: result.status === "clone_detected" ? 409 : 200 });
  } catch (error) {
    if (error instanceof NfcApiError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }

    return NextResponse.json({ error: "Failed to verify scan with NFC API." }, { status: 502 });
  }
}
