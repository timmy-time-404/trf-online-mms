import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Actor } from '../../middleware/auth.ts';
import { found, jsonBody, parse, protectedRoutes, type Database } from '../../http.ts';
import { actionBody, date, lockRecall, optionalId, optionalText, requireChangedPassword, rpc, text, type Transaction } from '../operations.ts';

const all = ['EMPLOYEE', 'ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'] as const;
export const RECALL_ACTION_ROLES = {
  list: all, detail: all, create: ['HOD', 'PM', 'SUPER_ADMIN'], update: ['HOD', 'PM', 'SUPER_ADMIN'],
  submit: ['HOD', 'PM', 'SUPER_ADMIN'], hr_validate: ['HR', 'SUPER_ADMIN'], return_revision: ['HR', 'PM', 'SUPER_ADMIN'],
  pm_approve: ['PM', 'SUPER_ADMIN'], ga_start: ['GA', 'SUPER_ADMIN'], travel_booked: ['GA', 'SUPER_ADMIN'],
  acknowledge: ['EMPLOYEE'], confirm_return: ['GA', 'HR', 'SUPER_ADMIN'], reject: ['HR', 'PM', 'SUPER_ADMIN'],
  cancel: ['HOD', 'HR', 'PM', 'SUPER_ADMIN'],
} as const;
const names: Record<string, string> = { create: 'create_early_recall_request', update: 'update_early_recall_request',
  submit: 'submit_early_recall_request', hr_validate: 'hr_validate_early_recall_request',
  return_revision: 'return_early_recall_for_revision', pm_approve: 'pm_approve_early_recall_request',
  ga_start: 'start_early_recall_ga_processing', travel_booked: 'mark_early_recall_travel_booked',
  acknowledge: 'acknowledge_early_recall', confirm_return: 'confirm_early_recall_actual_return',
  reject: 'reject_early_recall_request', cancel: 'cancel_early_recall_request' };
const allowedStatuses: Record<string, readonly string[]> = {
  update: ['DRAFT', 'NEEDS_REVISION'], submit: ['DRAFT', 'NEEDS_REVISION'], hr_validate: ['PENDING_HR_VALIDATION'],
  return_revision: ['PENDING_HR_VALIDATION', 'PENDING_PM_APPROVAL'], reject: ['PENDING_HR_VALIDATION', 'PENDING_PM_APPROVAL'],
  pm_approve: ['PENDING_PM_APPROVAL', 'PM_APPROVED', 'GA_PROCESSING', 'TRAVEL_BOOKED', 'RETURNED_TO_SITE', 'OS_GENERATED'],
  ga_start: ['PM_APPROVED', 'GA_PROCESSING', 'TRAVEL_BOOKED', 'RETURNED_TO_SITE', 'OS_GENERATED'],
  travel_booked: ['PM_APPROVED', 'GA_PROCESSING', 'TRAVEL_BOOKED', 'RETURNED_TO_SITE', 'OS_GENERATED'],
  acknowledge: ['PM_APPROVED', 'GA_PROCESSING', 'TRAVEL_BOOKED', 'RETURNED_TO_SITE', 'OS_GENERATED'],
  confirm_return: ['TRAVEL_BOOKED', 'RETURNED_TO_SITE', 'OS_GENERATED'],
  cancel: ['DRAFT', 'NEEDS_REVISION', 'PENDING_HR_VALIDATION', 'HR_VALIDATED', 'PENDING_PM_APPROVAL', 'PM_APPROVED', 'GA_PROCESSING', 'TRAVEL_BOOKED'],
};
function canView(actor: Actor, row: { employee_id: string; department: string }) {
  if (actor.role === 'EMPLOYEE') return !!actor.employeeId && actor.employeeId === row.employee_id;
  if (actor.role === 'HOD' || actor.role === 'ADMIN_DEPT') return !!actor.department && actor.department === row.department;
  return true;
}
async function details(tx: Transaction, ids: string[]) {
  if (!ids.length) return [];
  return await tx`select r.*,
    jsonb_build_object('id',e.id,'employee_code',e.employee_code,'employee_name',e.employee_name,
      'department',e.department,'job_title',e.job_title,'phone',e.phone) as employee,
    case when t.id is null then null else jsonb_build_object('id',t.id,'trf_number',t.trf_number,'status',t.status,
      'start_date',t.start_date,'end_date',t.end_date,'travel_arrangements',t.travel_arrangements,'ga_process',t.ga_process) end as linked_trf,
    case when l.id is null then null else jsonb_build_object('id',l.id,'os_number',l.os_number,'employee_id',l.employee_id,
      'source_type',l.source_type,'generated_date',l.generated_date,'original_days',l.original_days,'remaining_days',l.remaining_days,
      'used_days',l.used_days,'expired_days',l.expired_days,'cancelled_days',l.cancelled_days,
      'cycle_number',l.cycle_number,'status',l.status,'created_at',l.created_at) end as os_ledger
    from public.early_recall_requests r join public.employees e on e.id=r.employee_id
    left join public.trfs t on t.id=r.linked_trf_id left join public.employee_os_ledger l on l.id=r.os_ledger_id
    where r.id in ${tx(ids)} order by r.created_at desc`;
}
async function detail(tx: Transaction, id: string, history: boolean): Promise<Record<string, unknown>> {
  const row = found((await details(tx, [id]))[0]);
  return { ...row, ...(history ? { history: await tx`select * from public.early_recall_status_history where early_recall_id=${id} order by created_at,id` } : {}) };
}

