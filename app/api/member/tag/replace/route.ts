import { NextRequest, NextResponse } from "next/server";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import {
  appendTagEvent,
  getCooldownState,
  getMemberCode,
  normalizeUid,
  resolveMemberContext,
} from "../_helpers";

type ReplaceTagPayload = {
  new_uid?: string;
};

type ReplaceTagResponse = {
  message?: string;
  new_tag?: {
    uid?: string;
  };
};

export async function PATCH(request: NextRequest) {
  const context = await resolveMemberContext();

  if ("error" in context) {
    return context.error;
  }

  const { adminClient, person, settings, user } = context;

  if (person.nfc_tag_status !== "active" || !person.nfc_tag_id) {
    return NextResponse.json({ error: "Only active tags can be replaced." }, { status: 400 });
  }

  const cooldown = getCooldownState(person, settings);
  if (settings.cooldown_enabled && !cooldown.canChangeNow) {
    return NextResponse.json(
      {
        error: "Tag change cooldown is active.",
        next_allowed_at: cooldown.nextAllowedAt,
        remaining_hours: cooldown.remainingHours,
      },
      { status: 429 }
    );
  }

  const payload = (await request.json()) as ReplaceTagPayload;
  const nextUid = payload.new_uid?.trim();

  if (!nextUid) {
    return NextResponse.json({ error: "new_uid is required." }, { status: 400 });
  }

  const normalizedOldUid = normalizeUid(person.nfc_tag_id);
  const normalizedNewUid = normalizeUid(nextUid);

  if (normalizedOldUid === normalizedNewUid) {
    return NextResponse.json({ error: "New tag UID must be different." }, { status: 400 });
  }

  const memberCode = getMemberCode(person);

  let externalResponse: ReplaceTagResponse;
  try {
    externalResponse = await callNfcApi<ReplaceTagResponse>(
      `/api/tags/${encodeURIComponent(normalizedOldUid)}/replace`,
      {
        method: "PATCH",
        body: JSON.stringify({
          new_uid: normalizedNewUid,
          member_code: memberCode,
        }),
      }
    );
  } catch (error) {
    if (error instanceof NfcApiError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unknown NFC API error.";
    return NextResponse.json(
      { error: "Failed to replace tag with NFC API.", details: { cause: message } },
      { status: 502 }
    );
  }

  const updatedUid = normalizeUid(externalResponse.new_tag?.uid || normalizedNewUid);
  const nowIso = new Date().toISOString();

  const { error: updateError } = await adminClient
    .from("person_registry")
    .update({
      nfc_tag_id: updatedUid,
      nfc_tag_status: "active",
      nfc_tag_last_changed_at: nowIso,
      nfc_tag_deactivation_reason: null,
    })
    .eq("id", person.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const eventError = await appendTagEvent({
    adminClient,
    personId: person.id,
    action: "replace",
    previousTagUid: normalizedOldUid,
    newTagUid: updatedUid,
    externalStatus: "replaced",
    createdBy: user.id,
  });

  if (eventError) {
    return eventError;
  }

  return NextResponse.json({
    message: externalResponse.message || "Tag replaced successfully.",
    tag: {
      uid: updatedUid,
      status: "active",
      last_changed_at: nowIso,
    },
  });
}
