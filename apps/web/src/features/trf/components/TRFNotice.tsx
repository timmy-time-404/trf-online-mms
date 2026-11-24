import type { TRF } from '@/types';
import { isUrgent } from '@trf/shared';
export default function TRFNotice({trf}: {trf: TRF}) {
  return <span className="block space-y-1 text-sm">
    {(trf.urgent ?? isUrgent(trf.purposeEntries?.[0]?.startDate ?? trf.startDate)) && <span className="block font-semibold text-amber-800">Urgent (&lt; H-14)</span>}
    {trf.lateSubmissionReason && <span className="block text-gray-700">Alasan keterlambatan: {trf.lateSubmissionReason}</span>}
    {trf.blockedBy && <span className="block text-red-700">Tertahan: approver {trf.blockedBy} aktif belum tersedia.</span>}
  </span>;
}
