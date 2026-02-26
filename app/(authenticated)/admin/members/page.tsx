'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Shield, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

type CombinedRole = 'Admin' | 'Officer' | 'Student' | 'Staff' | 'Visitor';

type Member = {
  id: string;
  email: string;
  fullName: string;
  personType: string;
  role: CombinedRole;
  operatorRole: 'Admin' | 'Taker' | null;
  isActive: boolean;
};

const roleOptions: CombinedRole[] = ['Admin', 'Officer', 'Student', 'Staff', 'Visitor'];

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [deactivatingMemberId, setDeactivatingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, CombinedRole>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadMembers = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const search = (searchTerm ?? query).trim();
      const response = await fetch(`/api/admin/members${search ? `?q=${encodeURIComponent(search)}` : ''}`);
      const payload = (await response.json()) as { error?: string; members?: Member[] };

      if (!response.ok || !payload.members) {
        throw new Error(payload.error ?? 'Failed to load members.');
      }

      setMembers(payload.members);
      setDraftRoles(
        payload.members.reduce<Record<string, CombinedRole>>((acc, member) => {
          acc[member.id] = member.role;
          return acc;
        }, {})
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load members.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadMembers('');
  }, [loadMembers]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((left, right) => left.fullName.localeCompare(right.fullName));
  }, [members]);

  const handleSearch = async () => {
    await loadMembers(query);
  };

  const handleSaveRole = async (memberId: string) => {
    const selectedRole = draftRoles[memberId];

    if (!selectedRole) {
      return;
    }

    setSavingMemberId(memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-role', role: selectedRole }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to update role.');
      }

      setSuccessMessage(payload.message ?? 'Role updated.');
      await loadMembers(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role.';
      setErrorMessage(message);
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleDeactivate = async (memberId: string, memberName: string) => {
    const confirmed = window.confirm(`Deactivate ${memberName}? This blocks sign in but keeps records.`);

    if (!confirmed) {
      return;
    }

    setDeactivatingMemberId(memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to deactivate member.');
      }

      setSuccessMessage(payload.message ?? 'Member deactivated.');
      await loadMembers(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deactivate member.';
      setErrorMessage(message);
    } finally {
      setDeactivatingMemberId(null);
    }
  };

  const handleDelete = async (memberId: string, memberName: string) => {
    const confirmed = window.confirm(
      `Permanently delete ${memberName}? This removes auth access and linked person record.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingMemberId(memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete member account.');
      }

      setSuccessMessage(payload.message ?? 'Member deleted.');
      await loadMembers(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete member account.';
      setErrorMessage(message);
    } finally {
      setDeletingMemberId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8">
      <div className="mb-8">
        <button
          onClick={() => window.history.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a] hover:bg-[#f8f9fa] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-[#1e293b]" />
          <h1 className="text-3xl font-bold text-[#0f172a]">Member Management</h1>
        </div>
        <p className="text-[#64748b]">
          Query members, assign roles (Admin, Officer, Student, Staff, Visitor), deactivate users, or permanently
          delete accounts.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 mb-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSearch();
                }
              }}
              placeholder="Search by member name, email, type, or role"
              className="w-full rounded-lg border border-[#e2e8f0] pl-10 pr-4 py-2 text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]"
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            className="px-4 py-2 rounded-lg bg-[#1e293b] text-white hover:bg-[#334155] transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#b91c1c] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[#166534] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">{successMessage}</span>
        </div>
      ) : null}

      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#0f172a]">Member</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#0f172a]">Base Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#0f172a]">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#0f172a]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#0f172a]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#64748b]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading members...
                    </div>
                  </td>
                </tr>
              ) : sortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#64748b]">
                    No members found.
                  </td>
                </tr>
              ) : (
                sortedMembers.map((member) => {
                  const selectedRole = draftRoles[member.id] ?? member.role;
                  const canSave = selectedRole !== member.role;
                  const roleUpdateBusy = savingMemberId === member.id;
                  const deactivationBusy = deactivatingMemberId === member.id;
                  const deletionBusy = deletingMemberId === member.id;
                  const busy = roleUpdateBusy || deactivationBusy || deletionBusy;

                  return (
                    <tr key={member.id} className="border-b border-[#e2e8f0] align-top">
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-[#0f172a]">{member.fullName}</p>
                        <p className="text-xs text-[#64748b]">{member.email}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#0f172a]">{member.personType}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRole}
                            disabled={busy}
                            onChange={(event) =>
                              setDraftRoles((previous) => ({
                                ...previous,
                                [member.id]: event.target.value as CombinedRole,
                              }))
                            }
                            className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#1e293b]"
                          >
                            {roleOptions.map((roleOption) => (
                              <option key={roleOption} value={roleOption}>
                                {roleOption}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={!canSave || roleUpdateBusy || deactivationBusy || deletionBusy}
                            onClick={() => void handleSaveRole(member.id)}
                            className="px-3 py-2 rounded-lg text-sm bg-[#1e293b] text-white disabled:opacity-50 hover:bg-[#334155] transition-colors"
                          >
                            {roleUpdateBusy ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.isActive
                              ? 'bg-[#dcfce7] text-[#166534]'
                              : 'bg-[#f1f5f9] text-[#334155]'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={busy}
                            onClick={() => void handleDeactivate(member.id, member.fullName)}
                            className="px-3 py-2 rounded-lg text-xs border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] disabled:opacity-50 transition-colors"
                          >
                            {deactivationBusy ? 'Deactivating...' : 'Deactivate'}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void handleDelete(member.id, member.fullName)}
                            className="px-3 py-2 rounded-lg text-xs bg-[#ef4444] text-white hover:bg-[#dc2626] disabled:opacity-50 transition-colors"
                          >
                            {deletionBusy ? 'Deleting...' : 'Delete Account'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
