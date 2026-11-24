import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { verify } from '@node-rs/argon2';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { USER_ROLES, type UserRole } from '@trf/shared';
import { openDatabase } from './db/connection.ts';
import { createApp } from './app.ts';

const admin = openDatabase();
let runtime: ReturnType<typeof postgres> | undefined;
const users: string[] = [], employees: string[] = [], trfs: string[] = [], hotels: string[] = [], references: string[] = [], locations: string[] = [];
const roleUsers = new Map<UserRole, string>(), cookies = new Map<UserRole, string>();
let checks = 0;
const origin = 'https://meong-mms.org';
try {
  const [database] = await admin`select current_database() as name`;
  assert.ok(database?.name.endsWith('_test'), 'Use an isolated disposable database ending in _test');
  assert.ok(database);
  await migrate(drizzle(admin), { migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations') });
  const [existing] = await admin`select count(*)::int as total from public.users`;
  assert.equal(existing?.total, 0, 'Master-data integration requires an empty dedicated database');
  const password = randomBytes(32).toString('hex');
  const [exists] = await admin`select 1 from pg_roles where rolname='trf_wp3_test_runtime'`;
  await admin.unsafe(`${exists ? 'ALTER' : 'CREATE'} ROLE trf_wp3_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`);
  await admin`grant trf_auth_runtime to trf_wp3_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: database.name,
    username: 'trf_wp3_test_runtime', password, max: 4, prepare: false, onnotice: () => {} });
  const app = createApp(runtime, origin);
  const [privileges] = await runtime`select has_column_privilege(current_user,'public.users','password_hash','UPDATE') as password_update,
    has_table_privilege(current_user,'public.users','DELETE') as user_delete,
    has_column_privilege(current_user,'public.notifications','title','UPDATE') as notification_title`;
  assert.equal(privileges?.password_update, false); assert.equal(privileges?.user_delete, false); assert.equal(privileges?.notification_title, false);
  const employee = async (department: string) => {
    const id = randomUUID(); await admin`insert into public.employees(id,employee_code,employee_name,department)
      values (${id},${id},'WP3 Employee',${department})`; employees.push(id); return id;
  };
  const owner = await employee('HRMD'), colleague = await employee('HRMD'), other = await employee('Survey');
  for (const role of USER_ROLES) {
    const id = randomUUID(), token = randomBytes(32).toString('base64url');
    await admin`insert into public.users(id,username,email,role,department,employee_id,is_active,must_change_password)
      values (${id},${id},${id + '@example.invalid'},${role},'HRMD',${role === 'EMPLOYEE' ? owner : null},true,false)`;
    users.push(id); roleUsers.set(role, id); cookies.set(role, '__Host-trf-session=' + token);
    if (role === 'EMPLOYEE') await admin`update public.employees set user_id=${id} where id=${owner}`;
    await admin`insert into public.app_sessions(user_id,token_hash,expires_at)
      values (${id},${createHash('sha256').update(token).digest('hex')},now()+interval '30 minutes')`;
    await admin`insert into public.notifications(user_id,title,message) values (${id},'WP3','Private notification')`;
  }
  const request = (role: UserRole | null, path: string, method = 'GET', body?: unknown) => app.request(path, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(role ? { Cookie: cookies.get(role)! } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const expectStatus = async (pending: Response | Promise<Response>, status: number) => {
    const response = await pending;
    assert.equal(response.status, status, `HTTP check ${checks}: expected ${status}, received ${response.status}`); checks++;
    const text = await response.clone().text();
    assert.ok(!/password_?hash/i.test(text), 'A response exposed a password hash');
    return response;
  };
  const body = { username: randomUUID(), email: 'managed@example.invalid', role: 'EMPLOYEE' };
  const managed = await (await expectStatus(request('SUPER_ADMIN', '/users', 'POST', body), 201)).json() as {
    user: { id: string; mustChangePassword: boolean }; temporaryPassword: string;
  };
  users.push(managed.user.id);
  assert.equal(managed.user.mustChangePassword, true);
  assert.ok(typeof managed.temporaryPassword === 'string' && managed.temporaryPassword.length >= 24);
  const [secret] = await admin`select password_hash from public.users where id=${managed.user.id}`;
  assert.ok(secret);
  assert.ok(secret?.password_hash.startsWith('$argon2id$'));
  assert.ok(await verify(secret.password_hash, managed.temporaryPassword));
  const second = await (await expectStatus(request('SUPER_ADMIN', '/users', 'POST', { ...body, username: randomUUID(), email: 'second@example.invalid' }), 201)).json() as typeof managed;
  users.push(second.user.id); assert.notEqual(managed.temporaryPassword === second.temporaryPassword, true);
  const managementPaths = ['/users', '/employees', '/hotels', '/reference', '/locations?keyword=WP3&type=CITY', '/notifications', '/dashboard/stats', '/dashboard/weekly', '/dashboard/rooms'];
  for (const path of managementPaths) await expectStatus(request(null, path), 401);
  for (const role of USER_ROLES) {
    const adminOnly = role === 'SUPER_ADMIN', hr = role === 'HR' || adminOnly, ga = role === 'GA' || adminOnly;
    for (const path of managementPaths) await expectStatus(request(role, path), path === '/users' && !adminOnly || path === '/hotels' && !ga ? 403 : 200);
    const create = await expectStatus(request(role, '/users', 'POST', { ...body, username: randomUUID(), email: randomUUID() + '@example.invalid' }), adminOnly ? 201 : 403);
    if (adminOnly) users.push(((await create.json()) as typeof managed).user.id);
    await expectStatus(request(role, '/users/' + second.user.id, 'PUT', { department: 'Updated' }), adminOnly ? 200 : 403);
    await expectStatus(request(role, '/users/' + second.user.id, 'DELETE'), adminOnly ? 200 : 403);
    await expectStatus(request(role, '/users/' + second.user.id + '/deactivate', 'POST'), adminOnly ? 200 : 403);
    await expectStatus(request(role, '/users/' + second.user.id + '/enable', 'POST'), adminOnly ? 200 : 403);
    const input = { employee_name: 'WP3 basic', employee_code: randomUUID(), department: 'HRMD', section: '-', job_title: '-', phone: '' };
    const createdEmployee = await expectStatus(request(role, '/employees', 'POST', input), hr ? 201 : 403);
    const target = await employee('HRMD');
    if (hr) employees.push((await createdEmployee.json() as { id: string }).id);
    await expectStatus(request(role, '/employees/' + target, 'PUT', { employee_name: 'Updated' }), hr ? 200 : 403);
    await expectStatus(request(role, '/employees/' + target, 'DELETE'), hr ? 200 : 403);
    const hotelId = randomUUID(); hotels.push(hotelId);
    await admin`insert into public.hotels(id,name) values (${hotelId},${hotelId})`;
    const createdHotel = await expectStatus(request(role, '/hotels', 'POST', { name: 'WP3 ' + randomUUID(), totalRooms: 10 }), ga ? 201 : 403);
    if (ga) hotels.push((await createdHotel.json() as { id: string }).id);
    await expectStatus(request(role, '/hotels/' + hotelId, 'PUT', { name: 'WP3 ' + randomUUID(), totalRooms: null }), ga ? 200 : 403);
    await expectStatus(request(role, '/hotels/' + hotelId, 'DELETE'), ga ? 200 : 403);
    const [notification] = await admin`select id from public.notifications where user_id=${roleUsers.get(role)!} limit 1`;
    const ownList = await (await expectStatus(request(role, '/notifications?userId=' + managed.user.id), 200)).json() as { id: string; userId: string }[];
    assert.ok(ownList.every((row) => row.userId === roleUsers.get(role)));
    await expectStatus(request(role, '/notifications/' + notification!.id + '/read', 'POST'), 200);
    await expectStatus(request(role, '/notifications/read-all', 'POST', { userId: managed.user.id }), 200);
  }
  const listed = await (await expectStatus(request('SUPER_ADMIN', '/users'), 200)).text();
  assert.ok(!listed.includes('temporaryPassword') && !listed.includes(managed.temporaryPassword));
  await expectStatus(request('SUPER_ADMIN', '/users', 'POST', body), 409);
  await expectStatus(request('SUPER_ADMIN', '/users', 'POST', { ...body, username: randomUUID(), email: 'invalid' }), 400);
  await expectStatus(request('SUPER_ADMIN', '/users/' + second.user.id, 'PUT', { password_hash: 'injected' }), 400);
  await expectStatus(request('SUPER_ADMIN', '/users/not-an-id', 'DELETE'), 400);
  await expectStatus(request('GA', '/hotels', 'POST', { name: ' ', totalRooms: -1 }), 400);
  await expectStatus(request('HR', '/employees/' + owner, 'PUT', { user_id: managed.user.id }), 400);
  await expectStatus(request('SUPER_ADMIN', '/users/' + randomUUID(), 'DELETE'), 404);
  const [foreign] = await admin`insert into public.notifications(user_id,title,message) values (${roleUsers.get('GA')!},'Private','Other user') returning id`;
  await expectStatus(request('EMPLOYEE', '/notifications/' + foreign!.id + '/read', 'POST'), 404);
  await expectStatus(request('SUPER_ADMIN', '/notifications/' + foreign!.id + '/read', 'POST'), 404);
  await expectStatus(request('EMPLOYEE', '/notifications/' + foreign!.id), 404);
  await expectStatus(request('EMPLOYEE', '/notifications/read-all', 'POST', { userId: roleUsers.get('GA')! }), 200);
  const [unread] = await admin`select is_read from public.notifications where id=${foreign!.id}`;
  assert.equal(unread?.is_read, false);
  for (let i = 0; i < 55; i++) await admin`insert into public.notifications(user_id,title,message) values (${roleUsers.get('EMPLOYEE')!},'Limit','Limit')`;
  assert.equal((await (await expectStatus(request('EMPLOYEE', '/notifications'), 200)).json() as unknown[]).length, 50);
  for (const [category, name, active] of [['DEPARTMENT','WP3 Dept',true], ['TRANSPORT','WP3 Car',true], ['DEPARTMENT','WP3 Hidden',false]] as const) {
    const id = randomUUID(); references.push(id); await admin`insert into public.reference_master(id,category,name,is_active) values (${id},${category},${name},${active})`;
  }
  const refs = await (await expectStatus(request('EMPLOYEE', '/reference'), 200)).json() as { departments: string[]; transports: string[] };
  assert.ok(refs.departments.includes('WP3 Dept') && !refs.departments.includes('WP3 Hidden') && refs.transports.includes('WP3 Car'));
  for (let i = 0; i < 12; i++) {
    const id = randomUUID(); locations.push(id); await admin`insert into public.locations(id,name,type,is_active) values (${id},${'WP3 City ' + i},'CITY',true)`;
  }
  const results = await (await expectStatus(request('EMPLOYEE', '/locations?keyword=wp3&type=CITY'), 200)).json() as { type: string }[];
  assert.equal(results.length, 10); assert.ok(results.every((row) => row.type === 'CITY'));
  await expectStatus(request('EMPLOYEE', '/locations?keyword=x'), 400);
  const inactiveLocation = randomUUID(); locations.push(inactiveLocation);
  await admin`insert into public.locations(id,name,type,is_active) values (${inactiveLocation},'WP3 Inactive','OTHER',false)`;
  assert.equal((await (await expectStatus(request('EMPLOYEE', '/locations?keyword=Inactive&type=OTHER'), 200)).json() as unknown[]).length, 1);
  const today = new Date().toISOString().slice(0,10), monday = new Date();
  monday.setUTCDate(monday.getUTCDate() + (monday.getUTCDay() === 0 ? -6 : 1 - monday.getUTCDay()));
  const weekStart = monday.toISOString().slice(0,10);
  const createdTRF = await (await expectStatus(request('EMPLOYEE', '/trfs', 'POST', {
    employeeId: owner, travelPurpose: 'TRAINING', startDate: today, endDate: today, purposeRemarks: 'API fixture',
    travelArrangements: [{ id: 'route-1', travelType: 'TRAVEL_IN', arrangementType: 'BY_SITE_SERVICE',
      transportation: 'CAR', travelDate: '2000-01-01', fromLocation: 'A', toLocation: 'B', specialArrangement: false }],
  }), 201)).json() as { id: string };
  trfs.push(createdTRF.id);
  const start = new Date(today), end = new Date(today); start.setUTCDate(start.getUTCDate()-1); end.setUTCDate(end.getUTCDate()+1);
  for (const [employeeId, department, status] of [[owner,'HRMD','GA_PROCESSED'],[colleague,'HRMD','GA_PROCESSED'],[other,'Survey','GA_PROCESSED'],[other,' hrmd ','GA_PROCESSED'],[colleague,'HRMD','SUBMITTED']]) {
    const id = randomUUID(); trfs.push(id);
    const travel = [{ travelType: 'TRAVEL_IN', travelDate: weekStart }, { travelType: 'TRAVEL_IN', travelDate: weekStart }, { travelType: 'TRAVEL_OUT', travelDate: weekStart }];
    await admin`insert into public.trfs(id,trf_number,employee_id,department,status,travel_purpose,start_date,end_date,purpose_remarks,travel_arrangements)
      values (${id},${'WP3-' + id},${employeeId!},${department!},${status!},'TRAINING',${start.toISOString().slice(0,10)},${end.toISOString().slice(0,10)},'Test',${JSON.stringify(travel)}::jsonb)`;
  }
  for (const role of USER_ROLES) {
    const total = role === 'EMPLOYEE' ? 1 : role === 'ADMIN_DEPT' || role === 'HOD' ? 2 : 4;
    const stats = await (await expectStatus(request(role, '/dashboard/stats?userId=' + managed.user.id), 200)).json();
    assert.deepEqual(stats, { totalTravelIn: total, totalTravelOut: total, siteEntry: 0, onSiteActive: total, daysInSite: 2*total });
    const weekly = await (await expectStatus(request(role, '/dashboard/weekly?weekStart=' + weekStart), 200)).json() as { travelIn: number; travelOut: number }[];
    const weeklyTotal = role === 'EMPLOYEE' ? 1 : role === 'ADMIN_DEPT' || role === 'HOD' ? 3 : 5;
    assert.equal(weekly[0]?.travelIn, weeklyTotal); assert.equal(weekly[0]?.travelOut, weeklyTotal);
    assert.ok(weekly.slice(1).every((row) => row.travelIn === 0 && row.travelOut === 0));
    assert.deepEqual(await (await expectStatus(request(role, '/dashboard/rooms'), 200)).json(), []);
  }
  await expectStatus(request('EMPLOYEE', '/dashboard/weekly?weekStart=2026-02-30'), 400);
  const login = () => app.request('/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: body.username, password: managed.temporaryPassword }) });
  const loginResponse = await expectStatus(login(), 200);
  const cookie = loginResponse.headers.get('Set-Cookie')?.split(';')[0]; assert.ok(cookie);
  await expectStatus(app.request('/notifications', { headers: { Cookie: cookie } }), 200);
  await expectStatus(request('SUPER_ADMIN', '/users/' + managed.user.id + '/deactivate', 'POST'), 200);
  await expectStatus(app.request('/notifications', { headers: { Cookie: cookie } }), 401);
  await expectStatus(login(), 401);
  await expectStatus(request('SUPER_ADMIN', '/users/' + managed.user.id + '/enable', 'POST'), 200);
  await expectStatus(app.request('/notifications', { headers: { Cookie: cookie } }), 401);
  const raced = await Promise.all([login(), request('SUPER_ADMIN', '/users/' + managed.user.id + '/deactivate', 'POST')]);
  assert.ok([200,401].includes(raced[0]!.status)); assert.equal(raced[1]!.status, 200); checks += 2;
  const [liveSessions] = await admin`select count(*)::int as total from public.app_sessions where user_id=${managed.user.id} and revoked_at is null`;
  assert.equal(liveSessions?.total, 0);
  console.log(`WP3 native PostgreSQL integration passed: ${checks} HTTP assertions; seven-role endpoint matrix, one-time credentials, session revocation, private notifications and scoped dashboard.`);
} finally {
  if (trfs.length) await admin`delete from public.trfs where id in ${admin(trfs)}`;
  if (users.length) {
    await admin`delete from public.app_login_attempts where user_id in ${admin(users)}`;
    await admin`delete from public.users where id in ${admin(users)}`;
  }
  if (employees.length) await admin`delete from public.employees where id in ${admin(employees)}`;
  if (hotels.length) await admin`delete from public.hotels where id in ${admin(hotels)}`;
  if (references.length) await admin`delete from public.reference_master where id in ${admin(references)}`;
  if (locations.length) await admin`delete from public.locations where id in ${admin(locations)}`;
  await runtime?.end(); await admin.end();
}
