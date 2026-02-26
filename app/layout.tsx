
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
        {children}
      </body>
    </html>
  );
}
