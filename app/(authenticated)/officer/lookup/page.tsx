'use client';

import { Search, Users, UserCheck } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';

const people = [
  { name: 'Maria Santos',   type: 'Student', email: 'maria.santos@vsu.edu.ph',  nfc: 'NFC-001', status: 'Active'   },
  { name: 'Carlos Reyes',   type: 'Staff',   email: 'carlos.reyes@vsu.edu.ph',  nfc: 'NFC-002', status: 'Active'   },
  { name: 'Ana Gonzalez',   type: 'Student', email: 'ana.gonzalez@vsu.edu.ph',  nfc: 'NFC-003', status: 'Active'   },
  { name: 'Jose Dela Cruz', type: 'Visitor', email: 'jose.delacruz@email.com',  nfc: 'NFC-004', status: 'Active'   },
  { name: 'Lena Torres',    type: 'Student', email: 'lena.torres@vsu.edu.ph',   nfc: 'NFC-005', status: 'Inactive' },
  { name: 'Mark Bautista',  type: 'Staff',   email: 'mark.bautista@vsu.edu.ph', nfc: 'NFC-006', status: 'Active'   },
  { name: 'Rosa Mendoza',   type: 'Student', email: 'rosa.mendoza@vsu.edu.ph',  nfc: 'NFC-007', status: 'Active'   },
];

const typeColors: Record<string, string> = {
  Student: 'bg-[#dbeafe] text-[#2563eb]',
  Staff:   'bg-[#ddd6fe] text-[#7c3aed]',
  Visitor: 'bg-[#fef3c7] text-[#f59e0b]',
};

export default function LookupPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <OfficerSidebar activePage="lookup" />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">People Lookup</h2>
            <p className="text-[#64748b]">Search registered people to manually verify identity at your checkpoint.</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">342</h3>
              <p className="text-sm text-[#64748b]">Registered People</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">318</h3>
              <p className="text-sm text-[#64748b]">Active</p>
            </div>
          </div>

          {/* Search + Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#e2e8f0]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <div className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#94a3b8] bg-[#f8f9fa] flex items-center gap-2">
                  Search by name, email, or NFC tag…
                  <span className="ml-auto text-xs font-medium bg-[#e2e8f0] text-[#94a3b8] px-1.5 py-0.5 rounded">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Email</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">NFC Tag</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {people.map((p, i) => (
                    <tr key={i} className="hover:bg-[#f8f9fa] transition-colors">
                      <td className="px-6 py-4 font-medium text-[#0f172a]">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[p.type] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#64748b]">{p.email}</td>
                      <td className="px-6 py-4 text-[#64748b] font-mono text-xs">{p.nfc}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          p.status === 'Active' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f1f5f9] text-[#94a3b8]'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
