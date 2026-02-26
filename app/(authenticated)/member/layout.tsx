"use client";

import { ReactNode, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  return (
    <>
      <header className="bg-[#1e293b] text-white py-4 shadow">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-[#1e293b] flex items-center justify-center font-bold text-sm">
              K
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-wide">KYUBI</span>
          </div>
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
