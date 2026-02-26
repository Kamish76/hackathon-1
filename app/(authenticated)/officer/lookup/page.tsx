'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Users, UserCheck } from 'lucide-react';
import OfficerSidebar from '@/components/OfficerSidebar';
import { createClient } from '@/lib/supabase/client';

interface Person {
  id: string;
  full_name: string;
  person_type: string;
  email: string | null;
  nfc_tag_id: string | null;
  qr_code_data: string | null;
  is_active: boolean;
}

const typeColors: Record<string, string> = {
  Student:        'bg-[#dbeafe] text-[#2563eb]',
  Staff:          'bg-[#ddd6fe] text-[#7c3aed]',
  Visitor:        'bg-[#fef3c7] text-[#f59e0b]',
  'Special Guest':'bg-[#f0fdf4] text-[#16a34a]',
};

export default function LookupPage() {
  const supabase = createClient();

  const [totalCount, setTotalCount]   = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [people, setPeople]           = useState<Person[] | null>(null);
  const [query, setQuery]             = useState('');
  const [searching, setSearching]     = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stats once on mount
  useEffect(() => {
    async function fetchStats() {
      const [{ count: total }, { count: active }] = await Promise.all([
        supabase.from('person_registry').select('*', { count: 'exact', head: true }),
        supabase.from('person_registry').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setTotalCount(total ?? 0);
      setActiveCount(active ?? 0);
    }
    fetchStats();
  }, []);

  // Fetch people (debounced search)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const q = query.trim();

      let req = supabase
        .from('person_registry')
        .select('id, full_name, person_type, email, nfc_tag_id, qr_code_data, is_active')
        .order('full_name')
        .limit(100);

      if (q) {
        req = req.or(
          `full_name.ilike.%${q}%,email.ilike.%${q}%,nfc_tag_id.ilike.%${q}%,qr_code_data.ilike.%${q}%`
        );
      }

      const { data } = await req;
      setPeople((data as Person[]) ?? []);
      setSearching(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#f8f9fa]">
      <OfficerSidebar activePage="lookup" />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8">
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
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                {totalCount === null ? '…' : totalCount}
              </h3>
              <p className="text-sm text-[#64748b]">Registered People</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                {activeCount === null ? '…' : activeCount}
              </h3>
              <p className="text-sm text-[#64748b]">Active</p>
            </div>
          </div>

          {/* Search + Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#e2e8f0]">
              <div className="relative">
                {searching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8] animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                )}
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, NFC tag, or QR code…"
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0f172a] placeholder:text-[#94a3b8] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {people === null ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[#94a3b8]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : people.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-[#94a3b8]">
                  <Users className="w-8 h-8" />
                  <p className="text-sm">{query ? 'No results found.' : 'No registered people yet.'}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Type</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Email</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">NFC Tag</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {people.map((p) => (
                      <tr key={p.id} className="hover:bg-[#f8f9fa] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#0f172a]">{p.full_name}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[p.person_type] ?? 'bg-[#f1f5f9] text-[#64748b]'}`}>
                            {p.person_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#64748b]">{p.email ?? '—'}</td>
                        <td className="px-6 py-4 text-[#64748b] font-mono text-xs">{p.nfc_tag_id ?? '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.is_active ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f1f5f9] text-[#94a3b8]'
                          }`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Row count footer */}
            {people !== null && people.length > 0 && (
              <div className="px-6 py-3 border-t border-[#e2e8f0] bg-[#f8f9fa]">
                <p className="text-xs text-[#94a3b8]">
                  Showing {people.length} {people.length === 1 ? 'result' : 'results'}
                  {query ? ` for "${query}"` : ' (first 100)'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
