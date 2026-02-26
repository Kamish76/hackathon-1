import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../_helpers";

export async function POST() {
  const access = await requireAuthenticatedUser();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient, user } = access;
  const { data, error } = await adminClient.rpc("prepare_tag_write", { p_user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.success) {
    const status = data?.error === "Cooldown not elapsed." ? 429 : 400;
    return NextResponse.json(data ?? { success: false, error: "Unable to prepare tag write." }, { status });
  }

  return NextResponse.json(data);
}
