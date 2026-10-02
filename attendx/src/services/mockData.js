// In-memory mock backend. Swap these for real fetch/axios calls to your
// Node/Express API once it exists — every service function below is the
// seam where that swap happens, so components never talk to this file directly.

export const ROLES = { ADMIN: 'admin', PROFESSOR: 'professor', STUDENT: 'student' };

export let users = [
  { id: 'u1', role: ROLES.ADMIN, name: 'Priya Nair', email: 'priya@attendx.edu' },
  { id: 'u2', role: ROLES.PROFESSOR, name: 'Dr. Alan Reyes', email: 'reyes@attendx.edu' },
  { id: 'u3', role: ROLES.PROFESSOR, name: 'Dr. Mei Chen', email: 'chen@attendx.edu' },
  { id: 'u4', role: ROLES.STUDENT, name: 'Jordan Blake', email: 'jblake@attendx.edu', studentId: 'S1001' },
  { id: 'u5', role: ROLES.STUDENT, name: 'Sam Patel', email: 'spatel@attendx.edu', studentId: 'S1002' },
  { id: 'u6', role: ROLES.STUDENT, name: 'Riya Kapoor', email: 'rkapoor@attendx.edu', studentId: 'S1003' },
];

export let courses = [
  { id: 'c1', name: 'Distributed Systems', code: 'CS-441', professorId: 'u2', term: 'Fall 2026', studentIds: ['u4', 'u5'], pendingStudentIds: ['u6'] },
  { id: 'c2', name: 'Computer Vision', code: 'CS-512', professorId: 'u2', term: 'Fall 2026', studentIds: ['u4', 'u6'], pendingStudentIds: [] },
  { id: 'c3', name: 'Applied Cryptography', code: 'CS-478', professorId: 'u3', term: 'Fall 2026', studentIds: ['u5'], pendingStudentIds: ['u4'] },
];

export let sessionsHistory = [
  { id: 's101', courseId: 'c1', date: '2026-07-10', attendance: { u4: 'present', u5: 'absent' } },
  { id: 's102', courseId: 'c1', date: '2026-07-13', attendance: { u4: 'present', u5: 'present' } },
  { id: 's103', courseId: 'c1', date: '2026-07-17', attendance: { u4: 'absent', u5: 'present' } },
  { id: 's201', courseId: 'c2', date: '2026-07-11', attendance: { u4: 'present', u6: 'present' } },
];

export let pendingRegistrations = [
  { id: 'r1', name: 'Noah Kim', email: 'nkim@attendx.edu', requestedAt: '2026-07-18' },
  { id: 'r2', name: 'Elena Ruiz', email: 'eruiz@attendx.edu', requestedAt: '2026-07-19' },
];

export let privateKeys = [
  { id: 'k1', key: 'ATX-7F2K-9QRT', issuedTo: 'nkim@attendx.edu', status: 'unused', expiresAt: '2026-07-27' },
  { id: 'k2', key: 'ATX-3M8P-XQ21', issuedTo: 'eruiz@attendx.edu', status: 'unused', expiresAt: '2026-07-26' },
];

export function attendancePercent(courseId, studentId) {
  const rows = sessionsHistory.filter((s) => s.courseId === courseId && s.attendance[studentId]);
  if (!rows.length) return 0;
  const present = rows.filter((s) => s.attendance[studentId] === 'present').length;
  return Math.round((present / rows.length) * 100);
}
