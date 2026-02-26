import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy endpoint removed.",
      use: "/api/user/by-tag and /api/attendance",
    },
    { status: 410 }
  );
}
