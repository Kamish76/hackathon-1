import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../_helpers";

type ConfirmPayload = {
  pending_id?: string;
};

export async function POST(request: NextRequest) {
  const access = await requireAuthenticatedUser();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient, user } = access;
  const payload = (await request.json()) as ConfirmPayload;
  const pendingId = payload.pending_id?.trim();

  if (!pendingId) {
    return NextResponse.json({ error: "pending_id is required." }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("confirm_tag_write", {
    p_user_id: user.id,
    p_pending_id: pendingId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.success) {
    const message = data?.error || "Unable to confirm tag write.";
    const status = message === "Pending write expired." ? 410 : 400;
    return NextResponse.json(data ?? { success: false, error: message }, { status });
  }

  return NextResponse.json(data);
}
