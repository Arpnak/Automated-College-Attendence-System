import { useEffect, useState } from 'react';
import { Users, GraduationCap, BookOpen, Building2, X, UserMinus } from 'lucide-react';
import StatCard from '../../components/molecules/StatCard';
import Modal from '../../components/atoms/Modal';
import Button from '../../components/atoms/Button';
import EmptyState from '../../components/atoms/EmptyState';
import * as adminService from '../../services/adminService';
import * as courseService from '../../services/courseService';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseDetail, setCourseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    adminService.getMetrics().then(setMetrics);
    adminService.getInstitution().then(setInstitution);
    courseService.listAllCourses().then(setCourses);
  }, []);

  const openCourse = async (course) => {
    setSelectedCourse(course);
    setDetailLoading(true);
    try {
      const detail = await courseService.getCourse(course.id);
      setCourseDetail(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => { setSelectedCourse(null); setCourseDetail(null); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Admin Dashboard</h1>
        {institution && (
          <p className="text-sm text-fog flex items-center gap-1.5 mt-0.5">
            <Building2 size={13} /> {institution.name}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={GraduationCap} label="Students" value={metrics?.totalStudents ?? '—'} />
        <StatCard icon={Users} label="Professors" value={metrics?.totalProfessors ?? '—'} />
        <StatCard icon={BookOpen} label="Courses" value={metrics?.totalCourses ?? '—'} />
      </div>

      {/* Course Cards */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-950 dark:text-mist">Courses</h2>
        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses yet" description="Create a course to get started." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => openCourse(c)}
                className="card flex flex-col gap-3 p-5 text-left hover:border-scan-500/50 border border-transparent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-fog bg-ink-800/60 rounded px-1.5 py-0.5">{c.code}</span>
                  <span className="text-[10px] text-fog">{c.term}</span>
                </div>
                <h3 className="font-display text-sm font-semibold text-ink-950 dark:text-mist leading-snug">{c.name}</h3>
                <p className="text-xs text-fog truncate">
                  {c.professor ? `Prof. ${c.professor.name}` : <span className="text-status-review">No professor assigned</span>}
                </p>
                <div className="mt-auto pt-1 text-xs text-scan-500 font-medium">View enrolled students →</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Enrolled Students Modal */}
      <Modal
        open={Boolean(selectedCourse)}
        onClose={closeModal}
        title={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : ''}
      >
        {detailLoading ? (
          <p className="text-sm text-fog py-4 text-center">Loading roster…</p>
        ) : courseDetail ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-xs text-fog">
              {courseDetail.professor
                ? `Taught by ${courseDetail.professor.name}`
                : <span className="text-status-review">No professor assigned</span>}
              {' · '}{courseDetail.roster?.length ?? 0} enrolled
            </p>
            {!courseDetail.roster?.length ? (
              <EmptyState icon={UserMinus} title="No enrolled students" description="Students who are approved will appear here." />
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
    </div>
  );
}
