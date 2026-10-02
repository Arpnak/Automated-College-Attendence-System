import { api } from '../lib/apiClient';

export async function login({ email, password }) {
  return api.post('/auth/login', { email, password });
}

// Open registration — any user can sign up with a role
export async function register({ name, email, password, role }) {
  return api.post('/auth/register', { name, email, password, role });
}

export async function logout() {
  await api.post('/auth/logout').catch(() => {});
}
