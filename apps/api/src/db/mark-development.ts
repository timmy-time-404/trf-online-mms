import { openDatabase } from './connection.ts';

/** Marks a local database as development so dev-only seeds are allowed. Never run on production. */
const db = openDatabase();
try {
  const [row] = await db`select current_database() as name`;
  await db.unsafe(`ALTER DATABASE "${String(row?.name).replace(/"/g, '')}" SET trf.environment = 'development'`);
  console.log('Database marked as development.');
} finally {
  await db.end();
}
