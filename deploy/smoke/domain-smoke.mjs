// End-to-end audit of the deployed app through its public domain, per role.
// Creates dummy TRFs/recalls; run only against the development dataset.
//
//   docker run --rm -u 0 \
//     -v $PWD/deploy/smoke/domain-smoke.mjs:/s.mjs:ro \
//     -v $PWD/deploy/secrets/dummy-accounts.json:/a.json:ro \
//     --entrypoint node trf-api:$RELEASE_TAG /s.mjs https://meong-mms.org
//
// Credentials are read from the mounted file and never printed.
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'https://meong-mms.org';
const accounts = Object.fromEntries(JSON.parse(readFileSync('/a.json', 'utf8')).accounts.map((a) => [a.role, a]));
const results = [];
let section = '';
const check = (name, pass, detail = '') => results.push({ section, name, pass: !!pass, detail: String(detail) });

const cookie = {};
async function api(role, method, path, { body, version, form } = {}) {
  const headers = { Origin: base, ...(role ? { Cookie: cookie[role] } : {}) };
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}/api${path}`, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  let json = null;
  try { json = await response.clone().json(); } catch { /* binary or empty */ }
  return { status: response.status, json, response };
}
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// ── Platform ─────────────────────────────────────────────────────────────
section = 'Platform';
{
  const home = await fetch(base + '/');
  check('Halaman utama tersaji (HTTPS)', home.status === 200, home.status);
  const h = home.headers;
  check('Header keamanan (HSTS, frame, noindex)', h.get('strict-transport-security') && h.get('x-frame-options') === 'DENY' && /noindex/.test(h.get('x-robots-tag') ?? ''));
  check('Health API', (await fetch(base + '/api/health')).status === 200);
  check('Tanpa login ditolak', (await api(null, 'GET', '/trfs')).status === 401);
}

// ── Login ────────────────────────────────────────────────────────────────
section = 'Login';
for (const role of Object.keys(accounts)) {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: accounts[role].username, password: accounts[role].password }) });
  cookie[role] = (r.headers.get('set-cookie') ?? '').split(';')[0];
  check(`Login ${role}`, r.status === 200 && cookie[role].startsWith('__Host-'), r.status);
}
check('Password salah ditolak', (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: accounts.EMPLOYEE.username, password: 'salah-' + Date.now() }) })).status === 401);

// ── TRF lifecycle ────────────────────────────────────────────────────────
section = 'TRF';
const ctx = (await api('EMPLOYEE', 'GET', '/trfs/context')).json;
const employeeId = (ctx?.employees?.[0] ?? ctx?.employee)?.id;
const trfBody = (start, extra = {}) => ({ employeeId, travelPurpose: '["BUSINESS_TRIP"]', startDate: start, endDate: day(40),
  purposeRemarks: 'Audit E2E', purposeEntries: [{ id: 'p1', travelPurpose: '["BUSINESS_TRIP"]', startDate: start, endDate: day(40), purposeRemarks: 'Audit E2E' }],
  travelArrangements: [], accommodations: [], ...extra });
let trf = (await api('EMPLOYEE', 'POST', '/trfs', { body: trfBody(day(30)), version: 0 })).json;
check('EMPLOYEE membuat TRF', trf?.status === 'SUBMITTED', trf?.trfNumber);
check('GA tidak bisa membuat TRF', (await api('GA', 'POST', '/trfs', { body: trfBody(day(30)), version: 0 })).status === 403);
check('Pengajuan < H-14 tanpa alasan ditolak', (await api('EMPLOYEE', 'POST', '/trfs', { body: trfBody(day(5)), version: 0 })).status === 400);
for (const role of ['EMPLOYEE', 'ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN']) {
  const list = (await api(role, 'GET', '/trfs')).json ?? [];
  check(`${role} melihat TRF sesuai hak`, list.some((t) => t.id === trf.id));
}
const act = async (role, path, body = {}) => {
  const r = await api(role, 'POST', `/trfs/${trf.id}/${path}`, { body, version: trf.version });
  if (r.status === 200) trf = r.json;
  return r;
};
check('Antrean Admin Dept berisi TRF', JSON.stringify((await api('ADMIN_DEPT', 'GET', '/trfs/queue')).json).includes(trf.id));
check('Peran salah tidak bisa verify', (await act('EMPLOYEE', 'verify', { decision: 'YES' })).status === 403);
await act('ADMIN_DEPT', 'verify', { decision: 'YES', remarks: 'OK' });
check('Admin Dept verifikasi → PENDING_APPROVAL', trf.status === 'PENDING_APPROVAL');
await act('HOD', 'approve', { remarks: 'OK' });
check('HOD approve → HOD_APPROVED', trf.status === 'HOD_APPROVED');
check('HR approve tanpa lumpsum ditolak', (await act('HR', 'approve', {})).status === 400);
await act('HR', 'approve', { lumpsum: { amount: 500000, note: 'Audit' } });
check('HR approve + lumpsum → HR_APPROVED', trf.status === 'HR_APPROVED' && Number(trf.lumpsumAmount) === 500000);
await act('PM', 'approve', {});
check('PM approve → PM_APPROVED', trf.status === 'PM_APPROVED');
check('GA proses tanpa dokumen ditolak (D4)', (await act('GA', 'process', { remarks: 'x' })).status === 400);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]);
const form = new FormData(); form.append('file', new File([pdf], 'tiket-audit.pdf'));
const up = await api('GA', 'POST', `/trf-documents/${trf.id}/flightTicket`, { form, version: trf.version });
if (up.status === 201) trf = up.json;
check('GA unggah tiket', up.status === 201);
const dl = await api('EMPLOYEE', 'GET', `/trf-documents/${trf.id}/flightTicket`);
check('Karyawan unduh tiketnya', dl.status === 200 && dl.response.headers.get('content-type') === 'application/pdf');
await act('GA', 'process', { remarks: 'Tiket siap', voucherDetails: { flightTicket: 'AUDIT' } });
check('GA proses → GA_PROCESSED', trf.status === 'GA_PROCESSED');
check('TRF selesai tidak bisa direject', (await act('SUPER_ADMIN', 'reject', { remarks: 'x' })).status === 409);

let other = (await api('EMPLOYEE', 'POST', '/trfs', { body: trfBody(day(30)), version: 0 })).json;
const actOther = async (role, path, body) => { const r = await api(role, 'POST', `/trfs/${other.id}/${path}`, { body, version: other.version }); if (r.status === 200) other = r.json; return r; };
await actOther('ADMIN_DEPT', 'verify', { decision: 'NO', remarks: 'Lengkapi' });
check('Verify NO → NEEDS_REVISION', other.status === 'NEEDS_REVISION');
await actOther('EMPLOYEE', 'resubmit', trfBody(day(31)));
check('Karyawan kirim ulang → SUBMITTED', other.status === 'SUBMITTED');
await actOther('ADMIN_DEPT', 'verify', { decision: 'YES' });
check('Reject tanpa alasan ditolak (D10)', (await actOther('HOD', 'reject', { remarks: '' })).status === 400);
await actOther('HOD', 'reject', { remarks: 'Audit reject' });
check('HOD reject → REJECTED', other.status === 'REJECTED');

let draft = (await api('EMPLOYEE', 'POST', '/trfs', { body: { employeeId, draft: true, purposeRemarks: 'draft' }, version: 0 })).json;
check('Simpan draft (D9)', draft?.status === 'DRAFT');
check('Versi basi ditolak 409 (D13)', (await api('EMPLOYEE', 'POST', `/trfs/${draft.id}/cancel`, { body: { remarks: 'x' }, version: draft.version + 7 })).status === 409);
const cancel = await api('EMPLOYEE', 'POST', `/trfs/${draft.id}/cancel`, { body: { remarks: 'Audit batal' }, version: draft.version });
check('Batalkan TRF (D9)', cancel.json?.status === 'CANCELLED');

// ── Early Recall & roster ────────────────────────────────────────────────
section = 'Early Recall & Roster';
for (const role of Object.keys(accounts)) check(`${role} buka daftar Early Recall`, (await api(role, 'POST', '/early-recall-workflow', { body: { action: 'list' } })).status === 200);
check('EMPLOYEE tidak bisa membuat recall', (await api('EMPLOYEE', 'POST', '/early-recall-workflow', { body: { action: 'create', employeeId, approvedLeaveStart: day(-5), approvedLeaveEnd: day(10), proposedReturnDate: day(3), reason: 'x' } })).status === 403);
const active = ((await api('HOD', 'POST', '/early-recall-workflow', { body: { action: 'list' } })).json?.items ?? [])
  .find((x) => x.employee_id === employeeId && !['OS_GENERATED', 'REJECTED', 'CANCELLED'].includes(x.status));
if (active) await api('PM', 'POST', '/early-recall-workflow', { body: { action: 'cancel', earlyRecallId: active.id, remarks: 'Audit: bersihkan recall lama' } });
const recallBody = { action: 'create', employeeId, approvedLeaveStart: day(-5), approvedLeaveEnd: day(10), proposedReturnDate: day(3), reason: 'Audit E2E' };
const created = await api('HOD', 'POST', '/early-recall-workflow', { body: recallBody });
let recall = created.json?.item;
// A previous audit within the last ~15 days already converted this leave period into OS (#13).
if (created.status === 400 && /sudah pernah dikonversi/.test(created.json?.message ?? ''))
  check('Recall periode yang sudah jadi OS ditolak (#13); siklus recall dilewati', true, created.json.message);
else check('HOD membuat Early Recall', recall?.status === 'DRAFT', recall?.status);
const rstep = async (role, action, extra = {}) => { const r = await api(role, 'POST', '/early-recall-workflow', { body: { action, earlyRecallId: recall.id, ...extra } }); if (r.status === 200) recall = r.json.item; return r.status; };
if (recall) {
  await rstep('HOD', 'submit'); await rstep('HR', 'hr_validate'); await rstep('PM', 'pm_approve');
  check('Recall disetujui PM, TRF Travel-In dibuat', recall.status === 'PM_APPROVED' && recall.linked_trf_id);
  let linked = (await api('GA', 'GET', `/trfs/${recall.linked_trf_id}`)).json;
  const f2 = new FormData(); f2.append('file', new File([pdf], 'tiket-recall.pdf'));
  linked = (await api('GA', 'POST', `/trf-documents/${linked.id}/flightTicket`, { form: f2, version: linked.version })).json;
  await api('GA', 'POST', `/trfs/${linked.id}/process`, { body: { remarks: 'Tiket recall' }, version: linked.version });
  await rstep('GA', 'ga_start'); await rstep('GA', 'travel_booked'); await rstep('EMPLOYEE', 'acknowledge');
  await rstep('GA', 'confirm_return', { actualReturnDate: day(0) }); // actual dates cannot be in the future (#12)
  check('Recall selesai → OS_GENERATED', recall.status === 'OS_GENERATED', recall.status);
  const again = await api('HOD', 'POST', '/early-recall-workflow', { body: recallBody });
  check('Recall kedua untuk periode yang sama ditolak (#13)', again.status === 400, again.status);
}
check('Roster saya (EMPLOYEE)', (await api('EMPLOYEE', 'POST', '/roster-operations', { body: { action: 'my_summary' } })).status === 200);
for (const role of ['GA', 'HOD', 'HR', 'SUPER_ADMIN']) check(`Antrean roster ${role}`, (await api(role, 'POST', '/roster-operations', { body: { action: 'queue' } })).status === 200);
check('EMPLOYEE tidak bisa buka antrean roster', (await api('EMPLOYEE', 'POST', '/roster-operations', { body: { action: 'queue' } })).status === 403);
for (const role of ['HOD', 'HR', 'PM', 'SUPER_ADMIN']) check(`Manpower dashboard ${role}`, (await api(role, 'POST', '/manpower-dashboard', { body: { action: 'snapshot', asOfDate: day(0) } })).status === 200);

// ── Master data & dashboard ──────────────────────────────────────────────
section = 'Master data & Dashboard';
const users = (await api('SUPER_ADMIN', 'GET', '/users')).json ?? [];
check('SUPER_ADMIN kelola user (semua peran ada, tanpa hash)', new Set(users.map((u) => u.role)).size === 7 && !JSON.stringify(users).includes('password_hash'));
check('HR tidak bisa kelola user', (await api('HR', 'GET', '/users')).status === 403);
check('HR employee management', (await api('HR', 'POST', '/employee-management', { body: { action: 'list' } })).status === 200);
check('EMPLOYEE hanya lihat data dirinya (D12)', ((await api('EMPLOYEE', 'GET', '/employees')).json ?? []).length === 1);
check('GA kelola hotel', (await api('GA', 'GET', '/hotels')).status === 200);
check('Pencarian lokasi bandara', ((await api('EMPLOYEE', 'GET', '/locations?types=AIRPORT&keyword=ba')).json ?? []).length > 0);
for (const role of Object.keys(accounts)) {
  const a = await api(role, 'GET', '/dashboard/stats'), b = await api(role, 'GET', '/notifications');
  check(`Dashboard & notifikasi ${role}`, a.status === 200 && b.status === 200);
}

section = 'Logout';
await api('EMPLOYEE', 'POST', '/auth/logout', { body: {} });
check('Sesi tidak berlaku setelah logout', (await api('EMPLOYEE', 'GET', '/trfs')).status === 401);

// ── Report ───────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.section}] ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} lulus`);
console.log('JSON ' + JSON.stringify({ at: new Date().toISOString(), base, total: results.length, failed: failed.length, results }));
process.exitCode = failed.length ? 1 : 0;
