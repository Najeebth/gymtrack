import { app } from './app.js';
import { PORT } from './config/env.js';

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  GymTrack API running on: http://localhost:${PORT}`);
  console.log(`  Connected DB: PostgreSQL via Prisma ORM`);
  console.log(`  - Health:   http://localhost:${PORT}/api/health`);
  console.log(`  - Traffic:  http://localhost:${PORT}/api/traffic`);
  console.log(`  - Workouts: http://localhost:${PORT}/api/workouts`);
  console.log(`===============================================`);
});
 