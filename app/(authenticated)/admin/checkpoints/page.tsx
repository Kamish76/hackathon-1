"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminCheckpointsPage() {
  const [cooldownEnabled, setCooldownEnabled] = useState(true);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      const response = await fetch("/api/admin/nfc-tag-settings", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error || "Failed to load cooldown settings.");
        setIsLoading(false);
        return;
      }

      setCooldownEnabled(Boolean(data.cooldown_enabled));
      setCooldownDays(Number(data.cooldown_days) || 7);
      setMessage("");
      setIsLoading(false);
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/nfc-tag-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cooldown_enabled: cooldownEnabled,
        cooldown_days: cooldownDays,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data?.error || "Failed to save cooldown settings.");
      setIsSaving(false);
      return;
    }

    setMessage("Cooldown settings updated.");
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa]">
      <AdminSidebar activePage="checkpoints" />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-7 h-7 text-[#1e293b]" />
              <h2 className="text-3xl font-bold text-[#0f172a]">Tag Cooldown Settings</h2>
            </div>
            <p className="text-[#64748b]">Control whether members must wait before replacing or re-activating NFC tags.</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 shadow-sm">
            {isLoading ? (
              <p className="text-[#64748b]">Loading settings...</p>
            ) : (
              <div className="space-y-4 max-w-lg">
                <label className="flex items-center gap-2 text-sm text-[#0f172a]">
                  <input
                    type="checkbox"
                    checked={cooldownEnabled}
                    onChange={(event) => setCooldownEnabled(event.target.checked)}
                  />
                  Enable member tag cooldown
                </label>

                <div>
                  <label className="text-xs text-[#64748b] uppercase tracking-wide">Cooldown days</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={cooldownDays}
                    onChange={(event) => setCooldownDays(Number(event.target.value) || 1)}
                    className="mt-1 w-full border border-[#e2e8f0] rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-[#64748b] mt-1">
                    Applies to replacing tags and re-activating after deactivation.
                  </p>
                </div>

                <button
                  type="button"
                  className="text-sm bg-white text-[#1e293b] border border-[#e2e8f0] px-4 py-2 rounded-md"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>

                {message ? <p className="text-sm text-[#64748b]">{message}</p> : null}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}