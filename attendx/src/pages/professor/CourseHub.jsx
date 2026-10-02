import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, ArrowRight } from 'lucide-react';
import Button from '../../components/atoms/Button';
import EmptyState from '../../components/atoms/EmptyState';
import * as courseService from '../../services/courseService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import * as sessionService from '../../services/sessionService';

export default function CourseHub() {
  const { user, activeSession, setActiveSession } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    courseService.listCoursesForProfessor(user.id).then(setCourses);
    sessionService.getActiveSession().then((session) => {
      if (session) {
        setActiveSession({ sessionId: session.sessionId, courseId: session.courseId, courseName: session.courseName });
      }
    });
  }, [user.id, setActiveSession]);

  const startSession = async (course) => {
    if (activeSession) {
      toast.warning(`Finish your live session for ${activeSession.courseName} first.`);
      return;
    }
    setStarting(course.id);
    try {
      const session = await sessionService.startSession(course.id);
      setActiveSession({ sessionId: session.sessionId, courseId: course.id, courseName: course.name });
      navigate(`/professor/session/${session.sessionId}`, { state: { session } });
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Course Hub</h1>
        <p className="text-sm text-fog">Your assigned courses this term.</p>
      </div>

      {courses.length === 0 ? (
        <EmptyState title="No courses assigned" description="Your admin hasn't assigned any courses to you yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => {
            const isActiveForThisCourse = activeSession?.courseId === c.id;
            
            return (
              <div key={c.id} className="card flex flex-col gap-4 p-5">
                <div>
                  <p className="text-xs font-mono text-fog">{c.code} · {c.term}</p>
                  <h3 className="font-display text-base font-semibold text-ink-950 dark:text-mist">{c.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-fog">
                  <Users size={14} /> {c.enrolledCount ?? 0} enrolled
                  {(c.pendingCount ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-status-review/15 px-2 py-0.5 text-status-review">
                      {c.pendingCount} pending
                    </span>
                  )}
                </div>
                <div className="mt-auto flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowRight}
                    className="flex-1"
                    onClick={() => navigate(`/professor/courses/${c.id}`)}
                  >
                    Roster
                  </Button>
                  <Button
                    size="sm"
                    icon={Video}
                    className="flex-1"
                    loading={starting === c.id}
                    disabled={Boolean(activeSession) && !isActiveForThisCourse}
                    onClick={() => {
                      if (isActiveForThisCourse) {
                        navigate(`/professor/session/${activeSession.sessionId}`, { state: { session: activeSession } });
                      } else {
                        startSession(c);
                      }
                    }}
                  >
                    {isActiveForThisCourse ? 'Resume Session' : 'Start Session'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
