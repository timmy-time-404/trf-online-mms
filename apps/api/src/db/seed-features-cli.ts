import { openDatabase } from './connection.ts';
import { seedDevelopmentFeatures } from './seed-features.ts';

const db = openDatabase();
try {
  await seedDevelopmentFeatures(db, process.env.SEED_CONFIRM);
  console.log('Development locations and roster context are ready.');
} finally { await db.end(); }
