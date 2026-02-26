'use client';

import { useState, useEffect, useCallback } from 'react';
import { DoorOpen, Plus, X, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AdminSidebar from '@/components/AdminSidebar';
import { cn } from '@/lib/utils';

interface Gate {
  id: string;
  gate_code: string;
  gate_name: string;
  location_description: string | null;
  is_vehicle_lane: boolean;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  gate_code: '',
  gate_name: '',
  location_description: '',
  is_vehicle_lane: false,
};

export default function AdminGatesPage() {
  const [gates, setGates] = useState<Gate[] | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchGates = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('gates')
      .select('id, gate_code, gate_name, location_description, is_vehicle_lane, is_active, created_at')
      .order('gate_name');
    setGates((data as Gate[]) ?? []);
  }, []);

  useEffect(() => {
    fetchGates();
  }, [fetchGates]);

  const handleToggle = async (gate: Gate) => {
    setToggling(gate.id);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('gates')
      .update({ is_active: !gate.is_active })
      .eq('id', gate.id);

    if (err) {
      showToast(`Error: ${err.message}`);
    } else {
      showToast(`${gate.gate_name} marked ${!gate.is_active ? 'active' : 'inactive'}`);
      setGates((prev) =>
        prev?.map((g) => (g.id === gate.id ? { ...g, is_active: !gate.is_active } : g)) ?? null
      );
    }
    setToggling(null);
  };

  const handleAdd = async () => {
    setError('');
    if (!form.gate_code.trim()) { setError('Gate code is required.'); return; }
    if (!form.gate_name.trim()) { setError('Gate name is required.'); return; }

    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.from('gates').insert({
      gate_code: form.gate_code.trim().toUpperCase(),
      gate_name: form.gate_name.trim(),
      location_description: form.location_description.trim() || null,
      is_vehicle_lane: form.is_vehicle_lane,
      is_active: true,
    });

    if (err) {
      setError(err.message);
    } else {
      setForm(emptyForm);
      setShowAddForm(false);
      showToast(`Gate "${form.gate_name.trim()}" added`);
      await fetchGates();
    }
    setSaving(false);
  };

  const isLoading = gates === null;
  const activeCount = gates?.filter((g) => g.is_active).length ?? 0;
  const totalCount = gates?.length ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <AdminSidebar activePage="gates" />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <DoorOpen className="w-7 h-7 text-[#1e293b]" />
                <h2 className="text-3xl font-bold text-[#0f172a]">Gates</h2>
              </div>
              <button
                onClick={() => { setShowAddForm((v) => !v); setError(''); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  showAddForm
                    ? 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                    : 'bg-[#1e293b] text-white hover:bg-[#334155]'
                )}
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm ? 'Cancel' : 'Add Gate'}
              </button>
            </div>
            <p className="text-[#64748b]">
              {isLoading ? 'Loading…' : `${activeCount} of ${totalCount} gates active`}
            </p>
          </div>

          {/* Add Gate Form */}
          {showAddForm && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-6 shadow-sm">
              <h3 className="text-base font-semibold text-[#0f172a] mb-4">New Gate</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Gate Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GATE-A"
                    value={form.gate_code}
                    onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Gate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Gate"
                    value={form.gate_name}
                    onChange={(e) => setForm((f) => ({ ...f, gate_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Location Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. North entrance near parking lot"
                    value={form.location_description}
                    onChange={(e) => setForm((f) => ({ ...f, location_description: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] text-sm focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_vehicle_lane"
                    checked={form.is_vehicle_lane}
                    onChange={(e) => setForm((f) => ({ ...f, is_vehicle_lane: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#d1d5db] accent-[#1e293b]"
                  />
                  <label htmlFor="is_vehicle_lane" className="text-sm text-[#374151]">
                    Vehicle lane (this gate handles vehicle access)
                  </label>
                </div>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-[#1e293b] text-white rounded-lg text-sm font-medium hover:bg-[#334155] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Add Gate'}
                </button>
              </div>
            </div>
          )}

          {/* Gates List */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="px-6 py-12 text-center text-[#64748b]">Loading gates…</div>
            ) : gates!.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <DoorOpen className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
                <p className="text-[#64748b] font-medium">No gates found</p>
                <p className="text-[#94a3b8] text-sm">Add your first gate using the button above</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Gate</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Code</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Location</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Status</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-[#0f172a]">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {gates!.map((gate) => (
                    <tr
                      key={gate.id}
                      className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8f9fa] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-[#0f172a]">{gate.gate_name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-0.5 bg-[#f1f5f9] text-[#475569] rounded text-xs font-mono">
                          {gate.gate_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">
                        {gate.location_description ?? <span className="text-[#cbd5e1]">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {gate.is_vehicle_lane ? (
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            Vehicle
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-[#f1f5f9] text-[#475569] rounded-full text-xs font-medium">
                            Walk
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                            gate.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-[#f1f5f9] text-[#94a3b8]'
                          )}
                        >
                          {gate.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggle(gate)}
                          disabled={toggling === gate.id}
                          aria-label={gate.is_active ? 'Deactivate gate' : 'Activate gate'}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                            gate.is_active ? 'bg-[#1e293b]' : 'bg-[#e2e8f0]',
                            toggling === gate.id && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              gate.is_active ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1e293b] text-white text-sm px-4 py-3 rounded-lg shadow-lg z-50 transition-all">
          {toast}
        </div>
      )}
    </div>
  );
}
