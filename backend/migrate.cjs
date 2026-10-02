const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://attendx:attendx@localhost:5432/attendx' });

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_working_days (
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        PRIMARY KEY (course_id, date)
      );
    `);
    console.log('Migration successful.');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
