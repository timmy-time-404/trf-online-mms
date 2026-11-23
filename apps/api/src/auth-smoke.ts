import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Administrative integration check; never prints credentials, cookies or response bodies.
const credentials = JSON.parse(readFileSync(process.env.AUTH_CREDENTIALS_FILE ?? '/run/seed/dummy-accounts.json', 'utf8')) as {
  accounts: { username: string; password: string; role: string }[];
};
const base = process.env.AUTH_TEST_URL ?? 'https://meong-mms.org/api/auth';
const origin = 'https://meong-mms.org';
for (const account of credentials.accounts) {
  const denied = await fetch(`${base}/login`, { method: 'POST', headers: { Origin: 'https://invalid.example', 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
  assert.equal(denied.status, 403);
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: account.username, password: account.password }) });
  assert.equal(login.status, 200, `Login failed for role ${account.role}`);
  const payload = await login.json() as { user: { role: string; mustChangePassword: boolean }; token?: string };
  assert.equal(payload.user.role, account.role);
  assert.equal(payload.user.mustChangePassword, false);
  assert.equal(payload.token, undefined);
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);
  assert.ok(cookie?.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Lax'));
  const headers = { Cookie: cookie.split(';')[0]!, Origin: origin };
  assert.equal((await fetch(`${base}/me`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers })).status, 200);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 401);
}
assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: credentials.accounts[0]?.username, password: 'incorrect-password' }) })).status, 401);
console.log('Seven-role authentication smoke checks passed.');
