import { api } from '../lib/apiClient';

/** Returns the primary institution the student belongs to (backward compat). */
export async function getStudentInstitution() {
  return api.get('/students/institution');
}

/** Returns all institutions: [{ institution, rollNumber, joinedAt, courseCount }] */
export async function getMyInstitutions() {
  return api.get('/students/institutions');
}

/** Updates the student's roll number for a specific institution. */
export async function updateRollNumber(institutionId, rollNumber) {
  return api.patch(`/students/institution/${institutionId}/roll`, { rollNumber });
}

/** Returns face count + profile completeness. */
export async function getMyProfile() {
  return api.get('/students/profile');
}
