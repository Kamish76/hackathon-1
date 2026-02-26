import {
  Users,
  UserCheck,
  Activity,
  AlertTriangle,
  Clock,
  Shield,
  BarChart3,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

type DashboardStats = {
  currentInside: number;
  todayIn: number;
  registeredMembersAndStudents: number;
  activeAlerts: number;
  activeGates: number;
};

type RecentActivity = {
  id: string;
  event_timestamp: string;
  direction: 'IN' | 'OUT';
  is_manual_override: boolean;
  person_registry: {
    full_name: string;
    person_type: string;
  } | null;
  gates: {
    gate_name: string;
  } | null;
};

function getStartOfDayIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

async function getDashboardData() {
  const supabase = await createClient();
  const startOfDay = getStartOfDayIso();

  const [
    insideResult,
    todayInResult,
    membersAndStudentsResult,
    manualOverridesResult,
    deniedEventsResult,
    activeGatesResult,
    recentActivityResult,
  ] = await Promise.all([
    supabase.from('current_population_inside').select('person_id', { count: 'exact', head: true }),
    supabase
      .from('access_events')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'IN')
      .gte('event_timestamp', startOfDay),
    supabase
      .from('person_registry')
      .select('id', { count: 'exact', head: true })
      .in('person_type', ['Student', 'Staff']),
    supabase
      .from('override_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay),
    supabase
      .from('access_events')
      .select('id', { count: 'exact', head: true })
      .gte('event_timestamp', startOfDay)
      .filter('metadata->>decision', 'eq', 'DENIED'),
    supabase.from('gates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('access_events')
      .select(
        `
          id,
          event_timestamp,
          direction,
          is_manual_override,
          person_registry(full_name, person_type),
          gates(gate_name)
        `
      )
      .order('event_timestamp', { ascending: false })
      .limit(6),
  ]);

  const stats: DashboardStats = {
    currentInside: insideResult.count ?? 0,
    todayIn: todayInResult.count ?? 0,
    registeredMembersAndStudents: membersAndStudentsResult.count ?? 0,
    activeAlerts: (manualOverridesResult.count ?? 0) + (deniedEventsResult.count ?? 0),
    activeGates: activeGatesResult.count ?? 0,
  };

  const recentActivity: RecentActivity[] = (recentActivityResult.data as RecentActivity[] | null) ?? [];

  return { stats, recentActivity };
}

function formatRelativeTime(timestamp: string) {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.floor((now - then) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default async function AdminDashboardPage() {
  const { stats, recentActivity } = await getDashboardData();

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <aside className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col">
        <div className="p-6 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#1e293b]" />
            <div>
              <h1 className="text-lg font-semibold text-[#0f172a]">NFC Access</h1>
              <p className="text-xs text-[#64748b]">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <a
              href="/admin/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f1f5f9] text-[#1e293b] font-medium"
            >
              <BarChart3 className="w-5 h-5" />
              Dashboard
            </a>
            <a
              href="/people"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors"
            >
              <Users className="w-5 h-5" />
              People
            </a>
            <a
              href="/events"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors"
            >
              <Activity className="w-5 h-5" />
              Access Events
            </a>
            <a
              href="/admin/checkpoints"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors"
            >
              <Settings className="w-5 h-5" />
              Checkpoints
            </a>
          </div>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Admin Dashboard</h2>
            <p className="text-[#64748b]">System overview, access activity, and admin management shortcuts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#dbeafe] flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-[#2563eb]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{stats.currentInside}</h3>
              <p className="text-sm text-[#64748b]">Current Population Inside</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#ddd6fe] flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-[#7c3aed]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{stats.todayIn}</h3>
              <p className="text-sm text-[#64748b]">Today IN Count</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#fef3c7] flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-[#f59e0b]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{stats.registeredMembersAndStudents}</h3>
              <p className="text-sm text-[#64748b]">Registered Members & Students</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#fee2e2] flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{stats.activeAlerts}</h3>
              <p className="text-sm text-[#64748b]">Manual Overrides + Denied</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#dcfce7] flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[#16a34a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">{stats.activeGates}</h3>
              <p className="text-sm text-[#64748b]">Active Checkpoints/Gates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#0f172a]">Recent Activity</h3>
                <a href="/events" className="text-sm text-[#2563eb] hover:underline">
                  View all
                </a>
              </div>

              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-[#f8f9fa] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">
                          {activity.person_registry?.full_name ?? 'Unknown Person'}
                        </p>
                        <p className="text-xs text-[#64748b]">
                          {activity.person_registry?.person_type ?? 'Unknown Type'} •{' '}
                          {activity.gates?.gate_name ?? 'Unknown Gate'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-xs font-medium mb-1 ${
                            activity.direction === 'IN' ? 'text-[#16a34a]' : 'text-[#ef4444]'
                          }`}
                        >
                          {activity.direction}
                          {activity.is_manual_override ? ' (Manual Override)' : ''}
                        </p>
                        <p className="text-xs text-[#64748b]">{formatRelativeTime(activity.event_timestamp)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-[#64748b]">No recent access events available.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Management Actions</h3>

              <div className="space-y-3">
                <a
                  href="/people"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#1e293b] text-white hover:bg-[#334155] transition-colors"
                >
                  <span className="text-sm font-medium">Manage Members / Students</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="/admin/officers"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] transition-colors"
                >
                  <span className="text-sm font-medium">Manage Officers / Attendance Takers</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="/admin/checkpoints"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] transition-colors"
                >
                  <span className="text-sm font-medium">Manage Events / Checkpoints</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="/admin/reports"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] transition-colors"
                >
                  <span className="text-sm font-medium">View Attendance Logs / Reports</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
                <h4 className="text-sm font-semibold text-[#0f172a] mb-3">System Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Gates Online</span>
                    <span className="font-medium text-[#10b981]">{stats.activeGates}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Sync Status</span>
                    <span className="font-medium text-[#10b981]">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Updated</span>
                    <span className="font-medium text-[#64748b] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}