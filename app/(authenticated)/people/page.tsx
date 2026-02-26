'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import AdminSidebar from '@/components/AdminSidebar';

interface Person {
  id: string;
  name: string;
  type: 'Student' | 'Staff' | 'Visitor' | 'Special Guest';
  contact: string;
  nfcUid: string;
  status: 'Active' | 'Inactive';
}

const personTypes = ['All', 'Student', 'Staff', 'Visitor', 'Special Guest'];

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: 'bg-green-100', text: 'text-green-800' },
  Inactive: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

function PeopleRegistryContent() {
  const supabase = createClient();

  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  useEffect(() => {
    const fetchPeople = async () => {
      setIsLoading(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from('person_registry')
        .select('id, full_name, person_type, email, nfc_tag_id, is_active')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[PeopleRegistry] Failed to fetch:', error);
        setFetchError('Failed to load people. Please try again.');
      } else {
        setPeople(
          (data ?? []).map((row) => ({
            id: row.id,
            name: row.full_name,
            type: row.person_type as Person['type'],
            contact: row.email ?? '—',
            nfcUid: row.nfc_tag_id ?? '—',
            status: row.is_active ? 'Active' : 'Inactive',
          }))
        );
      }

      setIsLoading(false);
    };

    void fetchPeople();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter and search logic
  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      const matchesSearch =
        person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.nfcUid.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'All' || person.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [people, searchQuery, selectedType]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar activePage="people" />

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
          {!isLoading && !fetchError && (
            <div className="mb-4 text-sm text-[#64748b]">
              Showing {filteredPeople.length} of {people.length} people
            </div>
          )}

          {/* Error */}
          {fetchError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {fetchError}
            </div>
          )}

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
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-4 border-[#e2e8f0] border-t-[#1e293b] rounded-full animate-spin" />
                          <p className="text-[#64748b] text-sm">Loading people...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPeople.length > 0 ? (
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

export default function PeopleRegistry() {
  return <PeopleRegistryContent />;
}
