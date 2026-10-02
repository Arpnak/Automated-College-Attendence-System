import { api } from '../lib/apiClient';

// ── Metrics ───────────────────────────────────────────────────────────────────
export const getMetrics = () => api.get('/superadmin/metrics');

// ── Institutions ──────────────────────────────────────────────────────────────
export const listInstitutions = () => api.get('/superadmin/institutions');
export const createInstitution = (data) => api.post('/superadmin/institutions', data);
export const getInstitution = (id) => api.get(`/superadmin/institutions/${id}`);
export const updateInstitution = (id, data) => api.put(`/superadmin/institutions/${id}`, data);
export const deleteInstitution = (id) => api.del(`/superadmin/institutions/${id}`);

// ── Admins ────────────────────────────────────────────────────────────────────
export const listAdmins = () => api.get('/superadmin/admins');
export const createAdmin = (data) => api.post('/superadmin/admins', data);
export const updateAdmin = (id, data) => api.put(`/superadmin/admins/${id}`, data);
export const deleteAdmin = (id) => api.del(`/superadmin/admins/${id}`);

// ── Global sessions & logs ────────────────────────────────────────────────────
export const listSessions = () => api.get('/superadmin/sessions');
export const listLogs = () => api.get('/superadmin/logs');
