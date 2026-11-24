import { describe, expect, it } from 'vitest';
import { verify } from '@node-rs/argon2';
import { createDummyCredentials, DUMMY_ACCOUNTS } from './dummy-accounts.ts';

describe('dummy account credentials', () => {
  it('covers each legacy role once, retaining the requested usernames', () => {
    expect(new Set(DUMMY_ACCOUNTS.map((a) => a.role)).size).toBe(7);
    expect(DUMMY_ACCOUNTS).toHaveLength(7);
    expect(DUMMY_ACCOUNTS.map((a) => a.username)).toContain('superadmin');
    expect(DUMMY_ACCOUNTS.map((a) => a.username)).toContain('adm_hrmd_01');
  });

  it('generates distinct random temporary passwords and verifiable Argon2id hashes', async () => {
    const accounts = await createDummyCredentials();
    expect(new Set(accounts.map((a) => a.password)).size).toBe(7);
    for (const account of accounts) {
      expect(account.password).toHaveLength(32);
      expect(account.passwordHash).toMatch(/^\$argon2id\$/);
      expect(await verify(account.passwordHash, account.password)).toBe(true);
      expect(await verify(account.passwordHash, 'incorrect-password')).toBe(false);
    }
  });
});