export function createEarlyRecallRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.post('/', async (c) => {
    const actor = c.get('actor');
    await requireChangedPassword(db, actor);
    const { action, body } = actionBody(await jsonBody(z.record(z.string(), z.unknown()), c.req), RECALL_ACTION_ROLES, actor);
    const response = await db.begin(async (tx) => {
      if (action === 'list') {
        if (actor.role === 'EMPLOYEE' && !actor.employeeId || ['HOD','ADMIN_DEPT'].includes(actor.role) && !actor.department)
          throw new HTTPException(403, { message: 'Scope akun belum dikonfigurasi.' });
        const status = parse(optionalText, body.status), search = parse(optionalText, body.search);
        const rows = await tx`select id from public.early_recall_requests where
          (${actor.role} <> 'EMPLOYEE' or employee_id=${actor.employeeId}) and
          (${!['HOD','ADMIN_DEPT'].includes(actor.role)} or department=${actor.department}) and
          (${status}::text is null or status=${status}) and (${search}::text is null or recall_number ilike ${'%' + (search ?? '') + '%'})
          order by created_at desc limit 500`;
        const items = await details(tx, rows.map((row) => row.id));
        return { items, total: items.length };
      }
      const id = action === 'create' ? null : parse(z.uuid(), body.earlyRecallId);
      const old = id ? action === 'detail' ? found((await tx`select * from public.early_recall_requests where id=${id}`)[0]) : await lockRecall(tx, id) : null;
      if (old && !canView(actor, old as { employee_id: string; department: string }))
        throw new HTTPException(403, { message: 'Anda tidak memiliki akses ke Early Recall ini.' });
      if (action === 'detail') return { item: await detail(tx, id!, true) };
      if (old && !allowedStatuses[action]?.includes(old.status)) throw new HTTPException(409, { message: 'Status Early Recall tidak sesuai aksi.' });
      if (old && ['reject','return_revision'].includes(action) &&
        (actor.role === 'HR' && old.status !== 'PENDING_HR_VALIDATION' || actor.role === 'PM' && old.status !== 'PENDING_PM_APPROVAL'))
        throw new HTTPException(403, { message: 'Tahap persetujuan bukan milik peran ini.' });
      if (old && action === 'cancel' && ['PENDING_PM_APPROVAL','PM_APPROVED','GA_PROCESSING','TRAVEL_BOOKED'].includes(old.status)
        && !['PM','SUPER_ADMIN'].includes(actor.role)) throw new HTTPException(403, { message: 'Tahap PM hanya dapat dibatalkan PM atau SUPER_ADMIN.' });
      const args: Record<string, unknown> = { p_actor_user_id: actor.id };
      if (id) args.p_early_recall_id = id;
      if (action === 'create' || action === 'update') {
        const fields = parse(z.object({ approvedLeaveStart: date, approvedLeaveEnd: date, proposedReturnDate: date,
          reason: text, sourceTrfId: optionalId }), body);
        Object.assign(args, { p_approved_leave_start: fields.approvedLeaveStart, p_approved_leave_end: fields.approvedLeaveEnd,
          p_proposed_return_date: fields.proposedReturnDate, p_reason: fields.reason, p_source_trf_id: fields.sourceTrfId });
        if (action === 'create') {
          args.p_employee_id = parse(z.uuid(), body.employeeId);
          const employee = found((await tx`select department from public.employees where id=${String(args.p_employee_id)}`)[0]);
          if (actor.role === 'HOD' && (!actor.department || actor.department !== employee.department))
            throw new HTTPException(403, { message: 'HOD hanya dapat membuat Early Recall department sendiri.' });
        }
      }
      if (action === 'confirm_return') args.p_actual_return_date = parse(date, body.actualReturnDate);
      const reasons: Record<string, [string,string]> = { reject: ['p_rejection_reason','rejectionReason'], return_revision: ['p_revision_reason','revisionReason'],
        cancel: ['p_cancellation_reason','cancellationReason'] };
      const reason = reasons[action];
      if (reason) args[reason[0]!] = parse(text, body[reason[1]!]);
      else if (action !== 'acknowledge') args.p_remarks = parse(optionalText, body.remarks);
      const results = await rpc(tx, names[action]!, args, true) as Record<string, unknown>[];
      const result = found(results[0]);
      const recallId = String(result.early_recall_id ?? id);
      const item = await detail(tx, recallId, true);
      const events: string[] = [];
      // Retries retain legacy idempotency without enqueueing duplicate notifications.
      if (old?.status !== item.status) {
        if (action === 'pm_approve') events.push('EARLY_RECALL_APPROVED');
        if (action === 'travel_booked') events.push('EARLY_RECALL_TRAVEL_BOOKED');
        if (action === 'confirm_return') events.push('EARLY_RECALL_RETURN_CONFIRMED', 'EARLY_RECALL_OS_GENERATED');
        if (action === 'cancel' && ['PM_APPROVED','GA_PROCESSING','TRAVEL_BOOKED'].includes(old?.status)) events.push('EARLY_RECALL_CANCELLED');
      }
      for (const event of events) {
        const employee = item.employee as { phone: string | null };
        await tx`insert into public.notification_outbox(early_recall_id,recipient_phone,template_key,payload)
          values (${recallId},${employee.phone},${event},${tx.json({ event, recall: item, remarks: args.p_remarks ?? null })})`;
      }
      return { result, item, notifications: events.map((event) => ({ event, attempted: false, success: true,
        skippedReason: 'Notifikasi masuk antrean; pengiriman tersedia pada WP5.' })) };
    });
    return c.json({ success: true, action, ...response });
  });
  return app;
}
