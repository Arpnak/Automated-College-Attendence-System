import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Copy, Check } from 'lucide-react';
import Button from '../../components/atoms/Button';
import Modal from '../../components/atoms/Modal';
import TextField from '../../components/atoms/TextField';
import DataTable from '../../components/molecules/DataTable';
import { useToast } from '../../hooks/useToast';
import * as sa from '../../services/superAdminService';

function CopyablePassword({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg bg-ink-800 border border-ink-700/40 px-3 py-2">
      <code className="flex-1 text-sm text-scan-400 font-mono">{value}</code>
      <button onClick={copy} className="text-fog hover:text-mist">
        {copied ? <Check size={15} className="text-status-present" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

const EMPTY_FORM = { name: '', email: '', password: '', institutionId: '' };

export default function SuperAdminAdmins() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [createdCred, setCreatedCred] = useState(null);  // shows generated password
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => {
    sa.listAdmins().then(setAdmins).catch(() => {});
    sa.listInstitutions().then(setInstitutions).catch(() => {});
  };
  useEffect(load, []);

  const filtered = admins.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const result = await sa.createAdmin(form);
      setCreatedCred({ email: result.email, password: result.generatedPassword || form.password });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await sa.updateAdmin(editTarget.id, { name: form.name, email: form.email, institutionId: form.institutionId });
      toast.success('Admin updated.');
      setEditTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (!form.password) return;
    setSaving(true);
    try {
      await sa.updateAdmin(resetTarget.id, { password: form.password });
      toast.success(`Password reset for ${resetTarget.name}.`);
      setResetTarget(null);
      setForm(EMPTY_FORM);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await sa.deleteAdmin(deleteTarget.id);
      toast.success(`Admin "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (admin) => {
    setEditTarget(admin);
    setForm({ ...EMPTY_FORM, name: admin.name, email: admin.email, institutionId: admin.institution_id || '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-mist">Admins</h1>
          <p className="text-sm text-fog mt-0.5">Create and manage institution-level admins.</p>
        </div>
        <Button icon={Plus} onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
          New Admin
        </Button>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-xl bg-ink-900 border border-ink-700/40 px-4 py-2 text-sm text-mist placeholder:text-fog outline-none focus:border-scan-500/50"
      />

      {/* Table */}
      <DataTable
        rows={filtered}
        emptyTitle="No admins yet"
        emptyDescription="Create the first admin account for an institution."
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'email', header: 'Email' },
          { key: 'institution_name', header: 'Institution', render: (r) => r.institution_name || <span className="text-fog italic">Unassigned</span> },
          { key: 'created_at', header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
          {
            key: '_actions', header: '',
            render: (r) => (
              <div className="flex items-center gap-1 justify-end">
                <button title="Edit" onClick={() => openEdit(r)}
                  className="p-1.5 rounded-lg text-fog hover:text-mist hover:bg-ink-800 transition-colors">
                  <Pencil size={14} />
                </button>
                <button title="Reset password" onClick={() => { setResetTarget(r); setForm(EMPTY_FORM); }}
                  className="p-1.5 rounded-lg text-fog hover:text-scan-400 hover:bg-scan-500/10 transition-colors">
                  <KeyRound size={14} />
                </button>
                <button title="Delete" onClick={() => setDeleteTarget(r)}
                  className="p-1.5 rounded-lg text-fog hover:text-status-absent hover:bg-status-absent/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create admin"
        footer={<>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleCreate}>Create admin</Button>
        </>}>
        <form className="space-y-3" onSubmit={handleCreate}>
          <TextField label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Password (leave blank to auto-generate)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div>
            <label className="block text-xs font-medium text-fog mb-1">Institution (optional)</label>
            <select
              value={form.institutionId}
              onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
              className="w-full rounded-xl bg-ink-800 border border-ink-700/40 px-3 py-2 text-sm text-mist outline-none focus:border-scan-500/50"
            >
              <option value="">— None —</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit "${editTarget?.name}"`}
        footer={<>
          <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button loading={saving} onClick={handleEdit}>Save changes</Button>
        </>}>
        <form className="space-y-3" onSubmit={handleEdit}>
          <TextField label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div>
            <label className="block text-xs font-medium text-fog mb-1">Institution</label>
            <select
              value={form.institutionId}
              onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
              className="w-full rounded-xl bg-ink-800 border border-ink-700/40 px-3 py-2 text-sm text-mist outline-none focus:border-scan-500/50"
            >
              <option value="">— None —</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset password for "${resetTarget?.name}"`}
        footer={<>
          <Button variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button loading={saving} onClick={handleResetPassword}>Reset password</Button>
        </>}>
        <form className="space-y-3" onSubmit={handleResetPassword}>
          <TextField label="New password" type="password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Enter new password" />
        </form>
      </Modal>

      {/* Created credentials modal */}
      <Modal open={!!createdCred} onClose={() => setCreatedCred(null)} title="Admin created ✓"
        footer={<Button onClick={() => setCreatedCred(null)}>Done</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-fog">Share these credentials with the new admin. The password will <strong className="text-mist">not be shown again</strong>.</p>
          <div className="space-y-1.5">
            <p className="text-xs text-fog">Email</p>
            <CopyablePassword value={createdCred?.email} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-fog">Password</p>
            <CopyablePassword value={createdCred?.password || '(user-specified)'} />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete admin?"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={handleDelete}>Delete</Button>
        </>}>
        <p className="text-sm text-fog">
          This will permanently delete admin account <strong className="text-mist">{deleteTarget?.email}</strong>.
          Courses and professors linked to this institution remain unaffected.
        </p>
      </Modal>
    </div>
  );
}
