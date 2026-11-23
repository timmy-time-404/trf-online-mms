import { createTRFSchema, trfPatchSchema } from '@trf/shared';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import type { Actor } from '../../middleware/auth.ts';
import type { openDatabase } from '../../db/connection.ts';
import { assertCanEdit, assertStatus, canSeeTRF } from './policy.ts';
import * as repo from './repository.ts';

function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues[0]?.message ?? 'Data TRF tidak valid.' });
  return result.data;
}
export const createTRFService = (db: ReturnType<typeof openDatabase>) => ({
  list: async (actor: Actor) => (await repo.listRows(db, actor)).map(repo.trfDTO),
  context: async (actor: Actor) => ({ employees: (await repo.formEmployees(db, actor)).map(repo.employeeDTO) }),
  detail: async (actor: Actor, id: string) => {
    const row = await repo.findRow(db, id);
    if (!row || !canSeeTRF(actor, row)) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    return repo.trfDTO(row);
  },
  create: async (actor: Actor, body: unknown) => {
    const input = parse(createTRFSchema, body);
    if (actor.role !== 'SUPER_ADMIN' && actor.employeeId !== input.employeeId) throw new HTTPException(403, { message: 'Karyawan tidak sesuai akun.' });
    return db.begin(async (tx) => {
      const employee = await repo.findEmployee(tx, input.employeeId);
      if (!employee) throw new HTTPException(400, { message: 'Karyawan tidak ditemukan.' });
      const row = await repo.insertRow(tx, input, employee.department);
      await repo.writeHistory(tx, actor, row.id, null, 'SUBMITTED', 'TRF created and submitted');
      return repo.trfDTO((await repo.findRow(tx, row.id))!);
    });
  },
  change: async (actor: Actor, id: string, body: unknown, resubmit: boolean) => db.begin(async (tx) => {
    const row = await repo.findRow(tx, id, true);
    if (!row) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    assertCanEdit(actor, row);
    assertStatus(row.status, resubmit ? ['NEEDS_REVISION'] : ['DRAFT', 'NEEDS_REVISION']);
    const patch = parse(trfPatchSchema, body);
    if (patch.employeeId && patch.employeeId !== row.employee_id) throw new HTTPException(403, { message: 'Pemilik TRF tidak boleh diubah.' });
    const current = repo.trfDTO(row);
    const input = parse(createTRFSchema, {
      employeeId: row.employee_id, travelPurpose: current.travelPurpose,
      startDate: current.startDate, endDate: current.endDate, purposeRemarks: current.purposeRemarks,
      purposeEntries: current.purposeEntries.length ? current.purposeEntries : undefined,
      accommodation: current.accommodation, accommodations: current.accommodations,
      travelArrangements: current.travelArrangements, ...patch,
    });
    const changed = await repo.changeRow(tx, row, input, resubmit);
    if (!changed) throw new HTTPException(409, { message: 'TRF berubah selama penyimpanan.' });
    await repo.writeHistory(tx, actor, id, row.status, changed.status,
      resubmit ? 'TRF revised and resubmitted by employee' : 'TRF edited by owner');
    return repo.trfDTO((await repo.findRow(tx, id))!);
  }),
  remove: async (actor: Actor, id: string) => db.begin(async (tx) => {
    const row = await repo.findRow(tx, id, true);
    if (!row) throw new HTTPException(404, { message: 'TRF tidak ditemukan.' });
    if (!canSeeTRF(actor, row)) throw new HTTPException(403, { message: 'Akses TRF ditolak.' });
    // The legacy delete action adds no role restriction beyond visible DRAFT requests.
    assertStatus(row.status, ['DRAFT']);
    const deleted = await repo.removeRow(tx, row);
    if (!deleted.length) throw new HTTPException(409, { message: 'TRF sudah berubah.' });
    return { id };
  }),
});
