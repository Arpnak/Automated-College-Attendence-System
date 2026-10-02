import { api } from '../lib/apiClient';

export async function listCoursesForProfessor() {
  return api.get('/courses');
}

export async function listCoursesForStudent() {
  return api.get('/courses');
}

export async function listAllCourses() {
  return api.get('/courses');
}

export async function getCourse(courseId) {
  return api.get(`/courses/${courseId}`);
}

export async function createCourse({ name, code, professorId, term, startDate, endDate }) {
  return api.post('/courses', { name, code, professorId, term, startDate, endDate });
}

export async function updateCourse(courseId, data) {
  return api.patch(`/courses/${courseId}`, data);
}

export async function deleteCourse(id) {
  return api.del(`/courses/${id}`);
}

// Date-keyed attendance map for a student in a course { start_date, end_date, attendance: {date: status} }
export async function getStudentAttendance(courseId, studentId) {
  return api.get(`/courses/${courseId}/attendance/${studentId}`);
}

// Professor toggles attendance for a specific student on a specific date
export async function markAttendance(courseId, studentId, date, status) {
  return api.post(`/courses/${courseId}/attendance/${studentId}`, { date, status });
}

// Roster with precomputed attendance stats for professor view
export async function getRosterStats(courseId) {
  return api.get(`/courses/${courseId}/roster-stats`);
}

export async function getStudentHistory(courseId, studentId) {
  return api.get(`/courses/${courseId}/history?studentId=${studentId}`);
}

export async function approveJoinRequest(courseId, studentId) {
  return api.post(`/courses/${courseId}/approve`, { studentId });
}

export async function denyJoinRequest(courseId, studentId) {
  return api.post(`/courses/${courseId}/deny`, { studentId });
}

export async function requestEnrollment(courseId) {
  return api.post(`/courses/${courseId}/enroll`, {});
}

export async function removeStudentFromCourse(courseId, studentId) {
  return api.del(`/courses/${courseId}/students/${studentId}`);
}

export async function toggleWorkingDay(courseId, date, isWorkingDay) {
  return api.post(`/courses/${courseId}/working-days`, { date, isWorkingDay });
}
