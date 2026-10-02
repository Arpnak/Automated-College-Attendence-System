import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Users, GraduationCap, BookOpen, Activity, ToggleLeft, ToggleRight } from 'lucide-react';
import Button from '../../components/atoms/Button';
import DataTable from '../../components/molecules/DataTable';
import { useToast } from '../../hooks/useToast';
import * as sa from '../../services/superAdminService';

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-scan-500/15 text-scan-400' : 'text-fog hover:text-mist'
      }`}
    >
      {children}
    </button>
  );
}

const STATUS_BADGE = {
  live: 'bg-status-present/15 text-status-present',
  finalized: 'bg-ink-700/40 text-fog',
  indexing: 'bg-status-review/15 text-status-review',
  expired: 'bg-status-absent/15 text-status-absent',
};

export default function SuperAdminInstitutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('admins');

  const load = () => sa.getInstitution(id).then(setData).catch(() => toast.error('Failed to load institution.'));
  useEffect(load, [id]);

  const handleToggle = async () => {
    try {
      await sa.updateInstitution(id, { isActive: !data.is_active });
      toast.success(`Institution ${data.is_active ? 'suspended' : 'activated'}.`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-4 border-scan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/superadmin/institutions')}
          className="p-2 rounded-lg text-fog hover:text-mist hover:bg-ink-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Building2 size={18} className="text-violet-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-mist">{data.name}</h1>
              {data.domain && <p className="text-xs text-fog">{data.domain}</p>}
            </div>
            <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full font-semibold ${data.is_active ? 'bg-status-present/15 text-status-present' : 'bg-status-absent/15 text-status-absent'}`}>
              {data.is_active ? 'Active' : 'Suspended'}
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={data.is_active ? ToggleLeft : ToggleRight}
          onClick={handleToggle}
        >
          {data.is_active ? 'Suspend' : 'Activate'}
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Admins', val: data.admins?.length ?? 0, color: 'text-blue-400' },
          { icon: Users, label: 'Professors', val: data.professors?.length ?? 0, color: 'text-pink-400' },
          { icon: GraduationCap, label: 'Courses', val: data.courses?.length ?? 0, color: 'text-amber-400' },
          { icon: Activity, label: 'Recent Sessions', val: data.recentSessions?.length ?? 0, color: 'text-scan-400' },
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="rounded-xl bg-ink-900 border border-ink-700/40 p-4">
            <Icon size={18} className={`${color} mb-2`} />
            <p className="text-xl font-bold text-mist">{val}</p>
            <p className="text-xs text-fog">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-700/30 pb-0.5">
        {['admins', 'professors', 'courses', 'sessions'].map((t) => (
          <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'admins' && (
        <DataTable
          rows={data.admins || []}
          emptyTitle="No admins yet"
          emptyDescription="Create an admin for this institution from the Admins page."
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
            { key: 'created_at', header: 'Added', render: (r) => new Date(r.created_at).toLocaleDateString() },
          ]}
        />
      )}

      {tab === 'professors' && (
        <DataTable
          rows={data.professors || []}
          emptyTitle="No professors yet"
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
          ]}
        />
      )}

      {tab === 'courses' && (
        <DataTable
          rows={data.courses || []}
          emptyTitle="No courses yet"
          columns={[
            { key: 'name', header: 'Course' },
            { key: 'code', header: 'Code' },
            { key: 'term', header: 'Term' },
            { key: 'professor_name', header: 'Professor' },
            { key: 'enrolled', header: 'Enrolled' },
          ]}
        />
      )}

      {tab === 'sessions' && (
        <DataTable
          rows={data.recentSessions || []}
          emptyTitle="No sessions yet"
          columns={[
            { key: 'course_name', header: 'Course' },
            { key: 'professor_name', header: 'Professor' },
            { key: 'started_at', header: 'Started', render: (r) => new Date(r.started_at).toLocaleString() },
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
