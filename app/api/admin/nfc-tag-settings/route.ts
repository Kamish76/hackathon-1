import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: adminRole, error: roleError } = await supabase
    .from("school_operator_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("operator_role", "Admin")
    .eq("is_active", true)
    .maybeSingle();

  if (roleError || !adminRole) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id };
}

export async function GET() {
  const access = await assertAdminAccess();

  if ("error" in access) {
    return access.error;
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("nfc_tag_settings")
    .select("cooldown_enabled, cooldown_days, updated_at")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    cooldown_enabled: data?.cooldown_enabled ?? true,
    cooldown_days: data?.cooldown_days ?? 7,
    updated_at: data?.updated_at ?? null,
  });
}

type UpdatePayload = {
  cooldown_enabled?: boolean;
  cooldown_days?: number;
};

export async function PATCH(request: NextRequest) {
  const access = await assertAdminAccess();

  if ("error" in access) {
    return access.error;
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const payload = (await request.json()) as UpdatePayload;

  if (typeof payload.cooldown_enabled !== "boolean") {
    return NextResponse.json({ error: "cooldown_enabled must be a boolean." }, { status: 400 });
  }

  if (!Number.isInteger(payload.cooldown_days) || (payload.cooldown_days ?? 0) < 1 || (payload.cooldown_days ?? 0) > 365) {
    return NextResponse.json({ error: "cooldown_days must be an integer between 1 and 365." }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("nfc_tag_settings")
    .upsert(
      {
        id: true,
        cooldown_enabled: payload.cooldown_enabled,
        cooldown_days: payload.cooldown_days,
        updated_by: access.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("cooldown_enabled, cooldown_days, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
