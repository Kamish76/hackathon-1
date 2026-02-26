"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [pageTitle, setPageTitle] = useState("MEMBER");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  useEffect(() => {
    const loadPersonType = async () => {
      if (!user) {
        setPageTitle("MEMBER");
        return;
      }

      const { data: person } = await supabase
        .from("person_registry")
        .select("person_type")
        .or(`linked_user_id.eq.${user.id},email.eq.${user.email}`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const resolvedTitle = (person?.person_type || "Member").toUpperCase();
      setPageTitle(resolvedTitle);
    };

    void loadPersonType();
  }, [supabase, user]);

  return (
    <>
      <header className="bg-[#1e293b] text-white py-4 shadow">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xl md:text-2xl font-bold">{pageTitle}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded disabled:opacity-70"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm md:text-base">{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </header>
      {children}
    </>
  );
}
