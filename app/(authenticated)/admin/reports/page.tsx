import { FileText } from 'lucide-react';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminReportsPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-7 h-7 text-[#1e293b]" />
              <h2 className="text-3xl font-bold text-[#0f172a]">Attendance Logs / Reports</h2>
            </div>
            <p className="text-[#64748b]">Attendance summaries and report generation for admin review.</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 shadow-sm">
            <p className="text-[#64748b] mb-4">This section will host attendance summaries and report generation for admin review.</p>
            <a href="/events" className="text-sm text-[#2563eb] hover:underline">
              View access event logs
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}