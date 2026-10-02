import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Building2, AlertTriangle, Search, AlertCircle, X } from 'lucide-react';
import Button from '../../components/atoms/Button';
import EmptyState from '../../components/atoms/EmptyState';
import AttendanceBar from '../../components/atoms/AttendanceBar';
import * as courseService from '../../services/courseService';
import * as studentService from '../../services/studentService';
import { getOnboardStatus } from '../../services/onboardService';
import { useAuth } from '../../hooks/useAuth';
import { useAttendanceSocket } from '../../hooks/useAttendanceSocket';
import { calcAttendance } from '../../utils/attendanceCalc';

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [allCourses, setAllCourses]   = useState([]);
  const [courseStats, setCourseStats] = useState({});  // { courseId: { pct, color } }
  const [institution, setInstitution] = useState(undefined);
  const [search, setSearch]           = useState('');
  const [profileComplete, setProfileComplete] = useState(true); // optimistic
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Load courses + attendance stats ────────────────────────────────────────
  const loadAttendanceForCourse = useCallback(async (courseId) => {
    try {
      const data = await courseService.getStudentAttendance(courseId, user.id);
      // FIXED: calcAttendance() reads `workingDays`, not `startDate`/`endDate` —
      // those two were being silently ignored, so `workingDays` always defaulted
      // to [] and every card showed 0% / "not started" no matter what the
      // backend actually returned.
      const result = calcAttendance({
        workingDays: data.working_days || [],
        attendance: data.attendance || {},
      });
      setCourseStats((prev) => ({ ...prev, [courseId]: result }));
    } catch {
      setCourseStats((prev) => ({ ...prev, [courseId]: { pct: 0, color: 'green', notStarted: true } }));
    }
  }, [user.id]);

  useEffect(() => {
    courseService.listCoursesForStudent().then(async (all) => {
      const enrolled = (all || []).filter((c) => c.enrollment_status === 'approved');
      setAllCourses(enrolled);
      await Promise.all(enrolled.map((c) => loadAttendanceForCourse(c.id)));
    });

    studentService.getStudentInstitution()
      .then(setInstitution)
      .catch(() => setInstitution(null));

    // Check if student has completed their profile
    getOnboardStatus()
      .then((s) => setProfileComplete(s?.profileComplete ?? true))
      .catch(() => setProfileComplete(true));
  }, [user.id, loadAttendanceForCourse]);

  // ── Real-time WS: when professor marks attendance → refresh that course ────
  useAttendanceSocket(useCallback((msg) => {
    const { courseId } = msg.payload || {};
    if (courseId) loadAttendanceForCourse(courseId);
  }, [loadAttendanceForCourse]));

  const notLinked = institution === null && !user.institutionId;

  const filtered = useMemo(() => {
    if (!search.trim()) return allCourses;
    const q = search.toLowerCase();
    return allCourses.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [allCourses, search]);

  const showBanner = !profileComplete && !bannerDismissed;

  return (
    <div className="space-y-5">

      {/* ── Profile incomplete warning banner ──────────────────────────────── */}
      {showBanner && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-status-review/40 bg-status-review/8 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-status-review shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink-950 dark:text-mist">
                Profile incomplete — face photos required
              </p>
              <p className="text-xs text-fog mt-0.5">
                Upload at least 2 reference photos so the system can recognise you during attendance sessions.
              </p>
              <button
                onClick={() => navigate('/onboard')}
                className="mt-2 text-xs font-semibold text-scan-500 hover:text-scan-400 underline underline-offset-2"
              >
                Complete my profile →
              </button>
            </div>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="text-fog hover:text-mist shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">My Courses</h1>
          {institution?.name ? (
            <p className="text-sm text-fog flex items-center gap-1 mt-0.5">
              <Building2 size={12} className="shrink-0" /> {institution.name}
            </p>
          ) : notLinked ? (
            <p className="text-sm flex items-center gap-1 mt-0.5 text-status-review">
              <AlertTriangle size={12} className="shrink-0" />
              Not linked to an institution — ask your admin.
            </p>
          ) : (
            <p className="text-sm text-fog mt-0.5">Your enrolled courses and attendance.</p>
          )}
        </div>
        {!notLinked && (
          <Button variant="secondary" icon={GraduationCap} onClick={() => navigate('/student/enroll')}>
            Browse Courses
          </Button>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      {allCourses.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
          <input
            type="text"
            placeholder="Search by course name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink-700/30 dark:border-ink-600 bg-white dark:bg-ink-800 pl-9 pr-3 py-2 text-sm text-ink-950 dark:text-mist placeholder-fog focus:outline-none focus:ring-2 focus:ring-scan-500/50"
          />
        </div>
      )}

      {/* ── Course Cards ────────────────────────────────────────────────────── */}
      {allCourses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Not enrolled in any courses yet"
          description={notLinked ? 'Contact your admin first.' : "Browse your institution's courses and request enrollment."}
          action={!notLinked ? <Button size="sm" onClick={() => navigate('/student/enroll')}>Browse Courses</Button> : null}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No courses match" description="Try a different name or code." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const stats = courseStats[c.id] ?? { pct: 0, color: 'green' };
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/student/courses/${c.id}`)}
                className="card flex flex-col gap-3 p-5 text-left hover:border-scan-500/40 border border-transparent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-fog bg-ink-800/60 rounded px-1.5 py-0.5">{c.code}</span>
                  <span className="text-[10px] text-fog">{c.term}</span>
                </div>
                <h3 className="font-display text-sm font-semibold text-ink-950 dark:text-mist leading-snug">{c.name}</h3>
                {c.professor?.name && <p className="text-xs text-fog">Prof. {c.professor.name}</p>}
                <div className="mt-auto pt-1">
                  {stats.notStarted
                    ? <p className="text-[10px] text-fog italic">Course hasn't started yet</p>
                    : null}
                  <AttendanceBar pct={stats.pct} color={stats.color} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
