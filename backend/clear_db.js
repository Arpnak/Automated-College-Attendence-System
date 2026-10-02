import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function clearDB() {
  await client.connect();
  console.log('Clearing database...');
  await client.query(`
    TRUNCATE TABLE users, courses, institutions, attendance_sessions, attendance_logs, manual_attendance, course_enrollments, student_institution_map CASCADE;
  `);
  console.log('Database cleared.');
  await client.end();
}

clearDB().catch(console.error);
