import { isUrgent } from '@trf/shared';
export default function LateSubmissionField({start,value,onChange}: {start?:string;value:string;onChange:(value:string)=>void}) {
  if (!isUrgent(start) && !value) return null;
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
    <label htmlFor="late-submission-reason" className="block font-medium">Urgent (&lt; H-14) — alasan keterlambatan wajib</label>
    <textarea id="late-submission-reason" value={value} onChange={(e)=>onChange(e.target.value)} maxLength={4000}
      className="w-full rounded-md border p-3" rows={3} required />
  </div>;
}
