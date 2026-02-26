'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Calendar, Phone, User, LogOut } from 'lucide-react';

export default function MemberProfile() {
  const memberData = {
    name: 'Jake C',
    birthDate: '01/15/1998',
    contactNumber: '+1 (555) 123-4567',
    studentId: 'STU-2024-001',
    profileImage:
      '/jeyk.png' // replace with your new picture file placed in public/ folder
  };

  const qrCodeValue = JSON.stringify({
    studentId: memberData.studentId,
    name: memberData.name,
    contactNumber: memberData.contactNumber
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center py-12">
      <main className="w-full max-w-4xl px-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left column: two stacked boxes */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Combined profile/details card */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-8 md:p-12 relative flex flex-col items-center">
              {/* Avatar */}
              <div className="absolute -top-14">
                <img
                  src={memberData.profileImage}
                  alt={memberData.name}
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-white shadow-md object-cover"
                />
              </div>
              <div className="pt-16 text-center">
                <h1 className="text-2xl font-semibold text-[#0f172a]">{memberData.name}</h1>
                <p className="text-sm text-[#64748b] mt-1">Student</p>
              </div>
              {/* basic information under header */}
              <div className="mt-8 w-full">
                <div className="space-y-4 text-center md:text-left">
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Full name</p>
                    <p className="text-lg text-[#0f172a] font-medium">{memberData.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Birth date</p>
                    <p className="text-lg text-[#0f172a] font-medium">{memberData.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748b] uppercase tracking-wide">Contact</p>
                    <p className="text-lg text-[#0f172a] font-medium">{memberData.contactNumber}</p>
                  </div>
                </div>
                {/* removed duplicate ID reference */}
              </div>
            </div>
            {/* QR box separate */}
            <div className="bg-white rounded-2xl shadow-lg border border-[#e9eef6] p-8 md:p-12 mt-6 md:mt-8">
              <div className="flex justify-center">
                <div className="bg-[#fafbff] border border-[#eef4ff] rounded-xl p-6 shadow-sm inline-block">
                  <QRCodeSVG value={qrCodeValue} size={220} level="H" includeMargin fgColor="#0f172a" bgColor="#ffffff" />
                </div>
              </div>
              {/* move ID reference & link below QR */}
              <div className="mt-6 text-center">
                <p className="text-xs text-[#64748b]">Reference ID: {memberData.studentId}</p>
                <a href="#" className="text-sm text-[#2563eb] hover:underline">
                  Lost your ID?
                </a>
              </div>
            </div>
          </div>


          {/* Right - Attendance History */}
          <aside className="flex flex-col w-full md:w-1/3">
            <h3 className="text-xl font-semibold text-[#0f172a] mb-4">Attendance History</h3>
            <div className="flex-1 bg-[#fafbff] border border-[#eef4ff] rounded-xl p-4 overflow-auto">
              {/* placeholder entries */}
              <ul className="space-y-2 text-sm text-[#64748b]">
                <li>2026-02-25 08:00 - Entered</li>
                <li>2026-02-25 16:30 - Exited</li>
                <li>2026-02-24 08:05 - Entered</li>
                <li>2026-02-24 16:45 - Exited</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
