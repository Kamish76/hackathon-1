'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Calendar, Phone, User, LogOut } from 'lucide-react';

export default function MemberProfile() {
  const accentColor = '#1e293b';

  const memberData = {
    name: 'Jake C',
    birthDate: '01/15/1998',
    contactNumber: '+1 (555) 123-4567',
    studentId: 'STU-2024-001',
    profileImage:
      '/jeyk.png' // replace with your new picture file placed in public/ folder
  };

  const idStatus = {
    account: 'ACTIVE',
    validThru: 'Dec 2026',
    clearance: 'Undergraduate'
  };

  const emergencyInfo = {
    name: 'Mary C',
    phone: '+1 (555) 765-4321',
    bloodType: 'O+',
    allergies: 'Peanuts'
  };

  const vehicleInfo = {
    makeModel: '2010 Nissan Sentra',
    plate: 'XYZ-1234',
    permit: 'Active'
  };

  const announcements = [
    'Main Gate under maintenance from 10 PM - 12 AM.',
    'NFC system offline, please use QR fallback.',
    'Holiday gate hours in effect.'
  ];

  const stats = {
    entriesThisWeek: 14,
    mostUsedGate: 'Main Gate'
  };

  const attendanceHistory = [
    { date: '2026-02-25', time: '08:00', action: 'Entered', location: 'VSU Main Gate - Entry' },
    { date: '2026-02-25', time: '16:30', action: 'Exited', location: 'VSU Main Gate - Exit' },
    { date: '2026-02-24', time: '08:05', action: 'Entered', location: 'Lower Campus Pedestrian Gate - Entry' },
    { date: '2026-02-24', time: '16:45', action: 'Exited', location: 'Lower Campus Pedestrian Gate - Exit' }
  ];

  const qrCodeValue = JSON.stringify({
    studentId: memberData.studentId,
    name: memberData.name,
    contactNumber: memberData.contactNumber
  });

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
            <div className="bg-white rounded-2xl shadow-xl border-t-4 border-[#1e293b] p-8 md:p-12 relative flex flex-col items-center">
              {/* Avatar */}
              <div className="absolute -top-14">
                <img
                  src={memberData.profileImage}
                  alt={memberData.name}
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-[#1e293b] shadow-md object-cover"
                />
              </div>
              <div className="pt-16 text-center">
                <h1 className="text-2xl font-semibold text-[#0f172a]">{memberData.name}</h1>
                <p className="text-sm text-[#64748b] mt-1">Student</p>
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
                  <p className="ml-6 text-lg text-[#0f172a] font-medium">{memberData.birthDate}</p>
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
              <p><span className="font-semibold">Contact:</span> {emergencyInfo.name}</p>
              <p><span className="font-semibold">Phone:</span> {emergencyInfo.phone}</p>
              <p><span className="font-semibold">Blood Type:</span> {emergencyInfo.bloodType}</p>
              <p><span className="font-semibold">Allergies:</span> {emergencyInfo.allergies}</p>
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
