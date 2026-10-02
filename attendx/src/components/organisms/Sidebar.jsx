import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, ScanFace,
  Building2, ShieldCheck, Activity, UserPlus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import * as courseService from '../../services/courseService';

const NAV = {
  super_admin: [
    { to: '/superadmin/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/superadmin/institutions', label: 'Institutions', icon: Building2 },
    { to: '/superadmin/admins',       label: 'Admins',       icon: Users },
    { to: '/superadmin/sessions',     label: 'All Sessions', icon: Activity },
    { to: '/superadmin/logs',         label: 'Audit Logs',   icon: ShieldCheck },
  ],
  admin: [
    { to: '/admin/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/admin/courses',     label: 'Courses',      icon: BookOpen },
    { to: '/admin/professors',  label: 'Add Professor', icon: Users },
    { to: '/admin/students',    label: 'Add Student',  icon: UserPlus },
  ],
  professor: [
    { to: '/professor/courses', label: 'Course Hub', icon: BookOpen },
  ],
  student: [
    { to: '/student/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/student/institutions', label: 'Institutions',   icon: Building2 },
    { to: '/student/enroll',       label: 'Browse Courses', icon: GraduationCap },
  ],
};

function StudentCourseList() {
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    courseService.listCoursesForStudent().then((all) => {
      setCourses((all || []).filter((c) => c.enrollment_status === 'approved'));
    }).catch(() => {});
  }, []);

  if (courses.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-fog uppercase tracking-wider hover:text-mist transition-colors"
      >
        <span>My Courses</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {courses.map((c) => (
            <NavLink
              key={c.id}
              to={`/student/courses/${c.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors truncate ${
                  isActive ? 'bg-scan-500/12 text-scan-500' : 'text-fog hover:bg-ink-700/5 dark:hover:bg-ink-800 hover:text-mist'
                }`
              }
            >
              <span className="font-mono text-[10px] bg-ink-800/60 rounded px-1 shrink-0">{c.code}</span>
              <span className="truncate">{c.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const items = NAV[user?.role] || [];
  const isSuperAdmin = user?.role === 'super_admin';
  const isStudent = user?.role === 'student';

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-ink-700/10 dark:border-ink-700/60 bg-white dark:bg-ink-900 px-3 py-5 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isSuperAdmin ? 'bg-violet-500/15 text-violet-400' : 'bg-scan-500/15 text-scan-500'
        }`}>
          <ScanFace size={18} />
        </div>
        <div>
          <span className="font-display text-base font-semibold text-ink-950 dark:text-mist">AttendX</span>
          {isSuperAdmin && (
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Platform Owner</p>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? isSuperAdmin ? 'bg-violet-500/12 text-violet-400' : 'bg-scan-500/12 text-scan-500'
                  : 'text-fog hover:bg-ink-700/5 dark:hover:bg-ink-800 hover:text-ink-950 dark:hover:text-mist'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Student enrolled course list */}
      {isStudent && <StudentCourseList />}
    </aside>
  );
}
