import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { hash, verify } from '@node-rs/argon2';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { USER_ROLES, type UserRole } from '@trf/shared';
import { openDatabase } from './db/connection.ts';
import { seedDevelopmentFeatures } from './db/seed-features.ts';
import { createApp } from './app.ts';
import { ROSTER_ACTION_ROLES } from './modules/roster-operations/routes.ts';
import { RECALL_ACTION_ROLES } from './modules/early-recall-workflow/routes.ts';
import { EMPLOYEE_ACTION_ROLES } from './modules/employee-management/routes.ts';

const admin = openDatabase();
let runtime: ReturnType<typeof postgres> | undefined;
let fixtureDatabase = false, checks = 0, context = '';
const origin = 'https://meong-mms.org';
const cookies = new Map<UserRole,string>(), userIds = new Map<UserRole,string>();
const password = `Aa9!${randomBytes(24).toString('base64url')}`;
try {
  const [database] = await admin`select current_database() as name`;
  assert.ok(database?.name.endsWith('_test'), 'Use an isolated disposable database ending in _test');
  assert.ok(database);
  await migrate(drizzle(admin), { migrationsFolder: resolve(process.env.DB_MIGRATIONS_DIR ?? '../../db/migrations') });
  assert.equal((await admin`select count(*)::int as total from public.users`)[0]?.total, 0, 'Use an empty dedicated database');
  assert.equal((await admin`select count(*)::int as total from public.trfs`)[0]?.total, 0, 'Use an empty dedicated database');
  fixtureDatabase = true;
  const runtimePassword = randomBytes(32).toString('hex');
  const [exists] = await admin`select 1 from pg_roles where rolname='trf_wp4_test_runtime'`;
  await admin.unsafe(`${exists ? 'ALTER' : 'CREATE'} ROLE trf_wp4_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${runtimePassword}'`);
  await admin`grant trf_auth_runtime to trf_wp4_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: database.name,
    username: 'trf_wp4_test_runtime', password: runtimePassword, max: 4, prepare: false, onnotice: () => {} });
  assert.equal((await runtime`select has_column_privilege(current_user,'public.users','password_hash','UPDATE') as allowed`)[0]?.allowed,false);
  const app = createApp(runtime, origin);
  const passwordHash = await hash(password);
  const [owner] = await admin`insert into public.employees(employee_code,employee_name,department,phone,email)
    values ('TEST-EMPLOYEE','Dummy EMPLOYEE','HRMD','082398454988','employee_dummy@example.invalid') returning id`;
  const [other] = await admin`insert into public.employees(employee_code,employee_name,department,phone)
    values ('WP4-OTHER','Other Department','Survey','087896323613') returning id`;
  for (const role of USER_ROLES) {
    const id = randomUUID(), token = randomBytes(32).toString('base64url');
    await admin`insert into public.users(id,username,email,role,department,employee_id,password_hash,is_active,must_change_password)
      values (${id},${role === 'EMPLOYEE' ? 'employee_dummy' : id},${role === 'EMPLOYEE' ? 'employee_dummy@example.invalid' : id + '@example.invalid'},
        ${role},'HRMD',${role === 'EMPLOYEE' ? owner!.id : null},${passwordHash},true,false)`;
    userIds.set(role,id); cookies.set(role,'__Host-trf-session=' + token);
    await admin`insert into public.app_sessions(user_id,token_hash,expires_at)
      values (${id},${createHash('sha256').update(token).digest('hex')},now()+interval '30 minutes')`;
  }
  await admin`update public.employees set user_id=${userIds.get('EMPLOYEE')!} where id=${owner!.id}`;
  await admin`insert into public.reference_master(category,code,name) values ('DEPARTMENT','HRMD','HRMD')`;
  await admin`set trf.environment=''`;
  await assert.rejects(seedDevelopmentFeatures(admin,'trf-development-dummy-only'), /refuses databases/);
  await admin.unsafe(`ALTER DATABASE "${database.name.replaceAll('"','""')}" SET trf.environment='development'`);
  await admin`set trf.environment='development'`;
  await assert.rejects(seedDevelopmentFeatures(admin,undefined), /confirmation/);
  await seedDevelopmentFeatures(admin,'trf-development-dummy-only');
  const seedCounts = await admin`select (select count(*) from public.locations)::int as locations,
    (select count(*) from public.employee_roster_assignments)::int as assignments,(select count(*) from public.employee_site_cycles)::int as cycles`;
  await seedDevelopmentFeatures(admin,'trf-development-dummy-only');
  assert.deepEqual(await admin`select (select count(*) from public.locations)::int as locations,
    (select count(*) from public.employee_roster_assignments)::int as assignments,(select count(*) from public.employee_site_cycles)::int as cycles`,seedCounts);
  assert.equal(seedCounts[0]?.locations,6); assert.equal(seedCounts[0]?.cycles,1);
  const request = (role: UserRole | null, path: string, body: unknown) => app.request(path, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(role ? { Cookie: cookies.get(role)! } : {}) }, body: JSON.stringify(body) });
  const check = async (pending: Response | Promise<Response>, status: number) => {
    const response = await pending;
    assert.equal(response.status,status,`HTTP check ${checks} (${context}): expected ${status}, received ${response.status}`); checks++;
    assert.ok(!/password_?hash/i.test(await response.clone().text()), 'Response exposed a password hash');
    return response;
  };
  const invoke = async (role: UserRole, path: string, body: unknown, status=200) => {
    context = `${role} ${path} ${(body as {action?:string}).action ?? ''}`;
    return await (await check(request(role,path,body),status)).json() as Record<string, unknown>;
  };
  for (const [path,actions] of [['/employee-management',EMPLOYEE_ACTION_ROLES],['/roster-operations',ROSTER_ACTION_ROLES],
    ['/early-recall-workflow',RECALL_ACTION_ROLES]] as const) {
    for (const [action,roles] of Object.entries(actions)) {
      await check(request(null,path,{action}),401);
      for (const role of USER_ROLES) {
        const allowed = (roles as readonly UserRole[]).includes(role);
        const reads = ['master_data','list','queue','my_summary','os_ledger','os_adjustment_options'].includes(action);
        await check(request(role,path,{action}),!allowed ? 403 : reads ? 200 : 400);
      }
    }
  }
  await check(request(null,'/manpower-dashboard',{action:'snapshot'}),401);
  for (const role of USER_ROLES) await check(request(role,'/manpower-dashboard',{action:'snapshot',asOfDate:'2026-11-24'}),['HOD','HR','PM','SUPER_ADMIN'].includes(role)?200:403);
  await check(request('HR','/manpower-dashboard',{action:'snapshot'}),400);
  await check(request(null,'/auth/change-password',{currentPassword:password,newPassword:'Changed123!'}),401);
  const site = (await admin`select id from public.locations where code='WP4-SITE'`)[0]!;
  const profile = { employeeName:'Onboarded Employee',employeeType:'EMPLOYEE',email:'onboarded@example.invalid',phone:'082398454988',
    department:'HRMD',jobTitle:'Engineer',joinDate:'2026-01-01',rosterCode:'8:2',siteLocationId:site.id,plannedD1:'2026-10-01' };
  const operationKey = randomUUID();
  const onboard = await invoke('HR','/employee-management',{action:'create',...profile,employeeCode:'1234567',operationKey});
  const credentials = onboard.credentials as { username: string; temporaryPassword: string; shownOnce: boolean };
  assert.equal(credentials.shownOnce,true);
  const result = onboard.result as { employee: { id: string }; user: { id: string }; site_cycle: { id: string } };
  const [account] = await admin`select password_hash,must_change_password from public.users where id=${result.user.id}`;
  assert.ok(account?.must_change_password); assert.ok(account?.password_hash.startsWith('$argon2id$'));
  assert.ok(await verify(account!.password_hash,credentials.temporaryPassword));
  const adminOnboard = await invoke('SUPER_ADMIN','/employee-management',{action:'create',...profile,email:'admin-onboarded@example.invalid',employeeCode:'7654321',operationKey:randomUUID()});
  const adminEmployee = (adminOnboard.result as typeof result).employee.id;
  await invoke('HR','/employee-management',{action:'update',...profile,email:'admin-onboarded@example.invalid',employeeId:adminEmployee,operationKey:randomUUID()});
  for(const isActive of [false,true]) await invoke('SUPER_ADMIN','/employee-management',{action:'set_active',employeeId:adminEmployee,isActive,operationKey:randomUUID(),remarks:'Admin activation test'});
  await invoke('HR','/employee-management',{action:'create',...profile,employeeCode:'1234567',operationKey},409);
  await invoke('SUPER_ADMIN','/employee-management',{action:'update',...profile,employeeName:'Updated employee',employeeId:result.employee.id,operationKey:randomUUID()});
  const resetBody = { action:'reset_password',employeeId:result.employee.id,operationKey:randomUUID(),remarks:'Testing reset' };
  const reset = await invoke('HR','/employee-management',resetBody);
  await invoke('HR','/employee-management',resetBody,409);
  const reset2 = await invoke('SUPER_ADMIN','/employee-management',{...resetBody,operationKey:randomUUID()});
  const firstPassword = (reset.credentials as typeof credentials).temporaryPassword;
  const nextPassword = (reset2.credentials as typeof credentials).temporaryPassword;
  assert.notEqual(firstPassword,nextPassword); assert.notEqual(nextPassword,'1234567');
  assert.ok(await verify((await admin`select password_hash from public.users where id=${result.user.id}`)[0]!.password_hash,nextPassword));
  const login = (username: string, secret: string) => app.request('/auth/login',{ method:'POST',headers:{ Origin:origin,'Content-Type':'application/json' },body:JSON.stringify({username,password:secret}) });
  const loggedIn = await check(login('1234567',nextPassword),200);
  const loginCookie = loggedIn.headers.get('Set-Cookie')!.split(';')[0]!;
  await check(app.request('/roster-operations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:loginCookie},body:JSON.stringify({action:'my_summary'})}),403);
  await invoke('HR','/employee-management',{...resetBody,operationKey:randomUUID()});
  await check(app.request('/auth/me',{headers:{Cookie:loginCookie}}),401);
  await invoke('HR','/employee-management',{action:'set_active',employeeId:result.employee.id,isActive:false,operationKey:randomUUID(),remarks:'Test deactivate'});
  await check(app.request('/auth/me',{headers:{Cookie:loginCookie}}),401);
  await invoke('HR','/employee-management',{action:'set_active',employeeId:result.employee.id,isActive:true,operationKey:randomUUID(),remarks:'Enable again'});
  assert.ok((await admin`select count(*)::int as total from public.employee_management_audit where employee_id=${result.employee.id}`)[0]!.total>=6);
  const recallInput = { employeeId:owner!.id, approvedLeaveStart:'2026-11-01', approvedLeaveEnd:'2026-11-14',proposedReturnDate:'2026-11-07',reason:'Operational need' };
  const createRecall = async (role: UserRole='HOD', employeeId=owner!.id) => {
    // Preserve the legacy one-active-recall-per-employee constraint between independent cases.
    await admin`update public.early_recall_requests set status='CANCELLED',cancelled_by_user_id=${userIds.get('SUPER_ADMIN')!},
      cancelled_at=now(),cancellation_reason='Fixture complete' where employee_id=${employeeId}
      and status not in ('OS_GENERATED','REJECTED','CANCELLED','RETURNED_TO_SITE')`;
    const response = await invoke(role,'/early-recall-workflow',{action:'create',...recallInput,employeeId});
    return response.item as { id: string; status: string; linked_trf: { id: string } | null; os_generated_days: number };
  };
  const recallAction = async (id: string, action: string, role: UserRole, more: Record<string,unknown>={},status=200) => {
    const response = await invoke(role,'/early-recall-workflow',{action,earlyRecallId:id,remarks:'Integration test',...more},status);
    return response.item as Awaited<ReturnType<typeof createRecall>>;
  };
  const prepareRecall = async (status: string) => {
    let item = await createRecall();
    if (status==='DRAFT') return item;
    item=await recallAction(item.id,'submit','HOD');
    if(status==='PENDING_HR_VALIDATION') return item;
    item=await recallAction(item.id,'hr_validate','HR');
    if(status==='PENDING_PM_APPROVAL') return item;
    item=await recallAction(item.id,'pm_approve','PM');
    if(status==='PM_APPROVED') return item;
    item=await recallAction(item.id,'ga_start','GA');
    await admin`update public.trfs set status='GA_PROCESSED' where id=${item.linked_trf!.id}`;
    if(status==='GA_PROCESSING') return item;
    return await recallAction(item.id,'travel_booked','GA');
  };
  // Execute every allowed mutation role on a suitable real workflow fixture.
  const stages: Record<string,string> = { update:'DRAFT',submit:'DRAFT',hr_validate:'PENDING_HR_VALIDATION',return_revision:'PENDING_HR_VALIDATION',
    pm_approve:'PENDING_PM_APPROVAL',ga_start:'PM_APPROVED',travel_booked:'GA_PROCESSING',acknowledge:'PM_APPROVED',
    confirm_return:'TRAVEL_BOOKED',reject:'PENDING_HR_VALIDATION',cancel:'DRAFT' };
  for(const [action,roles] of Object.entries(RECALL_ACTION_ROLES)) {
    if(['list','detail','create'].includes(action)) continue;
    for(const role of roles) {
      const stage = ['reject','return_revision'].includes(action) && role==='PM' ? 'PENDING_PM_APPROVAL' : stages[action]!;
      const item = await prepareRecall(stage);
      const more = action==='update'?recallInput:action==='confirm_return'?{actualReturnDate:'2026-11-07'}:
        action==='return_revision'?{revisionReason:'Please revise'}:action==='reject'?{rejectionReason:'Rejected for test'}:
        action==='cancel'?{cancellationReason:'Cancelled for test'}:{};
      const [before] = await admin`select (select count(*) from public.early_recall_status_history where early_recall_id=${item.id})::int as history,
        (select count(*) from public.notification_outbox where early_recall_id=${item.id})::int as outbox`;
      const changed = await recallAction(item.id,action,role,more);
      const [after] = await admin`select (select count(*) from public.early_recall_status_history where early_recall_id=${item.id})::int as history,
        (select count(*) from public.notification_outbox where early_recall_id=${item.id})::int as outbox`;
      assert.equal(after!.history-before!.history,['confirm_return','hr_validate'].includes(action)?2:1,`${action}: history delta`);
      assert.equal(after!.outbox-before!.outbox,action==='confirm_return'?2:['pm_approve','travel_booked'].includes(action)?1:0,`${action}: outbox delta`);
      if(action==='confirm_return') { assert.equal(changed.status,'OS_GENERATED'); assert.equal(changed.os_generated_days,8); }
    }
  }
  await createRecall('PM'); await createRecall('SUPER_ADMIN');
  await invoke('HOD','/early-recall-workflow',{action:'create',...recallInput,employeeId:other!.id},403);
  const foreignRecall = await createRecall('PM',other!.id);
  await recallAction(foreignRecall.id,'detail','HOD',{},403);
  await recallAction(foreignRecall.id,'submit','HOD',{},403);
  await recallAction(foreignRecall.id,'detail','EMPLOYEE',{},403);
  const hodList = await invoke('HOD','/early-recall-workflow',{action:'list'});
  assert.ok((hodList.items as {department:string}[]).every(i=>i.department==='HRMD'));
  const invalid = await createRecall();
  for(const role of USER_ROLES) {
    await recallAction(invalid.id,'detail',role);
    await recallAction(foreignRecall.id,'detail',role,{},['EMPLOYEE','ADMIN_DEPT','HOD'].includes(role)?403:200);
  }
  for(const [action,role] of [['pm_approve','PM'],['ga_start','GA'],['travel_booked','GA'],['acknowledge','EMPLOYEE'],
    ['reject','HR'],['return_revision','HR']] as const) await recallAction(invalid.id,action,role,{},409);
  await recallAction(invalid.id,'hr_validate','HR',{},409);
  await recallAction(invalid.id,'confirm_return','GA',{actualReturnDate:'2026-11-07'},409);
  await recallAction(invalid.id,'update','HOD',{...recallInput,proposedReturnDate:'2026-10-31'},400);
  const race = await prepareRecall('PENDING_HR_VALIDATION');
  const raced = await Promise.all([request('HR','/early-recall-workflow',{action:'hr_validate',earlyRecallId:race.id}),request('HR','/early-recall-workflow',{action:'hr_validate',earlyRecallId:race.id})]);
  assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);checks+=2;
  const done = await prepareRecall('TRAVEL_BOOKED');
  await recallAction(done.id,'confirm_return','GA',{actualReturnDate:'2026-11-07'});
  const countsBefore = await admin`select (select count(*) from public.early_recall_status_history where early_recall_id=${done.id})::int as history,
    (select count(*) from public.notification_outbox where early_recall_id=${done.id})::int as outbox`;
  await recallAction(done.id,'confirm_return','GA',{actualReturnDate:'2026-11-07'});
  assert.deepEqual(await admin`select (select count(*) from public.early_recall_status_history where early_recall_id=${done.id})::int as history,
    (select count(*) from public.notification_outbox where early_recall_id=${done.id})::int as outbox`,countsBefore);
  assert.equal(countsBefore[0]?.outbox,4);
  const collisionRecall = await prepareRecall('PENDING_PM_APPROVAL');
  const [generator] = await admin`select pg_get_functiondef('public.generate_trf_number()'::regprocedure) as definition`;
  const [existingTrf] = await admin`select id from public.trfs limit 1`;
  await admin`update public.trfs set trf_number='TRF-COLLISION-PROBE' where id=${existingTrf!.id}`;
  await admin`create sequence public.wp4_collision_probe`;
  try {
    await admin.unsafe(`CREATE OR REPLACE FUNCTION public.generate_trf_number() RETURNS trigger LANGUAGE plpgsql AS $probe$
      BEGIN IF NEW.trf_number IS NULL THEN
        IF nextval('public.wp4_collision_probe')=1 THEN NEW.trf_number:='TRF-COLLISION-PROBE';
        ELSE NEW.trf_number:='TRF-' || to_char(now(),'YYYYMMDD') || '-' || lpad(floor(random()*900+100)::text,3,'0'); END IF;
      END IF; RETURN NEW; END $probe$`);
    await recallAction(collisionRecall.id,'pm_approve','PM');
    assert.ok(Number((await admin`select last_value from public.wp4_collision_probe`)[0]?.last_value)>=2);
    assert.equal((await admin`select count(*)::int as total from public.notification_outbox where early_recall_id=${collisionRecall.id}`)[0]?.total,1);
    const exhausted = await prepareRecall('PENDING_PM_APPROVAL');
    await admin`alter sequence public.wp4_collision_probe restart with 1`;
    await admin.unsafe(`CREATE OR REPLACE FUNCTION public.generate_trf_number() RETURNS trigger LANGUAGE plpgsql AS $probe$
      BEGIN IF NEW.trf_number IS NULL THEN PERFORM nextval('public.wp4_collision_probe');
        NEW.trf_number:='TRF-COLLISION-PROBE'; END IF; RETURN NEW; END $probe$`);
    await recallAction(exhausted.id,'pm_approve','PM',{},409);
    assert.equal(Number((await admin`select last_value from public.wp4_collision_probe`)[0]?.last_value),5);
    assert.equal((await admin`select status from public.early_recall_requests where id=${exhausted.id}`)[0]?.status,'PENDING_PM_APPROVAL');
    assert.equal((await admin`select count(*)::int as total from public.notification_outbox where early_recall_id=${exhausted.id}`)[0]?.total,0);
  } finally {
    await admin.unsafe(generator!.definition);
    await admin`drop sequence public.wp4_collision_probe`;
  }
  // Outbox failure must roll back the routine's status, linked TRF, and history writes.
  const rollback = await prepareRecall('PENDING_PM_APPROVAL');
  await admin`revoke insert on public.notification_outbox from trf_auth_runtime`;
  try { await recallAction(rollback.id,'pm_approve','PM',{},500); }
  finally { await admin`grant insert on public.notification_outbox to trf_auth_runtime`; }
  assert.equal((await admin`select status from public.early_recall_requests where id=${rollback.id}`)[0]?.status,'PENDING_PM_APPROVAL');
  const [cycle] = await admin`select id from public.employee_site_cycles where employee_id=${owner!.id} limit 1`;
  // Native roster routines preserve movement sequencing and successor creation.
  for(const role of ['GA','HR','SUPER_ADMIN'] as const) {
    const [movementEmployee] = await admin`insert into public.employees(employee_code,employee_name,department)
      values (${randomUUID()},'Movement fixture','HRMD') returning id`;
    const pattern = (await admin`select id from public.roster_patterns where code='8:2'`)[0]!;
    const assignment = (await admin`insert into public.employee_roster_assignments(employee_id,roster_pattern_id,effective_from,source_type)
      values (${movementEmployee!.id},${pattern.id},'2026-10-01','INITIAL_IMPORT') returning id`)[0]!;
    const [c] = await admin`insert into public.employee_site_cycles(employee_id,roster_assignment_id,site_location_id,cycle_number,
      planned_site_in,planned_site_out,planned_leave_start,planned_leave_end,actual_site_in,status,source_type,source_reference)
      values (${movementEmployee!.id},${assignment.id},${site.id},1,'2026-10-01','2026-11-26','2026-11-26','2026-12-09','2026-10-01','ON_SITE','BASELINE_MANIFEST',${randomUUID()}) returning id`;
    await invoke(role,'/roster-operations',{action:'confirm_site_out',siteCycleId:c!.id,actualSiteOut:'2026-11-26',remarks:'Site out test'});
    await invoke(role,'/roster-operations',{action:'confirm_leave_start',siteCycleId:c!.id,actualLeaveStart:'2026-11-26',remarks:'Leave test'});
    const returned = await invoke(role,'/roster-operations',{action:'confirm_return',siteCycleId:c!.id,returnToSiteDate:'2026-12-10',remarks:'Return test'});
    assert.equal((returned.result as {successor_cycle_status:string}).successor_cycle_status,'ON_SITE');
  }
  assert.ok(cycle);
  // Separate employee keeps FIFO assertions independent of recall-generated buckets.
  for(const [generated,days] of [['2026-01-01',3],['2026-02-01',5]] as const)
    await admin`insert into public.employee_os_ledger(employee_id,source_type,source_reference,generated_date,original_days,remaining_days)
      values (${other!.id},'OVERSTAY',${randomUUID()},${generated},${days},${days})`;
  await invoke('HR','/roster-operations',{action:'consume_os',employeeId:other!.id,requestedDays:4,operationKey:randomUUID(),referenceType:'TEST',remarks:'FIFO test'});
  const balances = await admin`select remaining_days from public.employee_os_ledger where employee_id=${other!.id} order by generated_date,created_at`;
  assert.deepEqual(balances.map(b=>b.remaining_days),[0,4]);
  await invoke('HR','/roster-operations',{action:'consume_os',employeeId:other!.id,requestedDays:100,operationKey:randomUUID(),referenceType:'TEST',remarks:'Insufficient balance'},400);
  assert.deepEqual((await admin`select remaining_days from public.employee_os_ledger where employee_id=${other!.id} order by generated_date,created_at`).map(b=>b.remaining_days),[0,4]);
  await invoke('SUPER_ADMIN','/roster-operations',{action:'consume_os',employeeId:other!.id,requestedDays:1,operationKey:randomUUID(),referenceType:'TEST',remarks:'FIFO admin'});
  for(const role of ['HR','SUPER_ADMIN'] as const) await invoke(role,'/roster-operations',{action:'adjust_os',adjustmentType:'ADD_BUCKET',employeeId:owner!.id,
    days:2,newCycleNumber:0,earnedSiteCycleId:cycle!.id,operationKey:randomUUID(),referenceNumber:'TEST-REFERENCE',remarks:'Manual test',generatedDate:'2026-03-01'});
  const ledger = await invoke('HOD','/roster-operations',{action:'os_ledger'});
  assert.ok((ledger.items as {employee:{department:string}}[]).every(i=>i.employee.department==='HRMD'));
  const hodSnapshot = await invoke('HOD','/manpower-dashboard',{action:'snapshot',asOfDate:'2026-11-24'});
  const snapshot = hodSnapshot.snapshot as {scope:{visibility:string};employees:{department:string}[]};
  assert.equal(snapshot.scope.visibility,'OWN_DEPARTMENT_ONLY'); assert.ok(snapshot.employees.every(i=>i.department==='HRMD'));
  const hrSnapshot = (await invoke('HR','/manpower-dashboard',{action:'snapshot',asOfDate:'2026-11-24'})).snapshot as {summary:{active_employee_total:number}};
  assert.ok(hrSnapshot.summary.active_employee_total > (hodSnapshot.snapshot as typeof hrSnapshot).summary.active_employee_total);
  const rosterPattern = (await admin`select id from public.roster_patterns where code='8:2'`)[0]!;
  const foreignAssignment = (await admin`insert into public.employee_roster_assignments(employee_id,roster_pattern_id,effective_from,source_type)
    values (${other!.id},${rosterPattern.id},'2026-09-01','INITIAL_IMPORT') returning id`)[0]!;
  await admin`insert into public.employee_site_cycles(employee_id,roster_assignment_id,site_location_id,cycle_number,
    planned_site_in,planned_site_out,planned_leave_start,planned_leave_end,actual_site_in,status,source_type)
    values (${other!.id},${foreignAssignment.id},${site.id},1,'2026-09-01','2026-10-27','2026-10-27','2026-11-09','2026-09-01','ON_SITE','BASELINE_MANIFEST')`;
  const hodQueue = await invoke('HOD','/roster-operations',{action:'queue',asOfDate:'2026-11-24'});
  const hrQueue = await invoke('HR','/roster-operations',{action:'queue',asOfDate:'2026-11-24'});
  assert.ok((hodQueue.items as {department:string}[]).every(i=>i.department==='HRMD'));
  assert.ok((hrQueue.items as {department:string}[]).some(i=>i.department==='Survey'));
  for (const role of USER_ROLES.filter((r) => r !== 'EMPLOYEE')) {
    await invoke(role,'/auth/change-password',{currentPassword:password,newPassword:'RoleChanged123!'});
  }
  // Password change preserves the caller's session and atomically revokes other sessions.
  const secondLogin = await check(login('employee_dummy',password),200);
  const secondCookie = secondLogin.headers.get('Set-Cookie')!.split(';')[0]!;
  await invoke('EMPLOYEE','/auth/change-password',{currentPassword:'incorrect',newPassword:'Changed123!'},400);
  await invoke('EMPLOYEE','/auth/change-password',{currentPassword:password,newPassword:'weak'},400);
  await invoke('EMPLOYEE','/auth/change-password',{currentPassword:password,newPassword:'Changed123!'});
  await check(app.request('/auth/me',{headers:{Cookie:secondCookie}}),401);
  await check(app.request('/auth/me',{headers:{Cookie:cookies.get('EMPLOYEE')!}}),200);
  await check(login('employee_dummy',password),401); await check(login('employee_dummy','Changed123!'),200);
  const attemptKey = createHash('sha256').update('CHANGE_PASSWORD:' + userIds.get('EMPLOYEE')!).digest('hex');
  await admin`delete from public.app_login_attempts where identifier_hash=${attemptKey}`;
  for(let attempt=0;attempt<10;attempt++) await invoke('EMPLOYEE','/auth/change-password',{currentPassword:'incorrect',newPassword:'Attempted123!'},400);
  await invoke('EMPLOYEE','/auth/change-password',{currentPassword:'Changed123!',newPassword:'Attempted123!'},429);
  console.log(`WP4 native PostgreSQL integration passed: ${checks} HTTP assertions; action/role matrices, Recall/OS/FIFO, atomic outbox, random credentials, session revocation, dev-only seed.`);
} finally {
  if (fixtureDatabase) {
    // This database was checked empty before creating any fixtures; no user dataset is removed.
    await admin`truncate public.trfs,public.users,public.employees,public.reference_master,public.locations,public.roster_patterns cascade`;
  }
  await runtime?.end(); await admin.end();
}
