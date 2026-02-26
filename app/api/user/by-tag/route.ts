import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../tag/_helpers";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const access = await requireAuthenticatedUser();

  if ("error" in access) {
    return access.error;
  }

  const tagId = request.nextUrl.searchParams.get("tag_id")?.trim() ?? "";

  if (!tagId) {
    return NextResponse.json({ error: "tag_id is required." }, { status: 400 });
  }

  if (!uuidPattern.test(tagId)) {
    return NextResponse.json({ error: "tag_id must be a valid UUID." }, { status: 400 });
  }

  const { adminClient } = access;
  const { data, error } = await adminClient.rpc("lookup_user_by_tag", { p_tag_id: tagId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.found) {
    return NextResponse.json({ error: "No user found for this tag." }, { status: 404 });
  }

  return NextResponse.json(data.user);
}
