import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check, X, UserMinus, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, Mail, Hash
} from 'lucide-react';
import Button from '../../components/atoms/Button';
import EmptyState from '../../components/atoms/EmptyState';
import Modal from '../../components/atoms/Modal';
import AttendanceBar from '../../components/atoms/AttendanceBar';
import AttendanceHeatmap from '../../components/molecules/AttendanceHeatmap';
import * as courseService from '../../services/courseService';
import { useToast } from '../../hooks/useToast';
import { calcAttendance, buildCalendarGrid, todayStr } from '../../utils/attendanceCalc';

function WorkingDaysToggle({ courseId, workingDays, onToggle, toast }) {
  const [loading, setLoading] = useState(false);
  const today = todayStr();
  const isWorkingDay = workingDays.includes(today);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await courseService.toggleWorkingDay(courseId, today, !isWorkingDay);
      toast.success(isWorkingDay ? 'Today removed from class days.' : 'Today marked as a class day.');
      onToggle(); // refresh data
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-ink-900/40 p-3 rounded-lg border border-ink-800">
      <div>
        <p className="text-sm font-medium text-ink-950 dark:text-mist">Today's Class</p>
        <p className="text-xs text-fog">Record today as an official working day.</p>
      </div>
      <Button 
        size="sm" 
        variant={isWorkingDay ? 'secondary' : 'primary'}
        loading={loading}
        onClick={handleToggle}
      >
        {isWorkingDay ? 'Unmark Today' : 'Mark as Class Day'}
      </Button>
    </div>
  );
}

// ── Color tint per attendance tier ────────────────────────────────────────────
const ROW_BG = {
  green:  'border-l-2 border-status-present/50 bg-status-present/4',
  yellow: 'border-l-2 border-yellow-400/50 bg-yellow-400/4',
  red:    'border-l-2 border-status-absent/50 bg-status-absent/4',
};

