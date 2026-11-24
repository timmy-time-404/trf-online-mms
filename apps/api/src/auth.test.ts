import { describe, expect, it } from 'vitest';
import { createAuthRoutes } from './auth.ts';
import type { openDatabase } from './db/connection.ts';

const unusedDatabase = (() => { throw new Error('Database must not be reached'); }) as unknown as ReturnType<typeof openDatabase>;
describe('auth request boundaries', () => {
  it('rejects missing or foreign Origin before accessing database', async () => {
    const app = createAuthRoutes(unusedDatabase, 'https://meong-mms.org');
    for (const origin of [undefined, 'https://untrusted.example']) {
      const response = await app.request('/login', { method: 'POST', headers: origin ? { Origin: origin } : {} });
      expect(response.status).toBe(403);
    }
  });
  it('rejects invalid payload, oversized input and missing sessions', async () => {
    const app = createAuthRoutes(unusedDatabase, 'https://meong-mms.org');
    expect((await app.request('/me')).status).toBe(401);
    expect((await app.request('/login', { method: 'POST', headers: { Origin: 'https://meong-mms.org' }, body: '{}' })).status).toBe(400);
    expect((await app.request('/login', { method: 'POST', headers: { Origin: 'https://meong-mms.org' }, body: 'x'.repeat(4097) })).status).toBe(413);
  });
});
