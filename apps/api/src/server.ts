import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/connection.ts';

const config = loadConfig();
const database = process.env.DB_HOST ? openDatabase() : undefined;
if (database && (!process.env.APP_ORIGIN || new URL(process.env.APP_ORIGIN).origin !== process.env.APP_ORIGIN)) {
  throw new Error('Configure APP_ORIGIN with the exact application origin.');
}

const server = serve({ fetch: createApp(database, process.env.APP_ORIGIN).fetch, port: config.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close(async (error) => {
    await database?.end();
    clearTimeout(deadline);
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
