import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { jsonBody, parse, protectedRoutes, type Database } from '../../http.ts';
import { actionBody, date, optionalId, optionalText, requireChangedPassword, rpc, text, today } from '../operations.ts';

export const ROSTER_ACTION_ROLES = {
  my_summary: ['EMPLOYEE'], queue: ['GA', 'HOD', 'HR', 'SUPER_ADMIN'], os_ledger: ['HOD', 'HR', 'SUPER_ADMIN'],
  os_adjustment_options: ['HR', 'SUPER_ADMIN'], confirm_site_out: ['GA', 'HR', 'SUPER_ADMIN'],
  confirm_leave_start: ['GA', 'HR', 'SUPER_ADMIN'], confirm_return: ['GA', 'HR', 'SUPER_ADMIN'],
  consume_os: ['HR', 'SUPER_ADMIN'], adjust_os: ['HR', 'SUPER_ADMIN'],
} as const;
const nullableInteger = (minimum?: number, maximum?: number) => z.preprocess((v) => v === '' || v == null ? null : v,
  z.coerce.number().int().min(minimum ?? -2147483648).max(maximum ?? 2147483647).nullable());
export function createRosterOperationsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.post('/', async (c) => {
    const actor = c.get('actor');
    await requireChangedPassword(db, actor);
    const { action, body } = actionBody(await jsonBody(z.record(z.string(), z.unknown()), c.req), ROSTER_ACTION_ROLES, actor);
    const response = await db.begin(async (tx) => {
      const args: Record<string, unknown> = { p_actor_user_id: actor.id };
      if (action === 'my_summary' || action === 'queue') {
        const asOfDate = parse(date, body.asOfDate || today());
        Object.assign(args, { p_as_of_date: asOfDate });
        if (action === 'my_summary') return { asOfDate, summary: await rpc(tx, 'get_my_roster_os_summary', args) };
        const items = await rpc(tx, 'get_roster_attention_queue', args, true) as { action_code: string }[];
        const counts: Record<string, number> = {};
        for (const item of items) counts[item.action_code] = (counts[item.action_code] ?? 0) + 1;
        return { asOfDate, items, total: items.length, counts };
      }
      if (action === 'os_ledger') {
        if (actor.role === 'HOD' && !actor.department?.trim()) throw new HTTPException(403, { message: 'Department HOD belum dikonfigurasi.' });
        const items = await tx`select l.id,l.os_number,l.employee_id,l.source_type,l.source_reference,l.generated_date,
          l.original_days,l.remaining_days,l.used_days,l.expired_days,l.cancelled_days,l.cycle_number,l.status,
          l.earned_site_cycle_id,l.remarks,l.created_at,l.updated_at,
          jsonb_build_object('id',e.id,'employee_code',e.employee_code,'employee_name',e.employee_name,
            'department',e.department,'job_title',e.job_title,'is_active',e.is_active) as employee,
          s.cycle_number as earned_site_cycle_number,s.status as earned_site_cycle_status
          from public.employee_os_ledger l join public.employees e on e.id=l.employee_id
          left join public.employee_site_cycles s on s.id=l.earned_site_cycle_id
          where l.remaining_days>0 and (${actor.role} <> 'HOD' or public.normalize_department(e.department)=public.normalize_department(${actor.department}))
          order by l.generated_date,l.created_at limit 1000`;
        return { items, total: items.length, summary: { employeeCount: new Set(items.map((i) => i.employee_id)).size,
          activeBucketCount: items.length, totalRemainingDays: items.reduce((sum, i) => sum + i.remaining_days, 0) } };
      }
      if (action === 'os_adjustment_options') return {
        employees: await tx`select id,employee_code,employee_name,department,job_title,is_active from public.employees where is_active=true order by employee_code limit 1000`,
        cycles: await tx`select id,employee_id,cycle_number,status,planned_site_in,planned_site_out,actual_site_in,actual_site_out,
          planned_leave_start,planned_leave_end,actual_leave_start,actual_leave_end from public.employee_site_cycles where status<>'CANCELLED' order by cycle_number desc limit 3000`,
      };
      args.p_remarks = parse(text, body.remarks);
      let name: string;
      if (action === 'confirm_site_out' || action === 'confirm_leave_start' || action === 'confirm_return') {
        args.p_site_cycle_id = parse(z.uuid(), body.siteCycleId);
        if (action === 'confirm_site_out') {
          name = 'confirm_employee_actual_site_out'; args.p_actual_site_out = parse(date, body.actualSiteOut);
          args.p_site_out_trf_id = parse(optionalId, body.siteOutTrfId);
        } else if (action === 'confirm_leave_start') {
          name = 'confirm_employee_leave_start'; args.p_actual_leave_start = parse(date, body.actualLeaveStart);
        } else {
          name = 'confirm_employee_return_to_site'; args.p_return_to_site_date = parse(date, body.returnToSiteDate);
          args.p_site_in_trf_id = parse(optionalId, body.siteInTrfId);
        }
      } else {
        args.p_operation_key = parse(text, body.operationKey);
        if (action === 'consume_os') {
          name = 'consume_employee_os_fifo'; args.p_employee_id = parse(z.uuid(), body.employeeId);
          args.p_requested_days = parse(z.coerce.number().int().positive(), body.requestedDays);
          args.p_reference_type = parse(text, body.referenceType); args.p_reference_id = parse(optionalId, body.referenceId);
          args.p_reference_number = parse(optionalText, body.referenceNumber);
        } else {
          name = 'adjust_employee_os'; args.p_adjustment_type = parse(text, body.adjustmentType);
          args.p_employee_id = parse(optionalId, body.employeeId); args.p_os_ledger_id = parse(optionalId, body.osLedgerId);
          args.p_days = parse(nullableInteger(), body.days); args.p_new_remaining_days = parse(nullableInteger(0,10000), body.newRemainingDays);
          args.p_new_cycle_number = parse(nullableInteger(0,4), body.newCycleNumber);
          args.p_earned_site_cycle_id = parse(optionalId, body.earnedSiteCycleId);
          args.p_generated_date = parse(date, body.generatedDate || today()); args.p_reference_number = parse(text, body.referenceNumber);
        }
      }
      const rows = await rpc(tx, name, args, true) as Record<string, unknown>[];
      return { result: rows.length === 1 ? rows[0] : rows };
    });
    return c.json({ success: true, action, requestId: crypto.randomUUID(), ...response });
  });
  return app;
}
