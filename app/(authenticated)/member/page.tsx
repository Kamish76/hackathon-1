"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AttendanceEntry = {
  date: string;
  time: string;
  action: "Entered" | "Exited";
  location: string;
};

type AccessEventRow = {
  event_timestamp: string | null;
  direction: "IN" | "OUT";
  gate_id: string | null;
  vehicle_session_id: string | null;
};

type GateRow = {
  id: string;
  gate_name: string;
};

type ManifestRow = {
  manifest_name: string;
  scheduled_date: string;
  direction: "IN" | "OUT" | "BOTH";
};

type MemberTagStatusResponse = {
  tag: {
    uid: string | null;
    status: "none" | "active" | "deactivated" | "replaced";
    deactivation_reason: "lost" | "stolen" | "damaged" | "other" | null;
    last_changed_at: string | null;
  };
  cooldown: {
    enabled: boolean;
    days: number;
    can_change_now: boolean;
    next_allowed_at: string | null;
    remaining_hours: number;
  };
  external: {
    reachable: boolean;
    scan_count?: number;
    last_counter?: number;
    last_scanned_at?: string;
    status?: string;
    message?: string;
  } | null;
};

type ScanVerificationResult = {
  status: "first_scan" | "valid" | "skipped_scans" | "clone_detected";
  message: string;
  expected_counter: number;
  received_counter: number;
  scan_count: number;
  uid: string;
};

const normalizePersonTypeLabel = (personType?: string | null) => {
  const normalized = (personType || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "staff") return "Staff";
  if (normalized === "student") return "Student";
  if (normalized === "visitor") return "Visitor";
  if (normalized === "special guest") return "Special Guest";

  return "Student";
};

