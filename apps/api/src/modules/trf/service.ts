import { createTRFSchema, draftTRFSchema, trfPatchSchema, missingApprover } from '@trf/shared';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Actor } from '../../middleware/auth.ts';
import type { openDatabase } from '../../db/connection.ts';
import { assertCanEdit, assertStatus, canSeeTRF } from './policy.ts';
import * as repo from './repository.ts';
import { enqueueNotification, notifyOwner, notifyNextApprovers, activeApprovers } from './workflowRepository.ts';
import { assertVersion } from './concurrency.ts';

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues[0]?.message ?? 'Data TRF tidak valid.' });
  return result.data;
}
export const createTRFService = (db: ReturnType<typeof openDatabase>) => ({
  list: async (actor: Actor) => {
    const users = actor.role==='SUPER_ADMIN' ? await activeApprovers(db) : [];
    return (await repo.listRows(db, actor)).map((row) => ({...repo.trfDTO(row),
      ...(actor.role==='SUPER_ADMIN' ? { blockedBy: missingApprover(row.status,users,row.department) } : {}) }));
  },
  context: async (actor: Actor) => ({ employees: (await repo.formEmployees(db, actor)).map(repo.employeeDTO) }),
  detail: async (actor: Actor, id: string) => {
    const row = await repo.findRow(db, id);
    if (!row || !canSeeTRF(actor, row)) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    // Same held-TRF hint as the list, so SUPER_ADMIN sees it on the detail endpoint too (#16).
    if (actor.role !== 'SUPER_ADMIN') return repo.trfDTO(row);
    return { ...repo.trfDTO(row), blockedBy: missingApprover(row.status, await activeApprovers(db), row.department) ?? null };
  },
  /**
   * Creates a TRF. With an `Idempotency-Key`, a retried or double-clicked submit returns the
   * TRF the first request created (`replayed: true`) instead of creating a duplicate.
   */
  create: async (actor: Actor, body: unknown, expected: number, idempotencyKey: string | null = null) => {
    assertVersion(0,expected);
    const { draft = false, ...data } = parse(z.record(z.string(),z.unknown()),body);
    parse(z.boolean(),draft);
    const input = draft ? parse(draftTRFSchema,data) : parse(createTRFSchema, data);
    if (actor.role !== 'SUPER_ADMIN' && actor.employeeId !== input.employeeId) throw new HTTPException(403, { message: 'Karyawan tidak sesuai akun.' });
    const replay = async () => {
      const existing = idempotencyKey ? await repo.findByIdempotencyKey(db, input.employeeId, idempotencyKey) : undefined;
      return existing ? { trf: repo.trfDTO((await repo.findRow(db, existing.id))!), replayed: true } : undefined;
    };
    const earlier = await replay();
    if (earlier) return earlier;
    try {
      return await db.begin(async (tx) => {
        const employee = await repo.findEmployee(tx, input.employeeId);
        if (!employee) throw new HTTPException(400, { message: 'Karyawan tidak ditemukan.' });
        const row = await repo.insertRow(tx, input, employee.department,!!draft, idempotencyKey);
        await repo.writeHistory(tx, actor, row.id, null, row.status, draft ? 'Draft created' : 'TRF created and submitted');
        const created = (await repo.findRow(tx, row.id))!;
        if (!draft) await notifyNextApprovers(tx, created, actor, created.status);
        return { trf: repo.trfDTO(created), replayed: false };
      });
    } catch (error) {
      // Two requests with the same key raced; the loser returns the winner's TRF.
      const raced = error && typeof error === 'object' && 'constraint_name' in error
        && error.constraint_name === 'trfs_employee_idempotency_key_idx' ? await replay() : undefined;
      if (raced) return raced;
      throw error;
    }
  },
  change: async (actor: Actor, id: string, body: unknown, resubmit: boolean, expected: number) => db.begin(async (tx) => {
    const row = await repo.findRow(tx, id, true);
    if (!row) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    assertCanEdit(actor, row);
    assertVersion(row.version,expected);
    assertStatus(row.status, ['DRAFT', 'NEEDS_REVISION']);
    const patch = parse(trfPatchSchema, body);
    if (patch.employeeId && patch.employeeId !== row.employee_id) throw new HTTPException(403, { message: 'Pemilik TRF tidak boleh diubah.' });
    const current = repo.trfDTO(row);
    const input = parse(row.status==='DRAFT' && !resubmit ? draftTRFSchema : createTRFSchema, {
      employeeId: row.employee_id, travelPurpose: current.travelPurpose,
      startDate: current.startDate, endDate: current.endDate, purposeRemarks: current.purposeRemarks,
      purposeEntries: current.purposeEntries.length ? current.purposeEntries : undefined,
      accommodation: current.accommodation, accommodations: current.accommodations,
      travelArrangements: current.travelArrangements, lateSubmissionReason: current.lateSubmissionReason, ...patch,
    });
    const changed = await repo.changeRow(tx, row, input, resubmit);
    if (!changed) throw new HTTPException(409, { message: 'TRF berubah selama penyimpanan.' });
    await repo.writeHistory(tx, actor, id, row.status, changed.status,
      resubmit ? 'TRF revised and resubmitted by employee' : 'TRF edited by owner');
    if (resubmit) {
      await enqueueNotification(tx, row, actor, changed.status, 'TRF revised and resubmitted by employee', false);
      await notifyNextApprovers(tx, row, actor, changed.status);
    }
    return repo.trfDTO((await repo.findRow(tx, id))!);
  }),
  remove: async (actor: Actor, id: string, expected: number) => db.begin(async (tx) => {
    const row = await repo.findRow(tx, id, true);
    if (!row) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    assertCanEdit(actor,row);
    assertVersion(row.version,expected);
    // D9: visibility does not grant permission to delete another employee's draft.
    assertStatus(row.status, ['DRAFT']);
    const deleted = await repo.removeRow(tx, row);
    if (!deleted.length) throw new HTTPException(409, { message: 'TRF sudah berubah.' });
    return { id };
  }),
  cancel: async (actor: Actor, id: string, body: unknown, expected: number) => db.begin(async (tx) => {
    const row = await repo.findRow(tx,id,true);
    if (!row) throw new HTTPException(404,{message:'TRF tidak ditemukan.'});
    assertCanEdit(actor,row); assertVersion(row.version,expected);
    if (['GA_PROCESSED','REJECTED','CANCELLED'].includes(row.status)) throw new HTTPException(409,{message:'TRF tidak dapat dibatalkan.'});
    const { remarks } = parse(z.object({remarks:z.string().trim().min(1,'Alasan pembatalan wajib diisi.').max(4000)}).strict(),body);
    await tx`update public.trfs set status='CANCELLED' where id=${id} and version=${row.version} and status=${row.status}`;
    await repo.writeHistory(tx,actor,id,row.status,'CANCELLED',remarks);
    await enqueueNotification(tx,row,actor,'CANCELLED',remarks,false);
    await notifyOwner(tx,row,actor,remarks,`TRF ${row.trf_number} dibatalkan`);
    return repo.trfDTO((await repo.findRow(tx,id))!);
  }),
});
