#!/usr/bin/env node
// Local development helper. Everything it creates lives in .dev/ (git-ignored).
//
//   node scripts/dev.mjs setup     create local secrets and apps/api/.env
//   node scripts/dev.mjs db:init   migrate, create the API login, seed dummy data
//   node scripts/dev.mjs db:reset  drop the Docker dev database and run db:init again
//
// Uses the Docker database from compose.dev.yaml by default. To use another local
// PostgreSQL, set DEV_DB_PORT, DEV_DB_USER and DEV_DB_PASSWORD_FILE.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dev = resolve(root, '.dev');
const api = resolve(root, 'apps/api');
const port = process.env.DEV_DB_PORT ?? '5433';
const owner = process.env.DEV_DB_USER ?? 'trf_owner';
const ownerPasswordFile = process.env.DEV_DB_PASSWORD_FILE ?? resolve(dev, 'owner_password');
const database = process.env.DEV_DB_NAME ?? 'trf';

const writeOnce = (path, value) => { if (!existsSync(path)) writeFileSync(path, value, { mode: 0o600 }); };

function setup() {
  mkdirSync(resolve(dev, 'documents'), { recursive: true });
  writeOnce(resolve(dev, 'owner_password'), randomBytes(24).toString('hex'));
  writeOnce(resolve(dev, 'runtime_password'), randomBytes(32).toString('hex'));
  writeOnce(resolve(dev, 'document_signing_key'), randomBytes(32).toString('hex'));
  // Same variable names as production; only the values differ.
  writeOnce(resolve(api, '.env'), [
    'NODE_ENV=development',
    'API_PORT=3000',
    'APP_ORIGIN=http://localhost:5173',
    'DB_HOST=127.0.0.1',
    `DB_PORT=${port}`,
    `DB_NAME=${database}`,
    'DB_USER=trf_api',
    `DB_PASSWORD_FILE=${resolve(dev, 'runtime_password')}`,
    `DOCUMENTS_DIR=${resolve(dev, 'documents')}`,
    `DOCUMENT_SIGNING_KEY_FILE=${resolve(dev, 'document_signing_key')}`,
    '# WhatsApp stays off locally. Set a token file only to test delivery on purpose.',
    'FONNTE_TOKEN_FILE=',
    'WA_ALLOWLIST=',
    '',
  ].join('\n'));
  console.log('Local secrets in .dev/ and apps/api/.env are ready.');
}

function run(script, extraEnv = {}) {
  execFileSync(process.execPath, ['--import', 'tsx', script], {
    cwd: api, stdio: 'inherit',
    env: { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: port, DB_NAME: database, DB_USER: owner,
      DB_PASSWORD_FILE: ownerPasswordFile, DB_MIGRATIONS_DIR: resolve(root, 'db/migrations'), ...extraEnv },
  });
}

function init() {
  setup();
  run('src/db/migrate.ts');
  run('src/db/provision-runtime.ts', { RUNTIME_PASSWORD_FILE: resolve(dev, 'runtime_password') });
  // Feature seed refuses any database not explicitly marked as development.
  run('src/db/mark-development.ts');
  if (!existsSync(resolve(dev, 'dummy-accounts.json'))) {
    run('src/db/seed.ts', { SEED_CONFIRM: 'trf-development-dummy-only', SEED_CREDENTIALS_FILE: resolve(dev, 'dummy-accounts.json') });
  }
  run('src/db/seed-features-cli.ts', { SEED_CONFIRM: 'trf-development-dummy-only' });
  console.log('\nLocal database ready. Dummy logins: .dev/dummy-accounts.json');
}

function reset() {
  const compose = (...args) => execFileSync('docker', ['compose', '-f', 'compose.dev.yaml', ...args], { cwd: root, stdio: 'inherit' });
  compose('down', '-v');
  rmSync(resolve(dev, 'dummy-accounts.json'), { force: true });
  compose('up', '-d', '--wait');
  init();
}

const command = process.argv[2];
if (command === 'setup') setup();
else if (command === 'db:init') init();
else if (command === 'db:reset') reset();
else { console.error('Usage: node scripts/dev.mjs <setup|db:init|db:reset>'); process.exit(1); }
