import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/organisms/DashboardLayout';

import LoginPage from './pages/shared/LoginPage';
import SignupPage from './pages/shared/SignupPage';
import OnboardPage from './pages/shared/OnboardPage';
import UnauthorizedPage from './pages/shared/UnauthorizedPage';
import NotFoundPage from './pages/shared/NotFoundPage';
import ProfilePage from './pages/shared/ProfilePage';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCourses from './pages/admin/AdminCourses';
import AdminProfessors from './pages/admin/AdminProfessors';
import AdminStudents from './pages/admin/AdminStudents';

import CourseHub from './pages/professor/CourseHub';
import CourseRoster from './pages/professor/CourseRoster';
import ActiveSessionPage from './pages/professor/ActiveSessionPage';

import StudentDashboard from './pages/student/StudentDashboard';
import StudentCourseDetail from './pages/student/StudentCourseDetail';
import StudentEnroll from './pages/student/StudentEnroll';
import StudentInstitutions from './pages/student/StudentInstitutions';

import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminInstitutions from './pages/superadmin/SuperAdminInstitutions';
import SuperAdminInstitutionDetail from './pages/superadmin/SuperAdminInstitutionDetail';
import SuperAdminAdmins from './pages/superadmin/SuperAdminAdmins';
import SuperAdminSessions from './pages/superadmin/SuperAdminSessions';
import SuperAdminLogs from './pages/superadmin/SuperAdminLogs';

const ALL_ROLES = ['super_admin', 'admin', 'professor', 'student'];

export default function App() {
  return (
    <Routes>
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/signup"       element={<SignupPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Student face-enrolment onboarding — auth required, no layout shell */}
      <Route
        path="/onboard"
        element={
          <ProtectedRoute roles={['student']}>
            <OnboardPage />
          </ProtectedRoute>
        }
      />

      {/* Shared layout shell — all authenticated roles */}
      <Route element={<ProtectedRoute roles={ALL_ROLES}><DashboardLayout /></ProtectedRoute>}>
        <Route path="/profile" element={<ProfilePage />} />

        {/* ── Super Admin ── */}
        <Route path="/superadmin/dashboard"          element={<ProtectedRoute roles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/superadmin/institutions"       element={<ProtectedRoute roles={['super_admin']}><SuperAdminInstitutions /></ProtectedRoute>} />
        <Route path="/superadmin/institutions/:id"   element={<ProtectedRoute roles={['super_admin']}><SuperAdminInstitutionDetail /></ProtectedRoute>} />
        <Route path="/superadmin/admins"             element={<ProtectedRoute roles={['super_admin']}><SuperAdminAdmins /></ProtectedRoute>} />
        <Route path="/superadmin/sessions"           element={<ProtectedRoute roles={['super_admin']}><SuperAdminSessions /></ProtectedRoute>} />
        <Route path="/superadmin/logs"               element={<ProtectedRoute roles={['super_admin']}><SuperAdminLogs /></ProtectedRoute>} />

        {/* ── Admin ── */}
        <Route path="/admin/dashboard"  element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/courses"    element={<ProtectedRoute roles={['admin']}><AdminCourses /></ProtectedRoute>} />
        <Route path="/admin/professors" element={<ProtectedRoute roles={['admin']}><AdminProfessors /></ProtectedRoute>} />
        <Route path="/admin/students"   element={<ProtectedRoute roles={['admin']}><AdminStudents /></ProtectedRoute>} />

        {/* ── Professor ── */}
        <Route path="/professor/courses"               element={<ProtectedRoute roles={['professor']}><CourseHub /></ProtectedRoute>} />
        <Route path="/professor/courses/:courseId"     element={<ProtectedRoute roles={['professor']}><CourseRoster /></ProtectedRoute>} />
        <Route path="/professor/session/:sessionId"    element={<ProtectedRoute roles={['professor']}><ActiveSessionPage /></ProtectedRoute>} />

        {/* ── Student ── */}
        <Route path="/student/dashboard"             element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/courses/:courseId"     element={<ProtectedRoute roles={['student']}><StudentCourseDetail /></ProtectedRoute>} />
        <Route path="/student/enroll"                element={<ProtectedRoute roles={['student']}><StudentEnroll /></ProtectedRoute>} />
        <Route path="/student/institutions"          element={<ProtectedRoute roles={['student']}><StudentInstitutions /></ProtectedRoute>} />
      </Route>

      <Route path="/"  element={<Navigate to="/login" replace />} />
      <Route path="*"  element={<NotFoundPage />} />
    </Routes>
  );
}
