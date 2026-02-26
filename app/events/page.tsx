'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Calendar, Download, Shield, BarChart3, Users, Activity, Settings, LogOut, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

interface AccessEvent {
  id: string;
  timestamp: string;
  personName: string;
  personType: 'Student' | 'Staff' | 'Visitor' | 'Special Guest';
  direction: 'IN' | 'OUT';
  gate: string;
  nfcUid: string;
}

// Mock data
const mockEvents: AccessEvent[] = [
  { id: '1', timestamp: '2026-02-26 14:32:15', personName: 'Sarah Johnson', personType: 'Student', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-001' },
  { id: '2', timestamp: '2026-02-26 14:27:42', personName: 'Mike Chen', personType: 'Staff', direction: 'OUT', gate: 'Side Gate', nfcUid: 'NFC-002' },
  { id: '3', timestamp: '2026-02-26 14:20:18', personName: 'Emily Davis', personType: 'Visitor', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-003' },
  { id: '4', timestamp: '2026-02-26 14:14:55', personName: 'Robert Williams', personType: 'Student', direction: 'OUT', gate: 'Main Gate', nfcUid: 'NFC-004' },
  { id: '5', timestamp: '2026-02-26 14:09:33', personName: 'Lisa Anderson', personType: 'Special Guest', direction: 'IN', gate: 'VIP Entrance', nfcUid: 'NFC-005' },
  { id: '6', timestamp: '2026-02-26 14:05:21', personName: 'James Taylor', personType: 'Staff', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-006' },
  { id: '7', timestamp: '2026-02-26 13:58:47', personName: 'Michelle Brown', personType: 'Student', direction: 'IN', gate: 'Side Gate', nfcUid: 'NFC-007' },
  { id: '8', timestamp: '2026-02-26 13:52:09', personName: 'David Martinez', personType: 'Visitor', direction: 'OUT', gate: 'Main Gate', nfcUid: 'NFC-008' },
  { id: '9', timestamp: '2026-02-26 13:45:33', personName: 'Jessica Lee', personType: 'Staff', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-009' },
  { id: '10', timestamp: '2026-02-26 13:38:12', personName: 'Thomas Garcia', personType: 'Student', direction: 'IN', gate: 'Side Gate', nfcUid: 'NFC-010' },
  { id: '11', timestamp: '2026-02-26 13:30:45', personName: 'Amanda Wilson', personType: 'Student', direction: 'OUT', gate: 'Main Gate', nfcUid: 'NFC-011' },
  { id: '12', timestamp: '2026-02-26 13:22:18', personName: 'Kevin Moore', personType: 'Staff', direction: 'OUT', gate: 'Side Gate', nfcUid: 'NFC-012' },
  { id: '13', timestamp: '2026-02-26 13:15:56', personName: 'Rachel Green', personType: 'Visitor', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-013' },
  { id: '14', timestamp: '2026-02-26 13:08:34', personName: 'Daniel Brown', personType: 'Student', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-014' },
  { id: '15', timestamp: '2026-02-26 12:59:21', personName: 'Sophia Miller', personType: 'Staff', direction: 'IN', gate: 'Main Gate', nfcUid: 'NFC-015' },
];

const personTypes = ['All', 'Student', 'Staff', 'Visitor', 'Special Guest'];
const directions = ['All', 'IN', 'OUT'];
const gates = ['All', 'Main Gate', 'Side Gate', 'VIP Entrance'];

function AccessEventsContent() {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDirection, setSelectedDirection] = useState('All');
  const [selectedGate, setSelectedGate] = useState('All');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showDirectionFilter, setShowDirectionFilter] = useState(false);
  const [showGateFilter, setShowGateFilter] = useState(false);

  // Filter and search logic
  const filteredEvents = useMemo(() => {
    return mockEvents.filter((event) => {
      const matchesSearch =
        event.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.nfcUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.gate.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'All' || event.personType === selectedType;
      const matchesDirection = selectedDirection === 'All' || event.direction === selectedDirection;
      const matchesGate = selectedGate === 'All' || event.gate === selectedGate;

      return matchesSearch && matchesType && matchesDirection && matchesGate;
    });
  }, [searchQuery, selectedType, selectedDirection, selectedGate]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
            <a href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <BarChart3 className="w-5 h-5" />
              Dashboard
            </a>
            <a href="/people" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-colors">
              <Users className="w-5 h-5" />
              People
            </a>
            <a href="/events" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f1f5f9] text-[#1e293b] font-medium">
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
            <LogOut className="w-4 h-4 text-[#64748b] cursor-pointer hover:text-[#ef4444]" onClick={logout} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-[#0f172a]">Access Events</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] text-white rounded-lg hover:bg-[#334155] transition-colors">
                <Download className="w-5 h-5" />
                <span>Export</span>
              </button>
            </div>
            <p className="text-[#64748b]">Monitor and track all access events in real-time</p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Total Events</p>
              <p className="text-2xl font-bold text-[#0f172a]">{mockEvents.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Entries Today</p>
              <p className="text-2xl font-bold text-[#10b981]">{mockEvents.filter(e => e.direction === 'IN').length}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Exits Today</p>
              <p className="text-2xl font-bold text-[#ef4444]">{mockEvents.filter(e => e.direction === 'OUT').length}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
              <p className="text-sm text-[#64748b] mb-1">Active Gates</p>
              <p className="text-2xl font-bold text-[#0f172a]">4</p>
            </div>
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
                    placeholder="Search by person, NFC UID, or gate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#64748b] focus:outline-none focus:border-[#1e293b] focus:ring-1 focus:ring-[#1e293b]"
                  />
                </div>
              </div>

              {/* Direction Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDirectionFilter(!showDirectionFilter);
                    setShowTypeFilter(false);
                    setShowGateFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Direction: {selectedDirection}</span>
                </button>
                {showDirectionFilter && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {directions.map((dir) => (
                      <button
                        key={dir}
                        onClick={() => {
                          setSelectedDirection(dir);
                          setShowDirectionFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedDirection === dir
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowTypeFilter(!showTypeFilter);
                    setShowDirectionFilter(false);
                    setShowGateFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Type: {selectedType}</span>
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

              {/* Gate Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGateFilter(!showGateFilter);
                    setShowTypeFilter(false);
                    setShowDirectionFilter(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#e2e8f0] bg-white rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors whitespace-nowrap"
                >
                  <Filter className="w-5 h-5" />
                  <span>Gate: {selectedGate}</span>
                </button>
                {showGateFilter && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-10">
                    {gates.map((gate) => (
                      <button
                        key={gate}
                        onClick={() => {
                          setSelectedGate(gate);
                          setShowGateFilter(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedGate === gate
                            ? 'bg-[#f1f5f9] text-[#1e293b] font-medium'
                            : 'text-[#64748b] hover:bg-[#f8f9fa]'
                        )}
                      >
                        {gate}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-4 text-sm text-[#64748b]">
            Showing {filteredEvents.length} of {mockEvents.length} events
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8f9fa]">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Timestamp</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Person</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Direction</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">Gate</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[#0f172a]">NFC UID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => (
                      <tr key={event.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors">
                        <td className="px-6 py-4 text-sm text-[#0f172a]">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatTime(event.timestamp)}</span>
                            <span className="text-xs text-[#64748b]">{formatDate(event.timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-[#0f172a]">{event.personName}</td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">
                          <span className="inline-block px-3 py-1 bg-[#f1f5f9] text-[#0f172a] rounded-full text-xs font-medium">
                            {event.personType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                              event.direction === 'IN'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            )}
                          >
                            {event.direction === 'IN' ? (
                              <ArrowDownCircle className="w-3 h-3" />
                            ) : (
                              <ArrowUpCircle className="w-3 h-3" />
                            )}
                            {event.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#64748b]">{event.gate}</td>
                        <td className="px-6 py-4 text-sm font-mono text-[#0f172a]">{event.nfcUid}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Activity className="w-12 h-12 text-[#cbd5e1] mb-3" />
                          <p className="text-[#64748b] font-medium">No events found</p>
                          <p className="text-[#94a3b8] text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredEvents.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-[#64748b]">Page 1 of 1</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                  Previous
                </button>
                <button className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#0f172a] hover:bg-[#f8f9fa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
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

export default function AccessEvents() {
  return (
    <ProtectedRoute>
      <AccessEventsContent />
    </ProtectedRoute>
  );
}
