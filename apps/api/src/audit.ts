import type postgres from 'postgres';
import type { Actor } from './middleware/auth.ts';

export type AuditEntity = 'USER' | 'EMPLOYEE' | 'HOTEL';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'ENABLE' | 'DELETE';
type Json = Record<string, unknown> | null | undefined;

/**
 * Appends one row to `admin_audit` inside the caller's transaction, so a change and its
 * audit record commit or roll back together. The runtime role can only INSERT here.
 */
export const writeAdminAudit = (tx: postgres.TransactionSql, actor: Actor, entity: AuditEntity,
  entityId: string, action: AuditAction, before: Json, after: Json) => tx`
  insert into public.admin_audit(actor_user_id,entity,entity_id,action,before_data,after_data)
  values (${actor.id},${entity},${entityId},${action},
    ${before ? tx.json(before as postgres.JSONValue) : null},${after ? tx.json(after as postgres.JSONValue) : null})`;
