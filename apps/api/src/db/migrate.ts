import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { openDatabase } from './connection.ts';

const client = openDatabase();
try {
  // One connection holds this session lock across the migrator's transaction.
  await client`select pg_advisory_lock(174231, 1)`;
  await migrate(drizzle(client), {
    migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations'),
  });
  console.log('Database migrations applied.');
} catch {
  console.error('Database migration failed. Inspect the database and migration files.');
  process.exitCode = 1;
} finally {
  // Closing the connection also releases the advisory lock after any failure.
  await client.end();
}
