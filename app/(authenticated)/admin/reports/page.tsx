import { FileText } from 'lucide-react';

export default function AdminReportsPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8">
      <div className="max-w-4xl mx-auto bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-7 h-7 text-[#1e293b]" />
          <h1 className="text-2xl font-bold text-[#0f172a]">Attendance Logs / Reports</h1>
        </div>
        <p className="text-[#64748b] mb-6">
          This section will host attendance summaries and report generation for admin review.
        </p>
        <a href="/events" className="text-sm text-[#2563eb] hover:underline mr-4">
          View access event logs
        </a>
        <a href="/admin/dashboard" className="text-sm text-[#2563eb] hover:underline">
          Back to admin dashboard
        </a>
      </div>
    </div>
  );
}