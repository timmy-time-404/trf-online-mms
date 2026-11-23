import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase } from './connection.ts';
import { createDummyCredentials } from './dummy-accounts.ts';

if (process.env.SEED_CONFIRM !== 'trf-development-dummy-only' || !process.env.SEED_CREDENTIALS_FILE) {
  throw new Error('Set SEED_CONFIRM=trf-development-dummy-only and SEED_CREDENTIALS_FILE explicitly.');
}
const outputPath = resolve(process.env.SEED_CREDENTIALS_FILE);
const client = openDatabase();
try {
  const accounts = await createDummyCredentials();
  await client.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(174231, 2)`;
    const [counts] = await tx`select (select count(*) from public.users) +
      (select count(*) from public.employees) + (select count(*) from public.trfs) +
      (select count(*) from public.reference_master) + (select count(*) from public.roster_patterns) as total`;
    if (Number(counts?.total) !== 0) throw new Error('Seed requires an empty application dataset.');

    // Exclusive creation prevents a rerun from overwriting the only credential copy.
    // If commit is uncertain, retain this file for reconciliation; never print its contents.
    await writeFile(outputPath, JSON.stringify({
      warning: 'Use only after seed reports success. Temporary test credentials; keep private.',
      accounts: accounts.map(({ username, role, password }) => ({ username, role, password })),
    }, null, 2), { flag: 'wx', mode: 0o600 });

    await tx`insert into public.reference_master (category, code, name)
      values ('DEPARTMENT', 'HRMD', 'HRMD')`;
    await tx`insert into public.roster_patterns (code, name, site_weeks, leave_weeks)
      values ('8:2', 'Dummy 8 minggu site / 2 minggu cuti', 8, 2)`;
    for (const account of accounts) {
      const [employee] = await tx`insert into public.employees
        (employee_code, employee_name, department, employee_type, email)
        values (${`TEST-${account.role}`}, ${`Dummy ${account.role}`}, 'HRMD', 'EMPLOYEE',
          ${`${account.username}@example.invalid`}) returning id`;
      if (!employee) throw new Error('Employee fixture was not created.');
      const [user] = await tx`insert into public.users
        (username, email, role, department, is_active, must_change_password, password_hash, employee_id)
        values (${account.username}, ${`${account.username}@example.invalid`}, ${account.role},
          'HRMD', true, false, ${account.passwordHash}, ${employee.id}) returning id`;
      if (!user) throw new Error('User fixture was not created.');
      await tx`update public.employees set user_id = ${user.id} where id = ${employee.id}`;
      if (account.role === 'EMPLOYEE') {
        await tx`insert into public.trfs
          (trf_number, employee_id, department, travel_purpose, start_date, end_date, purpose_remarks, status)
          values ('TRF-TEST-0001', ${employee.id}, 'HRMD', 'BUSINESS_TRIP',
            current_date + 14, current_date + 16, 'Pengajuan dummy untuk pengujian', 'DRAFT')`;
      }
    }
  });
  console.log('Dummy seed committed: seven accounts, seven employees and one draft TRF. Credentials saved privately.');
} catch {
  console.error('Dummy seed failed; no success confirmed. Check database and credential file before retrying.');
  process.exitCode = 1;
} finally {
  await client.end();
}
