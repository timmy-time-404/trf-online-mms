import type postgres from 'postgres';
import type { CreateTRF } from '@trf/shared';
import type { Actor } from '../../middleware/auth.ts';
export type Connection = postgres.Sql | postgres.TransactionSql;
export interface TrfRow extends postgres.Row {
  id: string; employee_id: string; department: string | null; status: string;
  travel_purpose: string; start_date: string; end_date: string; purpose_remarks: string | null;
}

const visibility = (sql: Connection, actor: Actor) => {
  if (actor.role === 'EMPLOYEE') return sql`t.employee_id=${actor.employeeId}`;
  if (actor.role === 'ADMIN_DEPT' || actor.role === 'HOD') {
    const department = actor.department?.trim().toLowerCase() ?? '';
    return sql`${department}<>'' and lower(btrim(t.department))=${department}`;
  }
  return sql`true`;
};
export const listRows = (sql: Connection, actor: Actor) => sql<TrfRow[]>`
  select t.*,t.start_date::text,t.end_date::text,to_jsonb(e) as employee
  from public.trfs t left join public.employees e on e.id=t.employee_id
  where ${visibility(sql, actor)} order by t.created_at desc,t.id`;
export const findRow = async (sql: Connection, id: string, lock = false) => {
  const [row] = await sql<TrfRow[]>`select t.*,t.start_date::text,t.end_date::text,to_jsonb(e) as employee
    from public.trfs t left join public.employees e on e.id=t.employee_id where t.id=${id}
    ${lock ? sql`for update of t` : sql``}`;
  return row;
};
export const findEmployee = async (sql: Connection, id: string) => {
  const [row] = await sql`select * from public.employees where id=${id}`;
  return row;
};
export const formEmployees = (sql: Connection, actor: Actor) => sql`
  select * from public.employees where is_active=true
    and (${actor.role === 'SUPER_ADMIN'} or id=${actor.employeeId}) order by employee_name`;
const fields = (sql: Connection, input: CreateTRF) => ({
  travel_purpose: input.travelPurpose, start_date: input.startDate, end_date: input.endDate,
  purpose_remarks: input.purposeRemarks ?? null,
  purpose_entries: sql.json(input.purposeEntries ?? []),
  accommodation: input.accommodation ? sql.json(input.accommodation) : null,
  accommodations: sql.json(input.accommodations ?? []), travel_arrangements: sql.json(input.travelArrangements),
});
export const insertRow = async (sql: Connection, input: CreateTRF, department: string) => {
  const [row] = await sql<TrfRow[]>`insert into public.trfs ${sql({ ...fields(sql, input),
    employee_id: input.employeeId, department, status: 'SUBMITTED', submitted_at: new Date() })} returning *`;
  return row!;
};
export const changeRow = async (sql: Connection, row: TrfRow, input: CreateTRF, resubmit: boolean) => {
  const payload = { ...fields(sql, input), updated_at: new Date(),
    ...(resubmit ? { status: 'SUBMITTED', submitted_at: new Date() } : {}) };
  const [changed] = await sql<TrfRow[]>`update public.trfs set ${sql(payload)}
    where id=${row.id} and status=${row.status} and employee_id=${row.employee_id} returning *`;
  return changed;
};
export const removeRow = (sql: Connection, row: TrfRow) => sql`delete from public.trfs
  where id=${row.id} and status='DRAFT' returning id`;
export const writeHistory = (sql: Connection, actor: Actor, id: string, oldStatus: string | null, newStatus: string, remarks: string) =>
  sql`insert into public.status_history(trf_id,changed_by,changed_by_name,old_status,new_status,remarks)
    values (${id},${actor.id},${actor.displayName},${oldStatus},${newStatus},${remarks})`;

export function employeeDTO(row: postgres.Row) {
  return { id: row.id, userId: row.user_id ?? undefined, employeeCode: row.employee_code,
    employeeName: row.employee_name, employeeType: row.employee_type ?? 'EMPLOYEE',
    department: row.department, jobTitle: row.job_title ?? '-', section: row.section ?? '-',
    email: row.email ?? '', phone: row.phone ?? '', pointOfHire: row.point_of_hire ?? '-',
    dateOfHire: row.join_date, employeeLevel: row.employee_level ?? undefined };
}
export function trfDTO(row: TrfRow) {
  return { id: row.id, trfNumber: row.trf_number, employeeId: row.employee_id,
    employee: row.employee ? employeeDTO(row.employee) : undefined, department: row.department,
    travelPurpose: row.travel_purpose, startDate: row.start_date, endDate: row.end_date,
    purposeRemarks: row.purpose_remarks ?? undefined, status: row.status,
    purposeEntries: row.purpose_entries ?? [], accommodations: row.accommodations ?? [],
    accommodation: row.accommodation ?? undefined, travelArrangements: row.travel_arrangements ?? [],
    adminDeptVerify: row.admin_dept_verify ?? undefined, parallelApproval: row.parallel_approval ?? undefined,
    pmApproval: row.pm_approval ?? undefined, gaProcess: row.ga_process ?? undefined,
    gaDocuments: row.ga_documents ?? {}, lumpsumAmount: row.lumpsum_amount == null ? undefined : Number(row.lumpsum_amount),
    lumpsumCurrency: row.lumpsum_currency ?? undefined, lumpsumNote: row.lumpsum_note ?? undefined,
    lumpsumInputBy: row.lumpsum_input_by ?? undefined, lumpsumInputAt: row.lumpsum_input_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}
