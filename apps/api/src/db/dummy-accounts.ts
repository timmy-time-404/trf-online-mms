import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';

export const DUMMY_ACCOUNTS = [
  { username: 'superadmin', role: 'SUPER_ADMIN' },
  { username: 'adm_hrmd_01', role: 'ADMIN_DEPT' },
  { username: 'employee_dummy', role: 'EMPLOYEE' },
  { username: 'hod_dummy', role: 'HOD' },
  { username: 'hr_dummy', role: 'HR' },
  { username: 'pm_dummy', role: 'PM' },
  { username: 'ga_dummy', role: 'GA' },
] as const;

export const createDummyCredentials = async () => {
  const accounts = [];
  // Sequential hashes bound memory while creating the fixtures.
  for (const account of DUMMY_ACCOUNTS) {
    const password = randomBytes(24).toString('base64url');
    const passwordHash = await hash(password, {
      memoryCost: 19456, timeCost: 2, parallelism: 1,
    });
    accounts.push({ ...account, password, passwordHash });
  }
  return accounts;
};
