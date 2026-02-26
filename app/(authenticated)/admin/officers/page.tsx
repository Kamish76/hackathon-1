import { Users2 } from 'lucide-react';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminOfficersPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Users2 className="w-7 h-7 text-[#1e293b]" />
              <h2 className="text-3xl font-bold text-[#0f172a]">Officers / Attendance Takers</h2>
            </div>
            <p className="text-[#64748b]">Assign and manage Admin and Taker roles.</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 shadow-sm">
            <p className="text-[#64748b]">This section is reserved for assigning and managing Admin and Taker roles.</p>
          </div>
        </div>
      </main>
    </div>
  );
}