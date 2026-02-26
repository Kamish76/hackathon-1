import { NextResponse } from "next/server";
import { callNfcApi, NfcApiError } from "@/lib/nfcApi";
import { getCooldownState, resolveMemberContext } from "./_helpers";

type ExternalTagDetails = {
  tag?: {
    uid?: string;
    member_code?: string;
    scan_count?: number;
    last_counter?: number;
    last_scanned_at?: string;
    status?: string;
  };
  recent_scans?: Array<{
    id: string;
    counter: number;
    status: string;
    created_at: string;
  }>;
};

export async function GET() {
  const context = await resolveMemberContext();

  if ("error" in context) {
    return context.error;
  }

  const { person, settings } = context;
  const cooldown = getCooldownState(person, settings);
  let externalTagStatus: {
    reachable: boolean;
    scan_count?: number;
    last_counter?: number;
    last_scanned_at?: string;
    status?: string;
    recent_scans?: ExternalTagDetails["recent_scans"];
    message?: string;
  } | null = null;

  if (person.nfc_tag_id) {
    try {
      const external = await callNfcApi<ExternalTagDetails>(`/api/tags/${encodeURIComponent(person.nfc_tag_id)}`);
      externalTagStatus = {
        reachable: true,
        scan_count: external.tag?.scan_count,
        last_counter: external.tag?.last_counter,
        last_scanned_at: external.tag?.last_scanned_at,
        status: external.tag?.status,
        recent_scans: external.recent_scans,
      };
    } catch (error) {
      if (error instanceof NfcApiError) {
        externalTagStatus = {
          reachable: false,
          message: error.message,
        };
      } else {
        externalTagStatus = {
          reachable: false,
          message: "Unable to reach NFC status endpoint.",
        };
      }
    }
  }

  return NextResponse.json({
    tag: {
      uid: person.nfc_tag_id,
      status: person.nfc_tag_status,
      deactivation_reason: person.nfc_tag_deactivation_reason,
      last_changed_at: person.nfc_tag_last_changed_at,
    },
    cooldown: {
      enabled: settings.cooldown_enabled,
      days: settings.cooldown_days,
      can_change_now: cooldown.canChangeNow,
      next_allowed_at: cooldown.nextAllowedAt,
      remaining_hours: cooldown.remainingHours,
    },
    external: externalTagStatus,
  });
}
