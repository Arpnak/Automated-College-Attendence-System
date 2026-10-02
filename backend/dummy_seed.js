import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function seed() {
  await client.connect();
  console.log('Seeding dummy data...');
  const hash = await bcrypt.hash('password123', 10);
  
  // 1. Institution
  const resInst = await client.query(`
    INSERT INTO institutions (name, domain, is_active) VALUES ('Dummy University', 'dummy.edu', true) RETURNING id
  `);
  const instId = resInst.rows[0].id;
  
  // 2. Admin
  await client.query(`
    INSERT INTO users (role, name, email, password_hash, institution_id)
    VALUES ('admin', 'Admin User', 'admin@dummy.edu', $1, $2)
  `, [hash, instId]);

  // 3. Professor
  const resProf = await client.query(`
    INSERT INTO users (role, name, email, password_hash, institution_id)
    VALUES ('professor', 'Prof Smith', 'prof@dummy.edu', $1, $2) RETURNING id
  `, [hash, instId]);
  const profId = resProf.rows[0].id;

  // 4. Student
  const resStudent = await client.query(`
    INSERT INTO users (role, name, email, password_hash)
    VALUES ('student', 'John Doe', 'john@dummy.edu', $1) RETURNING id
  `, [hash]);
  const studentId = resStudent.rows[0].id;

  // Map student to institution
  await client.query(`
    INSERT INTO student_institution_map (student_id, institution_id, roll_number)
    VALUES ($1, $2, 'R1234')
  `, [studentId, instId]);

  // 5. Course (Started 5 days ago)
  const d = new Date();
  d.setDate(d.getDate() - 5);
  const startStr = d.toISOString().split('T')[0];

  const resCourse = await client.query(`
    INSERT INTO courses (name, code, term, professor_id, institution_id, start_date, rekognition_collection_id)
    VALUES ('Intro to CS', 'CS101', 'Fall 2026', $1, $2, $3, 'dummy-collection') RETURNING id
  `, [profId, instId, startStr]);
  const courseId = resCourse.rows[0].id;

  // 6. Enroll student (approved)
  await client.query(`
    INSERT INTO course_enrollments (course_id, student_id, status)
    VALUES ($1, $2, 'approved')
  `, [courseId, studentId]);

  console.log('Seeding complete. You can login with prof@dummy.edu / password123 or john@dummy.edu / password123');
  await client.end();
}

seed().catch(console.error);
