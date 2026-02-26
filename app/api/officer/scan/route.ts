import { NextRequest, NextResponse } from "next/server";
import { requireOfficerOrAdmin } from "../_helpers";

type ScanPayload = {
  tag_id?: string;
  uid?: string;
  event_id?: string;
  gate_id?: string;
  scan_method?: "NFC" | "QR" | "Manual";
  location_lat?: number;
  location_lng?: number;
  notes?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const access = await requireOfficerOrAdmin();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient, user } = access;
  const payload = (await request.json()) as ScanPayload;

  const tagId = (payload.tag_id?.trim() || payload.uid?.trim() || "").toLowerCase();
  const eventId = payload.event_id?.trim() || payload.gate_id?.trim() || "";
  const scanMethod = payload.scan_method ?? "NFC";

  if (!tagId) {
    return NextResponse.json({ error: "tag_id is required." }, { status: 400 });
  }

  if (!uuidPattern.test(tagId)) {
    return NextResponse.json({ error: "tag_id must be a valid UUID." }, { status: 400 });
  }

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  if (!["NFC", "QR", "Manual"].includes(scanMethod)) {
    return NextResponse.json({ error: "scan_method must be NFC, QR, or Manual." }, { status: 400 });
  }

  if (payload.location_lat !== undefined && (payload.location_lat < -90 || payload.location_lat > 90)) {
    return NextResponse.json({ error: "location_lat is out of range." }, { status: 400 });
  }

  if (payload.location_lng !== undefined && (payload.location_lng < -180 || payload.location_lng > 180)) {
    return NextResponse.json({ error: "location_lng is out of range." }, { status: 400 });
  }

  const { data: lookupData, error: lookupError } = await adminClient.rpc("lookup_user_by_tag", {
    p_tag_id: tagId,
  });

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!lookupData?.found || !lookupData?.user?.id) {
    return NextResponse.json({ error: "No user found for this tag." }, { status: 404 });
  }

  const { data: attendanceData, error: attendanceError } = await adminClient.rpc("mark_attendance", {
    p_event_id: eventId,
    p_user_id: lookupData.user.id,
    p_marked_by: user.id,
    p_scan_method: scanMethod,
    p_location_lat: payload.location_lat ?? null,
    p_location_lng: payload.location_lng ?? null,
    p_notes: payload.notes ?? null,
    p_is_member: true,
  });

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message }, { status: 500 });
  }

  if (!attendanceData?.success) {
    const status = attendanceData?.duplicate ? 409 : attendanceData?.error === "Permission denied." ? 403 : 400;
    return NextResponse.json(attendanceData ?? { success: false, error: "Unable to mark attendance." }, { status });
  }

  return NextResponse.json(
    {
      verdict: "allowed",
      event_id: eventId,
      user: lookupData.user,
      attendance: {
        id: attendanceData.attendance_id,
        marked_at: attendanceData.marked_at,
        is_member: attendanceData.is_member,
      },
    },
    { status: 200 }
  );
}
