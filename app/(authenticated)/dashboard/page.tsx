'use client';

import { 
  Users, 
  UserCheck, 
  UserX, 
  Activity, 
  AlertTriangle,
  TrendingUp,
  Clock,
  Shield,
  BarChart3,
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
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
            <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f1f5f9] text-[#1e293b] font-medium">
              <BarChart3 className="w-5 h-5" />
              Dashboard
            </a>
            <a href="/people" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <Users className="w-5 h-5" />
              People
            </a>
            <a href="/events" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <Activity className="w-5 h-5" />
              Access Events
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <Settings className="w-5 h-5" />
              Settings
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-[#e2e8f0]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#1e293b] flex items-center justify-center text-white text-sm font-medium">
              {user?.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#0f172a]">{user?.name}</p>
              <p className="text-xs text-[#64748b]">{user?.role}</p>
            </div>
            <LogOut 
              className="w-4 h-4 text-[#64748b] cursor-pointer hover:text-[#ef4444]" 
              onClick={logout}
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Dashboard Overview</h2>
            <p className="text-[#64748b]">Monitor real-time access events and system status</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Currently Inside */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#dbeafe] flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-[#2563eb]" />
                </div>
                <span className="text-xs font-medium text-[#10b981] bg-[#d1fae5] px-2 py-1 rounded-full">
                  Live
                </span>
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">342</h3>
              <p className="text-sm text-[#64748b]">Currently Inside</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-[#10b981]">
                <TrendingUp className="w-3 h-3" />
                <span>12% from yesterday</span>
              </div>
            </div>

            {/* Today's Entries */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#ddd6fe] flex items-center justify-center">
                  <Activity className="w-6 h-6 text-[#7c3aed]" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">1,248</h3>
              <p className="text-sm text-[#64748b]">Today&apos;s Entries</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-[#64748b]">
                <Clock className="w-3 h-3" />
                <span>Last entry 2 min ago</span>
              </div>
            </div>

            {/* Active Visitors */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#fef3c7] flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#f59e0b]" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">28</h3>
              <p className="text-sm text-[#64748b]">Active Visitors</p>
              <div className="mt-3 text-xs text-[#64748b]">
                3 special guests
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#fee2e2] flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">5</h3>
              <p className="text-sm text-[#64748b]">Active Alerts</p>
              <div className="mt-3 text-xs text-[#ef4444]">
                2 expired credentials
              </div>
            </div>
          </div>

          {/* Recent Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[#0f172a]">Recent Activity</h3>
                <a href="/events" className="text-sm text-[#2563eb] hover:underline">View all</a>
              </div>
              <div className="space-y-4">
                {[
                  { name: "Sarah Johnson", role: "Student", action: "Entered", gate: "Main Gate", time: "2 min ago", type: "in" },
                  { name: "Mike Chen", role: "Staff", action: "Exited", gate: "Side Gate", time: "5 min ago", type: "out" },
                  { name: "Emily Davis", role: "Visitor", action: "Entered", gate: "Main Gate", time: "12 min ago", type: "in" },
                  { name: "Robert Williams", role: "Student", action: "Exited", gate: "Main Gate", time: "18 min ago", type: "out" },
                  { name: "Lisa Anderson", role: "Special Guest", action: "Entered", gate: "VIP Entrance", time: "23 min ago", type: "in" },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#f8f9fa] transition-colors">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      activity.type === "in" ? "bg-[#dcfce7]" : "bg-[#fee2e2]"
                    )}>
                      {activity.type === "in" ? (
                        <UserCheck className="w-5 h-5 text-[#16a34a]" />
                      ) : (
                        <UserX className="w-5 h-5 text-[#ef4444]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0f172a]">{activity.name}</p>
                      <p className="text-xs text-[#64748b]">{activity.role} • {activity.gate}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-xs font-medium mb-1",
                        activity.type === "in" ? "text-[#16a34a]" : "text-[#ef4444]"
                      )}>
                        {activity.action}
                      </p>
                      <p className="text-xs text-[#64748b]">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#0f172a] mb-6">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1e293b] text-white hover:bg-[#334155] transition-colors">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">Register Person</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] transition-colors">
                  <UserCheck className="w-5 h-5" />
                  <span className="text-sm font-medium">Issue Credential</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8f9fa] transition-colors">
                  <Activity className="w-5 h-5" />
                  <span className="text-sm font-medium">View Reports</span>
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
                <h4 className="text-sm font-semibold text-[#0f172a] mb-3">System Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Gates Online</span>
                    <span className="font-medium text-[#10b981]">4/4</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Sync Status</span>
                    <span className="font-medium text-[#10b981]">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Last Backup</span>
                    <span className="font-medium text-[#64748b]">10 min ago</span>
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

export default function AdminDashboard() {
  return <DashboardContent />;
}
