import { useEffect, useState } from 'react';
import { Building2, Edit2, Check, X, BookOpen } from 'lucide-react';
import EmptyState from '../../components/atoms/EmptyState';
import * as studentService from '../../services/studentService';
import { useToast } from '../../hooks/useToast';

function RollEditor({ institutionId, initial, onSaved }) {
  const { toast }    = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(initial || '');
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await studentService.updateRollNumber(institutionId, value.trim());
      onSaved(value.trim());
      setEditing(false);
      toast.success('Roll number updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return editing ? (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter roll number"
        className="rounded-md border border-scan-500/50 bg-ink-800/60 px-2 py-1 text-xs text-mist focus:outline-none focus:ring-1 focus:ring-scan-500"
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-status-present hover:brightness-125">
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} className="text-fog hover:text-mist">
        <X size={14} />
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 mt-1">
      <p className="text-xs text-fog">
        Roll: <span className="font-mono text-mist">{value || '—'}</span>
      </p>
      <button
        onClick={() => setEditing(true)}
        className="text-fog hover:text-scan-400 transition-colors"
        title="Edit roll number"
      >
        <Edit2 size={11} />
      </button>
    </div>
  );
}

export default function StudentInstitutions() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    studentService.getMyInstitutions()
      .then(setInstitutions)
      .catch(() => setInstitutions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRollSaved = (institutionId, newRoll) => {
    setInstitutions((prev) =>
      prev.map((item) =>
        item.institution.id === institutionId ? { ...item, rollNumber: newRoll } : item
      )
    );
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">My Institutions</h1>
        <p className="text-sm text-fog mt-0.5">All institutions you belong to, with your roll number for each.</p>
      </div>

      {institutions.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No institutions yet"
          description="An admin needs to add you to an institution first."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {institutions.map(({ institution, rollNumber, courseCount }) => (
            <div key={institution.id} className="card p-5 space-y-3">
              {/* Icon + name */}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-scan-500/12 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-scan-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold text-ink-950 dark:text-mist leading-snug truncate">
                    {institution.name}
                  </h3>
                  {institution.domain && (
                    <p className="text-[10px] text-fog truncate">{institution.domain}</p>
                  )}
                </div>
              </div>

              {/* Roll number (editable) */}
              <RollEditor
                institutionId={institution.id}
                initial={rollNumber}
                onSaved={(roll) => handleRollSaved(institution.id, roll)}
              />

              {/* Course count */}
              <div className="flex items-center gap-1.5 text-xs text-fog pt-1 border-t border-ink-700/10">
                <BookOpen size={13} />
                <span>{courseCount} course{courseCount !== 1 ? 's' : ''} available</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
