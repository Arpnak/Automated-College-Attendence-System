import { useEffect, useState } from 'react';
import { Plus, Search, UserPlus, Check, Trash2, AlertTriangle, Copy } from 'lucide-react';
import Button from '../../components/atoms/Button';
import TextField from '../../components/atoms/TextField';
import Modal from '../../components/atoms/Modal';
import * as adminService from '../../services/adminService';
import { useToast } from '../../hooks/useToast';

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="space-y-1">
      <p className="text-xs text-fog">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2">
        <code className="flex-1 text-sm text-scan-400 font-mono">{value}</code>
        <button onClick={copy} className="text-fog hover:text-mist">
          <Copy size={14} className={copied ? 'text-status-present' : ''} />
        </button>
      </div>
    </div>
  );
}

const TABS = ['Create New', 'Link Existing'];

export default function AdminProfessors() {
  const { toast } = useToast();
  const [professors, setProfessors] = useState([]);
  const [tab, setTab] = useState(0); // 0 = create, 1 = link by email

  // Create-new form
  const [createForm, setCreateForm] = useState({ name: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [createdCred, setCreatedCred] = useState(null);

  // Link-existing search
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(undefined);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Remove
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => adminService.listProfessors().then(setProfessors).catch(() => {});
  useEffect(() => { load(); }, []);

  // ── Create new ──
  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!createForm.name || !createForm.email) return;
    setCreating(true);
    try {
      const result = await adminService.addProfessor(createForm);
      setCreatedCred({ email: result.email, password: result.temporaryPassword });
      setCreateForm({ name: '', email: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  // ── Link existing ──
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(undefined);
    try {
      const result = await adminService.searchUserByEmail(searchEmail.trim());
      setSearchResult((!result || result.role !== 'professor') ? null : result);
    } catch { setSearchResult(null); }
    finally { setSearching(false); }
  };

  const handleLink = async () => {
    if (!searchResult) return;
    setAdding(true);
    try {
      const res = await adminService.addProfessorToInstitution(searchResult.id);
      if (res?.alreadyAdded) {
        toast.info(`${searchResult.name} is already in your institution.`);
      } else {
        toast.success(`${searchResult.name} linked to your institution.`);
      }
      setSearchResult({ ...searchResult, alreadyAdded: true });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setAdding(false); }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await adminService.removeProfessor(removeTarget.id);
      toast.info(`${removeTarget.name} removed. Their courses are preserved.`);
      setRemoveTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setRemoving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Professors</h1>
        <p className="text-sm text-fog">Add professors to your institution or create new accounts.</p>
      </div>

      {/* Tab switcher */}
      <div className="card p-5 space-y-4">
        <div className="flex gap-1 bg-ink-800/40 rounded-lg p-1">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === i ? 'bg-scan-500/15 text-scan-400' : 'text-fog hover:text-mist'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Create new tab */}
        {tab === 0 && (
          <form onSubmit={handleCreate} className="space-y-3">
            <TextField
              label="Full name"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Dr. Jane Smith"
            />
            <TextField
              label="Email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="jane@university.edu"
            />
            <Button type="submit" icon={Plus} loading={creating} className="w-full">
              Create professor account
            </Button>
            <p className="text-xs text-fog text-center">
              A temporary password will be generated — you'll see it once.
            </p>
          </form>
        )}

        {/* Link existing tab */}
        {tab === 1 && (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <TextField
                  label=""
                  type="email"
                  placeholder="professor@university.edu"
                  value={searchEmail}
                  onChange={(e) => { setSearchEmail(e.target.value); setSearchResult(undefined); }}
                />
              </div>
              <Button type="submit" icon={Search} loading={searching} className="self-end">
                Search
              </Button>
            </form>
            {searchResult === null && (
              <p className="text-sm text-fog">No professor found with that email.</p>
            )}
            {searchResult && (
              <div className="flex items-center justify-between rounded-lg border border-ink-700/30 bg-ink-800/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-mist">{searchResult.name}</p>
                  <p className="text-xs text-fog">{searchResult.email}</p>
                </div>
                {searchResult.alreadyAdded ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-scan-500">
                    <Check size={13} /> Already Added
                  </span>
                ) : (
                  <Button size="sm" icon={UserPlus} loading={adding} onClick={handleLink}>
                    Link to Institution
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Professors list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-950 dark:text-mist">
          Professors in Institution ({professors.length})
        </h2>
        {professors.length === 0 ? (
          <div className="rounded-xl bg-ink-900 border border-ink-700/40 p-8 text-center text-sm text-fog">
            No professors yet — create or link one above.
          </div>
        ) : (
          <div className="space-y-2">
            {professors.map((p) => (
              <div key={p.id} className="card flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-950 dark:text-mist">{p.name}</p>
                  <p className="text-xs text-fog">{p.email}</p>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoveTarget(p)}
                  className="text-status-absent hover:bg-status-absent/10">
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Credentials modal */}
      <Modal open={!!createdCred} onClose={() => setCreatedCred(null)} title="Professor account created ✓"
        footer={<Button onClick={() => { setCreatedCred(null); load(); }}>Done</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-fog">Share these login credentials with the professor. The password will <strong className="text-mist">not be shown again</strong>.</p>
          <CopyRow label="Email" value={createdCred?.email || ''} />
          <CopyRow label="Temporary password" value={createdCred?.password || ''} />
        </div>
      </Modal>

      {/* Remove confirmation */}
      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove professor?"
        footer={<>
          <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={removing} icon={Trash2} onClick={handleRemove}>Remove</Button>
        </>}>
        <div className="flex gap-3 items-start">
          <AlertTriangle size={20} className="text-status-review shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-mist">Remove <strong>{removeTarget?.name}</strong> from your institution?</p>
            <p className="text-xs text-fog">Their courses will <strong>not</strong> be deleted — they'll be marked unassigned.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
