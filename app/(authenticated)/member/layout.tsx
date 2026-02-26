"use client";

import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="bg-[#1e293b] text-white py-4 shadow">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xl md:text-2xl font-bold">{user?.role?.toUpperCase() ?? 'MEMBER'}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm md:text-base">Logout</span>
          </button>
        </div>
      </header>
      {children}
    </>
  );
}
