import { useEffect, useState } from 'react';
import { Search, UserPlus, Check, Trash2, AlertTriangle } from 'lucide-react';
import Button from '../../components/atoms/Button';
import TextField from '../../components/atoms/TextField';
import Modal from '../../components/atoms/Modal';
import EmptyState from '../../components/atoms/EmptyState';
import * as adminService from '../../services/adminService';
import { useToast } from '../../hooks/useToast';

export default function AdminStudents() {
  const { toast } = useToast();

  // Existing students list
  const [students, setStudents] = useState([]);

  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(undefined); // undefined=idle, null=not found, object=found
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Remove confirmation modal
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => adminService.listStudents().then(setStudents);
  useEffect(() => { load(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(undefined);
    try {
      const result = await adminService.searchUserByEmail(searchEmail.trim());
      if (!result || result.role !== 'student') {
        setSearchResult(null);
      } else {
        setSearchResult(result);
      }
    } catch {
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!searchResult) return;
    setAdding(true);
    try {
      const res = await adminService.addStudentToInstitution(searchResult.id);
      if (res?.alreadyAdded) {
        toast.info(`${searchResult.name} is already in your institution.`);
      } else {
        toast.success(`${searchResult.name} added as student.`);
      }
      setSearchResult({ ...searchResult, alreadyAdded: true });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await adminService.removeStudent(removeTarget.id);
      toast.info(`${removeTarget.name} removed from institution.`);
      setRemoveTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Add Student</h1>
        <p className="text-sm text-fog">Search for a registered student by email and add them to your institution.</p>
      </div>

      {/* Search bar */}
      <div className="card p-5 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1">
            <TextField
              label=""
              type="email"
              placeholder="student@university.edu"
              value={searchEmail}
              onChange={(e) => { setSearchEmail(e.target.value); setSearchResult(undefined); }}
            />
          </div>
          <Button type="submit" icon={Search} loading={searching} className="self-end">
            Search
          </Button>
        </form>

        {/* Search result */}
        {searchResult === null && (
          <p className="text-sm text-fog">
            No student found with that email. Make sure they've registered an account first.
          </p>
        )}
        {searchResult && (
          <div className="flex items-center justify-between rounded-lg border border-ink-700/30 bg-ink-800/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-950 dark:text-mist">{searchResult.name}</p>
              <p className="text-xs text-fog">{searchResult.email}</p>
            </div>
            {searchResult.alreadyAdded ? (
              <span className="flex items-center gap-1 text-xs font-medium text-scan-500">
                <Check size={13} /> Already Added
              </span>
            ) : (
              <Button size="sm" icon={UserPlus} loading={adding} onClick={handleAdd}>
                Add to Institution
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Students in institution */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-950 dark:text-mist">
          Students in Institution ({students.length})
        </h2>
        {students.length === 0 ? (
          <EmptyState title="No students yet" description="Search and add students above." />
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <div key={s.id} className="card flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-950 dark:text-mist">{s.name}</p>
                  <p className="text-xs text-fog">
                    {s.email}
                    {s.student_number && <span className="ml-2 font-mono text-[10px] bg-ink-800/60 rounded px-1">{s.student_number}</span>}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => setRemoveTarget(s)}
                  className="text-status-absent hover:bg-status-absent/10"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Remove Confirmation Modal */}
      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove student?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={removing} icon={Trash2} onClick={handleRemove}>
              Remove
            </Button>
          </>
        }
      >
        <div className="flex gap-3 items-start">
          <AlertTriangle size={20} className="text-status-review shrink-0 mt-0.5" />
          <p className="text-sm text-ink-950 dark:text-mist">
            Are you sure you want to remove <strong>{removeTarget?.name}</strong> from your institution?
            Their course enrollment history is preserved.
          </p>
        </div>
      </Modal>
    </div>
  );
}
