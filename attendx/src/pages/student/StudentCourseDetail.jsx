import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, TrendingUp } from 'lucide-react';
import AttendanceHeatmap from '../../components/molecules/AttendanceHeatmap';
import AttendanceBar from '../../components/atoms/AttendanceBar';
import * as courseService from '../../services/courseService';
import { useAuth } from '../../hooks/useAuth';
import { useAttendanceSocket } from '../../hooks/useAttendanceSocket';
import { calcAttendance, buildCalendarGrid } from '../../utils/attendanceCalc';

export default function StudentCourseDetail() {
  const { courseId } = useParams();
  const { user }     = useAuth();

  const [course,        setCourse]        = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);

  // Memoised loader — called on mount and whenever WS fires an update for THIS course
  const load = useCallback(async () => {
    const [courseRes, attRes] = await Promise.all([
      courseService.getCourse(courseId),
      courseService.getStudentAttendance(courseId, user.id),
    ]);
    setCourse(courseRes);
    setAttendanceData(attRes);
  }, [courseId, user.id]);

  useEffect(() => { load(); }, [load]);

  // ── Real-time WS: professor marks a date → re-fetch this course instantly ──
  useAttendanceSocket(useCallback((msg) => {
    if (msg.payload?.courseId === courseId) load();
  }, [courseId, load]));

  if (!course || !attendanceData) return null;

  const stats = calcAttendance({
    workingDays: attendanceData.working_days || [],
    attendance: attendanceData.attendance || {},
  });

  const days = buildCalendarGrid({
    startDate:  attendanceData.start_date,
    endDate:    attendanceData.end_date,
    workingDays: attendanceData.working_days || [],
    attendance: attendanceData.attendance || {},
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Course header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-xs font-mono text-fog">{course.code} · {course.term}</p>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">{course.name}</h1>
          {course.professor?.name && (
            <p className="text-sm text-fog mt-0.5">Prof. {course.professor.name}</p>
          )}
        </div>

        {/* Stats pill */}
        <div className="card px-5 py-3 flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold font-display text-ink-950 dark:text-mist">{stats.pct}%</p>
            <p className="text-[10px] text-fog">attendance</p>
          </div>
          <div className="h-8 w-px bg-ink-700/20" />
          <div className="text-center">
            <p className="text-lg font-semibold text-ink-950 dark:text-mist">{stats.attended}</p>
            <p className="text-[10px] text-fog">present / {stats.elapsed}</p>
          </div>
        </div>
      </div>

      {/* ── Attendance bar ────────────────────────────────────────────────── */}
      <AttendanceBar pct={stats.pct} color={stats.color} />

      {/* Not-started notice */}
      {stats.notStarted && (
        <p className="text-xs text-fog italic bg-ink-800/30 rounded-lg px-4 py-2">
          This course hasn't started yet — attendance tracking begins on {attendanceData.start_date}.
        </p>
      )}

      {/* Course date range */}
      {(attendanceData.start_date || attendanceData.end_date) && (
        <div className="flex items-center gap-2 text-xs text-fog">
          <Calendar size={13} />
          <span>{attendanceData.start_date ?? '—'} → {attendanceData.end_date ?? 'ongoing'}</span>
        </div>
      )}

      {/* ── LeetCode streak heatmap ────────────────────────────────────────── */}
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-scan-500" />
          <h2 className="text-sm font-semibold text-ink-950 dark:text-mist">Attendance Streak</h2>
          <span className="ml-auto text-[10px] text-fog italic">Updates live ·</span>
        </div>
        {days.length > 0
          ? <AttendanceHeatmap days={days} readOnly />
          : <p className="text-xs text-fog text-center py-4">No attendance data yet for this course.</p>
        }
      </section>
    </div>
  );
}
