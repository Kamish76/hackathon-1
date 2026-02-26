import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../_helpers";

export async function GET() {
  const access = await requireAuthenticatedUser();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient, user } = access;
  const { data, error } = await adminClient.rpc("can_user_write_tag", { p_user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? {
    can_write: false,
    next_available_date: null,
    last_write_date: null,
    cooldown_days: 14,
  });
}
