import http from 'node:http';
import { app } from './app.js';
import { PORT } from './config/env.js';
import { initSocket } from './lib/socket.js';

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  GymTrack API running on: http://localhost:${PORT}`);
  console.log(`  Connected DB: PostgreSQL via Prisma ORM`);
  console.log(`  - WebSockets: Enabled via Socket.IO`);
  console.log(`  - Health:   http://localhost:${PORT}/api/health`);
  console.log(`  - Traffic:  http://localhost:${PORT}/api/traffic`);
  console.log(`  - Workouts: http://localhost:${PORT}/api/workouts`);
  console.log(`===============================================`);
});
