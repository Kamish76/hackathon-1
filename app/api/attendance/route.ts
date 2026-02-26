import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AttendancePayload = {
  event_id?: string;
  user_id?: string;
  scan_method?: "NFC" | "QR" | "Manual";
  location_lat?: number;
  location_lng?: number;
  notes?: string;
  is_member?: boolean;
};

const methodSet = new Set(["NFC", "QR", "Manual"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const payload = (await request.json()) as AttendancePayload;
  const eventId = payload.event_id?.trim();
  const targetUserId = payload.user_id?.trim();
  const scanMethod = payload.scan_method?.trim() as AttendancePayload["scan_method"];

  if (!eventId || !targetUserId || !scanMethod) {
    return NextResponse.json(
      { error: "event_id, user_id, and scan_method are required." },
      { status: 400 }
    );
  }

  if (!methodSet.has(scanMethod)) {
    return NextResponse.json({ error: "scan_method must be NFC, QR, or Manual." }, { status: 400 });
  }

  if (payload.location_lat !== undefined && (payload.location_lat < -90 || payload.location_lat > 90)) {
    return NextResponse.json({ error: "location_lat is out of range." }, { status: 400 });
  }

  if (payload.location_lng !== undefined && (payload.location_lng < -180 || payload.location_lng > 180)) {
    return NextResponse.json({ error: "location_lng is out of range." }, { status: 400 });
  }

  const { data, error } = await adminClient.rpc("mark_attendance", {
    p_event_id: eventId,
    p_user_id: targetUserId,
    p_marked_by: user.id,
    p_scan_method: scanMethod,
    p_location_lat: payload.location_lat ?? null,
    p_location_lng: payload.location_lng ?? null,
    p_notes: payload.notes ?? null,
    p_is_member: payload.is_member ?? true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.success) {
    const status = data?.duplicate ? 409 : data?.error === "Permission denied." ? 403 : 400;
    return NextResponse.json(data ?? { success: false, error: "Unable to mark attendance." }, { status });
  }

  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("event_id")?.trim();

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required." }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("event_attendance")
    .select("id, event_id, user_id, marked_at, marked_by, scan_method, location_lat, location_lng, notes, is_member")
    .eq("event_id", eventId)
    .order("marked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const summary = {
    total_attended: rows.length,
    members: rows.filter((row) => row.is_member).length,
    guests: rows.filter((row) => !row.is_member).length,
    methods: {
      NFC: rows.filter((row) => row.scan_method === "NFC").length,
      QR: rows.filter((row) => row.scan_method === "QR").length,
      Manual: rows.filter((row) => row.scan_method === "Manual").length,
    },
  };

  return NextResponse.json({ attendance: rows, summary });
}
