import { useEffect, useState } from 'react';
import { GraduationCap, Send, Check, Clock, Building2, AlertTriangle } from 'lucide-react';
import Button from '../../components/atoms/Button';
import EmptyState from '../../components/atoms/EmptyState';
import * as courseService from '../../services/courseService';
import * as studentService from '../../services/studentService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export default function StudentEnroll() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [institution, setInstitution] = useState(undefined);
  const [busyId, setBusyId] = useState(null);

  const load = () =>
    courseService.listCoursesForStudent().then((all) => setCourses(all || []));

  useEffect(() => {
    load();
    studentService.getStudentInstitution()
      .then(setInstitution)
      .catch(() => setInstitution(null));
  }, []);

  const request = async (course) => {
    setBusyId(course.id);
    try {
      await courseService.requestEnrollment(course.id);
      toast.success(`Enrollment requested for ${course.name} — awaiting professor approval.`);
      load(); // refresh to show 'pending' state
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const notLinked = institution === null && !user.institutionId;

  if (notLinked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Browse Courses</h1>
          <p className="text-sm text-fog">Courses available at your institution.</p>
        </div>
        <EmptyState
          icon={AlertTriangle}
          title="Not linked to an institution"
          description="Ask your admin to add you to an institution before you can browse or enroll in courses."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Browse Courses</h1>
        {institution?.name ? (
          <p className="text-sm text-fog flex items-center gap-1 mt-0.5">
            <Building2 size={12} className="shrink-0" /> {institution.name}
          </p>
        ) : (
          <p className="text-sm text-fog">Courses available at your institution.</p>
        )}
      </div>

      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses available" description="Your institution has no courses yet. Check back later." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => {
            const isApproved = c.enrollment_status === 'approved';
            const isPending  = c.enrollment_status === 'pending';

            return (
              <div key={c.id} className="card flex flex-col gap-3 p-5">
                {/* Code + Term */}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-fog bg-ink-800/60 rounded px-1.5 py-0.5">{c.code}</span>
                  <span className="text-[10px] text-fog">{c.term}</span>
                </div>

                {/* Course name */}
                <h3 className="font-display text-sm font-semibold text-ink-950 dark:text-mist leading-snug">{c.name}</h3>

                {/* Professor */}
                <p className="text-xs text-fog">
                  {c.professor?.name ? `Prof. ${c.professor.name}` : 'No professor assigned'}
                </p>

                {/* Enroll button — three states */}
                {isApproved ? (
                  <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-scan-500/10 px-3 py-2 text-xs font-semibold text-scan-500">
                    <Check size={13} /> Enrolled
                  </div>
                ) : isPending ? (
                  <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-status-review/10 px-3 py-2 text-xs font-semibold text-status-review">
                    <Clock size={13} /> Pending Approval
                  </div>
                ) : (
                  <Button
                    size="sm"
                    icon={Send}
                    className="mt-auto w-full"
                    loading={busyId === c.id}
                    onClick={() => request(c)}
                  >
                    Enroll
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
