import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TagAction = "set" | "replace" | "deactivate" | "reactivate";
export type DeactivationReason = "lost" | "stolen" | "damaged" | "other";

type PersonRecord = {
  id: string;
  full_name: string;
  email: string | null;
  external_identifier: string | null;
  nfc_tag_id: string | null;
  nfc_tag_status: "none" | "active" | "deactivated" | "replaced";
  nfc_tag_last_changed_at: string | null;
  nfc_tag_deactivation_reason: DeactivationReason | null;
};

type CooldownSettings = {
  cooldown_enabled: boolean;
  cooldown_days: number;
};

export async function resolveMemberContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }

  const { data: primaryPerson, error: primaryError } = await adminClient
    .from("person_registry")
    .select(
      "id, full_name, email, external_identifier, nfc_tag_id, nfc_tag_status, nfc_tag_last_changed_at, nfc_tag_deactivation_reason"
    )
    .or(`linked_user_id.eq.${user.id},email.eq.${user.email}`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (primaryError) {
    return { error: NextResponse.json({ error: primaryError.message }, { status: 500 }) };
  }

  let person = primaryPerson as PersonRecord | null;

  if (!person) {
    const fallbackName =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      user.email ||
      "Member";

    const { data: insertedPerson, error: insertError } = await adminClient
      .from("person_registry")
      .insert({
        linked_user_id: user.id,
        person_type: "Student",
        full_name: fallbackName,
        email: user.email ?? null,
        is_active: true,
      })
      .select(
        "id, full_name, email, external_identifier, nfc_tag_id, nfc_tag_status, nfc_tag_last_changed_at, nfc_tag_deactivation_reason"
      )
      .single();

    if (insertError || !insertedPerson) {
      return {
        error: NextResponse.json(
          { error: insertError?.message || "Member profile not found." },
          { status: 500 }
        ),
      };
    }

    person = insertedPerson as PersonRecord;
  }

  const { data: rawSettings, error: settingsError } = await adminClient
    .from("nfc_tag_settings")
    .select("cooldown_enabled, cooldown_days")
    .eq("id", true)
    .maybeSingle();

  if (settingsError) {
    return { error: NextResponse.json({ error: settingsError.message }, { status: 500 }) };
  }

  const settings: CooldownSettings = {
    cooldown_enabled: rawSettings?.cooldown_enabled ?? true,
    cooldown_days: rawSettings?.cooldown_days ?? 7,
  };

  return {
    user,
    adminClient,
    person,
    settings,
  };
}

export function normalizeUid(rawUid: string) {
  return rawUid.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function getMemberCode(person: PersonRecord) {
  return person.external_identifier || person.id;
}

export function getCooldownState(person: PersonRecord, settings: CooldownSettings) {
  if (!settings.cooldown_enabled || !person.nfc_tag_last_changed_at) {
    return {
      canChangeNow: true,
      nextAllowedAt: null as string | null,
      remainingHours: 0,
    };
  }

  const lastChangedAt = new Date(person.nfc_tag_last_changed_at);
  const nextAllowedAt = new Date(lastChangedAt.getTime() + settings.cooldown_days * 24 * 60 * 60 * 1000);
  const now = new Date();

  const remainingMs = Math.max(0, nextAllowedAt.getTime() - now.getTime());
  return {
    canChangeNow: remainingMs === 0,
    nextAllowedAt: nextAllowedAt.toISOString(),
    remainingHours: Math.ceil(remainingMs / (1000 * 60 * 60)),
  };
}

export async function appendTagEvent(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  personId: string;
  action: TagAction;
  previousTagUid?: string | null;
  newTagUid?: string | null;
  reason?: string | null;
  externalStatus?: string | null;
  createdBy?: string;
}) {
  const { error } = await params.adminClient.from("member_tag_events").insert({
    person_id: params.personId,
    action: params.action,
    previous_tag_uid: params.previousTagUid ?? null,
    new_tag_uid: params.newTagUid ?? null,
    reason: params.reason ?? null,
    external_status: params.externalStatus ?? null,
    created_by: params.createdBy ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}