const createDefaultProfileImage = (name?: string) => {
  const initial = (name?.trim()?.charAt(0) || "M").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="96" fill="#0f172a">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export default function MemberProfile() {
  const { user, isLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileObjectUrlRef = useRef<string | null>(null);
  const defaultProfileImage = useMemo(
    () => createDefaultProfileImage(user?.name || user?.email || "Member"),
    [user?.name, user?.email]
  );
  const profileImageBucket = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_IMAGE_BUCKET || "profile-images";

  const [memberData, setMemberData] = useState({
    name: "",
    birthDate: "",
    contactNumber: "",
    studentId: "",
    profileImage: defaultProfileImage,
  });

  const [idStatus, setIdStatus] = useState({
    account: "ACTIVE",
    validThru: "N/A",
    clearance: "Member",
  });

  const [emergencyInfo, setEmergencyInfo] = useState({
    name: "",
    phone: "",
    contacts: "",
    remarks: "",
  });

  const [personRegistryId, setPersonRegistryId] = useState<string | null>(null);
  const [personTypeLabel, setPersonTypeLabel] = useState("Student");
  const [vehicleInfo, setVehicleInfo] = useState({ makeModel: "", plate: "", permit: "N/A" });
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [stats, setStats] = useState({ entriesThisWeek: 0, mostUsedGate: "N/A" });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceEntry[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [tagStatus, setTagStatus] = useState<MemberTagStatusResponse | null>(null);
  const [tagLoading, setTagLoading] = useState(false);
  const [detectedTagUid, setDetectedTagUid] = useState("");
  const [deactivateReason, setDeactivateReason] = useState<"lost" | "stolen" | "damaged" | "other">("lost");
  const [tagActionLoading, setTagActionLoading] = useState<"set" | "replace" | "deactivate" | null>(null);
  const [tagMessage, setTagMessage] = useState("");
  const [isDetectingTag, setIsDetectingTag] = useState(false);
  const [isVerifyingCounterScan, setIsVerifyingCounterScan] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanVerificationResult | null>(null);
  const [manualCounterInput, setManualCounterInput] = useState("0");
  const [testerUrlValue, setTesterUrlValue] = useState("https://example.com/verify?cnt=0&code=TEST001");
  const [isTesterReading, setIsTesterReading] = useState(false);
  const [isTesterWriting, setIsTesterWriting] = useState(false);
  const [testerReadResult, setTesterReadResult] = useState<{
    serialNumber: string | null;
    recordType: string | null;
    mediaType: string | null;
    payload: string | null;
  } | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const isVehicleTabDisabled = personTypeLabel === "Visitor" || personTypeLabel === "Special Guest";

  const getProfileImagePath = (userId: string) => `${userId}/avatar`;

  const addDebugLog = useCallback((message: string, details?: unknown) => {
    const timestamp = new Date().toISOString();
    const detailText = details
      ? ` | ${typeof details === "string" ? details : JSON.stringify(details)}`
      : "";
    const line = `${timestamp} | ${message}${detailText}`;

    setDebugLogs((prev) => [line, ...prev].slice(0, 40));
    if (details !== undefined) {
      console.log("[MemberTagDebug]", message, details);
    } else {
      console.log("[MemberTagDebug]", message);
    }
  }, []);

  const getNdefReaderCtor = useCallback(() => {
    return (window as unknown as {
      NDEFReader?: new () => {
        scan: () => Promise<void>;
        write?: (message: string | { records: Array<{ recordType: string; data: string }> }) => Promise<void>;
        onreading:
          | ((event: { serialNumber?: string; message?: { records?: Array<{ data?: BufferSource; recordType?: string; mediaType?: string }> } }) => void)
          | null;
        onreadingerror: ((event: unknown) => void) | null;
      };
    }).NDEFReader;
  }, []);

  const decodeRecordPayload = useCallback(
    (record?: { data?: BufferSource; recordType?: string }) => {
      if (!record?.data) {
        return null;
      }

      let bytes: Uint8Array;
      if (record.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(record.data);
      } else if (ArrayBuffer.isView(record.data)) {
        bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
      } else {
        return null;
      }

      if (bytes.length === 0) {
        return null;
      }

      if (record.recordType === "url") {
        const uriPrefixes = [
          "",
          "http://www.",
          "https://www.",
          "http://",
          "https://",
        ];
        const looksLikePrefixCode = bytes[0] <= 0x23;

        if (looksLikePrefixCode) {
          const prefix = uriPrefixes[bytes[0]] ?? "";
          const suffix = new TextDecoder().decode(bytes.slice(1));
          return `${prefix}${suffix}`;
        }
      }

      return new TextDecoder().decode(bytes);
    },
    []
  );

  const setProfileImageFromStorage = useCallback(async (userId: string) => {
    const { data, error } = await supabase.storage
      .from(profileImageBucket)
      .download(getProfileImagePath(userId));

    if (error || !data) {
      setMemberData((prev) => ({ ...prev, profileImage: createDefaultProfileImage(prev.name || user?.name) }));
      return;
    }

    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
      profileObjectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(data);
    profileObjectUrlRef.current = objectUrl;
    setMemberData((prev) => ({ ...prev, profileImage: objectUrl }));
  }, [profileImageBucket, supabase, user?.name]);

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      return;
    }

    if (!user) {
      event.target.value = "";
      return;
    }

    setProfileImageLoading(true);

    await supabase.storage
      .from(profileImageBucket)
      .upload(getProfileImagePath(user.id), file, {
        upsert: true,
        contentType: file.type,
      });

    await setProfileImageFromStorage(user.id);

    event.target.value = "";
    setProfileImageLoading(false);
  };

  const handleRemoveProfileImage = async () => {
    if (!user) {
      return;
    }

    setProfileImageLoading(true);

    await supabase.storage
      .from(profileImageBucket)
      .remove([getProfileImagePath(user.id)]);

    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
      profileObjectUrlRef.current = null;
    }

    setMemberData((prev) => ({ ...prev, profileImage: defaultProfileImage }));
    setProfileImageLoading(false);
  };

  const handleSaveAdditionalInfo = async () => {
    if (!user) {
      setSaveMessage("Unable to save: user not authenticated.");
      return;
    }

    setIsSavingProfile(true);
    setSaveMessage("");

    const profilePayload = {
      birth_date: memberData.birthDate || null,
      emergency_contact_name: emergencyInfo.name || null,
      emergency_contact_phone: emergencyInfo.phone || null,
      emergency_contacts: emergencyInfo.contacts || null,
      remarks: emergencyInfo.remarks || null,
    };

    let currentPersonRegistryId = personRegistryId;

    if (!currentPersonRegistryId) {
      const { data: insertedPerson, error: insertError } = await supabase
        .from("person_registry")
        .insert({
          linked_user_id: user.id,
          person_type: "Student",
          full_name: memberData.name || user.name || user.email || "Member",
          email: user.email || null,
          is_active: true,
          ...profilePayload,
        })
        .select("id")
        .single();

      if (insertError || !insertedPerson?.id) {
        const errorText = insertError?.message || "Please try again.";
        if (errorText.includes("schema cache") || errorText.includes("column")) {
          setSaveMessage("Failed to save profile details: database columns are missing. Run docs/database/PATCH_person_registry_additional_fields.sql in Supabase SQL Editor.");
        } else {
          setSaveMessage(`Failed to save profile details. ${errorText}`);
        }
        setIsSavingProfile(false);
        return;
      }

      currentPersonRegistryId = insertedPerson.id;
      setPersonRegistryId(insertedPerson.id);
    } else {
      const { error: updateError } = await supabase
        .from("person_registry")
        .update(profilePayload)
        .eq("id", currentPersonRegistryId);

      if (updateError) {
        if (updateError.message.includes("schema cache") || updateError.message.includes("column")) {
          setSaveMessage("Failed to save profile details: database columns are missing. Run docs/database/PATCH_person_registry_additional_fields.sql in Supabase SQL Editor.");
        } else {
          setSaveMessage(`Failed to save profile details. ${updateError.message}`);
        }
        setIsSavingProfile(false);
        return;
      }
    }

    setSaveMessage("Profile details saved.");
    setIsEditMode(false);

    setIsSavingProfile(false);
  };

  const loadTagStatus = useCallback(async () => {
    setTagLoading(true);
    addDebugLog("loadTagStatus:start");
    const response = await fetch("/api/member/tag", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      setTagMessage(result?.error || "Failed to load tag status.");
      setTagStatus(null);
      addDebugLog("loadTagStatus:error", { status: response.status, result });
      setTagLoading(false);
      return;
    }

    setTagStatus(result as MemberTagStatusResponse);
    setTagMessage("");
    addDebugLog("loadTagStatus:success", {
      status: response.status,
      tag: result?.tag,
      cooldown: result?.cooldown,
    });
    setTagLoading(false);
  }, [addDebugLog]);

  const submitCounterScan = useCallback(
    async (uid: string | undefined, counter: number) => {
      const response = await fetch("/api/member/tag/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          counter,
        }),
      });

      const result = await response.json();

      if (!response.ok && response.status !== 409) {
        setTagMessage(result?.error || "Counter scan verification failed.");
        addDebugLog("verifyCounterScan:api-error", { status: response.status, result });
        return;
      }

      setLastScanResult(result as ScanVerificationResult);
      setTagMessage(result?.message || "Scan verified.");
      addDebugLog("verifyCounterScan:api-success", { status: response.status, result });
      await loadTagStatus();
    },
    [addDebugLog, loadTagStatus]
  );

  const runTagAction = useCallback(
    async (action: "set" | "replace" | "deactivate") => {
      setTagActionLoading(action);
      addDebugLog("runTagAction:start", { action, detectedTagUid });

      const endpoint =
        action === "set"
          ? "/api/member/tag/set"
          : action === "replace"
            ? "/api/member/tag/replace"
            : "/api/member/tag/deactivate";

      const payload =
        action === "deactivate"
          ? { reason: deactivateReason }
          : action === "replace"
            ? { new_uid: detectedTagUid }
            : { uid: detectedTagUid };

      const response = await fetch(endpoint, {
        method: action === "set" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        const cooldownHint = result?.next_allowed_at
          ? ` Next change allowed at ${new Date(result.next_allowed_at).toLocaleString()}.`
          : "";
        setTagMessage((result?.error || "Tag action failed.") + cooldownHint);
        addDebugLog("runTagAction:error", { action, status: response.status, result });
        setTagActionLoading(null);
        return;
      }

      setTagMessage(result?.message || "Tag updated.");
      addDebugLog("runTagAction:success", { action, status: response.status, result });
      if (action !== "deactivate") {
        setDetectedTagUid("");
      }
      await loadTagStatus();
      setTagActionLoading(null);
    },
    [addDebugLog, deactivateReason, detectedTagUid, loadTagStatus]
  );

  const detectTagUidAutomatically = useCallback(async () => {
    const ndefCtor = getNdefReaderCtor();

    if (!ndefCtor) {
      setTagMessage("Web NFC is not supported on this browser/device.");
      addDebugLog("detectTagUidAutomatically:unsupported");
      return;
    }

    setIsDetectingTag(true);
    setTagMessage("Tap the tag to read its UID automatically.");
    addDebugLog("detectTagUidAutomatically:start");

    try {
      const ndef = new ndefCtor();
      await ndef.scan();

      ndef.onreading = (event) => {
        if (!event.serialNumber) {
          setTagMessage("Unable to read tag UID. Try another tap.");
          addDebugLog("detectTagUidAutomatically:no-serial");
          setIsDetectingTag(false);
          return;
        }

        setDetectedTagUid(event.serialNumber);
        setTagMessage(`Tag detected: ${event.serialNumber}`);
        addDebugLog("detectTagUidAutomatically:success", { serialNumber: event.serialNumber });
        setIsDetectingTag(false);
      };

      ndef.onreadingerror = () => {
        setTagMessage("Tag read error. Please tap again.");
        addDebugLog("detectTagUidAutomatically:read-error");
        setIsDetectingTag(false);
      };
    } catch {
      setTagMessage("Unable to start NFC scanner. Allow NFC permission and try again.");
      addDebugLog("detectTagUidAutomatically:scan-start-error");
      setIsDetectingTag(false);
    }
  }, [addDebugLog, getNdefReaderCtor]);

  const verifyCounterScan = useCallback(async () => {
    const ndefCtor = getNdefReaderCtor();

    if (!ndefCtor) {
      setTagMessage("Web NFC is not supported on this browser/device.");
      addDebugLog("verifyCounterScan:unsupported");
      return;
    }

    setIsVerifyingCounterScan(true);
    setTagMessage("Tap the tag to verify counter and scan status.");
    addDebugLog("verifyCounterScan:start");

    try {
      const ndef = new ndefCtor();
      await ndef.scan();

      ndef.onreading = async (event) => {
        try {
          const firstRecord = event.message?.records?.[0];
          const payload = decodeRecordPayload(firstRecord);
          const counterRaw = payload ? new URL(payload).searchParams.get("cnt") : null;
          let counter = Number(counterRaw);

          if (!Number.isInteger(counter) || counter < 0) {
            const manualCounter = Number(manualCounterInput);
            if (Number.isInteger(manualCounter) && manualCounter >= 0) {
              counter = manualCounter;
              addDebugLog("verifyCounterScan:manual-counter-fallback", {
                payload,
                counter,
              });
            } else {
              setTagMessage("Counter mirror (cnt) missing. Use tester read/write or provide manual counter.");
              addDebugLog("verifyCounterScan:invalid-counter", {
                payload,
                counterRaw,
                manualCounterInput,
              });
              setIsVerifyingCounterScan(false);
              return;
            }
          }

          addDebugLog("verifyCounterScan:payload-parsed", {
            serialNumber: event.serialNumber,
            counter,
            payload,
            recordType: firstRecord?.recordType,
          });

          await submitCounterScan(event.serialNumber || undefined, counter);
        } catch {
          setTagMessage("Unable to process scanned payload.");
          addDebugLog("verifyCounterScan:processing-error");
        } finally {
          setIsVerifyingCounterScan(false);
        }
      };

      ndef.onreadingerror = () => {
        setTagMessage("Tag read error. Please tap again.");
        addDebugLog("verifyCounterScan:read-error");
        setIsVerifyingCounterScan(false);
      };
    } catch {
      setTagMessage("Unable to start NFC scan verification. Allow NFC permission and try again.");
      addDebugLog("verifyCounterScan:scan-start-error");
      setIsVerifyingCounterScan(false);
    }
  }, [addDebugLog, decodeRecordPayload, getNdefReaderCtor, manualCounterInput, submitCounterScan]);

  const runTesterRead = useCallback(async () => {
    const ndefCtor = getNdefReaderCtor();

    if (!ndefCtor) {
      setTagMessage("Web NFC is not supported on this browser/device.");
      addDebugLog("runTesterRead:unsupported");
      return;
    }

    setIsTesterReading(true);
    setTagMessage("Tester read started. Tap a tag now.");
    addDebugLog("runTesterRead:start");

    try {
      const ndef = new ndefCtor();
      await ndef.scan();

      ndef.onreading = (event) => {
        const firstRecord = event.message?.records?.[0];
        const payload = decodeRecordPayload(firstRecord);

        const readResult = {
          serialNumber: event.serialNumber || null,
          recordType: firstRecord?.recordType || null,
          mediaType: firstRecord?.mediaType || null,
          payload,
        };

        setTesterReadResult(readResult);
        addDebugLog("runTesterRead:success", readResult);
        setTagMessage("Tester read success.");
        setIsTesterReading(false);
      };

      ndef.onreadingerror = () => {
        setTagMessage("Tester read error. Try again.");
        addDebugLog("runTesterRead:error");
        setIsTesterReading(false);
      };
    } catch {
      setTagMessage("Unable to start tester read.");
      addDebugLog("runTesterRead:scan-start-error");
      setIsTesterReading(false);
    }
  }, [addDebugLog, decodeRecordPayload, getNdefReaderCtor]);

  const runTesterWrite = useCallback(async () => {
    const ndefCtor = getNdefReaderCtor();

    if (!ndefCtor) {
      setTagMessage("Web NFC is not supported on this browser/device.");
      addDebugLog("runTesterWrite:unsupported");
      return;
    }

    setIsTesterWriting(true);
    setTagMessage("Tester write started. Tap a writable tag now.");
    addDebugLog("runTesterWrite:start", { testerUrlValue });

    try {
      const formatError = (error: unknown) => {
        if (error instanceof Error) {
          return `${error.name}: ${error.message}`;
        }
        return String(error);
      };

      const ndef = new ndefCtor();
      if (!ndef.write) {
        setTagMessage("Web NFC write is not supported on this browser/device.");
        addDebugLog("runTesterWrite:no-write-method");
        setIsTesterWriting(false);
        return;
      }

      const writeAttempts: Array<{ mode: "string" | "url-record"; payload: string | { records: Array<{ recordType: string; data: string }> } }> = [
        { mode: "string", payload: testerUrlValue },
        { mode: "url-record", payload: { records: [{ recordType: "url", data: testerUrlValue }] } },
      ];

      let appliedMode: "string" | "url-record" | null = null;
      let lastWriteError: unknown = null;

      for (const attempt of writeAttempts) {
        try {
          await ndef.write(attempt.payload);
          appliedMode = attempt.mode;
          break;
        } catch (error) {
          lastWriteError = error;
          addDebugLog("runTesterWrite:attempt-failed", {
            mode: attempt.mode,
            error: formatError(error),
          });
        }
      }

      if (!appliedMode) {
        throw lastWriteError ?? new Error("No write mode succeeded.");
      }

      setTagMessage("Tester write command sent. Tap the same tag again to verify payload.");
      addDebugLog("runTesterWrite:success", { testerUrlValue, mode: appliedMode });

      setIsTesterReading(true);
      const verifyReader = new ndefCtor();
      await verifyReader.scan();

      verifyReader.onreading = (event) => {
        const firstRecord = event.message?.records?.[0];
        const payload = decodeRecordPayload(firstRecord);

        const readResult = {
          serialNumber: event.serialNumber || null,
          recordType: firstRecord?.recordType || null,
          mediaType: firstRecord?.mediaType || null,
          payload,
        };

        setTesterReadResult(readResult);
        setTagMessage("Tester write verified by read.");
        addDebugLog("runTesterWrite:verify-success", {
          mode: appliedMode,
          serialNumber: event.serialNumber,
          payload,
        });
        setIsTesterReading(false);
      };

      verifyReader.onreadingerror = (error) => {
        setTagMessage("Tester write sent, but verification read failed. Use Tester Read to confirm.");
        addDebugLog("runTesterWrite:verify-read-error", {
          mode: appliedMode,
          error: formatError(error),
        });
        setIsTesterReading(false);
      };

      window.setTimeout(() => {
        setIsTesterReading((prev) => {
          if (!prev) {
            return prev;
          }

          setTagMessage("Verification timed out. Tap Tester Read to confirm written payload.");
          addDebugLog("runTesterWrite:verify-timeout", { mode: appliedMode });
          return false;
        });
      }, 15000);

      setIsTesterWriting(false);
    } catch (error) {
      setTagMessage("Tester write failed. Tag may be read-only, locked, or browser denied write.");
      addDebugLog("runTesterWrite:error", {
        testerUrlValue,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
      setIsTesterReading(false);
      setIsTesterWriting(false);
    }
  }, [addDebugLog, decodeRecordPayload, getNdefReaderCtor, testerUrlValue]);

  useEffect(() => {
    if (!user) {
      return;
    }

    queueMicrotask(() => {
      void setProfileImageFromStorage(user.id);
    });

    return () => {
      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
        profileObjectUrlRef.current = null;
      }
    };
  }, [setProfileImageFromStorage, user]);

  useEffect(() => {
    const loadMemberData = async () => {
      if (!user) {
        setPageLoading(false);
        return;
      }

      const { data: primaryPerson } = await supabase
        .from("person_registry")
        .select("id, person_type, full_name, email, external_identifier, linked_user_id, is_active, birth_date, emergency_contact_name, emergency_contact_phone, emergency_contacts, remarks")
        .or(`linked_user_id.eq.${user.id},email.eq.${user.email}`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      let person = primaryPerson;

      if (!person && user.name) {
        const { data: fallbackPerson } = await supabase
          .from("person_registry")
          .select("id, person_type, full_name, email, external_identifier, linked_user_id, is_active, birth_date, emergency_contact_name, emergency_contact_phone, emergency_contacts, remarks")
          .eq("full_name", user.name)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        person = fallbackPerson;
      }

      if (person) {
        setPersonRegistryId(person.id);
        setMemberData((prev) => ({
          ...prev,
          name: person.full_name || user.name || "Member",
          birthDate: person.birth_date || "",
          contactNumber: person.email || user.email || "",
          studentId: person.external_identifier || person.id,
        }));

        setIdStatus({
          account: person.is_active ? "ACTIVE" : "INACTIVE",
          validThru: "N/A",
          clearance: normalizePersonTypeLabel(person.person_type),
        });
        setPersonTypeLabel(normalizePersonTypeLabel(person.person_type));

        setEmergencyInfo({
          name: person.emergency_contact_name || "",
          phone: person.emergency_contact_phone || "",
          contacts: person.emergency_contacts || "",
          remarks: person.remarks || "",
        });

        const { data: events } = await supabase
          .from("access_events")
          .select("event_timestamp, direction, gate_id, vehicle_session_id")
          .eq("person_id", person.id)
          .order("event_timestamp", { ascending: false })
          .limit(20);

        let gateMap: Record<string, string> = {};
        const gateIds = [...new Set(((events || []) as AccessEventRow[]).map((event: AccessEventRow) => event.gate_id).filter(Boolean))] as string[];
        if (gateIds.length > 0) {
          const { data: gates } = await supabase
            .from("gates")
            .select("id, gate_name")
            .in("id", gateIds);

          gateMap = ((gates || []) as GateRow[]).reduce((acc: Record<string, string>, gate: GateRow) => {
            acc[gate.id] = gate.gate_name;
            return acc;
          }, {} as Record<string, string>);
        }

        if (events && events.length > 0) {
          const mappedHistory: AttendanceEntry[] = (events as AccessEventRow[]).map((event: AccessEventRow) => {
            const timestamp = event.event_timestamp ? new Date(event.event_timestamp) : null;
            const date = timestamp ? timestamp.toISOString().slice(0, 10) : "";
            const time = timestamp
              ? timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
              : "";

            return {
              date,
              time,
              action: event.direction === "IN" ? "Entered" : "Exited",
              location: (event.gate_id ? gateMap[event.gate_id] : undefined) || "Unknown Gate",
            };
          });

          setAttendanceHistory(mappedHistory);

          const weekStart = new Date();
          weekStart.setHours(0, 0, 0, 0);
          weekStart.setDate(weekStart.getDate() - 7);

          const entriesThisWeek = (events as AccessEventRow[]).filter(
            (event: AccessEventRow) => event.direction === "IN" && event.event_timestamp && new Date(event.event_timestamp) >= weekStart
          ).length;

          const gateCounts = mappedHistory.reduce((acc, entry) => {
            acc[entry.location] = (acc[entry.location] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const mostUsedGate =
            Object.entries(gateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

          setStats({ entriesThisWeek, mostUsedGate });

          const latestVehicleSessionId = (events as AccessEventRow[]).find((event: AccessEventRow) => event.vehicle_session_id)?.vehicle_session_id;
          if (latestVehicleSessionId) {
            const { data: session } = await supabase
              .from("vehicle_sessions")
              .select("vehicle_id")
              .eq("id", latestVehicleSessionId)
              .maybeSingle();

            if (session?.vehicle_id) {
              const { data: vehicle } = await supabase
                .from("vehicle_registry")
                .select("plate_number, vehicle_type, is_active")
                .eq("id", session.vehicle_id)
                .maybeSingle();

              if (vehicle) {
                setVehicleInfo({
                  makeModel: vehicle.vehicle_type || "Unknown",
                  plate: vehicle.plate_number || "N/A",
                  permit: vehicle.is_active ? "Active" : "Inactive",
                });
              }
            }
          }
        }

        const today = new Date().toISOString().slice(0, 10);
        const { data: manifests } = await supabase
          .from("manifests")
          .select("manifest_name, scheduled_date, direction")
          .in("status", ["ACTIVE", "DRAFT"])
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(3);

        if (manifests && manifests.length > 0) {
          setAnnouncements(
            (manifests as ManifestRow[]).map(
              (manifest: ManifestRow) => `${manifest.manifest_name} - ${manifest.direction} (${manifest.scheduled_date})`
            )
          );
        } else {
          setAnnouncements(["No active announcements available."]);
        }
      } else {
        setPersonRegistryId(null);
        setPersonTypeLabel("Student");
        setIdStatus((prev) => ({ ...prev, clearance: "Student" }));
        setMemberData((prev) => ({ ...prev, name: user.name || user.email || "Member", contactNumber: user.email || "" }));
        setAnnouncements(["No active announcements available."]);
      }

      setPageLoading(false);
    };

    void loadMemberData();
  }, [supabase, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadTagStatus();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadTagStatus, user]);

  if (isLoading || pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#e2e8f0] border-t-[#1e293b] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748b]">Loading...</p>
        </div>
      </div>
    );
  }

  const qrCodeValue = memberData.studentId ? `REFERENCE_ID:${memberData.studentId}` : "REFERENCE_ID:UNAVAILABLE";
  const effectiveTagStatus: MemberTagStatusResponse =
    tagStatus ?? {
      tag: {
        uid: null,
        status: "none",
        deactivation_reason: null,
        last_changed_at: null,
      },
      cooldown: {
        enabled: true,
        days: 7,
        can_change_now: true,
        next_allowed_at: null,
        remaining_hours: 0,
      },
      external: null,
    };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center py-12">
      <main className="w-full max-w-4xl px-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left column: status, profile, QR, stats */}
          <div className="flex-1 flex flex-col gap-6">
            {/* ID status banner */}
            <div className="bg-green-500 text-white rounded-xl p-4 flex justify-between items-center">
              <span className="font-semibold">STATUS: {idStatus.account}</span>
              <span>Valid Thru: {idStatus.validThru}</span>
              <span className="text-sm italic">{idStatus.clearance}</span>
            </div>
            {/* Combined profile/details card */}
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-[#1e293b] p-8 md:p-12 flex flex-col items-center">
              {/* Avatar */}
              <div>
                <img
                  src={memberData.profileImage}
                  alt={memberData.name}
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-[#1e293b] shadow-md object-cover"
                />
              </div>
              <div className="pt-4 text-center">
                <h1 className="text-2xl font-semibold text-[#0f172a]">{memberData.name}</h1>
                <p className="text-sm text-[#64748b] mt-1">{idStatus.clearance}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfileImageChange}
                />
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={profileImageLoading}
                  >
                    {profileImageLoading ? "Saving..." : "Change Photo"}
                  </button>
                  <button
                    type="button"
                    className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                    onClick={handleRemoveProfileImage}
                    disabled={profileImageLoading}
                  >
                    Remove Photo
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {!isEditMode ? (
                    <button
                      type="button"
                      className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                      onClick={() => {
                        setSaveMessage("");
                        setIsEditMode(true);
                      }}
                    >
                      Edit Details
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                        onClick={handleSaveAdditionalInfo}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                        onClick={() => {
                          setIsEditMode(false);
                          setSaveMessage("");
                        }}
                        disabled={isSavingProfile}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                {saveMessage ? (
                  <p className="mt-2 text-xs text-[#64748b]">{saveMessage}</p>
                ) : null}
              </div>
              {/* basic information under header */}
              <div className="mt-8 w-full">
                <div className="space-y-4 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <User className="w-4 h-4 text-[#1e293b]" />
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Full name</p>
                  </div>
                  <p className="ml-6 text-lg text-[#0f172a] font-medium">{memberData.name}</p>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Calendar className="w-4 h-4 text-[#1e293b]" />
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Birth date</p>
                  </div>
                  {isEditMode ? (
                    <div className="ml-6">
                      <input
                        type="date"
                        value={memberData.birthDate}
                        onChange={(event) => setMemberData((prev) => ({ ...prev, birthDate: event.target.value }))}
                        className="text-sm border border-[#e2e8f0] rounded px-2 py-1"
                      />
                    </div>
                  ) : (
                    <p className="ml-6 text-lg text-[#0f172a] font-medium">{memberData.birthDate || "Not set"}</p>
                  )}
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Phone className="w-4 h-4 text-[#1e293b]" />
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Contact</p>
                  </div>
                  <p className="ml-6 text-lg text-[#0f172a] font-medium">{memberData.contactNumber}</p>
                </div>
                {/* removed duplicate ID reference */}
              </div>
            </div>
            {/* QR box separate */}
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-[#1e293b] p-8 md:p-12 mt-6 md:mt-8">
              <div className="flex justify-center">
                <div className="bg-[#fafbff] border border-[#eef4ff] rounded-xl p-6 shadow-sm inline-block">
                  <QRCodeSVG value={qrCodeValue} size={220} level="H" includeMargin fgColor="#0f172a" bgColor="#ffffff" />
                </div>
              </div>
              {/* move ID reference & link below QR */}
              <div className="mt-6 text-center">
                <p className="text-xs text-[#64748b]">Reference ID: {memberData.studentId}</p>
                <a href="#" className="text-sm text-[#1e293b] hover:underline">
                  Lost your ID?
                </a>
              </div>
              <p className="mt-4 text-sm text-[#64748b] text-center">Scan at entry point</p>
            </div>
            {/* Quick stats row */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-4 flex justify-around text-sm">
              <div>
                <span className="font-semibold">Entries This Week:</span> {stats.entriesThisWeek}
              </div>
              <div>
                <span className="font-semibold">Most Used Gate:</span> {stats.mostUsedGate}
              </div>
            </div>
          </div>


          {/* Right column grid: emergency, vehicle, announcements, logs */}
          <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Emergency Info card */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-6">
              <h4 className="font-semibold text-[#1e293b] mb-2">Emergency Info</h4>
              {isEditMode ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Primary contact name</p>
                    <input
                      type="text"
                      value={emergencyInfo.name}
                      onChange={(event) => setEmergencyInfo((prev) => ({ ...prev, name: event.target.value }))}
                      className="mt-1 w-full border border-[#e2e8f0] rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Primary contact phone</p>
                    <input
                      type="text"
                      value={emergencyInfo.phone}
                      onChange={(event) => setEmergencyInfo((prev) => ({ ...prev, phone: event.target.value }))}
                      className="mt-1 w-full border border-[#e2e8f0] rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Other emergency contacts</p>
                    <textarea
                      value={emergencyInfo.contacts}
                      onChange={(event) => setEmergencyInfo((prev) => ({ ...prev, contacts: event.target.value }))}
                      className="mt-1 w-full border border-[#e2e8f0] rounded px-2 py-1 text-sm"
                      rows={3}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Remarks</p>
                    <textarea
                      value={emergencyInfo.remarks}
                      onChange={(event) => setEmergencyInfo((prev) => ({ ...prev, remarks: event.target.value }))}
                      className="mt-1 w-full border border-[#e2e8f0] rounded px-2 py-1 text-sm"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p><span className="font-semibold">Contact:</span> {emergencyInfo.name || "Not set"}</p>
                  <p><span className="font-semibold">Phone:</span> {emergencyInfo.phone || "Not set"}</p>
                  <p><span className="font-semibold">Other Contacts:</span> {emergencyInfo.contacts || "Not set"}</p>
                  <p><span className="font-semibold">Remarks:</span> {emergencyInfo.remarks || "Not set"}</p>
                </>
              )}
            </div>

            {/* Vehicle Info card */}
            <div className={`rounded-2xl shadow-lg border p-6 ${isVehicleTabDisabled ? "bg-[#f1f5f9] border-[#dbe2ea] text-[#94a3b8]" : "bg-white border-[#e9eef6]"}`}>
              <h4 className="font-semibold text-[#1e293b] mb-2">Registered Vehicle</h4>
              {isVehicleTabDisabled ? (
                <p className="text-sm">Not available for {personTypeLabel}.</p>
              ) : (
                <>
                  <p>{vehicleInfo.makeModel}</p>
                  <p><span className="font-semibold">Plate:</span> {vehicleInfo.plate}</p>
                  <p><span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Parking Permit: {vehicleInfo.permit}</span></p>
                </>
              )}
            </div>

            {/* Announcements - span full width */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-6 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-[#1e293b]">Tag Management</h4>
                <button
                  type="button"
                  className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                  onClick={loadTagStatus}
                  disabled={tagLoading || tagActionLoading !== null}
                >
                  {tagLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="space-y-3 text-sm">
                  <p>
                    <span className="font-semibold">Current UID:</span> {effectiveTagStatus.tag.uid || "Not linked"}
                  </p>
                  <p>
                    <span className="font-semibold">Status:</span> {effectiveTagStatus.tag.status}
                  </p>
                  <p>
                    <span className="font-semibold">Last change:</span>{" "}
                    {effectiveTagStatus.tag.last_changed_at ? new Date(effectiveTagStatus.tag.last_changed_at).toLocaleString() : "N/A"}
                  </p>
                  {effectiveTagStatus.tag.deactivation_reason ? (
                    <p>
                      <span className="font-semibold">Deactivation reason:</span> {effectiveTagStatus.tag.deactivation_reason}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-semibold">Cooldown:</span>{" "}
                    {effectiveTagStatus.cooldown.enabled
                      ? effectiveTagStatus.cooldown.can_change_now
                        ? `Enabled (${effectiveTagStatus.cooldown.days} days) - available now`
                        : `Enabled (${effectiveTagStatus.cooldown.days} days) - ${effectiveTagStatus.cooldown.remaining_hours} hour(s) remaining`
                      : "Disabled"}
                  </p>
                  {effectiveTagStatus.external ? (
                    <p>
                      <span className="font-semibold">External API status:</span>{" "}
                      {effectiveTagStatus.external.reachable
                        ? `reachable${typeof effectiveTagStatus.external.scan_count === "number" ? `, scans: ${effectiveTagStatus.external.scan_count}` : ""}`
                        : `unreachable (${effectiveTagStatus.external.message || "unknown error"})`}
                    </p>
                  ) : null}

                  <div className="pt-2 border-t border-[#e2e8f0] space-y-2">
                    <label className="text-xs text-[#64748b] uppercase tracking-wide">Detected tag UID (automatic)</label>
                    <div className="w-full border border-[#e2e8f0] rounded px-3 py-2 text-sm bg-[#f8fafc]">
                      {detectedTagUid || "No tag detected yet"}
                    </div>
                    <button
                      type="button"
                      className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                      onClick={() => void detectTagUidAutomatically()}
                      disabled={isDetectingTag || tagActionLoading !== null || isVerifyingCounterScan}
                    >
                      {isDetectingTag ? "Waiting for tag tap..." : "Detect Tag UID Automatically"}
                    </button>
                    <p className="text-xs text-[#64748b]">
                      New tag registration starts at scan counter baseline 0 in the NFC API.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                        onClick={() => void runTagAction("set")}
                        disabled={tagActionLoading !== null || !detectedTagUid.trim() || isDetectingTag}
                      >
                        {tagActionLoading === "set" ? "Saving..." : effectiveTagStatus.tag.status === "none" ? "Set Tag" : "Re-activate with New Tag"}
                      </button>
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                        onClick={() => void runTagAction("replace")}
                        disabled={tagActionLoading !== null || !detectedTagUid.trim() || effectiveTagStatus.tag.status !== "active" || isDetectingTag}
                      >
                        {tagActionLoading === "replace" ? "Replacing..." : "Replace Tag"}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                      onClick={() => void verifyCounterScan()}
                      disabled={isVerifyingCounterScan || tagActionLoading !== null}
                    >
                      {isVerifyingCounterScan ? "Waiting for scan tap..." : "Verify Counter Scan via API"}
                    </button>

                    <div>
                      <label className="text-xs text-[#64748b] uppercase tracking-wide">Manual counter fallback</label>
                      <input
                        type="number"
                        min={0}
                        value={manualCounterInput}
                        onChange={(event) => setManualCounterInput(event.target.value)}
                        className="mt-1 w-full border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                      />
                    </div>

                    {lastScanResult ? (
                      <div className="text-xs text-[#64748b] space-y-1 border border-[#e2e8f0] rounded p-2">
                        <p><span className="font-semibold">Last scan status:</span> {lastScanResult.status}</p>
                        <p><span className="font-semibold">Expected/Received:</span> {lastScanResult.expected_counter} / {lastScanResult.received_counter}</p>
                        <p><span className="font-semibold">Total scans:</span> {lastScanResult.scan_count}</p>
                      </div>
                    ) : null}

                    <div className="pt-2 border-t border-[#e2e8f0] space-y-2">
                      <label className="text-xs text-[#64748b] uppercase tracking-wide">NFC tester URL payload</label>
                      <input
                        type="text"
                        value={testerUrlValue}
                        onChange={(event) => setTesterUrlValue(event.target.value)}
                        className="w-full border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                          onClick={() => void runTesterRead()}
                          disabled={isTesterReading || isTesterWriting}
                        >
                          {isTesterReading ? "Tester reading..." : "Tester Read Tag"}
                        </button>
                        <button
                          type="button"
                          className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                          onClick={() => void runTesterWrite()}
                          disabled={isTesterWriting || isTesterReading || !testerUrlValue.trim()}
                        >
                          {isTesterWriting ? "Tester writing..." : "Tester Write Tag"}
                        </button>
                      </div>
                      {testerReadResult ? (
                        <div className="text-xs text-[#64748b] space-y-1 border border-[#e2e8f0] rounded p-2">
                          <p><span className="font-semibold">Serial:</span> {testerReadResult.serialNumber || "N/A"}</p>
                          <p><span className="font-semibold">Record type:</span> {testerReadResult.recordType || "N/A"}</p>
                          <p><span className="font-semibold">Media type:</span> {testerReadResult.mediaType || "N/A"}</p>
                          <p><span className="font-semibold">Payload:</span> {testerReadResult.payload || "N/A"}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-2 border-t border-[#e2e8f0] space-y-2">
                      <label className="text-xs text-[#64748b] uppercase tracking-wide">Deactivate reason</label>
                      <select
                        value={deactivateReason}
                        onChange={(event) =>
                          setDeactivateReason(event.target.value as "lost" | "stolen" | "damaged" | "other")
                        }
                        className="w-full border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                      >
                        <option value="lost">lost</option>
                        <option value="stolen">stolen</option>
                        <option value="damaged">damaged</option>
                        <option value="other">other</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-3 py-1 rounded-md"
                        onClick={() => void runTagAction("deactivate")}
                        disabled={tagActionLoading !== null || effectiveTagStatus.tag.status !== "active"}
                      >
                        {tagActionLoading === "deactivate" ? "Deactivating..." : "Deactivate Tag"}
                      </button>
                    </div>
                  </div>

                  {tagMessage ? <p className="text-xs text-[#64748b]">{tagMessage}</p> : null}

                  <div className="pt-2 border-t border-[#e2e8f0] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#64748b] uppercase tracking-wide">Debug Logs (temporary)</label>
                      <button
                        type="button"
                        className="text-xs bg-white text-[#1e293b] border border-[#e2e8f0] px-2 py-1 rounded-md"
                        onClick={() => setDebugLogs([])}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="max-h-40 overflow-auto border border-[#e2e8f0] rounded p-2 bg-[#f8fafc] text-xs text-[#334155]">
                      {debugLogs.length === 0 ? (
                        <p>No logs yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {debugLogs.map((line, index) => (
                            <li key={`${line}-${index}`} className="wrap-break-word">{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-6 md:col-span-2">
              <h4 className="font-semibold text-[#1e293b] mb-2">Security Announcements</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {announcements.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>

            {/* Access Logs card */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-6 md:col-span-2">
              <h4 className="font-semibold text-[#1e293b] mb-2">Access Logs</h4>
              {/* tabs placeholder */}
              <div className="flex gap-2 mb-4">
                <button className="text-xs px-2 py-1 bg-[#f1f5f9] rounded">Today</button>
                <button className="text-xs px-2 py-1 bg-[#f1f5f9] rounded">This Week</button>
                <button className="text-xs px-2 py-1 bg-[#f1f5f9] rounded">All Time</button>
              </div>
              <div className="h-48 overflow-auto">
                <ul className="divide-y divide-[#e2e8f0] text-sm text-[#0f172a]">
                  {attendanceHistory.map((entry, idx) => (
                    <li
                      key={idx}
                      className="py-2 flex flex-col"
                    >
                      <span className="font-semibold">{entry.date} {entry.time}</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            entry.action === 'Entered' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span
                          className={
                            entry.action === 'Entered' ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {entry.action}
                        </span>
                      </span>
                      <span className="text-xs text-[#64748b]">{entry.location}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>  
  );
}
