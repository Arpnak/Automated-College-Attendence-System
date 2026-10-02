import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import DataTable from '../../components/molecules/DataTable';
import * as sa from '../../services/superAdminService';

const ACTION_COLORS = {
  s3_purge: 'text-blue-400 bg-blue-500/10',
  redis_ttl_event: 'text-violet-400 bg-violet-500/10',
  manual_finalize: 'text-amber-400 bg-amber-500/10',
};

export default function SuperAdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    sa.listLogs().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = !search
    ? logs
    : logs.filter((l) =>
        [l.action, l.triggered_by, l.course_name, l.institution_name, l.professor_name]
          .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-mist">Audit Logs</h1>
            <p className="text-sm text-fog mt-0.5">Privacy and session audit trail — all institutions.</p>
          </div>
        </div>
        <input
          type="search"
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl bg-ink-900 border border-ink-700/40 px-4 py-2 text-sm text-mist placeholder:text-fog outline-none focus:border-scan-500/50 w-64"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-ink-900 border border-ink-700/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <DataTable
          rows={filtered}
          emptyTitle="No audit events yet"
          emptyDescription="Privacy audit events are generated when session images are deleted."
          columns={[
            {
              key: 'action', header: 'Action',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold ${ACTION_COLORS[r.action] || 'text-fog bg-ink-800'}`}>
                  {r.action}
                </span>
              ),
            },
            { key: 'triggered_by', header: 'Triggered By' },
            { key: 'institution_name', header: 'Institution', render: (r) => r.institution_name || '—' },
            { key: 'course_name', header: 'Course', render: (r) => r.course_name || '—' },
            { key: 'session_status', header: 'Session Status', render: (r) => r.session_status || '—' },
            {
              key: 'occurred_at', header: 'When',
              render: (r) => new Date(r.occurred_at).toLocaleString(),
            },
          ]}
        />
      )}
    </div>
  );
}
