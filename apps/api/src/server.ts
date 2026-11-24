import { existsSync, readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { createDiskStorage } from './modules/documents/storage.ts';
import { signGrant } from './modules/documents/signing.ts';
import { normalizeIndonesianPhone } from './notifications/render.ts';
import { fonnteSender, startOutboxWorker } from './notifications/worker.ts';

const config = loadConfig();
const database = process.env.DB_HOST ? openDatabase() : undefined;
const origin = process.env.APP_ORIGIN;
if (database && (!origin || new URL(origin).origin !== origin)) {
  throw new Error('Configure APP_ORIGIN with the exact application origin.');
}

/** Optional secret file: missing or empty means the feature stays off. */
const readSecret = (path: string | undefined) =>
  path && existsSync(path) ? readFileSync(path, 'utf8').trim() : '';

const storage = process.env.DOCUMENTS_DIR ? createDiskStorage(process.env.DOCUMENTS_DIR) : undefined;
const documentSigningKey = readSecret(process.env.DOCUMENT_SIGNING_KEY_FILE);
if (storage && documentSigningKey.length < 32) throw new Error('Document signing key must be at least 32 characters.');

const server = serve({ fetch: createApp(database, origin, { storage, documentSigningKey }).fetch, port: config.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

// WhatsApp delivery runs on its own connection so it never queues behind HTTP requests.
const fonnteToken = readSecret(process.env.FONNTE_TOKEN_FILE);
const workerDb = database && storage && fonnteToken ? openDatabase() : undefined;
const stopWorker = workerDb ? startOutboxWorker(workerDb, {
  send: fonnteSender(fonnteToken),
  allowlist: new Set((process.env.WA_ALLOWLIST ?? '').split(',').map(normalizeIndonesianPhone).filter((n): n is string => !!n)),
  documentLink: (trfId, key) => `${origin}/api/public/documents/${signGrant(documentSigningKey, {
    trfId, key, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })}`,
}) : undefined;
if (database && !workerDb) console.log('WhatsApp delivery disabled: Fonnte token not configured; outbox stays pending.');

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopWorker?.();
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close(async (error) => {
    await Promise.all([database?.end(), workerDb?.end()]);
    clearTimeout(deadline);
    process.exit(error ? 1 : 0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
