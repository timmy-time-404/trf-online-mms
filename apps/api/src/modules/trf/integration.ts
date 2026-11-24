import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { resolve } from 'node:path';
import { USER_ROLES } from '@trf/shared';
import { openDatabase } from '../../db/connection.ts';
import { createApp } from '../../app.ts';

// Explicitly disposable native PostgreSQL database; never run against the shared app DB.
const admin = openDatabase();
const origin = 'https://meong-mms.org';
let runtime: ReturnType<typeof postgres> | undefined;
const createdUsers: string[] = [];
const createdEmployees: string[] = [];
const createdTRFs: string[] = [];
let checks = 0;
try {
  const [name] = await admin`select current_database() as name`;
  assert.ok(name);
  assert.ok(name?.name.endsWith('_test'), 'Integration database name must end with _test');
  await migrate(drizzle(admin), { migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations') });
  const password = randomBytes(32).toString('hex');
  const [exists] = await admin`select 1 from pg_roles where rolname='trf_wp1_test_runtime'`;
  await admin.unsafe(`${exists ? 'ALTER' : 'CREATE'} ROLE trf_wp1_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`);
  await admin`grant trf_auth_runtime to trf_wp1_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432),
    database: name.name, username: 'trf_wp1_test_runtime', password, max: 4, prepare: false });
  const app = createApp(runtime, origin);
  const employeeA = randomUUID(), employeeB = randomUUID(), employeeC = randomUUID();
  for (const [id, department] of [[employeeA, ' HrMd '], [employeeB, 'hrmd'], [employeeC, 'Survey']]) {
    await admin`insert into public.employees(id,employee_code,employee_name,department)
      values (${id!},${randomUUID()},'WP1 integration employee',${department!})`;
    createdEmployees.push(id!);
  }
  const cookies = new Map<string, string>();
  const userIds = new Map<string, string>();
  const loginPassword = randomBytes(32).toString('base64url');
  const passwordHash = await hash(loginPassword);
  for (const role of USER_ROLES) {
    const id = randomUUID();
    await admin`insert into public.users(id,username,email,role,department,employee_id,password_hash,is_active,must_change_password)
      values (${id},${id},${id + '@example.invalid'},${role},' HRMD ',${role === 'EMPLOYEE' ? employeeA : null},${passwordHash},true,false)`;
    if (role === 'EMPLOYEE') await admin`update public.employees set user_id=${id} where id=${employeeA}`;
    createdUsers.push(id); userIds.set(role, id);
    const login = await app.request('/auth/login', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: id, password: loginPassword }),
    });
    assert.equal(login.status, 200, `${role} login failed`); checks++;
    const cookie = login.headers.get('Set-Cookie')?.split(';')[0];
    assert.ok(cookie);
    assert.ok(cookie.startsWith('__Host-trf-session='));
    cookies.set(role, cookie);
  }
  // D13: legacy regression requests carry the version they read before mutation.
  const request = async (role: string | null, path: string, method = 'GET', body?: unknown) => {
    const id=path.split('/')[1]; const version=id && /^[0-9a-f-]{36}$/.test(id) ? (await admin`select version from public.trfs where id=${id}`)[0]?.version ?? 0 : 0;
    return app.request('/trfs' + path, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(role ? { Cookie: cookies.get(role)! } : {}), 'If-Match': `"${version}"` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }); };
  const expectStatus = async (promise: Promise<Response>, status: number) => {
    const response = await promise;
    assert.equal(response.status, status, `${checks}: expected HTTP ${status}, received ${response.status}`);
    checks++; return response;
  };
  await expectStatus(request(null, ''), 401);
  for (const employeeId of [employeeA, employeeB, employeeC]) {
    const id = randomUUID();
    await admin`insert into public.trfs(id,trf_number,employee_id,department,travel_purpose,start_date,end_date,purpose_remarks,status)
      select ${id},${'WP1-' + id},id,department,'TRAINING','2026-12-01','2026-12-02','Training','DRAFT' from public.employees where id=${employeeId}`;
    createdTRFs.push(id);
  }
  for (const role of USER_ROLES) {
    const response = await expectStatus(request(role, ''), 200);
    const rows = await response.json() as { id: string; employeeId: string; startDate: string }[];
    const actual = rows.filter((r) => createdTRFs.includes(r.id));
    const expected = role === 'EMPLOYEE' ? createdTRFs.slice(0, 1) : ['ADMIN_DEPT', 'HOD'].includes(role) ? createdTRFs.slice(0, 2) : createdTRFs;
    assert.deepEqual(actual.map((r) => r.id).sort(), [...expected].sort());
    assert.ok(actual.every((row) => row.startDate === '2026-12-01'));
  }
  await expectStatus(request('EMPLOYEE', '/' + createdTRFs[2]), 404);
  await admin`update public.users set employee_id=null where id=${userIds.get('EMPLOYEE')!}`;
  const fallback = await (await expectStatus(request('EMPLOYEE', ''), 200)).json() as { id: string }[];
  assert.deepEqual(fallback.map((row) => row.id), [createdTRFs[0]]);
  await admin`update public.users set employee_id=${employeeA} where id=${userIds.get('EMPLOYEE')!}`;
  await admin`update public.users set department=' ' where id=${userIds.get('HOD')!}`;
  assert.deepEqual(await (await expectStatus(request('HOD', ''), 200)).json(), []);
  await admin`update public.users set department=' HRMD ' where id=${userIds.get('HOD')!}`;
  await expectStatus(request('EMPLOYEE', '/context'), 200);
  await expectStatus(request('HOD', '/not-an-id'), 400);
  // D8: preserve the legacy fixture dates with a late submission reason.
  const input = { lateSubmissionReason: 'Integration fixture', employeeId: employeeA, department: 'spoofed', travelPurpose: 'TRAINING', startDate: '2026-12-01', endDate: '2026-12-02', purposeRemarks: 'Training', travelArrangements: [] };
  const created = await (await expectStatus(request('EMPLOYEE', '', 'POST', input), 201)).json() as { id: string; status: string; trfNumber: string; department: string };
  createdTRFs.push(created.id);
  assert.equal(created.status, 'SUBMITTED'); assert.equal(created.department, ' HrMd ');
  assert.match(created.trfNumber, /^TRF-/);
  const [history] = await admin`select * from public.status_history where trf_id=${created.id}`;
  assert.equal(history?.changed_by, userIds.get('EMPLOYEE'));
  for (const role of ['ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA']) await expectStatus(request(role, '', 'POST', input), 403);
  const superCreated = await (await expectStatus(request('SUPER_ADMIN', '', 'POST', { ...input, employeeId: employeeC }), 201)).json() as { id: string };
  createdTRFs.push(superCreated.id);
  await expectStatus(request('EMPLOYEE', '', 'POST', { ...input, employeeId: employeeC }), 403);
  for (const invalid of [
    { purposeRemarks: ' ' }, { startDate: '2026-02-30' }, { endDate: '2026-11-30' },
    { travelPurpose: '["UNKNOWN"]' }, { purposeEntries: [] }, { status: 'PM_APPROVED' },
  ]) await expectStatus(request('EMPLOYEE', '', 'POST', { ...input, ...invalid }), 400);
  await expectStatus(request('EMPLOYEE', '/' + created.id, 'PUT', input), 409);
  await expectStatus(request('EMPLOYEE', '/' + created.id + '/resubmit', 'POST', input), 409);
  await expectStatus(request('EMPLOYEE', '/' + created.id, 'DELETE'), 409);
  const draftId = createdTRFs[0]!;
  await expectStatus(request('EMPLOYEE', '/' + createdTRFs[1], 'PUT', input), 403);
  await expectStatus(request('GA', '/' + draftId, 'PUT', input), 403);
  await expectStatus(request('EMPLOYEE', '/' + draftId, 'PUT', { purposeRemarks: 'Updated' }), 200);
  await expectStatus(request('EMPLOYEE', '/' + draftId, 'PUT', { employeeId: employeeC }), 403);
  await expectStatus(request('EMPLOYEE', '/' + draftId + '/resubmit', 'POST', input), 200);
  await admin`update public.trfs set status='NEEDS_REVISION' where id=${draftId}`;
  await expectStatus(request('EMPLOYEE', '/' + draftId, 'PUT', { purposeRemarks: 'Revision saved' }), 200);
  await expectStatus(request('EMPLOYEE', '/' + draftId, 'DELETE'), 409);
  const raced = await Promise.all([request('EMPLOYEE', '/' + draftId + '/resubmit', 'POST', input), request('EMPLOYEE', '/' + draftId + '/resubmit', 'POST', input)]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]); checks += 2;
  const [resubmission] = await admin`select count(*) as total from public.status_history where trf_id=${draftId} and old_status='NEEDS_REVISION' and new_status='SUBMITTED'`;
  assert.equal(Number(resubmission?.total), 1);
  await expectStatus(request('EMPLOYEE', '/' + createdTRFs[2], 'DELETE'), 403);
  // D9: deletion belongs to the owner, even when another role sees the draft.
  await expectStatus(request('HOD', '/' + createdTRFs[1], 'DELETE'), 403);
  await expectStatus(request('HOD', '/' + createdTRFs[1]), 200);
  // A failed history insert must also roll back the newly created request.
  await admin`revoke insert on public.status_history from trf_auth_runtime`;
  try {
    const [before] = await admin`select count(*) as total from public.trfs`;
    await expectStatus(request('EMPLOYEE', '', 'POST', input), 500);
    const [after] = await admin`select count(*) as total from public.trfs`;
    assert.equal(before?.total, after?.total);
  } finally { await admin`grant insert on public.status_history to trf_auth_runtime`; }
  const employeeUser = userIds.get('EMPLOYEE')!;
  await admin`update public.users set is_active=false where id=${employeeUser}`;
  await expectStatus(request('EMPLOYEE', ''), 401);
  await admin`update public.users set is_active=true where id=${employeeUser}`;
  for (const condition of ['expired', 'revoked', 'absolute']) {
    const token = randomBytes(32).toString('base64url');
    await admin`insert into public.app_sessions(user_id,token_hash,created_at,expires_at,revoked_at,revoke_reason)
      values (${employeeUser},${createHash('sha256').update(token).digest('hex')},
        ${new Date(Date.now()-(condition === 'absolute' ? 13 : 2)*3600000).toISOString()}::timestamptz,
        ${new Date(Date.now()+(condition === 'expired' ? -1 : 1)*3600000).toISOString()}::timestamptz,
        ${condition === 'revoked' ? new Date().toISOString() : null}::timestamptz,${condition === 'revoked' ? 'TEST' : null})`;
    cookies.set('EMPLOYEE', '__Host-trf-session=' + token);
    await expectStatus(request('EMPLOYEE', ''), 401);
  }
  console.log(`WP1 native PostgreSQL integration passed: ${checks} HTTP assertions, seven-role visibility, atomic history rollback and concurrent resubmit.`);
} finally {
  // Fixture identifiers belong exclusively to this invocation.
  if (createdTRFs.length) await admin`delete from public.trfs where id in ${admin(createdTRFs)}`;
  if (createdUsers.length) {
    await admin`delete from public.app_login_attempts where user_id in ${admin(createdUsers)}`;
    await admin`delete from public.users where id in ${admin(createdUsers)}`;
  }
  if (createdEmployees.length) await admin`delete from public.employees where id in ${admin(createdEmployees)}`;
  await runtime?.end();
  await admin.end();
}
