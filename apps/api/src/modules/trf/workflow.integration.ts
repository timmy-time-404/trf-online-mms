import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { USER_ROLES, TRF_STATUSES, type UserRole, type WorkflowAction } from '@trf/shared';
import { openDatabase } from '../../db/connection.ts';
import { createApp } from '../../app.ts';

const admin = openDatabase();
let runtime: ReturnType<typeof postgres> | undefined;
const users = new Map<UserRole, string>(), employees = new Map<UserRole, string>(), cookies = new Map<UserRole, string>();
const trfs: string[] = [];
let checks = 0, transitions = 0;
const origin = 'https://meong-mms.org';
try {
  const [database] = await admin`select current_database() as name`;
  assert.ok(database);
  assert.ok(database?.name.endsWith('_test'), 'Use an isolated disposable database ending in _test');
  // Skip-policy tests toggle every fixture role: require an empty dedicated database.
  await migrate(drizzle(admin), { migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations') });
  const [existing] = await admin`select count(*) as total from public.users`;
  assert.equal(Number(existing?.total), 0, 'Workflow integration requires a database without application users');
  const password = randomBytes(32).toString('hex');
  const [roleExists] = await admin`select 1 from pg_roles where rolname='trf_wp2_test_runtime'`;
  await admin.unsafe(`${roleExists ? 'ALTER' : 'CREATE'} ROLE trf_wp2_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`);
  await admin`grant trf_auth_runtime to trf_wp2_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: database.name,
    username: 'trf_wp2_test_runtime', password, max: 4, prepare: false, onnotice: () => {} });
  const app = createApp(runtime, origin);
  for (const role of USER_ROLES) {
    const employee = randomUUID(), user = randomUUID(), token = randomBytes(32).toString('base64url');
    await admin`insert into public.employees(id,employee_code,employee_name,department,phone)
      values (${employee},${employee},${'Actor ' + role},' HrMd ','082398454988')`;
    employees.set(role, employee);
    await admin`insert into public.users(id,username,email,role,department,employee_id,is_active,must_change_password)
      values (${user},${'WP2_' + role},${user + '@example.invalid'},${role},' hrmd ',${employee},true,false)`;
    users.set(role, user);
    if (role === 'EMPLOYEE') await admin`update public.employees set user_id=${user} where id=${employee}`;
    await admin`insert into public.app_sessions(user_id,token_hash,expires_at)
      values (${user},${createHash('sha256').update(token).digest('hex')},now()+interval '30 minutes')`;
    cookies.set(role, '__Host-trf-session=' + token);
  }
  // D13: send the version captured before each request, including concurrent requests.
  const request = async (role: UserRole | null, id: string, endpoint: string, body: unknown = {}) => {
    const version=/^[0-9a-f-]{36}$/.test(id) ? (await admin`select version from public.trfs where id=${id}`)[0]?.version ?? 0 : 0;
    return app.request('/trfs/' + id + '/' + endpoint, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(role ? { Cookie: cookies.get(role)! } : {}), 'If-Match': `"${version}"` }, body: JSON.stringify(body),
  }); };
  const expectStatus = async (promise: Promise<Response> | Response, expected: number) => {
    const response = await promise;
    assert.equal(response.status, expected, `HTTP check ${checks}: ${await response.clone().text()}`);
    checks++; return response;
  };
  // D4: TRFs waiting for GA carry one stored document so process is allowed.
  const withDocument = (id: string) => admin`update public.trfs set ga_documents=${JSON.stringify({ flightTicket: {
    name: 'ticket.pdf', url: '/api/trf-documents/' + id + '/flightTicket', path: id + '/fixture.pdf' } })}::jsonb where id=${id}`;
  const fixture = async (status: string, department = ' HRMD ', document = true) => {
    const id = randomUUID();
    await admin`insert into public.trfs(id,trf_number,employee_id,department,status,travel_purpose,start_date,end_date,purpose_remarks,late_submission_reason)
      values (${id},${'WP2-' + id},${employees.get('EMPLOYEE')!},${department},${status},'TRAINING','2026-12-01','2026-12-02','Training','Integration fixture')`;
    if (status === 'PM_APPROVED' && document) await withDocument(id);
    trfs.push(id); return id;
  };
  const counts = async (id: string) => {
    const [row] = await admin`select (select count(*)::int from public.status_history where trf_id=${id}) as history,
      (select count(*)::int from public.notification_outbox where trf_id=${id}) as outbox`;
    return row;
  };
  const assertMutation = async (id: string, status: string, role: UserRole) => {
    const [row] = await admin`select * from public.trfs where id=${id}`;
    assert.equal(row?.status, status);
    assert.deepEqual(await counts(id), { history: 1, outbox: 1 });
    const [history] = await admin`select * from public.status_history where trf_id=${id}`;
    assert.equal(history?.changed_by, users.get(role));
    assert.equal(history?.changed_by_name, 'Actor ' + role);
    const [outbox] = await admin`select * from public.notification_outbox where trf_id=${id}`;
    assert.equal(outbox?.status, 'PENDING'); assert.equal(outbox?.recipient_phone, '082398454988');
    assert.equal(outbox?.payload.newStatus, status);
    return row!;
  };
  // Independent oracle copied from the characterized legacy table, not the implementation.
  const main: Record<string, string> = { ADMIN_DEPT_VERIFY_SUBMITTED: 'PENDING_APPROVAL',
    HOD_APPROVE_PENDING_APPROVAL: 'HOD_APPROVED', HR_APPROVE_HOD_APPROVED: 'HR_APPROVED',
    PM_APPROVE_HR_APPROVED: 'PM_APPROVED', GA_APPROVE_PM_APPROVED: 'GA_PROCESSED' };
  const review: Record<UserRole, string[]> = { EMPLOYEE: [], ADMIN_DEPT: ['SUBMITTED'], HOD: ['PENDING_APPROVAL'],
    HR: ['HOD_APPROVED'], PM: ['HR_APPROVED'], GA: ['PM_APPROVED'],
    SUPER_ADMIN: ['SUBMITTED', 'PENDING_APPROVAL', 'HOD_APPROVED', 'HR_APPROVED', 'PM_APPROVED'] };
  const actions: WorkflowAction[] = ['VERIFY', 'APPROVE', 'REJECT', 'REVISE'];
  for (const role of USER_ROLES) for (const action of actions) for (const status of TRF_STATUSES) {
    const id = await fixture(status);
    const endpoint = action === 'VERIFY' ? 'verify' : action === 'APPROVE' ? role === 'GA' ? 'process' : 'approve' : action.toLowerCase();
    const body = action === 'VERIFY' ? { decision: 'YES' } : action === 'APPROVE' && role === 'HR'
      ? { lumpsum: { amount: 75_000, note: ' Test ' } } : { remarks: 'Test' };
    const next = action === 'REJECT' || action === 'REVISE'
      ? review[role].includes(status) ? action === 'REJECT' ? 'REJECTED' : 'NEEDS_REVISION' : undefined
      : main[`${role}_${action}_${status}`];
    const roleAllowed = action === 'VERIFY' ? role === 'ADMIN_DEPT'
      : action === 'APPROVE' ? ['HOD', 'HR', 'PM', 'GA'].includes(role) : role !== 'EMPLOYEE';
    await expectStatus(request(role, id, endpoint, body), next ? 200 : roleAllowed ? 409 : 403);
    if (next) {
      const row = await assertMutation(id, next, role); transitions++;
      if (action === 'VERIFY') assert.equal(row.admin_dept_verify.verifierName, 'Actor ADMIN_DEPT');
      if (action === 'APPROVE' && (role === 'HOD' || role === 'HR')) assert.equal(row.parallel_approval[role.toLowerCase()].actionByName, 'Actor ' + role);
      if (action === 'APPROVE' && role === 'HR') { assert.equal(Number(row.lumpsum_amount), 75_000); assert.equal(row.lumpsum_note, 'Test'); }
      if (action === 'APPROVE' && role === 'PM') assert.equal(row.pm_approval.approverId, users.get(role));
      if (action === 'APPROVE' && role === 'GA') assert.equal(row.ga_process.processorId, users.get(role));
    } else {
      assert.deepEqual(await counts(id), { history: 0, outbox: 0 });
      const [row] = await admin`select status from public.trfs where id=${id}`;
      assert.equal(row?.status, status);
    }
  }
  assert.equal(transitions, 25);
  const resubmit = await fixture('NEEDS_REVISION');
  await expectStatus(request('EMPLOYEE', resubmit, 'resubmit'), 200);
  await assertMutation(resubmit, 'SUBMITTED', 'EMPLOYEE');
  const no = await fixture('SUBMITTED');
  await expectStatus(request('ADMIN_DEPT', no, 'verify', { decision: 'NO' }), 200);
  assert.equal((await assertMutation(no, 'NEEDS_REVISION', 'ADMIN_DEPT')).admin_dept_verify.verified, false);
  for (const action of ['approve', 'reject', 'revise']) await expectStatus(request('HOD', await fixture('PENDING_APPROVAL', 'Survey'), action, { remarks: 'Test' }), 403);
  await expectStatus(request('ADMIN_DEPT', await fixture('SUBMITTED', 'Survey'), 'verify', { decision: 'YES' }), 403);
  const hr = await fixture('HOD_APPROVED');
  for (const body of [{}, { lumpsum: { amount: 123 } }, { lumpsum: { amount: '75000' } }])
    await expectStatus(request('HR', hr, 'approve', body), 400);
  await expectStatus(request('HOD', await fixture('PENDING_APPROVAL'), 'revise', { remarks: ' ' }), 400);
  await expectStatus(request('GA', await fixture('PM_APPROVED'), 'process', { ga_documents: { url: 'https://untrusted.invalid/file' } }), 400);
  await expectStatus(request('ADMIN_DEPT', 'queue', 'verify', { decision: 'YES' }), 400);
  await expectStatus(request('GA', await fixture('PM_APPROVED'), 'edit-approve', { updates: {}, lumpsum: { amount: 75_000 } }), 400);
  const race = await fixture('PENDING_APPROVAL');
  const approvals = await Promise.all([request('HOD', race, 'approve'), request('HOD', race, 'approve')]);
  assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 409]); checks += 2;
  await assertMutation(race, 'HOD_APPROVED', 'HOD');
  const edits = { purposeRemarks: 'Updated by reviewer' };
  for (const role of ['HR', 'GA'] as const) {
    const status = role === 'HR' ? 'HOD_APPROVED' : 'PM_APPROVED', id = await fixture(status);
    await admin`update public.trfs set parallel_approval='{"hod":{"status":"APPROVED","actionByName":"Prior HOD"}}'::jsonb where id=${id}`;
    await expectStatus(request(role, id, 'edit-approve', { updates: edits, note: ' Please review ',
      ...(role === 'HR' ? { lumpsum: { amount: 150_000, note: 'Edit' } } : {}) }), 200);
    const row = await assertMutation(id, role === 'HR' ? 'HR_APPROVED' : status, role);
    assert.equal(row.purpose_remarks, edits.purposeRemarks);
    assert.equal(row.parallel_approval.hod.actionByName, 'Prior HOD');
    const [notification] = await admin`select * from public.notifications where trf_id=${id} and user_id=${users.get('EMPLOYEE')!}`;
    assert.equal(notification?.user_id, users.get('EMPLOYEE')); assert.equal(notification?.message, 'Please review');
    const [history] = await admin`select * from public.status_history where trf_id=${id}`;
    if (role === 'GA') assert.equal(history?.old_status, history?.new_status);
    await expectStatus(request(role, await fixture('SUBMITTED'), 'edit-approve', { updates: edits }), 409);
  }
  await expectStatus(request('HR', await fixture('HOD_APPROVED'), 'edit-approve', { updates: edits }), 400);
  await expectStatus(request('GA', await fixture('PM_APPROVED'), 'edit-approve', { updates: { status: 'GA_PROCESSED' } }), 400);
  // Outbox failure rolls back status, payload, lumpsum, history and in-app notification.
  const rollback = await fixture('HOD_APPROVED');
  await admin`revoke insert on public.notification_outbox from trf_auth_runtime`;
  try {
    await expectStatus(request('HR', rollback, 'edit-approve', { updates: edits, lumpsum: { amount: 75_000 } }), 500);
    const [row] = await admin`select * from public.trfs where id=${rollback}`;
    assert.equal(row?.status, 'HOD_APPROVED'); assert.equal(row?.lumpsum_amount, null); assert.equal(row?.purpose_remarks, 'Training');
    assert.deepEqual(await counts(rollback), { history: 0, outbox: 0 });
    const [notifications] = await admin`select count(*)::int as total from public.notifications where trf_id=${rollback}`;
    assert.equal(notifications?.total, 0);
  } finally { await admin`grant insert on public.notification_outbox to trf_auth_runtime`; }
  const notificationRollback = await fixture('HOD_APPROVED');
  await admin`revoke insert on public.notifications from trf_auth_runtime`;
  try {
    await expectStatus(request('HR', notificationRollback, 'edit-approve', { updates: edits, lumpsum: { amount: 75_000 } }), 500);
    assert.deepEqual(await counts(notificationRollback), { history: 0, outbox: 0 });
    const [row] = await admin`select status,lumpsum_amount from public.trfs where id=${notificationRollback}`;
    assert.equal(row?.status, 'HOD_APPROVED'); assert.equal(row?.lumpsum_amount, null);
  } finally { await admin`grant insert on public.notifications to trf_auth_runtime`; }
  // #14: each stage notifies the next role in-app (ADMIN_DEPT/HOD only for the TRF department) and the owner when done.
  const otherHod = randomUUID();
  await admin`insert into public.users(id,username,email,role,department,is_active,must_change_password)
    values (${otherHod},${otherHod},${otherHod + '@example.invalid'},'HOD','Survey',true,false)`;
  const inbox = (trf: string) => admin<{ user_id: string; title: string; message: string }[]>`
    select user_id,title,message from public.notifications where trf_id=${trf} order by created_at`;
  const latestFor = async (trf: string, userId: string) => (await inbox(trf)).filter((n) => n.user_id === userId).at(-1);
  const chain = await fixture('SUBMITTED');
  await expectStatus(request('ADMIN_DEPT', chain, 'verify', { decision: 'YES' }), 200);
  assert.match((await latestFor(chain, users.get('HOD')!))?.title ?? '', /menunggu approval Anda/);
  assert.equal((await inbox(chain)).length, 1, 'Only the HRMD HOD is notified, not the Survey HOD');
  await expectStatus(request('HOD', chain, 'approve'), 200);
  assert.match((await latestFor(chain, users.get('HR')!))?.title ?? '', /menunggu approval Anda/);
  await expectStatus(request('HR', chain, 'approve', { lumpsum: { amount: 200_000 } }), 200);
  assert.match((await latestFor(chain, users.get('PM')!))?.title ?? '', /menunggu approval Anda/);
  await expectStatus(request('PM', chain, 'approve'), 200);
  assert.match((await latestFor(chain, users.get('GA')!))?.title ?? '', /menunggu proses tiket\/voucher/);
  await expectStatus(request('GA', await fixture('PM_APPROVED', ' HRMD ', false), 'process', { remarks: 'No document' }), 400);
  await withDocument(chain);
  const processed = await (await expectStatus(request('GA', chain, 'process', { voucherDetails: { transportation: 'Car' }, remarks: 'Ready', ga_documents: {} }), 200)).json() as {
    status: string; gaProcess: { voucherDetails: { transportation: string }; remarksToEmployee: string }; lumpsumAmount: number;
  };
  const ready = await latestFor(chain, users.get('EMPLOYEE')!);
  assert.match(ready?.title ?? '', /sudah siap/); assert.equal(ready?.message, 'Ready');
  assert.ok(!(await inbox(chain)).some((n) => n.user_id === otherHod));
  const revision = await fixture('SUBMITTED');
  await expectStatus(request('ADMIN_DEPT', revision, 'verify', { decision: 'NO', remarks: 'Lengkapi tanggal pulang' }), 200);
  const revise = await latestFor(revision, users.get('EMPLOYEE')!);
  assert.match(revise?.title ?? '', /perlu direvisi/); assert.equal(revise?.message, 'Lengkapi tanggal pulang');
  await admin`delete from public.users where id=${otherHod}`;
  assert.equal(processed.status, 'GA_PROCESSED'); assert.equal(processed.lumpsumAmount, 200_000);
  assert.equal(processed.gaProcess.voucherDetails.transportation, 'Car'); assert.equal(processed.gaProcess.remarksToEmployee, 'Ready');
  assert.deepEqual(await counts(chain), { history: 5, outbox: 5 });
  // Real SQL status change after a service read makes the conditional write affect zero rows.
  const { saveWorkflow } = await import('./workflowRepository.ts');
  const { findRow } = await import('./repository.ts');
  const stale = await fixture('PENDING_APPROVAL');
  const snapshot = await findRow(runtime, stale);
  assert.ok(snapshot);
  await admin`update public.trfs set status='HOD_APPROVED' where id=${stale}`;
  assert.equal(await saveWorkflow(runtime, snapshot, { status: 'HOD_APPROVED' }), undefined);
  // D2: every unavailable-approver scenario retains PENDING_APPROVAL; never APPROVED.
  for (const scenario of ['none', 'hr', 'inactive-hod', 'other-dept-hod']) {
    await admin`update public.users set is_active=false where role in ('HOD','HR','PM','GA')`;
    if (scenario === 'hr' || scenario === 'inactive-hod') await admin`update public.users set is_active=true where id=${users.get('HR')!}`;
    if (scenario === 'other-dept-hod') await admin`update public.users set is_active=true,department='Survey' where id=${users.get('HOD')!}`;
    const id = await fixture('SUBMITTED');
    await expectStatus(request('ADMIN_DEPT', id, 'verify', { decision: 'YES' }), 200);
    await assertMutation(id, 'PENDING_APPROVAL', 'ADMIN_DEPT');
  }
  await admin`update public.users set is_active=true,department=' HRMD '`;
  await admin`update public.users set employee_id=null where id=${users.get('PM')!}`;
  const fallback = await fixture('HR_APPROVED');
  await expectStatus(request('PM', fallback, 'approve'), 200);
  const [fallbackHistory] = await admin`select changed_by_name from public.status_history where trf_id=${fallback}`;
  assert.equal(fallbackHistory?.changed_by_name, 'WP2_PM');
  // Queue is scoped by the session, including normalized department and no SUPER_ADMIN approve queue.
  const queueIds = new Map<string, string>();
  for (const status of ['SUBMITTED', 'PENDING_APPROVAL', 'HOD_APPROVED', 'HR_APPROVED', 'PM_APPROVED']) queueIds.set(status, await fixture(status));
  const foreignQueue = await fixture('PENDING_APPROVAL', 'Survey');
  for (const role of USER_ROLES) {
    const response = await expectStatus(app.request('/trfs/queue', { headers: { Cookie: cookies.get(role)! } }), 200);
    const rows = await response.json() as { id: string; status: string }[];
    const status = { ADMIN_DEPT: 'SUBMITTED', HOD: 'PENDING_APPROVAL', HR: 'HOD_APPROVED', PM: 'HR_APPROVED', GA: 'PM_APPROVED', SUPER_ADMIN: null, EMPLOYEE: null }[role];
    if (role==='SUPER_ADMIN') assert.ok(rows.some((row)=>row.id===foreignQueue));
    else if (!status) assert.deepEqual(rows, []);
    else { assert.ok(rows.some((row) => row.id === queueIds.get(status))); assert.ok(rows.every((row) => row.status === status)); }
    if (role === 'HOD') assert.ok(rows.every((row) => row.id !== foreignQueue));
  }
  await expectStatus(request(null, await fixture('SUBMITTED'), 'verify', { decision: 'YES' }), 401);
  console.log(`WP2 native PostgreSQL integration passed: ${checks} HTTP assertions; 308 role/action/status cases, ${transitions} legal transitions; atomic outbox, rollback, parallel approval, skip policy and queues.`);
} finally {
  if (trfs.length) await admin`delete from public.trfs where id in ${admin(trfs)}`;
  if (users.size) await admin`delete from public.users where id in ${admin([...users.values()])}`;
  if (employees.size) await admin`delete from public.employees where id in ${admin([...employees.values()])}`;
  await runtime?.end(); await admin.end();
}
