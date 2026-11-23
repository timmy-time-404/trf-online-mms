import { createTRFSchema, trfPatchSchema, getNextStatus, findNextActiveStatus,
  isHRLumpsumAmount, REVIEW_STATUSES, type TrfStatus, type WorkflowAction } from '@trf/shared';
import { HTTPException } from 'hono/http-exception';
import type postgres from 'postgres';
import { z } from 'zod';
import type { Actor } from '../../middleware/auth.ts';
import type { openDatabase } from '../../db/connection.ts';
import { assertStatus, canSeeTRF } from './policy.ts';
import * as repo from './repository.ts';
import * as workflow from './workflowRepository.ts';

const lumpsumSchema = z.object({
  amount: z.number().refine(isHRLumpsumAmount, 'Nominal lumpsum tidak tersedia pada daftar resmi.'),
  note: z.string().default(''),
}).strict();
const remarksSchema = z.object({ remarks: z.string().default('') }).strict();
const approveSchema = remarksSchema.extend({ lumpsum: lumpsumSchema.optional() });
const verifySchema = remarksSchema.extend({ decision: z.enum(['YES', 'NO']) });
const reviseSchema = z.object({ remarks: z.string().refine((value) => value.trim().length > 0, 'Remarks wajib diisi untuk revisi.') }).strict();
const editSchema = z.object({ updates: trfPatchSchema, note: z.string().default(''), lumpsum: lumpsumSchema.optional() }).strict();
const processSchema = remarksSchema.extend({
  voucherDetails: z.object({ hotelVoucher: z.string().optional(), flightTicket: z.string().optional(),
    transportation: z.string().optional(), other: z.string().optional() }).strict().optional(),
  ga_documents: z.object({}).strict().optional(),
});
export type WorkflowKind = 'verify' | 'approve' | 'reject' | 'revise' | 'edit-approve' | 'process';
function parse<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues[0]?.message ?? 'Data tidak valid.' });
  return result.data;
}
function nextStatus(current: string, actor: Actor, action: WorkflowAction) {
  try { return getNextStatus(current as TrfStatus, actor.role, action); }
  catch { throw new HTTPException(409, { message: 'Status TRF tidak mengizinkan tindakan ini.' }); }
}
export const createWorkflowService = (db: ReturnType<typeof openDatabase>) => ({
  queue: async (actor: Actor) => {
    const status = { ADMIN_DEPT: 'SUBMITTED', HOD: 'PENDING_APPROVAL', HR: 'HOD_APPROVED',
      PM: 'HR_APPROVED', GA: 'PM_APPROVED', SUPER_ADMIN: null, EMPLOYEE: null }[actor.role];
    if (!status) return [];
    return (await repo.listRows(db, actor)).filter((row) => row.status === status).map(repo.trfDTO);
  },
  act: async (actor: Actor, id: string, kind: WorkflowKind, body: unknown) => db.begin(async (tx) => {
    const row = await repo.findRow(tx, id, true);
    if (!row) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    if (!canSeeTRF(actor, row)) throw new HTTPException(403, { message: 'Akses TRF ditolak.' });
    if (!REVIEW_STATUSES[actor.role].length) throw new HTTPException(403, { message: 'Peran tidak boleh menjalankan workflow.' });
    const now = new Date();
    const stamp = now.toISOString();
    const payload: Record<string, postgres.SerializableParameter> = { updated_at: now };
    let target = row.status;
    let remarks = '';
    let note = '';
    let action: WorkflowAction | undefined;
    let lumpsum: z.output<typeof lumpsumSchema> | undefined;
    const editedOnly = kind === 'edit-approve' && actor.role === 'GA';
    if (kind === 'verify') {
      assertStatus(row.status, ['SUBMITTED']);
      const input = parse(verifySchema, body);
      note = input.remarks;
      action = input.decision === 'YES' ? 'VERIFY' : 'REVISE';
      remarks = input.remarks || `Verified by ${actor.role}`;
      payload.admin_dept_verify = tx.json({ verified: input.decision === 'YES', verifiedAt: stamp,
        verifierId: actor.id, verifierName: actor.displayName, remarks: input.remarks });
    } else if (kind === 'edit-approve') {
      assertStatus(row.status, actor.role === 'HR' ? ['HOD_APPROVED'] : ['PM_APPROVED']);
      const input = parse(editSchema, body);
      note = input.note;
      if (input.updates.employeeId && input.updates.employeeId !== row.employee_id)
        throw new HTTPException(403, { message: 'Pemilik TRF tidak boleh diubah.' });
      const current = repo.trfDTO(row);
      const changed = parse(createTRFSchema, { employeeId: row.employee_id,
        travelPurpose: current.travelPurpose, startDate: current.startDate, endDate: current.endDate,
        purposeRemarks: current.purposeRemarks, purposeEntries: current.purposeEntries.length ? current.purposeEntries : undefined,
        accommodation: current.accommodation, accommodations: current.accommodations,
        travelArrangements: current.travelArrangements, ...input.updates });
      Object.assign(payload, repo.fields(tx, changed));
      lumpsum = input.lumpsum;
      if (editedOnly && lumpsum) throw new HTTPException(400, { message: 'Lumpsum hanya dapat diisi HR.' });
      remarks = input.note.trim() || (editedOnly
        ? `Detail TRF diedit oleh GA (${actor.displayName}), menunggu proses dokumen.`
        : 'TRF diedit dan disetujui otomatis oleh HR');
      if (!editedOnly) action = 'APPROVE';
    } else if (kind === 'process') {
      const input = parse(processSchema, body);
      note = input.remarks;
      action = 'APPROVE';
      remarks = input.remarks || 'TRF Processed by GA';
      payload.ga_process = tx.json({ processed: true, processedAt: stamp, processorId: actor.id,
        processorName: actor.displayName, voucherDetails: input.voucherDetails ?? {}, remarksToEmployee: input.remarks });
      // Document uploads and trusted non-empty metadata are introduced in WP5.
      payload.ga_documents = tx.json(row.ga_documents ?? {});
    } else {
      const input = kind === 'approve' ? parse(approveSchema, body)
        : kind === 'revise' ? parse(reviseSchema, body) : parse(remarksSchema, body);
      note = input.remarks;
      action = kind === 'approve' ? 'APPROVE' : kind === 'reject' ? 'REJECT' : 'REVISE';
      remarks = input.remarks || `${action} by ${actor.role}`;
      if (kind === 'approve') lumpsum = parse(approveSchema, body).lumpsum;
    }
    if (action) {
      target = nextStatus(row.status, actor, action);
      if ((action === 'VERIFY' || action === 'APPROVE') && kind !== 'process')
        target = findNextActiveStatus(target, await workflow.activeApprovers(tx), row.department);
      if (action === 'APPROVE' && kind !== 'process') {
        const approval = { status: 'APPROVED', actionAt: stamp, actionById: actor.id,
          actionByName: actor.displayName, remarks: note };
        if (actor.role === 'HOD' || actor.role === 'HR')
          payload.parallel_approval = tx.json({ ...(row.parallel_approval ?? {}), [actor.role.toLowerCase()]: approval });
        if (actor.role === 'PM') payload.pm_approval = tx.json({ approved: true, approvedAt: stamp,
          approverId: actor.id, approverName: actor.displayName, remarks: approval.remarks });
        if (actor.role === 'HR') {
          if (!lumpsum) throw new HTTPException(400, { message: 'Pilih nominal lumpsum sebelum melakukan approval.' });
          Object.assign(payload, { lumpsum_amount: lumpsum.amount, lumpsum_currency: 'IDR',
            lumpsum_note: lumpsum.note.trim(), lumpsum_input_by: actor.id, lumpsum_input_at: now });
        } else if (lumpsum) throw new HTTPException(400, { message: 'Lumpsum hanya dapat diisi HR.' });
      }
    }
    payload.status = target;
    if (!await workflow.saveWorkflow(tx, row, payload)) throw new HTTPException(409, { message: 'TRF berubah selama penyimpanan.' });
    await repo.writeHistory(tx, actor, id, row.status, target, remarks);
    await workflow.enqueueNotification(tx, row, actor, target, remarks, editedOnly);
    if (kind === 'edit-approve') await workflow.notifyOwner(tx, row, actor, note);
    return repo.trfDTO((await repo.findRow(tx, id))!);
  }),
});
