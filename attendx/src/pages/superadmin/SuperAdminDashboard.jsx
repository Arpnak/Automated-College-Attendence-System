import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Users, GraduationCap, BookOpen, Activity,
  ShieldCheck, TrendingUp, Building2, Wifi, Database,
} from 'lucide-react';
import * as sa from '../../services/superAdminService';

function MetricCard({ icon: Icon, label, value, sub, accent = 'text-scan-400', bg = 'bg-scan-500/10' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink-900 border border-ink-700/40 p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${bg} mb-4`}>
        <Icon size={20} className={accent} />
      </div>
      <p className="text-2xl font-bold font-display text-mist">{value ?? '—'}</p>
      <p className="text-sm text-fog mt-0.5">{label}</p>
      {sub && <p className="text-xs text-ink-600 mt-1">{sub}</p>}
      {/* subtle gradient stripe */}
      <div className={`absolute top-0 right-0 w-24 h-1 ${accent.replace('text-', 'bg-')} opacity-40 rounded-bl-lg`} />
    </div>
  );
}

function ActivityRow({ session }) {
  const badge = {
    live: 'bg-status-present/15 text-status-present',
    finalized: 'bg-ink-700/40 text-fog',
    indexing: 'bg-status-review/15 text-status-review',
    expired: 'bg-status-absent/15 text-status-absent',
  }[session.status] || 'bg-ink-700/40 text-fog';

  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-700/30 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-mist truncate">{session.course_name}</p>
        <p className="text-xs text-fog">
          {session.institution_name || 'Unassigned'} · {session.professor_name}
        </p>
      </div>
      <div className="flex items-center gap-3 ml-3 shrink-0">
        <span className="text-xs text-fog">{session.present_count}/{session.total_logged}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge}`}>
          {session.status}
        </span>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    sa.getMetrics().then(setMetrics).catch(() => {});
    sa.listSessions().then(setSessions).catch(() => {});
  }, []);

  const live = sessions.filter((s) => s.status === 'live');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-scan-400" />
            <span className="text-xs font-mono text-scan-400 uppercase tracking-wider">Platform Owner</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-mist">Super Admin Console</h1>
          <p className="text-sm text-fog mt-1">Full visibility across all institutions on ClassRoll.</p>
        </div>
        {live.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-status-present/10 border border-status-present/20 px-4 py-2">
            <Wifi size={14} className="text-status-present animate-pulse" />
            <span className="text-sm font-medium text-status-present">{live.length} live session{live.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Building2} label="Institutions" value={metrics?.totalInstitutions}
          sub={`${metrics?.activeInstitutions ?? '—'} active`} accent="text-violet-400" bg="bg-violet-500/10" />
        <MetricCard icon={Users} label="Admins" value={metrics?.totalAdmins}
          accent="text-blue-400" bg="bg-blue-500/10" />
        <MetricCard icon={GraduationCap} label="Students" value={metrics?.totalStudents}
          accent="text-emerald-400" bg="bg-emerald-500/10" />
        <MetricCard icon={BookOpen} label="Courses" value={metrics?.totalCourses}
          accent="text-amber-400" bg="bg-amber-500/10" />
        <MetricCard icon={Activity} label="Live Sessions" value={metrics?.activeSessions}
          accent="text-scan-400" bg="bg-scan-500/10" />
        <MetricCard icon={Users} label="Professors" value={metrics?.totalProfessors}
          accent="text-pink-400" bg="bg-pink-500/10" />
        <MetricCard icon={Database} label="Attendance Records" value={metrics?.totalAttendanceRecords}
          accent="text-cyan-400" bg="bg-cyan-500/10" />
        <MetricCard icon={TrendingUp} label="Institutions Active" value={metrics?.activeInstitutions}
          accent="text-green-400" bg="bg-green-500/10" />
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Manage Institutions', desc: 'Create, edit, suspend universities', path: '/superadmin/institutions', icon: Building2, color: 'from-violet-500/20 to-violet-900/10 border-violet-500/20' },
          { label: 'Manage Admins', desc: 'Create admins for any institution', path: '/superadmin/admins', icon: Users, color: 'from-blue-500/20 to-blue-900/10 border-blue-500/20' },
          { label: 'Audit Logs', desc: 'View privacy & session logs', path: '/superadmin/logs', icon: ShieldCheck, color: 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/20' },
        ].map(({ label, desc, path, icon: Icon, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`rounded-2xl bg-gradient-to-br ${color} border p-5 text-left hover:scale-[1.02] transition-transform`}
          >
            <Icon size={22} className="text-mist mb-3" />
            <p className="font-semibold text-mist">{label}</p>
            <p className="text-xs text-fog mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mist">Recent sessions (all institutions)</h2>
          <button onClick={() => navigate('/superadmin/sessions')} className="text-xs text-scan-400 hover:text-scan-300">
            View all →
          </button>
        </div>
        <div className="rounded-2xl bg-ink-900 border border-ink-700/40 px-4 py-2 divide-y divide-ink-700/20">
          {sessions.slice(0, 8).length === 0
            ? <p className="py-6 text-center text-sm text-fog">No sessions yet.</p>
            : sessions.slice(0, 8).map((s) => <ActivityRow key={s.id} session={s} />)
          }
        </div>
      </div>
    </div>
  );
}
