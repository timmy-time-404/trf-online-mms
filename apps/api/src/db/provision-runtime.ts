import { readFileSync } from 'node:fs';
import { openDatabase } from './connection.ts';

const password = readFileSync(process.env.RUNTIME_PASSWORD_FILE ?? '/run/seed/runtime_password', 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Expected a generated 256-bit runtime password file.');
const db = openDatabase();
try {
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(174231, 3)`;
    const [role] = await tx`select 1 from pg_roles where rolname='trf_api'`;
    // Identifiers are fixed and the password is validated hexadecimal, never logged.
    await tx.unsafe(`${role ? 'ALTER' : 'CREATE'} ROLE trf_api WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
    await tx`grant trf_auth_runtime to trf_api`;
  });
  console.log('Runtime login provisioned with authentication-only database permissions.');
} catch {
  console.error('Runtime provisioning failed. No credential values were logged.');
  process.exitCode = 1;
} finally { await db.end(); }
