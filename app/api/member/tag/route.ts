import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Legacy endpoint removed.",
      migration: {
        can_write: "/api/user/tag/can-write",
        prepare: "/api/user/tag/prepare",
        confirm: "/api/user/tag/confirm",
        history: "/api/user/tag/history",
      },
    },
    { status: 410 }
  );
}
