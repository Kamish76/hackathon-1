import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (clientError) {
    const message = clientError instanceof Error ? clientError.message : "Server configuration error";
    return { error: NextResponse.json({ error: message }, { status: 500 }) };
  }

  return { user, adminClient };
}

export function parseLimit(rawLimit: string | null) {
  if (!rawLimit) {
    return 10;
  }

  const value = Number(rawLimit);
  if (!Number.isInteger(value)) {
    return 10;
  }

  return Math.max(1, Math.min(value, 100));
}
