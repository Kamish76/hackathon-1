import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import { normalizeUid, requireOfficerOrAdmin } from "../_helpers";

type ScanPayload = {
  uid?: string;
  counter?: number;
  member_code?: string | null;
  gate_id?: string;
};

type ScanResponse = {
  status: "first_scan" | "valid" | "skipped_scans" | "clone_detected" | "cnt_missing_testing_mode";
  message: string;
  expected_counter?: number;
  received_counter?: number;
  scan_count?: number;
  uid: string;
};

type PersonRow = {
  id: string;
  full_name: string;
  person_type: string;
  external_identifier: string | null;
  linked_user_id: string | null;
  email: string | null;
  nfc_tag_status: "none" | "active" | "deactivated" | "replaced";
};

type AccessEventRow = {
  id: string;
  gate_id: string;
  direction: "IN" | "OUT";
  event_timestamp: string;
};

function isScanResponse(value: unknown): value is ScanResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = (value as { status?: unknown }).status;
  return (
    status === "first_scan" ||
    status === "valid" ||
    status === "skipped_scans" ||
    status === "clone_detected" ||
    status === "cnt_missing_testing_mode"
  );
}

async function insertAccessEvent(params: {
  adminClient: SupabaseClient;
  personId: string;
  gateId: string;
  operatorUserId: string;
  metadata: Record<string, unknown>;
}) {
  const { adminClient, personId, gateId, operatorUserId, metadata } = params;

  const { data: lastEvent, error: lastEventError } = await adminClient
    .from("access_events")
    .select("direction")
    .eq("person_id", personId)
    .order("event_timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEventError) {
    return { error: NextResponse.json({ error: lastEventError.message }, { status: 500 }) };
  }

  const firstDirection: "IN" | "OUT" = lastEvent?.direction === "IN" ? "OUT" : "IN";
  const secondDirection: "IN" | "OUT" = firstDirection === "IN" ? "OUT" : "IN";

  const attemptInsert = async (direction: "IN" | "OUT") => {
    return adminClient
      .from("access_events")
      .insert({
        person_id: personId,
        gate_id: gateId,
        direction,
        entry_mode: "WALK",
        verification_method: "NFC",
        operator_user_id: operatorUserId,
        metadata,
      })
      .select("id, gate_id, direction, event_timestamp")
      .single();
  };

  const firstAttempt = await attemptInsert(firstDirection);

  if (!firstAttempt.error && firstAttempt.data) {
    return { event: firstAttempt.data as AccessEventRow };
  }

  const firstMessage = firstAttempt.error?.message ?? "";
  const maybeDirectionConflict = /direction|Anti-passback/i.test(firstMessage);

  if (!maybeDirectionConflict) {
    return { error: NextResponse.json({ error: firstMessage || "Failed to create access event." }, { status: 500 }) };
  }

  const secondAttempt = await attemptInsert(secondDirection);

  if (secondAttempt.error || !secondAttempt.data) {
    return {
      error: NextResponse.json(
        { error: secondAttempt.error?.message || "Failed to create access event." },
        { status: 500 }
      ),
    };
  }

  return { event: secondAttempt.data as AccessEventRow };
}

