import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Building2, ChevronRight } from 'lucide-react';
import Button from '../../components/atoms/Button';
import Modal from '../../components/atoms/Modal';
import TextField from '../../components/atoms/TextField';
import { useToast } from '../../hooks/useToast';
import * as sa from '../../services/superAdminService';

function InstitutionCard({ inst, onEdit, onDelete, onToggle }) {
  return (
    <div className={`rounded-2xl bg-ink-900 border ${inst.is_active ? 'border-ink-700/40' : 'border-status-absent/30 opacity-70'} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-mist">{inst.name}</h3>
            {inst.domain && <p className="text-xs text-fog">{inst.domain}</p>}
          </div>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${inst.is_active ? 'bg-status-present/15 text-status-present' : 'bg-status-absent/15 text-status-absent'}`}>
          {inst.is_active ? 'Active' : 'Suspended'}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Admins', val: inst.adminCount ?? 0 },
          { label: 'Professors', val: inst.professorCount ?? 0 },
          { label: 'Students', val: inst.studentCount ?? 0 },
          { label: 'Courses', val: inst.courseCount ?? 0 },
        ].map(({ label, val }) => (
          <div key={label} className="text-center rounded-lg bg-ink-800 py-2">
            <p className="text-base font-bold text-mist">{val}</p>
            <p className="text-[10px] text-fog">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(inst)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-ink-700/40 text-fog hover:text-mist hover:border-ink-600 transition-colors"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => onToggle(inst)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border border-ink-700/40 text-fog hover:text-mist hover:border-ink-600 transition-colors"
        >
          {inst.is_active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
          {inst.is_active ? 'Suspend' : 'Activate'}
        </button>
        <button
          onClick={() => onDelete(inst)}
          className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg border border-status-absent/30 text-status-absent hover:bg-status-absent/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminInstitutions() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', domain: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    sa.listInstitutions().then(setInstitutions).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await sa.createInstitution(form);
      toast.success(`Institution "${form.name}" created.`);
      setCreateOpen(false);
      setForm({ name: '', domain: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await sa.updateInstitution(editTarget.id, form);
      toast.success('Institution updated.');
      setEditTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (inst) => {
    try {
      await sa.updateInstitution(inst.id, { isActive: !inst.is_active });
      toast.success(`Institution ${inst.is_active ? 'suspended' : 'activated'}.`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await sa.deleteInstitution(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (inst) => {
    setEditTarget(inst);
    setForm({ name: inst.name, domain: inst.domain || '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-mist">Institutions</h1>
          <p className="text-sm text-fog mt-0.5">Manage all universities on AttendX.</p>
        </div>
        <Button icon={Plus} onClick={() => { setForm({ name: '', domain: '' }); setCreateOpen(true); }}>
          New Institution
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-ink-900 border border-ink-700/40 h-52 animate-pulse" />
          ))}
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-2xl bg-ink-900 border border-ink-700/40 p-16 text-center">
          <Building2 size={36} className="mx-auto text-fog mb-3" />
          <p className="text-sm font-medium text-mist">No institutions yet</p>
          <p className="text-xs text-fog mt-1">Create your first institution to get started.</p>
          <Button className="mt-4" icon={Plus} onClick={() => setCreateOpen(true)}>
            Create institution
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {institutions.map((inst) => (
            <div key={inst.id} className="group relative cursor-pointer" onClick={() => navigate(`/superadmin/institutions/${inst.id}`)}>
              <InstitutionCard
                inst={inst}
                onEdit={(e) => { e.stopPropagation?.(); openEdit(inst); }}
                onDelete={(e) => { e.stopPropagation?.(); setDeleteTarget(inst); }}
                onToggle={(e) => { e.stopPropagation?.(); handleToggle(inst); }}
              />
              <div className="absolute top-4 right-[9rem] opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={16} className="text-fog" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create institution"
        footer={<>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleCreate}>Create</Button>
        </>}>
        <form className="space-y-3" onSubmit={handleCreate}>
          <TextField label="Institution name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MIT" />
          <TextField label="Domain (optional)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="e.g. mit.edu" />
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit "${editTarget?.name}"`}
        footer={<>
          <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button loading={saving} onClick={handleEdit}>Save</Button>
        </>}>
        <form className="space-y-3" onSubmit={handleEdit}>
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete institution?"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={handleDelete}>Delete permanently</Button>
        </>}>
        <p className="text-sm text-fog">
          This will delete <strong className="text-mist">"{deleteTarget?.name}"</strong> and remove all institution linkages. User accounts are retained but unlinked.
        </p>
      </Modal>
    </div>
  );
}
