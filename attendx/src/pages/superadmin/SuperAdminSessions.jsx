import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import DataTable from '../../components/molecules/DataTable';
import * as sa from '../../services/superAdminService';

const STATUS_BADGE = {
  live: 'bg-status-present/15 text-status-present',
  finalized: 'bg-ink-700/40 text-fog',
  indexing: 'bg-status-review/15 text-status-review',
  expired: 'bg-status-absent/15 text-status-absent',
  finalizing: 'bg-amber-500/15 text-amber-400',
};

export default function SuperAdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    sa.listSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);
  const liveCnt = sessions.filter((s) => s.status === 'live').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-mist">All Sessions</h1>
          <p className="text-sm text-fog mt-0.5">
            {liveCnt > 0
              ? <span className="text-status-present font-medium">{liveCnt} live right now — </span>
              : ''}
            Across all institutions.
          </p>
        </div>
        {/* Status filter */}
        <div className="flex gap-1.5">
          {['all', 'live', 'finalized', 'expired'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === s ? 'bg-scan-500/15 text-scan-400' : 'text-fog hover:text-mist'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-ink-900 border border-ink-700/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <DataTable
          rows={filtered}
          emptyTitle="No sessions found"
          columns={[
            { key: 'course_name', header: 'Course' },
            { key: 'institution_name', header: 'Institution', render: (r) => r.institution_name || <span className="text-fog italic">—</span> },
            { key: 'professor_name', header: 'Professor' },
            {
              key: 'started_at', header: 'Started',
              render: (r) => new Date(r.started_at).toLocaleString(),
            },
            {
              key: 'attendance', header: 'Attendance',
              render: (r) => <span className="font-mono text-xs">{r.present_count}/{r.total_logged}</span>,
            },
            {
              key: 'status', header: 'Status',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[r.status] || ''}`}>
                  {r.status}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
