import { NextRequest, NextResponse } from "next/server";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import {
  appendTagEvent,
  DeactivationReason,
  getMemberCode,
  normalizeUid,
  resolveMemberContext,
} from "../_helpers";

type DeactivateTagPayload = {
  reason?: DeactivationReason;
};

type DeactivateTagResponse = {
  message?: string;
};

const allowedReasons: DeactivationReason[] = ["lost", "stolen", "damaged", "other"];

export async function PATCH(request: NextRequest) {
  const context = await resolveMemberContext();

  if ("error" in context) {
    return context.error;
  }

  const { adminClient, person, user } = context;

  if (person.nfc_tag_status !== "active" || !person.nfc_tag_id) {
    return NextResponse.json({ error: "Only active tags can be deactivated." }, { status: 400 });
  }

  const payload = (await request.json()) as DeactivateTagPayload;
  const reason = payload.reason;

  if (!reason || !allowedReasons.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason. Use lost, stolen, damaged, or other." }, { status: 400 });
  }

  const normalizedUid = normalizeUid(person.nfc_tag_id);
  const memberCode = getMemberCode(person);

  let externalResponse: DeactivateTagResponse;
  try {
    externalResponse = await callNfcApi<DeactivateTagResponse>(
      `/api/tags/${encodeURIComponent(normalizedUid)}/deactivate`,
      {
        method: "PATCH",
        body: JSON.stringify({
          member_code: memberCode,
          reason,
        }),
      }
    );
  } catch (error) {
    if (error instanceof NfcApiError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unknown NFC API error.";
    return NextResponse.json(
      { error: "Failed to deactivate tag with NFC API.", details: { cause: message } },
      { status: 502 }
    );
  }

  const nowIso = new Date().toISOString();

  const { error: updateError } = await adminClient
    .from("person_registry")
    .update({
      nfc_tag_status: "deactivated",
      nfc_tag_last_changed_at: nowIso,
      nfc_tag_deactivation_reason: reason,
    })
    .eq("id", person.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const eventError = await appendTagEvent({
    adminClient,
    personId: person.id,
    action: "deactivate",
    previousTagUid: normalizedUid,
    newTagUid: null,
    reason,
    externalStatus: "deactivated",
    createdBy: user.id,
  });

  if (eventError) {
    return eventError;
  }

  return NextResponse.json({
    message: externalResponse.message || "Tag deactivated successfully.",
    tag: {
      uid: normalizedUid,
      status: "deactivated",
      deactivation_reason: reason,
      last_changed_at: nowIso,
    },
  });
}
