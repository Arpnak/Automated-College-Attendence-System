// Seeds the hardcoded Super Admin account and runs all DB migrations on startup.
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import pool from './pool.js';

const __dir = dirname(fileURLToPath(import.meta.url));

const SUPER_ADMIN_EMAIL    = process.env.SUPER_ADMIN_EMAIL    || 'arpna@classroll.in';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'arpna@1234';
const SUPER_ADMIN_NAME     = process.env.SUPER_ADMIN_NAME     || 'Arpna (Platform Owner)';

// Runs the legacy super_admin migration (adds role enum value + institutions table)
export async function runSuperAdminMigration() {
  try {
    const sql = readFileSync(join(__dir, 'migrate_superadmin.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  Super-admin migration applied.');
  } catch (err) {
    console.warn('⚠️   Super-admin migration skipped:', err.message);
  }
}

// Runs the v2 migration (drops private_keys/pending_registrations, adds institution_id to courses, etc.)
export async function runV2Migration() {
  try {
    const sql = readFileSync(join(__dir, 'migrate_v2.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  V2 migration applied (private-key removal + institution partitioning).');
  } catch (err) {
    console.warn('⚠️   V2 migration skipped:', err.message);
  }
}

// Runs the v3 migration (course scheduling dates + manual attendance table)
export async function runV3Migration() {
  try {
    const sql = readFileSync(join(__dir, 'migrate_v3.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  V3 migration applied (course scheduling + manual attendance).');
  } catch (err) {
    console.warn('⚠️   V3 migration skipped:', err.message);
  }
}

// Runs the v4 migration (face_images_count + student_institution_map)
export async function runV4Migration() {
  try {
    const sql = readFileSync(join(__dir, 'migrate_v4.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  V4 migration applied (multi-institution + face count).');
  } catch (err) {
    console.warn('⚠️   V4 migration skipped:', err.message);
  }
}

// Runs the v5 migration (course_working_days safety net — see migrate_v5.sql
// for why this needed its own versioned migration instead of only living in
// the destructive schema.sql bootstrap script).
export async function runV5Migration() {
  try {
    const sql = readFileSync(join(__dir, 'migrate_v5.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅  V5 migration applied (course_working_days safety net).');
  } catch (err) {
    console.warn('⚠️   V5 migration skipped:', err.message);
  }
}

export async function seedSuperAdmin() {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE email = $1 AND role = 'super_admin'",
    [SUPER_ADMIN_EMAIL]
  );

  if (rows.length > 0) {
    console.log('ℹ️   Super admin already seeded — skipping.');
    return;
  }

  const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  await pool.query(
    `INSERT INTO users (role, name, email, password_hash)
     VALUES ('super_admin', $1, $2, $3)`,
    [SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, hash]
  );
  console.log(`✅  Super admin seeded → ${SUPER_ADMIN_EMAIL}`);
}
