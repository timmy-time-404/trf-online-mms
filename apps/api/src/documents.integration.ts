import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { USER_ROLES, type UserRole } from '@trf/shared';
import { openDatabase } from './db/connection.ts';
import { createApp } from './app.ts';
import { createDiskStorage } from './modules/documents/storage.ts';
import { signGrant } from './modules/documents/signing.ts';
import { deliverDue, type SendWhatsApp } from './notifications/worker.ts';
import type { OutgoingMessage } from './notifications/render.ts';

/** WP5: GA documents (upload, access, D4) and WhatsApp outbox delivery. */
const admin = openDatabase();
const origin = 'https://meong-mms.org';
const secret = randomBytes(32).toString('hex');
const dir = await mkdtemp(join(tmpdir(), 'trf-docs-'));
let runtime: ReturnType<typeof postgres> | undefined;
let checks = 0;
try {
  const [database] = await admin`select current_database() as name`;
  assert.ok(database?.name.endsWith('_test'), 'Use an isolated disposable database ending in _test');
  await migrate(drizzle(admin), { migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations') });
  const [existing] = await admin`select count(*)::int as total from public.users`;
  assert.equal(existing?.total, 0, 'Documents integration requires an empty dedicated database');
  const password = randomBytes(32).toString('hex');
  const [exists] = await admin`select 1 from pg_roles where rolname='trf_wp5_test_runtime'`;
  await admin.unsafe(`${exists ? 'ALTER' : 'CREATE'} ROLE trf_wp5_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`);
  await admin`grant trf_auth_runtime to trf_wp5_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: database!.name,
    username: 'trf_wp5_test_runtime', password, max: 4, prepare: false, onnotice: () => {} });
  const storage = createDiskStorage(dir);
  const app = createApp(runtime, origin, { storage, documentSigningKey: secret });

  const owner = randomUUID(), stranger = randomUUID();
  await admin`insert into public.employees(id,employee_code,employee_name,department,phone)
    values (${owner},'E-OWN','Owner','HRMD','082398454988'), (${stranger},'E-OTH','Other','Survey','081200000000')`;
  const cookies = new Map<string, string>();
  const addUser = async (key: string, role: UserRole, department: string, employeeId: string | null) => {
    const id = randomUUID(), token = randomBytes(32).toString('base64url');
    await admin`insert into public.users(id,username,email,role,department,employee_id,is_active,must_change_password)
      values (${id},${id},${id + '@example.invalid'},${role},${department},${employeeId},true,false)`;
    if (employeeId) await admin`update public.employees set user_id=${id} where id=${employeeId}`;
    await admin`insert into public.app_sessions(user_id,token_hash,expires_at)
      values (${id},${createHash('sha256').update(token).digest('hex')},now()+interval '30 minutes')`;
    cookies.set(key, '__Host-trf-session=' + token);
  };
  for (const role of USER_ROLES) await addUser(role, role, 'HRMD', role === 'EMPLOYEE' ? owner : null);
  await addUser('STRANGER', 'EMPLOYEE', 'Survey', stranger);

  const newTRF = async (status: string) => {
    const [row] = await admin`insert into public.trfs(employee_id,department,travel_purpose,start_date,end_date,purpose_remarks,status,travel_arrangements)
      values (${owner},'HRMD','["TRAINING"]',current_date+30,current_date+31,'Training',${status},'[]'::jsonb) returning id,version`;
    return row as { id: string; version: number };
  };
  const call = (who: string | null, path: string, init: { method?: string; body?: FormData | string; version?: number; json?: unknown } = {}) =>
    app.request(path, { method: init.method ?? 'GET', body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      headers: { Origin: origin, ...(who ? { Cookie: cookies.get(who)! } : {}),
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.version === undefined ? {} : { 'If-Match': `"${init.version}"` }) } });
  const expect = async (pending: Response | Promise<Response>, status: number, label: string) => {
    const response = await pending;
    assert.equal(response.status, status, `${label}: expected ${status}, got ${response.status} ${await response.clone().text()}`);
    checks++;
    return response;
  };
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
  const form = (bytes: Uint8Array, name = 'ticket.pdf') => { const f = new FormData(); f.append('file', new File([bytes], name)); return f; };

  const t = await newTRF('PM_APPROVED');
  const up = (who: string, bytes: Uint8Array, version?: number, key = 'flightTicket') =>
    call(who, `/trf-documents/${t.id}/${key}`, { method: 'POST', body: form(bytes), version });

  await expect(up('EMPLOYEE', pdf, t.version), 403, 'employee cannot upload');
  await expect(up('GA', pdf), 428, 'upload requires If-Match');
  await expect(up('GA', pdf, t.version + 9), 409, 'stale version');
  await expect(up('GA', new TextEncoder().encode('<html>'), t.version), 400, 'content sniffing rejects non-PDF/image');
  await expect(up('GA', pdf, t.version, 'passport'), 400, 'unknown document key');
  const uploaded = await (await expect(up('GA', pdf, t.version), 201, 'GA upload')).json() as { version: number; gaDocuments: Record<string, { url: string; path: string }> };
  assert.equal(uploaded.version, t.version + 1, 'upload bumps the TRF version');
  assert.equal(uploaded.gaDocuments.flightTicket?.url, `/api/trf-documents/${t.id}/flightTicket`);

  const download = await expect(call('EMPLOYEE', `/trf-documents/${t.id}/flightTicket`), 200, 'owner downloads');
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), pdf);
  assert.equal(download.headers.get('Content-Type'), 'application/pdf');
  assert.match(download.headers.get('Content-Disposition') ?? '', /^attachment;/);
  await expect(call('STRANGER', `/trf-documents/${t.id}/flightTicket`), 404, 'other employee cannot see');
  await expect(call(null, `/trf-documents/${t.id}/flightTicket`), 401, 'no session');
  await expect(call('HR', `/trf-documents/${t.id}/flightTicket`), 200, 'HR can see');

  // Replacing a slot keeps exactly one file for it.
  const replaced = await (await expect(up('GA', pdf, uploaded.version), 201, 'replace document')).json() as { version: number; gaDocuments: Record<string, { path: string }> };
  assert.notEqual(replaced.gaDocuments.flightTicket?.path, uploaded.gaDocuments.flightTicket?.path);
  await assert.rejects(storage.get(uploaded.gaDocuments.flightTicket!.path), 'old file removed after replace');

  // Signed public link: valid, tampered, expired.
  const token = signGrant(secret, { trfId: t.id, key: 'flightTicket', exp: Date.now() + 60_000 });
  await expect(call(null, `/public/documents/${token}`), 200, 'signed link works without session');
  await expect(call(null, `/public/documents/${token.slice(0, -2)}xx`), 404, 'tampered link');
  await expect(call(null, `/public/documents/${signGrant(secret, { trfId: t.id, key: 'flightTicket', exp: Date.now() - 1 })}`), 404, 'expired link');

  // D4: GA cannot process without a document.
  const empty = await newTRF('PM_APPROVED');
  await expect(call('GA', `/trfs/${empty.id}/process`, { method: 'POST', json: { remarks: 'x' }, version: empty.version }), 400, 'D4 process without document');
  const processed = await (await expect(call('GA', `/trfs/${t.id}/process`, { method: 'POST', json: { remarks: 'Tiket siap' }, version: replaced.version }), 200, 'process with document')).json() as { status: string; version: number };
  assert.equal(processed.status, 'GA_PROCESSED');
  await expect(up('GA', pdf, processed.version), 409, 'documents locked after processing');

  // Outbox delivery: allowlisted owner receives status text plus the document.
  const sent: { target: string; message: OutgoingMessage }[] = [];
  const ok: SendWhatsApp = async (target, message) => { sent.push({ target, message }); };
  const link = (trfId: string, key: string) => `${origin}/api/public/documents/${signGrant(secret, { trfId, key, exp: Date.now() + 60_000 })}`;
  await admin`update public.notification_outbox set status='SKIPPED' where trf_id<>${t.id} and status='PENDING'`;
  let result = await deliverDue(runtime, { send: ok, allowlist: new Set(['6282398454988']), documentLink: link });
  assert.deepEqual(result, { sent: 1, skipped: 0, retried: 0, failed: 0 });
  assert.equal(sent.length, 2, 'status message + one document');
  assert.equal(sent[0]!.target, '6282398454988');
  assert.match(sent[0]!.message.text, /diproses GA/);
  assert.match(sent[1]!.message.fileUrl ?? '', /\/api\/public\/documents\//);
  const [row] = await admin`select status,sent_at from public.notification_outbox where trf_id=${t.id}`;
  assert.equal(row?.status, 'SENT'); assert.ok(row?.sent_at);
  checks += 4;

  // Outside the allowlist → SKIPPED, nothing sent.
  const enqueue = (phone: string | null) => admin`insert into public.notification_outbox(trf_id,recipient_phone,template_key,payload)
    values (${empty.id},${phone},'TRF_STATUS_CHANGED',${JSON.stringify({ trfNumber: 'X', employeeName: 'Owner', newStatus: 'REJECTED', actorName: 'HOD' })}::jsonb) returning id`;
  const [outside] = await enqueue('081299999999');
  sent.length = 0;
  result = await deliverDue(runtime, { send: ok, allowlist: new Set(['6282398454988']), documentLink: link });
  assert.equal(result.skipped, 1); assert.equal(sent.length, 0);
  const [skipped] = await admin`select status from public.notification_outbox where id=${outside!.id}`;
  assert.equal(skipped?.status, 'SKIPPED');

  // Provider failure → retry with backoff, then FAILED after max attempts.
  const [flaky] = await enqueue('082398454988');
  const failing: SendWhatsApp = async () => { throw new Error('Fonnte down'); };
  result = await deliverDue(runtime, { send: failing, allowlist: new Set(['6282398454988']), documentLink: link, maxAttempts: 2 });
  assert.equal(result.retried, 1);
  let [state] = await admin`select status,attempts,next_attempt_at>now() as later from public.notification_outbox where id=${flaky!.id}`;
  assert.deepEqual({ ...state }, { status: 'PENDING', attempts: 1, later: true });
  await admin`update public.notification_outbox set next_attempt_at=now() where id=${flaky!.id}`;
  result = await deliverDue(runtime, { send: failing, allowlist: new Set(['6282398454988']), documentLink: link, maxAttempts: 2 });
  assert.equal(result.failed, 1);
  [state] = await admin`select status,last_error from public.notification_outbox where id=${flaky!.id}`;
  assert.equal(state?.status, 'FAILED'); assert.equal(state?.last_error, 'Fonnte down');
  checks += 6;

  // GA can remove a document while the TRF still waits for processing.
  const other = await newTRF('PM_APPROVED');
  const added = await (await expect(call('GA', `/trf-documents/${other.id}/hotelVoucher`, { method: 'POST', body: form(pdf), version: other.version }), 201, 'upload hotel voucher')).json() as { version: number };
  const removed = await (await expect(call('GA', `/trf-documents/${other.id}/hotelVoucher`, { method: 'DELETE', version: added.version }), 200, 'delete document')).json() as { gaDocuments: Record<string, unknown> };
  assert.equal(removed.gaDocuments.hotelVoucher, undefined);

  console.log(`WP5 PostgreSQL integration passed: ${checks} checks; upload/access/D4, signed links, outbox sent/skipped/retry/failed.`);
} finally {
  await runtime?.end();
  await admin.end();
  await rm(dir, { recursive: true, force: true });
}
