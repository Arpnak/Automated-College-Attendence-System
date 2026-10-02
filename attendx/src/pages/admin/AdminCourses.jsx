import { useEffect, useState } from 'react';
import { Plus, UserMinus, RefreshCw } from 'lucide-react';
import Modal from '../../components/atoms/Modal';
import Button from '../../components/atoms/Button';
import TextField from '../../components/atoms/TextField';
import EmptyState from '../../components/atoms/EmptyState';
import * as courseService from '../../services/courseService';
import * as adminService from '../../services/adminService';
import { useToast } from '../../hooks/useToast';

export default function AdminCourses() {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [professors, setProfessors] = useState([]);

  // Create course modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', professorId: '', term: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  // Enrollment detail modal
  const [detailCourse, setDetailCourse] = useState(null);
  const [courseDetail, setCourseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reassignCourse, setReassignCourse] = useState(null);
  const [newProfessorId, setNewProfessorId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Delete course modal
  const [deleteCourseTarget, setDeleteCourseTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => courseService.listAllCourses().then(setCourses);

  useEffect(() => {
    load();
    adminService.listProfessors().then(setProfessors);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await courseService.createCourse(form);
      toast.success(`${form.name} created.`);
      setCreateOpen(false);
      setForm({ name: '', code: '', professorId: '', term: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (course) => {
    setDetailCourse(course);
    setDetailLoading(true);
    try {
      const detail = await courseService.getCourse(course.id);
      setCourseDetail(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setDetailCourse(null); setCourseDetail(null); };

  const handleReassign = async (e) => {
    e.preventDefault();
    setReassigning(true);
    try {
      await courseService.updateCourse(reassignCourse.id, { professorId: newProfessorId || null });
      toast.success('Professor reassigned.');
      setReassignCourse(null);
      setNewProfessorId('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReassigning(false);
    }
  };

  const handleDeleteCourse = async () => {
    setDeleting(true);
    try {
      await courseService.deleteCourse(deleteCourseTarget.id);
      toast.success(`${deleteCourseTarget.code} deleted successfully.`);
      setDeleteCourseTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Courses</h1>
          <p className="text-sm text-fog">Create and oversee every course at your institution.</p>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>Add Course</Button>
      </div>

      {/* Course Card Grid */}
      {courses.length === 0 ? (
        <EmptyState icon={Plus} title="No courses yet" description="Add your first course to get started." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="card flex flex-col gap-3 p-5">
              {/* Code + Term */}
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-fog bg-ink-800/60 rounded px-1.5 py-0.5">{c.code}</span>
                <span className="text-[10px] text-fog">{c.term}</span>
              </div>

              {/* Name */}
              <h3 className="font-display text-sm font-semibold text-ink-950 dark:text-mist leading-snug">{c.name}</h3>

              {/* Professor */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-fog truncate">
                  {c.professor?.name
                    ? `Prof. ${c.professor.name}`
                    : <span className="text-status-review italic">No professor assigned</span>}
                </p>
                {!c.professor?.name && (
                  <button
                    onClick={() => { setReassignCourse(c); setNewProfessorId(''); }}
                    className="text-[10px] text-scan-500 hover:underline shrink-0"
                  >
                    Assign
                  </button>
                )}
                {c.professor?.name && (
                  <button
                    onClick={() => { setReassignCourse(c); setNewProfessorId(c.professor.id || ''); }}
                    className="text-[10px] text-fog hover:text-scan-500 shrink-0"
                    title="Reassign professor"
                  >
                    <RefreshCw size={11} />
                  </button>
                )}
              </div>

              {/* Action */}
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => openDetail(c)}>
                  View Enrolled Students
                </Button>
                <Button size="sm" variant="danger" className="px-3" onClick={() => setDeleteCourseTarget(c)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Course Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add course"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleAdd}>Create course</Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={handleAdd}>
          <TextField label="Course name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Course code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <TextField label="Term" required value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="Fall 2026" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-950 dark:text-mist">Professor</label>
            {professors.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink-700/30 px-3 py-2 text-xs text-fog">
                No professors in your institution yet.{' '}
                <a href="/admin/professors" className="text-scan-500 hover:underline">Add a professor first →</a>
              </p>
            ) : (
              <select
                value={form.professorId}
                onChange={(e) => setForm({ ...form, professorId: e.target.value })}
                className="rounded-lg border border-ink-700/30 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 text-sm text-ink-950 dark:text-mist"
              >
                <option value="">Select a professor (optional)</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          {/* Course schedule dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-950 dark:text-mist">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="rounded-lg border border-ink-700/30 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 text-sm text-ink-950 dark:text-mist"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-950 dark:text-mist">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="rounded-lg border border-ink-700/30 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 text-sm text-ink-950 dark:text-mist"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Enrolled Students Modal ── */}
      <Modal
        open={Boolean(detailCourse)}
        onClose={closeDetail}
        title={detailCourse ? `${detailCourse.code} — ${detailCourse.name}` : ''}
      >
        {detailLoading ? (
          <p className="text-sm text-fog py-4 text-center">Loading roster…</p>
        ) : courseDetail ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-xs text-fog">
              {courseDetail.professor?.name
                ? `Taught by ${courseDetail.professor.name}`
                : <span className="text-status-review">No professor assigned</span>}
              {' · '}{courseDetail.roster?.length ?? 0} enrolled
            </p>
            {!courseDetail.roster?.length ? (
              <EmptyState icon={UserMinus} title="No enrolled students" description="Students approved by the professor appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700/30">
                    <th className="py-2 text-left text-xs font-semibold text-fog">Name</th>
                    <th className="py-2 text-left text-xs font-semibold text-fog">Roll No.</th>
                    <th className="py-2 text-left text-xs font-semibold text-fog">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {courseDetail.roster.map((s) => (
                    <tr key={s.id} className="border-b border-ink-700/10 hover:bg-ink-800/30">
                      <td className="py-2 font-medium text-ink-950 dark:text-mist">{s.name}</td>
                      <td className="py-2 font-mono text-fog text-xs">{s.student_number || '—'}</td>
                      <td className="py-2 text-fog text-xs truncate max-w-[120px]">{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ── Reassign Professor Modal ── */}
      <Modal
        open={Boolean(reassignCourse)}
        onClose={() => setReassignCourse(null)}
        title={`Assign professor — ${reassignCourse?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassignCourse(null)}>Cancel</Button>
            <Button loading={reassigning} onClick={handleReassign}>Save</Button>
          </>
        }
      >
        <form onSubmit={handleReassign} className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-950 dark:text-mist">Select professor</label>
            <select
              value={newProfessorId}
              onChange={(e) => setNewProfessorId(e.target.value)}
              className="rounded-lg border border-ink-700/30 dark:border-ink-600 bg-white dark:bg-ink-800 px-3 py-2 text-sm text-ink-950 dark:text-mist"
            >
              <option value="">— Unassign professor —</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* ── Delete Course Modal ── */}
      <Modal
        open={Boolean(deleteCourseTarget)}
        onClose={() => setDeleteCourseTarget(null)}
        title={`Delete Course — ${deleteCourseTarget?.code}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteCourseTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteCourse}>Delete Course</Button>
          </>
        }
      >
        <p className="text-sm font-bold text-status-review dark:text-red-400">
          Are you sure you want to delete {deleteCourseTarget?.name}? This action cannot be undone and will permanently delete all associated attendance records and sessions!
        </p>
      </Modal>
    </div>
  );
}
