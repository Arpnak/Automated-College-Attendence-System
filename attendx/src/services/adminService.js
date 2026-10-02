import { api } from '../lib/apiClient';

export const getMetrics = () => api.get('/admin/metrics');
export const getInstitution = () => api.get('/admin/institution');

// Search any registered user by email
export const searchUserByEmail = (email) =>
  api.get(`/admin/users/search?email=${encodeURIComponent(email)}`);

// ── Professors ────────────────────────────────────────────────────────────────
export const listProfessors = () => api.get('/admin/professors');

// Create a brand-new professor account (returns temporaryPassword)
export const addProfessor = ({ name, email }) =>
  api.post('/admin/professors', { name, email });

// Link an existing professor to this institution
export const addProfessorToInstitution = (userId) =>
  api.post('/admin/professors', { userId });

// Remove professor from institution (does NOT delete user or courses)
export const removeProfessor = (professorId) =>
  api.del(`/admin/professors/${professorId}`);

// ── Students ──────────────────────────────────────────────────────────────────
export const listStudents = () => api.get('/admin/students');

// Create a brand-new student account (returns temporaryPassword)
export const addStudent = ({ name, email, studentNumber }) =>
  api.post('/admin/students', { name, email, studentNumber });

// Link an existing student to this institution
export const addStudentToInstitution = (userId) =>
  api.post('/admin/students', { userId });

// Remove student from institution
export const removeStudent = (studentId) =>
  api.del(`/admin/students/${studentId}`);

// ── Registration keys ─────────────────────────────────────────────────────────
export const listKeys = () => api.get('/admin/keys');
export const createKey = () => api.post('/admin/keys', {});
export const deleteKey = (id) => api.del(`/admin/keys/${id}`);

// ── Pending registrations ─────────────────────────────────────────────────────
export const listPendingRegistrations = () => api.get('/admin/registrations/pending');
