'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Person {
  id: string;
  name: string;
  type: 'Student' | 'Staff' | 'Visitor' | 'Special Guest';
  contact: string;
  nfcUid: string;
  status: 'Active' | 'Inactive' | 'Expired';
}

// Mock data
const mockPeople: Person[] = [
  { id: '1', name: 'Sarah Johnson', type: 'Student', contact: 'sarah.j@school.edu', nfcUid: 'NFC-001', status: 'Active' },
  { id: '2', name: 'Mike Chen', type: 'Staff', contact: 'mike.chen@school.edu', nfcUid: 'NFC-002', status: 'Active' },
  { id: '3', name: 'Emily Davis', type: 'Visitor', contact: 'emily.davis@email.com', nfcUid: 'NFC-003', status: 'Active' },
  { id: '4', name: 'Robert Williams', type: 'Student', contact: 'robert.w@school.edu', nfcUid: 'NFC-004', status: 'Active' },
  { id: '5', name: 'Lisa Anderson', type: 'Special Guest', contact: 'lisa.anderson@company.com', nfcUid: 'NFC-005', status: 'Expired' },
  { id: '6', name: 'James Taylor', type: 'Staff', contact: 'james.taylor@school.edu', nfcUid: 'NFC-006', status: 'Active' },
  { id: '7', name: 'Michelle Brown', type: 'Student', contact: 'michelle.b@school.edu', nfcUid: 'NFC-007', status: 'Inactive' },
  { id: '8', name: 'David Martinez', type: 'Visitor', contact: 'david.m@email.com', nfcUid: 'NFC-008', status: 'Active' },
  { id: '9', name: 'Jessica Lee', type: 'Staff', contact: 'jessica.lee@school.edu', nfcUid: 'NFC-009', status: 'Active' },
  { id: '10', name: 'Thomas Garcia', type: 'Student', contact: 'thomas.g@school.edu', nfcUid: 'NFC-010', status: 'Active' },
];

const personTypes = ['All', 'Student', 'Staff', 'Visitor', 'Special Guest'];

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: 'bg-green-100', text: 'text-green-800' },
  Inactive: { bg: 'bg-gray-100', text: 'text-gray-800' },
  Expired: { bg: 'bg-red-100', text: 'text-red-800' },
};

export default function PeopleRegistry() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  // Filter and search logic
  const filteredPeople = useMemo(() => {
    return mockPeople.filter((person) => {
      const matchesSearch =
        person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.nfcUid.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'All' || person.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [searchQuery, selectedType]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col">
        <div className="p-6 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center text-white text-sm font-bold">
              NFC
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#0f172a]">NFC Access</h1>
              <p className="text-xs text-[#64748b]">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V6" />
              </svg>
              Dashboard
            </a>
            <a href="/people" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f1f5f9] text-[#1e293b] font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              People
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Access Events
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Settings
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-[#e2e8f0]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-white text-sm font-medium">
              JD
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0f172a]">John Doe</p>
              <p className="text-xs text-[#64748b]">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-[#0f172a]">People Registry</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-[#334155] transition-colors">
                <Plus className="w-5 h-5" />
                <span>Add Person</span>
              </button>
            </div>
            <p className="text-[#64748b]">Manage and view all registered people in the system</p>
          </div>

          {/* Search and Filter Section */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or NFC UID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
              </div>

              {/* Type Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeFilter(!showTypeFilter)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>{selectedType}</span>
                </button>

                {showTypeFilter && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {personTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedType(type);
                          setShowTypeFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedType === type
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-[#64748b]">
            Showing {filteredPeople.length} of {mockPeople.length} people
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Contact</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">NFC UID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.length > 0 ? (
                    filteredPeople.map((person) => (
                      <tr key={person.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-[#0f172a]">{person.name}</td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">
                          <span className="inline-block px-3 py-1 bg-[#f1f5f9] text-[#0f172a] rounded-full text-xs font-medium">
                            {person.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">{person.contact}</td>
                        <td className="px-6 py-4 text-sm font-mono text-[#0f172a]">{person.nfcUid}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={cn(
                              'inline-block px-3 py-1 rounded-full text-xs font-medium',
                              statusColors[person.status].bg,
                              statusColors[person.status].text
                            )}
                          >
                            {person.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button className="text-[#2563eb] hover:text-[#1d4ed8] transition-colors text-xs font-medium">
                              Edit
                            </button>
                            <button className="text-[#ef4444] hover:text-[#dc2626] transition-colors text-xs font-medium">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Search className="w-12 h-12 text-[#cbd5e1] mb-3" />
                          <p className="text-[#64748b] font-medium">No people found</p>
                          <p className="text-[#94a3b8] text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination (optional) */}
          {filteredPeople.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-[#64748b]">Page 1 of 1</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors disabled:opacity-50">
                  Previous
                </button>
                <button className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
