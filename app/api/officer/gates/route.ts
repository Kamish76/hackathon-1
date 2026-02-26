import { NextResponse } from "next/server";
import { requireOfficerOrAdmin } from "../_helpers";

type GateRow = {
  id: string;
  gate_code: string;
  gate_name: string;
  is_active: boolean;
};

export async function GET() {
  const access = await requireOfficerOrAdmin();

  if ("error" in access) {
    return access.error;
  }

  const { adminClient } = access;

  const { data, error } = await adminClient
    .from("gates")
    .select("id, gate_code, gate_name, is_active")
    .eq("is_active", true)
    .order("gate_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gates = ((data ?? []) as GateRow[]).map((gate) => ({
    id: gate.id,
    gate_code: gate.gate_code,
    gate_name: gate.gate_name,
    is_active: gate.is_active,
  }));

  return NextResponse.json({ gates });
}
