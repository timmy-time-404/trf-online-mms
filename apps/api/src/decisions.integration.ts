import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { USER_ROLES, businessDate, businessWeekStart, addDays, normalizeDepartment, type UserRole } from '@trf/shared';
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
  const [exists] = await admin`select 1 from pg_roles where rolname='trf_wp4b_test_runtime'`;
  await admin.unsafe(`${exists ? 'ALTER' : 'CREATE'} ROLE trf_wp4b_test_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`);
  await admin`grant trf_auth_runtime to trf_wp4b_test_runtime`;
  runtime = postgres({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: database.name,
    username: 'trf_wp4b_test_runtime', password, max: 4, prepare: false, onnotice: () => {} });
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
  const expectStatus = async (pending: Response | Promise<Response>, status: number) => {
    const response = await pending;
    assert.equal(response.status, status, `HTTP check ${checks}: expected ${status}, received ${response.status}`); checks++;
    const text = await response.clone().text();
    assert.ok(!/password_?hash/i.test(text), 'A response exposed a password hash');
    return response;
  };

  // D6/D7: helpers agree around the UTC date boundary, independent of machine timezone.
  assert.equal(businessDate(new Date('2026-11-24T16:01:00Z')),'2026-11-25');
  assert.equal(businessDate(new Date('2026-11-24T15:59:00Z')),'2026-11-24');
  assert.equal(businessWeekStart(new Date('2026-11-22T16:01:00Z')),'2026-11-23');
  assert.equal(normalizeDepartment(' HrMd '),'hrmd');
  const [dates]=await admin`select public.business_date('2026-11-24T16:01:00Z'::timestamptz)::text as after,
    public.business_date('2026-11-24T15:59:00Z'::timestamptz)::text as before`;
  assert.deepEqual(dates,{after:'2026-11-25',before:'2026-11-24'});
  const raw=(role: UserRole|null,path:string,method='GET',body?:unknown,version?:number) => app.request(path,{
    method,headers:{Origin:origin,'Content-Type':'application/json',...(role?{Cookie:cookies.get(role)!}:{}),...(version===undefined?{}:{'If-Match':'"'+version+'"'})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  type Item={id:string;status:string;version:number;etag:string;urgent:boolean;trfNumber:string;lateSubmissionReason?:string};
  const read=async(id:string,role:UserRole='EMPLOYEE')=>{
    const response=await expectStatus(raw(role,'/trfs/'+id),200);
    const item=await response.json() as Item;
    assert.equal(response.headers.get('ETag'),item.etag);return item;
  };
  const input={employeeId:owner,travelPurpose:'TRAINING',startDate:addDays(businessDate(),30),endDate:addDays(businessDate(),31),purposeRemarks:'Training',travelArrangements:[]};
  const create=async(body:unknown=input)=>{
    const item=await (await expectStatus(raw('EMPLOYEE','/trfs','POST',body,0),201)).json() as Item;
    trfs.push(item.id);return item;
  };
  const mutate=async(item:Item,action:string,body:unknown={},role:UserRole='EMPLOYEE',expected=200)=>
    await (await expectStatus(raw(role,'/trfs/'+item.id+action,'POST',body,item.version),expected)).json() as Item;
  // D12: every employee-returning read is scoped by the server session.
  for(const role of USER_ROLES) for(const path of ['/employees','/trfs/context']) {
    const response=await expectStatus(raw(role,path),200);
    const value=await response.json() as {id:string}[]|{employees:{id:string}[]};
    const ids=(Array.isArray(value)?value:value.employees).map(e=>e.id);
    assert.deepEqual(ids.sort(),(role==='EMPLOYEE'?[owner]:['ADMIN_DEPT','HOD'].includes(role)?[owner,colleague]:[owner,colleague,other]).sort());
  }
  // D8/D13: a new resource uses version zero; first-purpose date is authoritative.
  await expectStatus(raw('EMPLOYEE','/trfs','POST',input),428);
  await expectStatus(raw('EMPLOYEE','/trfs','POST',input,1),409);
  const urgent={...input,startDate:addDays(businessDate(),13),endDate:addDays(businessDate(),14)};
  await expectStatus(raw('EMPLOYEE','/trfs','POST',urgent,0),400);
  const near=await create({...urgent,lateSubmissionReason:'Operational urgency'});
  assert.equal(near.urgent,true);assert.equal(near.lateSubmissionReason,'Operational urgency');
  // #14: a submitted TRF notifies the ADMIN_DEPT of its department in-app.
  const adminInbox=(trf:string)=>admin`select user_id,title from public.notifications where trf_id=${trf}`;
  const submittedNotes=await adminInbox(near.id);
  assert.equal(submittedNotes.length,1);assert.equal(submittedNotes[0]?.user_id,roleUsers.get('ADMIN_DEPT'));
  assert.match(String(submittedNotes[0]?.title),/menunggu verifikasi Anda/);
  const boundary=await create({...input,startDate:addDays(businessDate(),14)});
  assert.equal(boundary.urgent,false);
  const modern={id:'first',travelPurpose:'TRAINING',startDate:addDays(businessDate(),2),endDate:addDays(businessDate(),3),purposeRemarks:'Training'};
  await expectStatus(raw('EMPLOYEE','/trfs','POST',{...input,purposeEntries:[modern]},0),400);
  // D9: incomplete drafts persist and can be edited, but require full validation when sent.
  let draft=await create({employeeId:owner,draft:true});
  assert.equal(draft.status,'DRAFT');assert.equal(draft.version,1);
  assert.equal((await adminInbox(draft.id)).length,0,'Drafts do not notify anyone');
  await mutate(draft,'/submit',{},'EMPLOYEE',400);
  await expectStatus(raw('EMPLOYEE','/trfs/'+draft.id,'PUT',{purposeRemarks:'Saved'},draft.version),200);
  await expectStatus(raw('EMPLOYEE','/trfs/'+draft.id,'PUT',{purposeRemarks:'Stale'},draft.version),409);
  draft=await read(draft.id);
  await expectStatus(raw('EMPLOYEE','/trfs/'+draft.id,'PUT',{purposeRemarks:'Missing version'}),428);
  await expectStatus(raw('EMPLOYEE','/trfs/'+draft.id,'DELETE',undefined,draft.version-1),409);
  const sent=await mutate(draft,'/submit',input);
  assert.equal(sent.status,'SUBMITTED');assert.equal(sent.version,draft.version+1);
  assert.equal((await adminInbox(sent.id))[0]?.user_id,roleUsers.get('ADMIN_DEPT'),'Sending a draft notifies ADMIN_DEPT');
  await mutate(sent,'/cancel',{remarks:' '},'EMPLOYEE',400);
  const cancelled=await mutate(sent,'/cancel',{remarks:'Travel no longer needed'});
  assert.equal(cancelled.status,'CANCELLED');assert.equal(cancelled.version,sent.version+1);
  await mutate(cancelled,'/cancel',{remarks:'Again'},'EMPLOYEE',409);
  const [cancelEvent]=await admin`select payload from public.notification_outbox where trf_id=${cancelled.id} order by created_at desc limit 1`;
  assert.equal(cancelEvent?.payload.remarks,'Travel no longer needed');
  const removable=await create({employeeId:owner,draft:true});
  await expectStatus(raw('HOD','/trfs/'+removable.id,'DELETE',undefined,removable.version),403);
  await expectStatus(raw('EMPLOYEE','/trfs/'+removable.id,'DELETE'),428);
  await expectStatus(raw('EMPLOYEE','/trfs/'+removable.id,'DELETE',undefined,removable.version),200);
  // D2/D6: absence never skips a stage, and an HOD of another department cannot fill it.
  const held=await create();
  await admin`update public.users set is_active=false where role='HOD'`;
  const verified=await mutate(held,'/verify',{decision:'YES'},'ADMIN_DEPT');
  assert.equal(verified.status,'PENDING_APPROVAL');
  let queue=await (await expectStatus(raw('SUPER_ADMIN','/trfs/queue'),200)).json() as {id:string;blockedBy:string}[];
  assert.equal(queue.find(i=>i.id===held.id)?.blockedBy,'HOD');
  // #16: the detail endpoint carries the same hint for SUPER_ADMIN only.
  const heldDetail=await (await expectStatus(raw('SUPER_ADMIN','/trfs/'+held.id),200)).json() as {blockedBy?:string|null};
  assert.equal(heldDetail.blockedBy,'HOD');
  const ownerDetail=await (await expectStatus(raw('EMPLOYEE','/trfs/'+held.id),200)).json() as Record<string,unknown>;
  assert.ok(!('blockedBy' in ownerDetail),'blockedBy must stay SUPER_ADMIN-only');
  await admin`update public.users set is_active=true,department='Survey' where role='HOD'`;
  await mutate(verified,'/approve',{},'HOD',403);
  queue=await (await expectStatus(raw('SUPER_ADMIN','/trfs/queue'),200)).json() as typeof queue;
  assert.ok(queue.some(i=>i.id===held.id));
  await admin`update public.users set department=' hrMd ' where role='HOD'`;
  queue=await (await expectStatus(raw('SUPER_ADMIN','/trfs/queue'),200)).json() as typeof queue;
  assert.ok(!queue.some(i=>i.id===held.id));
  const approved=await mutate(verified,'/approve',{},'HOD');
  assert.equal(approved.status,'HOD_APPROVED');
  const freeDetail=await (await expectStatus(raw('SUPER_ADMIN','/trfs/'+held.id),200)).json() as {blockedBy?:string|null};
  assert.equal(freeDetail.blockedBy ?? null,null,'Not held once an active approver exists');
  // D3/D10/D13: no SUPER_ADMIN impersonation; rejection has mandatory reason and owner notification.
  for(const action of ['/approve','/verify','/process']) await mutate(approved,action,{decision:'YES'},'SUPER_ADMIN',403);
  await mutate(approved,'/reject',{},'HR',400);
  const rejected=await mutate(approved,'/reject',{remarks:'Budget not approved'},'HR');
  assert.equal(rejected.status,'REJECTED');
  const [notification]=await admin`select message from public.notifications where trf_id=${rejected.id} and user_id=${roleUsers.get('EMPLOYEE')!}`;
  assert.equal(notification?.message,'Budget not approved');
  await mutate(rejected,'/cancel',{remarks:'Too late'},'EMPLOYEE',409);
  const processed=await create();await admin`update public.trfs set status='GA_PROCESSED' where id=${processed.id}`;
  await mutate(await read(processed.id),'/cancel',{remarks:'Too late'},'EMPLOYEE',409);
  assert.equal((await admin`select count(*)::int as total from public.trfs where status='APPROVED'`)[0]?.total,0);
  // D5: occupancy removed for every authenticated role.
  for(const role of USER_ROLES) await expectStatus(raw(role,'/dashboard/rooms'),404);
  // D7: drive the actual trigger at a UTC/WITA day boundary without changing any existing number.
  const [dateFunction]=await admin`select pg_get_functiondef('public.business_date(timestamptz)'::regprocedure) as definition`;
  try {
    await admin.unsafe("CREATE OR REPLACE FUNCTION public.business_date(instant timestamptz DEFAULT now()) RETURNS date LANGUAGE sql STABLE AS $$ SELECT ('2026-11-24T16:01:00Z'::timestamptz AT TIME ZONE 'Asia/Makassar')::date $$");
    const number=await create();assert.match(number.trfNumber,/^TRF-20261125-/);
  } finally {await admin.unsafe(dateFunction!.definition);}
  assert.equal((await read(boundary.id)).trfNumber,boundary.trfNumber);
  console.log('WP4b PostgreSQL integration passed: '+checks+' HTTP assertions; D2/D3/D5/D6/D7/D8/D9/D10/D12/D13.');
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
