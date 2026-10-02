import { api } from '../lib/apiClient';

export async function startSession(courseId) {
  return api.post('/sessions', { courseId });
}

export async function getActiveSession() {
  return api.get('/sessions/active');
}

export async function getSessionRoster(sessionId) {
  return api.get(`/sessions/${sessionId}/roster`);
}

export async function endSession(sessionId, force = false) {
  return api.post(`/sessions/${sessionId}/finalize${force ? '?force=true' : ''}`);
}

export async function overrideAttendance(sessionId, studentId, status) {
  return api.put(`/sessions/${sessionId}/attendance/${studentId}`, { status });
}

export async function assignUnidentifiedFace(sessionId, faceId, studentId) {
  return api.post(`/sessions/${sessionId}/unidentified/${faceId}/assign`, { studentId });
}

/**
 * Full Cloudinary signed-upload flow (replaces the mock S3 presigned URL):
 *  1. GET upload params from backend
 *  2. POST file directly to Cloudinary (Gateway never receives image bytes — C2)
 *  3. Report back the cloudinaryPublicId to trigger the Kafka publish
 */
export async function uploadImageBatch(sessionId, files, onProgress) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pictureIndex = i + 1;

    // Step 1: get Cloudinary signed upload params
    const params = await api.post(`/sessions/${sessionId}/upload-url`, { pictureIndex });

    // Step 2: upload directly to Cloudinary
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', params.apiKey);
    form.append('timestamp', params.timestamp);
    form.append('signature', params.signature);
    form.append('public_id', params.publicId);
    form.append('folder', params.folder);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', params.uploadUrl);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(file.name, Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(file.name, 100);
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(form);
    });

    // Step 3: tell backend the upload is done → triggers Kafka publish
    await api.post(`/sessions/${sessionId}/batch-complete`, {
      pictureIndex,
      cloudinaryPublicId: `${params.folder}/${params.publicId}`,
    });

    results.push({ name: file.name, pictureIndex });
  }

  return results;
}
