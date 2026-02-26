
import type { Metadata } from "next";
import "./globals.css";
import { LogOut } from "lucide-react";

export const metadata: Metadata = {
  title: "NFC Access System",
  description: "Member Profile and Access Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#f8f9fa]">
        <header className="bg-[#1e293b] text-white py-4 shadow">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <span className="text-xl md:text-2xl font-bold">STUDENT</span>
            <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded">
              <LogOut className="w-5 h-5" />
              <span className="text-sm md:text-base">Logout</span>
            </button>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
