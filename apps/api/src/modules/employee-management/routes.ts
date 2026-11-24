import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { jsonBody, parse, protectedRoutes, type Database } from '../../http.ts';
import { actionBody, date, optionalText, requireChangedPassword, rpc, text } from '../operations.ts';

export const EMPLOYEE_ACTION_ROLES = Object.fromEntries(
  ['master_data', 'list', 'create', 'update', 'set_active', 'reset_password'].map((action) => [action, ['HR', 'SUPER_ADMIN'] as const]),
);
const profile = z.object({
  employeeName: text.max(200), employeeType: text.toUpperCase().pipe(z.enum(['EMPLOYEE', 'VISITOR'])),
  email: text.max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  phone: text.max(30).refine((v) => v.replace(/\D/g, '').length >= 8), department: text.max(200),
  section: optionalText, jobTitle: text.max(200), joinDate: date, pointOfHire: optionalText,
  rosterCode: z.enum(['4:2', '5:2', '6:2', '8:2', '10:2']), siteLocationId: z.uuid(), plannedD1: date,
});
export function createEmployeeManagementRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, ['HR', 'SUPER_ADMIN']);
  app.post('/', async (c) => {
    const actor = c.get('actor');
    await requireChangedPassword(db, actor);
    const { action, body } = actionBody(await jsonBody(z.record(z.string(), z.unknown()), c.req), EMPLOYEE_ACTION_ROLES, actor);
    const response = await db.begin(async (tx) => {
      const args: Record<string, unknown> = { p_actor_user_id: actor.id };
      if (action === 'master_data') return { masterData: await rpc(tx, 'get_employee_management_master_data', args) };
      if (action === 'list') return await rpc(tx, 'list_employee_management_records', {
        ...args, p_search: parse(optionalText, body.search), p_include_inactive: parse(z.boolean().default(true), body.includeInactive),
      }) as Record<string, unknown>;
      args.p_operation_key = parse(text.max(200).default(`EMPLOYEE_MANAGEMENT:${action}:${crypto.randomUUID()}`), body.operationKey);
      // Serialize retries before the legacy routines inspect their audit records.
      await tx`select pg_advisory_xact_lock(hashtextextended(${String(args.p_operation_key)},0))`;
      if (action === 'create' || action === 'update') {
        const p = parse(profile, body);
        Object.assign(args, { p_employee_name: p.employeeName, p_employee_type: p.employeeType, p_email: p.email,
          p_phone: p.phone, p_department: p.department, p_section: p.section, p_job_title: p.jobTitle,
          p_join_date: p.joinDate, p_point_of_hire: p.pointOfHire, p_roster_code: p.rosterCode,
          p_site_location_id: p.siteLocationId, p_planned_d1: p.plannedD1 });
      }
      if (action === 'create') args.p_employee_code = parse(text.regex(/^\d{7}$/), body.employeeCode);
      else args.p_employee_id = parse(z.uuid(), body.employeeId);
      if (action === 'set_active') args.p_is_active = parse(z.boolean(), body.isActive);
      if (action === 'set_active' || action === 'reset_password') args.p_remarks = parse(text.max(1000), body.remarks);
      const temporaryPassword = action === 'create' || action === 'reset_password' ? `Aa7!${randomBytes(24).toString('base64url')}` : null;
      if (temporaryPassword) args.p_password_hash = await hash(temporaryPassword);
      const names: Record<string, string> = { create: 'create_employee_onboarding', update: 'update_employee_management',
        set_active: 'set_employee_management_active', reset_password: 'reset_employee_temporary_password' };
      const result = await rpc(tx, names[action]!, args) as Record<string, unknown>;
      if (temporaryPassword && result.idempotent === true)
        throw new HTTPException(409, { message: 'Permintaan sudah diproses. Jalankan reset baru untuk password sementara baru.' });
      const user = result.user as { username: string } | undefined;
      return { result, ...(temporaryPassword ? { credentials: { username: user?.username ?? result.username,
        temporaryPassword, shownOnce: true, mustChangePassword: true } } : {}) };
    });
    return c.json({ success: true, action, requestId: crypto.randomUUID(), ...response });
  });
  return app;
}