export async function POST(request: NextRequest) {
  const access = await requireOfficerOrAdmin();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient, user } = access;
  const payload = (await request.json()) as ScanPayload;

  const rawUid = payload.uid?.trim() ?? "";
  const gateId = payload.gate_id?.trim() ?? "";
  const parsedCounter = Number(payload.counter);
  const hasCounter = Number.isInteger(parsedCounter) && parsedCounter >= 0;
  const memberCode = payload.member_code?.trim();

  if (!rawUid) {
    return NextResponse.json({ error: "uid is required." }, { status: 400 });
  }

  if (!gateId) {
    return NextResponse.json({ error: "gate_id is required." }, { status: 400 });
  }

  const { data: gate, error: gateError } = await adminClient
    .from("gates")
    .select("id, gate_code, gate_name, is_active")
    .eq("id", gateId)
    .eq("is_active", true)
    .maybeSingle();

  if (gateError) {
    return NextResponse.json({ error: gateError.message }, { status: 500 });
  }

  if (!gate) {
    return NextResponse.json({ error: "Selected gate is invalid or inactive." }, { status: 400 });
  }

  const normalizedUid = normalizeUid(rawUid);
  let scanResult: ScanResponse;
  let statusCode = 200;

  if (hasCounter) {
    try {
      scanResult = await callNfcApi<ScanResponse>("/api/scan", {
        method: "POST",
        body: JSON.stringify({
          uid: normalizedUid,
          counter: parsedCounter,
          ...(memberCode ? { member_code: memberCode } : {}),
        }),
      });
    } catch (error) {
      if (error instanceof NfcApiError) {
        if (error.status === 409 && isScanResponse(error.data)) {
          scanResult = error.data;
          statusCode = 409;
        } else {
          return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
        }
      } else {
        const message = error instanceof Error ? error.message : "Unknown NFC API error.";
        return NextResponse.json(
          { error: "Failed to verify scan with NFC API.", details: { cause: message } },
          { status: 502 }
        );
      }
    }
  } else {
    scanResult = {
      status: "cnt_missing_testing_mode",
      message: "Counter missing. Recorded in testing mode without anti-clone verification.",
      uid: normalizedUid,
    };
  }

  const { data: person, error: personError } = await adminClient
    .from("person_registry")
    .select("id, full_name, person_type, external_identifier, linked_user_id, email, nfc_tag_status")
    .eq("nfc_tag_id", normalizedUid)
    .maybeSingle();

  if (personError) {
    return NextResponse.json({ error: personError.message }, { status: 500 });
  }

  if (!person) {
    return NextResponse.json(
      {
        error: "No local person is linked to this NFC tag UID.",
        scan: scanResult,
      },
      { status: 404 }
    );
  }

  const typedPerson = person as PersonRow;

  const { data: authUser, error: authUserError } = await adminClient
    .from("auth_users")
    .select("id")
    .eq("person_id", typedPerson.id)
    .maybeSingle();

  if (authUserError) {
    return NextResponse.json({ error: authUserError.message }, { status: 500 });
  }

  const accountLinked = Boolean(authUser || typedPerson.linked_user_id);

  const insertResult = await insertAccessEvent({
    adminClient,
    personId: typedPerson.id,
    gateId,
    operatorUserId: user.id,
    metadata: {
      source: "officer_scan",
      nfc_status: scanResult.status,
      expected_counter: scanResult.expected_counter ?? null,
      received_counter: scanResult.received_counter ?? null,
      supplied_counter: hasCounter ? parsedCounter : null,
      counter_missing_testing_mode: !hasCounter,
      uid: scanResult.uid,
      supplied_member_code: memberCode ?? null,
      account_linked: accountLinked,
      clone_detected: scanResult.status === "clone_detected",
    },
  });

  if ("error" in insertResult) {
    return insertResult.error;
  }

  const verdict = scanResult.status === "clone_detected" ? "blocked" : "allowed";

  return NextResponse.json(
    {
      verdict,
      scan: scanResult,
      gate: {
        id: gate.id,
        gate_code: gate.gate_code,
        gate_name: gate.gate_name,
      },
      person: {
        id: typedPerson.id,
        full_name: typedPerson.full_name,
        person_type: typedPerson.person_type,
        member_code: typedPerson.external_identifier,
        nfc_tag_status: typedPerson.nfc_tag_status,
      },
      account: {
        is_linked: accountLinked,
        auth_user_id: authUser?.id ?? typedPerson.linked_user_id,
      },
      testing_mode: !hasCounter,
      access_event: insertResult.event,
    },
    { status: statusCode }
  );
}
