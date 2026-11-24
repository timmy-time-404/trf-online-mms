import type { Database } from '../http.ts';

export async function seedDevelopmentFeatures(db: Database, confirmation: string | undefined) {
  if (confirmation !== 'trf-development-dummy-only') throw new Error('Explicit development seed confirmation required.');
  await db.begin(async (tx) => {
    const [environment] = await tx`select current_setting('trf.environment',true) as name`;
    if (environment?.name !== 'development') throw new Error('Feature seed refuses databases without trf.environment=development.');
    await tx`select pg_advisory_xact_lock(174231,4)`;
    const locations = [
      ['WP4-BPN','Bandara Dummy Sepinggan','AIRPORT','Balikpapan'],
      ['WP4-YIA','Bandara Dummy Yogyakarta','AIRPORT','Yogyakarta'],
      ['WP4-STA','Stasiun Dummy Gambir','STATION','Jakarta'],
      ['WP4-PORT','Pelabuhan Dummy Semayang','PORT','Balikpapan'],
      ['WP4-CITY','Kota Dummy Balikpapan','CITY','Balikpapan'],
      ['WP4-SITE','Site Dummy MMS','SITE','Kutai Kartanegara'],
    ];
    for (const [code,name,type,city] of locations) await tx`insert into public.locations(code,name,type,city,priority)
      select ${code!},${name!},${type!},${city!},10 where not exists(select 1 from public.locations where code=${code!})`;
    for (const weeks of [4,5,6,8,10]) await tx`insert into public.roster_patterns(code,name,site_weeks,leave_weeks)
      values (${`${weeks}:2`},${`Dummy ${weeks} minggu site / 2 minggu cuti`},${weeks},2) on conflict (code) do nothing`;
    // Add context only to the known development account; existing roster history wins.
    const [employee] = await tx`select e.id from public.users u join public.employees e on e.id=u.employee_id
      where u.username='employee_dummy' and u.role='EMPLOYEE' and u.email like '%@example.invalid'`;
    if (!employee) throw new Error('Expected employee_dummy development fixture.');
    if ((await tx`select id from public.employee_roster_assignments where employee_id=${employee.id} limit 1`).length) return;
    const [pattern] = await tx`select id,site_days,leave_days from public.roster_patterns where code='8:2'`;
    const [site] = await tx`select id from public.locations where code='WP4-SITE' limit 1`;
    const [assignment] = await tx`insert into public.employee_roster_assignments(employee_id,roster_pattern_id,effective_from,source_type,source_reference)
      values (${employee.id},${pattern!.id},current_date-60,'INITIAL_IMPORT','WP4-DEV-DUMMY') returning id`;
    await tx`insert into public.employee_site_cycles(employee_id,roster_assignment_id,site_location_id,cycle_number,
      planned_site_in,planned_site_out,planned_leave_start,planned_leave_end,actual_site_in,actual_site_out,actual_leave_start,status,source_type,source_reference)
      values (${employee.id},${assignment!.id},${site!.id},1,current_date-60,current_date-4,current_date-4,current_date+9,
        current_date-60,current_date-4,current_date-4,'ON_LEAVE','BASELINE_MANIFEST','WP4-DEV-DUMMY')`;
  });
}
