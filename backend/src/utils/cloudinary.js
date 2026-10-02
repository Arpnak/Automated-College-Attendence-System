import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Generates signed upload params so the browser can POST directly to Cloudinary
 * (equivalent to an S3 presigned URL — the Gateway never receives image bytes, C2).
 */
export function generateUploadSignature(publicId, folder) {
  const timestamp = Math.round(Date.now() / 1000);
  const str = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(str + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    publicId,
    folder,
  };
}

/** Delete all resources under a folder prefix, then remove the folder. */
export async function deleteFolder(folderPath) {
  try {
    await cloudinary.api.delete_resources_by_prefix(folderPath + '/');
    await cloudinary.api.delete_folder(folderPath);
  } catch (err) {
    // Folder may already be empty — log and continue
    console.warn(`Cloudinary deleteFolder(${folderPath}):`, err.message);
  }
}

/** Delete a single resource by public_id. */
export async function deleteResource(publicId) {
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

export { cloudinary };