// ── Single enrolled student row ───────────────────────────────────────────────
function StudentRow({ s, courseId, courseStartDate, courseEndDate, onRemove, toast }) {
  const [open, setOpen]           = useState(false);
  const [attData, setAttData]     = useState(null);   // { attendanceMap, days }
  const [attLoading, setAttLoading] = useState(false);

  // Compute attendance percentage from backend-provided stats (fast path)
  const pct   = s.totalRecords > 0 ? Math.round((s.attended / s.totalRecords) * 100) : 0;
  const color = pct === 0 ? 'green' : pct >= 75 ? 'green' : pct >= 50 ? 'yellow' : 'red';

  const loadAtt = useCallback(async () => {
    if (attData) return;
    setAttLoading(true);
    try {
      const data = await courseService.getStudentAttendance(courseId, s.id);
      const days = buildCalendarGrid({
        startDate:  data.start_date ?? courseStartDate,
        endDate:    data.end_date   ?? courseEndDate,
        workingDays: data.working_days || [],
        attendance: data.attendance || {},
      });
      // Store as a new object so React detects the state change
      setAttData({ attendanceMap: { ...(data.attendance || {}) }, days: [...days], raw: data });
    } catch {
      toast.error('Failed to load attendance.');
    } finally {
      setAttLoading(false);
    }
  }, [attData, courseId, s.id, courseStartDate, courseEndDate, toast]);

  const toggle = async () => {
    if (!open) await loadAtt();
    setOpen((o) => !o);
  };

  // Professor toggles a cell ─────────────────────────────────────────────────
  const handleToggle = async (date, newStatus) => {
    if (date > todayStr()) return;
    try {
      await courseService.markAttendance(courseId, s.id, date, newStatus);
      // Rebuild with new status — always a fresh object so React re-renders
      setAttData((prev) => {
        if (!prev) return prev;
        const newMap = { ...prev.attendanceMap, [date]: newStatus };
        return {
          ...prev,
          attendanceMap: newMap,
          days: buildCalendarGrid({
            startDate:  prev.raw?.start_date ?? courseStartDate,
            endDate:    prev.raw?.end_date   ?? courseEndDate,
            attendance: newMap,
          }),
        };
      });
      toast.success(`Marked ${newStatus} for ${date}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={`card overflow-hidden ${ROW_BG[color]}`}>
      {/* ── Main row ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand button + student info */}
        <button className="flex-1 min-w-0 text-left" onClick={toggle}>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Name */}
            <p className="text-sm font-medium text-ink-950 dark:text-mist">{s.name}</p>
            {/* Roll number badge */}
            {s.student_number && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono bg-ink-800/60 text-fog rounded px-1.5 py-0.5">
                <Hash size={9} />{s.student_number}
              </span>
            )}
            {open
              ? <ChevronUp size={13} className="text-fog ml-auto shrink-0" />
              : <ChevronDown size={13} className="text-fog ml-auto shrink-0" />}
          </div>
          {/* Email */}
          <p className="flex items-center gap-1 text-xs text-fog mt-0.5">
            <Mail size={10} />{s.email}
          </p>
          {/* Attendance bar */}
          <AttendanceBar pct={pct} color={color} className="mt-1.5 max-w-xs" />
        </button>

        {/* Remove button */}
        <Button
          size="sm" variant="ghost" icon={UserMinus}
          onClick={() => onRemove(s)}
          className="shrink-0 text-status-absent hover:bg-status-absent/10"
        >
          Remove
        </Button>
      </div>

      {/* ── Expandable heatmap ─────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-ink-700/10 px-4 py-4 bg-white/40 dark:bg-ink-900/40">
          {attLoading && (
            <p className="text-xs text-fog text-center py-4">Loading attendance…</p>
          )}
          {!attLoading && attData && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-scan-500" />
                <p className="text-xs font-semibold text-ink-950 dark:text-mist">
                  Attendance Calendar — click past/today cells to toggle
                </p>
                {/* Quick stats */}
                <span className="ml-auto text-[10px] text-fog">
                  {Object.values(attData.attendanceMap).filter((v) => v === 'present').length} present
                  {' / '}{attData.days.filter((d) => !d.isFuture && !d.pad).length} days
                </span>
              </div>
              <AttendanceHeatmap
                days={attData.days}
                onToggle={handleToggle}
              />
            </>
          )}
          {!attLoading && !attData && (
            <p className="text-xs text-fog text-center py-4">No attendance data yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main CourseRoster ─────────────────────────────────────────────────────────
export default function CourseRoster() {
  const { courseId } = useParams();
  const { toast }    = useToast();

  const [course, setCourse]           = useState(null);
  const [rosterStats, setRosterStats] = useState(null);
  const [pending, setPending]         = useState([]);
  const [busyId, setBusyId]           = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving]         = useState(false);

  const load = useCallback(async () => {
    const [courseData, statsData] = await Promise.all([
      courseService.getCourse(courseId),
      courseService.getRosterStats(courseId),
    ]);
    setCourse(courseData);
    setPending(courseData.pending || []);
    setRosterStats(statsData);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const approve = async (studentId, name) => {
    setBusyId(studentId);
    try {
      await courseService.approveJoinRequest(courseId, studentId);
      toast.success(`${name} approved.`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const deny = async (studentId, name) => {
    setBusyId(studentId);
    try {
      await courseService.denyJoinRequest(courseId, studentId);
      toast.info(`${name}'s request declined.`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await courseService.removeStudentFromCourse(courseId, removeTarget.id);
      toast.info(`${removeTarget.name} removed.`);
      setRemoveTarget(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setRemoving(false); }
  };

  if (!course || !rosterStats) return null;

  const { students, course: courseStats } = rosterStats;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-fog">{course.code} · {course.term}</p>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">{course.name}</h1>
          {(courseStats?.start_date || courseStats?.end_date) && (
            <p className="text-xs text-fog mt-1">
              {courseStats.start_date ?? '—'} → {courseStats.end_date ?? 'ongoing'}
            </p>
          )}
        </div>
        <WorkingDaysToggle 
          courseId={courseId} 
          workingDays={rosterStats.working_days || []} 
          onToggle={load} 
          toast={toast} 
        />
      </div>

      {/* ── Column header (overview) ──────────────────────────────────────── */}
      {students?.length > 0 && (
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 text-[10px] font-semibold uppercase tracking-wider text-fog">
          <span>Student (Name · Roll · Email)</span>
          <span className="w-32 text-right">Attendance</span>
          <span className="w-16 text-right">%</span>
          <span className="w-20" />
        </div>
      )}

      {/* ── Section A: Enrolled Students ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-950 dark:text-mist">
          Enrolled Students ({students?.length ?? 0})
        </h2>
        {!students?.length ? (
          <EmptyState title="No enrolled students" description="Approve pending requests below." />
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <StudentRow
                key={s.id}
                s={s}
                courseId={courseId}
                courseStartDate={courseStats?.start_date}
                courseEndDate={courseStats?.end_date}
                onRemove={setRemoveTarget}
                toast={toast}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section B: Pending Course Enrollments ─────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-ink-950 dark:text-mist">
            Pending Course Enrollments ({pending.length})
          </h2>
          <p className="text-xs text-fog">
            Students must be approved here before they can be matched in live sessions.
          </p>
        </div>
        {!pending.length ? (
          <EmptyState title="No pending enrollments" description="Enrollment requests will appear here." />
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="card flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-950 dark:text-mist">{s.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {s.student_number && (
                      <span className="flex items-center gap-0.5 text-[10px] font-mono bg-ink-800/60 text-fog rounded px-1.5 py-0.5">
                        <Hash size={9} />{s.student_number}
                      </span>
                    )}
                    <p className="flex items-center gap-1 text-xs text-fog">
                      <Mail size={10} />{s.email}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="secondary" icon={X} loading={busyId === s.id} onClick={() => deny(s.id, s.name)}>
                    Reject
                  </Button>
                  <Button size="sm" icon={Check} loading={busyId === s.id} onClick={() => approve(s.id, s.name)}>
                    Approve Enrollment
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Remove confirmation modal ─────────────────────────────────────── */}
      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove student from course?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={removing} icon={UserMinus} onClick={handleRemove}>Remove</Button>
          </>
        }
      >
        <div className="flex gap-3 items-start">
          <AlertTriangle size={20} className="text-status-review shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-ink-950 dark:text-mist">
              Remove <strong>{removeTarget?.name}</strong> from <strong>{course.name}</strong>?
            </p>
            <p className="text-xs text-fog">This cannot be undone. The student will need to re-request enrollment.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
