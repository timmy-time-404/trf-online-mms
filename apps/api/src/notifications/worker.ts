import type { Database } from '../http.ts';
import { normalizeIndonesianPhone, renderOutbox, type OutboxRow, type OutgoingMessage } from './render.ts';

export type SendWhatsApp = (target: string, message: OutgoingMessage) => Promise<void>;

/** Fonnte REST API; the token never leaves the server (ADR-0008). */
export const fonnteSender = (token: string): SendWhatsApp => async (target, message) => {
  const form = new FormData();
  form.append('target', target);
  form.append('message', message.text);
  form.append('countryCode', '62');
  if (message.fileUrl) form.append('url', message.fileUrl);
  if (message.fileName) form.append('filename', message.fileName);
  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST', headers: { Authorization: token }, body: form, signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({})) as { status?: boolean; reason?: string };
  if (!response.ok || body.status === false) throw new Error(body.reason ?? `Fonnte HTTP ${response.status}`);
};

export interface WorkerOptions {
  send: SendWhatsApp;
  /** Normalized numbers allowed to receive messages; empty set blocks everyone. */
  allowlist: Set<string>;
  documentLink: (trfId: string, key: string) => string;
  batchSize?: number;
  maxAttempts?: number;
}

const LEASE_MINUTES = 10;
const backoffMinutes = (attempts: number) => Math.min(60, 2 ** attempts);

/**
 * Claims due rows with a short lease (FOR UPDATE SKIP LOCKED), sends outside the
 * transaction, then records the outcome. Delivery is at-least-once.
 */
export async function deliverDue(db: Database, options: WorkerOptions) {
  const { send, allowlist, documentLink, batchSize = 10, maxAttempts = 5 } = options;
  const rows = await db.begin(async (tx) => {
    const due = await tx<OutboxRow[]>`select id,trf_id,early_recall_id,recipient_phone,template_key,payload,attempts
      from public.notification_outbox where status='PENDING' and next_attempt_at<=now()
      order by next_attempt_at,id limit ${batchSize} for update skip locked`;
    if (due.length) await tx`update public.notification_outbox
      set next_attempt_at=now()+make_interval(mins => ${LEASE_MINUTES}) where id in ${tx(due.map((r) => r.id))}`;
    return due;
  });
  const summary = { sent: 0, skipped: 0, retried: 0, failed: 0 };
  for (const row of rows) {
    const target = normalizeIndonesianPhone(row.recipient_phone);
    const skip = !target ? 'Nomor HP tidak tersedia atau tidak valid.'
      : !allowlist.has(target) ? 'Nomor di luar allowlist pengembangan.' : null;
    if (skip) {
      await db`update public.notification_outbox set status='SKIPPED', last_error=${skip} where id=${row.id}`;
      summary.skipped++;
      continue;
    }
    try {
      const [trf] = row.trf_id ? await db<{ ga_documents: Record<string, unknown> | null }[]>`
        select ga_documents from public.trfs where id=${row.trf_id}` : [];
      for (const message of renderOutbox(row, trf?.ga_documents ?? null, documentLink)) await send(target!, message);
      await db`update public.notification_outbox set status='SENT', sent_at=now(), attempts=attempts+1, last_error=null
        where id=${row.id}`;
      summary.sent++;
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
      if (attempts >= maxAttempts) {
        await db`update public.notification_outbox set status='FAILED', attempts=${attempts}, last_error=${message} where id=${row.id}`;
        summary.failed++;
      } else {
        await db`update public.notification_outbox set attempts=${attempts}, last_error=${message},
          next_attempt_at=now()+make_interval(mins => ${backoffMinutes(attempts)}) where id=${row.id}`;
        summary.retried++;
      }
    }
  }
  return summary;
}

export function startOutboxWorker(db: Database, options: WorkerOptions, intervalMs = 15_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await deliverDue(db, options);
      if (result.sent + result.skipped + result.retried + result.failed > 0) console.log('WhatsApp outbox', result);
    } catch (error) {
      console.error('WhatsApp outbox tick failed.', error instanceof Error ? error.name : error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
