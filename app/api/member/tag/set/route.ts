import { NextRequest, NextResponse } from "next/server";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import {
  appendTagEvent,
  getCooldownState,
  getMemberCode,
  normalizeUid,
  resolveMemberContext,
} from "../_helpers";

type SetTagPayload = {
  uid?: string;
};

type RegisterTagResponse = {
  uid: string;
};

export async function POST(request: NextRequest) {
  const context = await resolveMemberContext();

  if ("error" in context) {
    return context.error;
  }

  const { adminClient, person, settings, user } = context;
  const payload = (await request.json()) as SetTagPayload;
  const uid = payload.uid?.trim();

  if (!uid) {
    return NextResponse.json({ error: "UID is required." }, { status: 400 });
  }

  if (person.nfc_tag_status === "active" && person.nfc_tag_id) {
    return NextResponse.json(
      { error: "You already have an active tag. Use replace to change it." },
      { status: 400 }
    );
  }

  const cooldown = getCooldownState(person, settings);
  if (settings.cooldown_enabled && person.nfc_tag_last_changed_at && !cooldown.canChangeNow) {
    return NextResponse.json(
      {
        error: "Tag change cooldown is active.",
        next_allowed_at: cooldown.nextAllowedAt,
        remaining_hours: cooldown.remainingHours,
      },
      { status: 429 }
    );
  }

  const normalizedUid = normalizeUid(uid);
  const memberCode = getMemberCode(person);

  let externalResponse: RegisterTagResponse;
  try {
    externalResponse = await callNfcApi<RegisterTagResponse>("/api/tags", {
      method: "POST",
      body: JSON.stringify({
        uid: normalizedUid,
        member_code: memberCode,
      }),
    });
  } catch (error) {
    if (error instanceof NfcApiError) {
      return NextResponse.json({ error: error.message, details: error.data }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unknown NFC API error.";
    return NextResponse.json(
      { error: "Failed to register tag with NFC API.", details: { cause: message } },
      { status: 502 }
    );
  }

  const updatedUid = normalizeUid(externalResponse.uid || normalizedUid);
  const action = person.nfc_tag_status === "deactivated" ? "reactivate" : "set";
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
    action,
    previousTagUid: person.nfc_tag_id,
    newTagUid: updatedUid,
    externalStatus: "registered",
    createdBy: user.id,
  });

  if (eventError) {
    return eventError;
  }

  return NextResponse.json({
    message: action === "reactivate" ? "Tag reactivated successfully." : "Tag linked successfully.",
    tag: {
      uid: updatedUid,
      status: "active",
      last_changed_at: nowIso,
    },
  });
}
