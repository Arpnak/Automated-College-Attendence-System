// Runs schema.sql against the configured DATABASE_URL.
// Usage: node src/db/migrate.js
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dir = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dir, 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log('✅  Schema applied successfully.');
} catch (err) {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
