import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OperatorRole = "Admin" | "Officer" | "Taker";

export function normalizeUid(rawUid: string) {
  return rawUid.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

async function resolveOperatorRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ data: isAdmin, error: adminError }, { data: isOfficer, error: officerError }, { data: isTaker, error: takerError }] =
    await Promise.all([
      supabase.rpc("has_school_operator_role", { p_user_id: userId, p_role: "Admin" }),
      supabase.rpc("has_school_operator_role", { p_user_id: userId, p_role: "Officer" }),
      supabase.rpc("has_school_operator_role", { p_user_id: userId, p_role: "Taker" }),
    ]);

  const rpcFailed = Boolean(adminError || officerError || takerError);

  if (!rpcFailed) {
    if (isAdmin) return { role: "Admin" as OperatorRole };
    if (isOfficer) return { role: "Officer" as OperatorRole };
    if (isTaker) return { role: "Taker" as OperatorRole };
    return { role: null };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("school_operator_roles")
    .select("operator_role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("operator_role", ["Admin", "Officer", "Taker"]);

  if (roleError) {
    return { error: roleError.message };
  }

  const hasAdmin = (roleRows ?? []).some((row) => row.operator_role === "Admin");
  if (hasAdmin) return { role: "Admin" as OperatorRole };

  const hasOfficer = (roleRows ?? []).some((row) => row.operator_role === "Officer");
  if (hasOfficer) return { role: "Officer" as OperatorRole };

  const hasTaker = (roleRows ?? []).some((row) => row.operator_role === "Taker");
  if (hasTaker) return { role: "Taker" as OperatorRole };

  return { role: null };
}

export async function requireOfficerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const roleResolution = await resolveOperatorRole(supabase, user.id);

  if ("error" in roleResolution) {
    return { error: NextResponse.json({ error: roleResolution.error }, { status: 500 }) };
  }

  if (!roleResolution.role) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }

  return {
    user,
    role: roleResolution.role,
    adminClient,
  };
}
