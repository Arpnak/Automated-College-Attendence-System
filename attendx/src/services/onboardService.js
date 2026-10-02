import { apiFetch } from '../lib/apiClient';

/** Upload ONE reference face photo (call up to 3 times, min 2 required). */
export async function uploadFacePhoto(file, photoIndex = 1) {
  const form = new FormData();
  form.append('photo', file);
  form.append('photo_index', String(photoIndex));
  return apiFetch('/onboard/upload', { method: 'POST', body: form });
}

/** Returns { faceCount, profileComplete, faceIndexedAt } */
export async function getOnboardStatus() {
  return apiFetch('/onboard/status');
}
