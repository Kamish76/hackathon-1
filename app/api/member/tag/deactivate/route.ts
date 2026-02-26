import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Legacy endpoint removed.",
      use: "/api/user/tag/prepare then /api/user/tag/confirm",
    },
    { status: 410 }
  );
}
