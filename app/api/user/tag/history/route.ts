import { NextRequest, NextResponse } from "next/server";
import { parseLimit, requireAuthenticatedUser } from "../_helpers";

export async function GET(request: NextRequest) {
  const access = await requireAuthenticatedUser();

  if ("error" in access) {
    return access.error;
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const { adminClient, user } = access;

  const { data, error } = await adminClient.rpc("get_tag_write_history", {
    p_user_id: user.id,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { writes: [], total_writes: 0 });
}
