import {
  buildEarlyRecallWaMessage, buildTrfStatusWaMessage,
  type EarlyRecallWAMessageParams, type TrfStatus,
} from '@trf/shared';

/** One WhatsApp message; documents are sent as separate messages, like the legacy app. */
export interface OutgoingMessage { text: string; fileUrl?: string; fileName?: string }

export interface OutboxRow {
  id: string;
  trf_id: string | null;
  early_recall_id: string | null;
  recipient_phone: string | null;
  template_key: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/** Same rules as the legacy browser helper: 0812… / 812… / +62812… become 62812…. */
export function normalizeIndonesianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('0')) cleaned = `62${cleaned.slice(1)}`;
  else if (!cleaned.startsWith('62')) cleaned = `62${cleaned}`;
  return /^62\d{8,13}$/.test(cleaned) ? cleaned : null;
}

const DOCUMENT_LABELS: Record<string, string> = {
  hotelVoucher: 'Hotel Voucher', flightTicket: 'Flight Ticket', shipTicket: 'Ship Ticket',
};

type Json = Record<string, unknown>;
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0) || 0);

function earlyRecallParams(event: string, recall: Json, remarks: string): EarlyRecallWAMessageParams | null {
  const employee = (recall.employee ?? {}) as Json;
  const base = { employeeName: text(employee.employee_name) || 'Karyawan',
    employeeCode: text(employee.employee_code) || undefined, recallNumber: text(recall.recall_number) || undefined };
  const trf = (recall.linked_trf ?? {}) as Json;
  const arrangement = (Array.isArray(trf.travel_arrangements) ? trf.travel_arrangements[0] ?? {} : {}) as Json;
  switch (event) {
    case 'EARLY_RECALL_APPROVED':
      return { ...base, event, plannedReturnDate: text(recall.proposed_return_date), reason: text(recall.reason) };
    case 'EARLY_RECALL_TRAVEL_BOOKED':
      return { ...base, event, travelDate: text(arrangement.travelDate) || text(trf.start_date),
        transportation: text(arrangement.transportation) || '-', origin: text(arrangement.fromLocation) || undefined,
        destination: text(arrangement.toLocation) || undefined, trfNumber: text(trf.trf_number) || undefined,
        remarks: remarks || undefined };
    case 'EARLY_RECALL_CANCELLED':
      return { ...base, event, cancellationReason: text(recall.cancellation_reason) || remarks || '-' };
    case 'EARLY_RECALL_RETURN_CONFIRMED':
      return { ...base, event, actualReturnDate: text(recall.actual_return_date), remarks: remarks || undefined };
    case 'EARLY_RECALL_OS_GENERATED':
      return { ...base, event, approvedLeaveDays: num(recall.approved_leave_days),
        actualLeaveDays: num(recall.actual_leave_days_used), osGeneratedDays: num(recall.os_generated_days),
        cycleNumber: num(((recall.os_ledger ?? {}) as Json).cycle_number) };
    default:
      return null;
  }
}

/**
 * Builds the messages for one outbox row. `documentLink` turns a stored GA document
 * into a signed, expiring URL that Fonnte can fetch.
 */
export function renderOutbox(row: OutboxRow, gaDocuments: Json | null,
  documentLink: (trfId: string, key: string) => string): OutgoingMessage[] {
  const p = row.payload;
  if (row.template_key === 'TRF_STATUS_CHANGED' || row.template_key === 'TRF_EDITED') {
    const messages: OutgoingMessage[] = [{ text: buildTrfStatusWaMessage({
      trfNumber: text(p.trfNumber), employeeName: text(p.employeeName) || 'Karyawan',
      newStatus: text(p.newStatus) as TrfStatus, actorName: text(p.actorName),
      remarks: text(p.remarks) || undefined, editedOnly: p.editedOnly === true,
    }) }];
    if (p.newStatus === 'GA_PROCESSED' && row.trf_id && gaDocuments) {
      for (const [key, doc] of Object.entries(gaDocuments)) {
        if (!doc || typeof doc !== 'object' || !('path' in doc)) continue;
        const label = DOCUMENT_LABELS[key] ?? key;
        messages.push({
          text: `Halo ${text(p.employeeName) || 'Karyawan'},\n\nBerikut *${label}* untuk TRF *${text(p.trfNumber)}* kamu.\n\n_Pesan otomatis dari TRF Online MMS._`,
          fileUrl: documentLink(row.trf_id, key), fileName: text((doc as Json).name) || `${label}.pdf`,
        });
      }
    }
    return messages;
  }
  const params = earlyRecallParams(row.template_key, (p.recall ?? {}) as Json, text(p.remarks));
  return params ? [{ text: buildEarlyRecallWaMessage(params) }] : [];
}
