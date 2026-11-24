// D6/D7: shared department keys and WITA calendar dates (independent of host/browser timezone).
export const normalizeDepartment = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
export const businessDate = (instant = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(instant);
export function addDays(date: string, days: number) {
  const value = new Date(date + 'T00:00:00Z'); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0,10);
}
export function businessWeekStart(instant = new Date()) {
  const today = businessDate(instant), day = new Date(today + 'T00:00:00Z').getUTCDay();
  return addDays(today, day === 0 ? -6 : 1-day);
}
export const isUrgent = (start: string | null | undefined, today = businessDate()) => !!start && start < addDays(today,14);
