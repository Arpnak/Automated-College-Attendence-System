import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import authRoutes from './routes/auth.js';
import onboardRoutes from './routes/onboard.js';
import adminRoutes from './routes/admin.js';
import courseRoutes from './routes/courses.js';
import sessionRoutes from './routes/sessions.js';
import superAdminRoutes from './routes/superadmin.js';
import studentRoutes from './routes/students.js';

import { setupWebSocket } from './ws/gateway.js';
import { errorHandler } from './utils/errors.js';
import { startBulkWriter } from './workers/bulkWriter.js';
import { startTTLReaper } from './workers/ttlReaper.js';
import { startCropConsumer } from './workers/cropConsumer.js';
import { startAttendanceConsumer } from './workers/attendanceConsumer.js';
import {
  runSuperAdminMigration,
  runV2Migration,
  runV3Migration,
  runV4Migration,
  runV5Migration,
  seedSuperAdmin,
} from './db/seed.js';

const app = express();
const server = createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/onboard', onboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/students', studentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

setupWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`ClassRoll API Gateway on :${PORT}`);
  // Auto-apply migrations then seed super admin
  await runSuperAdminMigration();
  await runV2Migration();
  await runV3Migration();
  await runV4Migration();
  await runV5Migration();
  await seedSuperAdmin();

  // Start all background workers in-process
  startBulkWriter();
  startTTLReaper();
  startCropConsumer();
  startAttendanceConsumer();
  console.log('All background workers started.');
});

// NOTE — deployment reminder, not code that runs from this file:
// This process only serves the HTTP/WS API. The following MUST also be running
// as separate processes for attendance to actually work end-to-end:
//   node src/workers/cropConsumer.js        (NEW — the piece that was missing)
//   node src/workers/attendanceConsumer.js
//   node src/workers/bulkWriter.js
//   node src/workers/ttlReaper.js
// src/workers/faceResultConsumer.js should be deleted — it's dead code from an
// earlier pipeline design, its message contract doesn't match the Python
// worker's actual API, and nothing ever calls startFaceResultConsumer().
