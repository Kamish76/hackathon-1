"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [vehicleInfo, setVehicleInfo] = useState({ makeModel: "", plate: "", permit: "N/A" });
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [stats, setStats] = useState({ entriesThisWeek: 0, mostUsedGate: "N/A" });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceEntry[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const getProfileImagePath = (userId: string) => `${userId}/avatar`;

  const setProfileImageFromStorage = async (userId: string) => {
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
  };

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

  useEffect(() => {
    if (!user) {
      return;
    }

    void setProfileImageFromStorage(user.id);

    return () => {
      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
        profileObjectUrlRef.current = null;
      }
    };
  }, [supabase, user, profileImageBucket]);

  useEffect(() => {
    const loadMemberData = async () => {
      if (!user) {
        setPageLoading(false);
        return;
      }

      const { data: person } = await supabase
        .from("person_registry")
        .select("id, person_type, full_name, email, external_identifier, linked_user_id, is_active, birth_date, emergency_contact_name, emergency_contact_phone, emergency_contacts, remarks")
        .or(`linked_user_id.eq.${user.id},email.eq.${user.email}`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

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
          clearance:
            (person.person_type || "").toLowerCase() === "staff"
              ? "Staff"
              : "Student",
        });

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
        setMemberData((prev) => ({ ...prev, name: user.name || user.email || "Member", contactNumber: user.email || "" }));
        setAnnouncements(["No active announcements available."]);
      }

      setPageLoading(false);
    };

    void loadMemberData();
  }, [supabase, user]);

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
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-6">
              <h4 className="font-semibold text-[#1e293b] mb-2">Registered Vehicle</h4>
              <p>{vehicleInfo.makeModel}</p>
              <p><span className="font-semibold">Plate:</span> {vehicleInfo.plate}</p>
              <p><span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Parking Permit: {vehicleInfo.permit}</span></p>
            </div>

            {/* Announcements - span full width */}
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
