import type { DashboardRow } from './repository.ts';
const arrangements = (row: DashboardRow) => row.travel_arrangements ?? [];
export function dashboardStats(rows: DashboardRow[], today: string) {
  const result = { totalTravelIn: 0, totalTravelOut: 0, siteEntry: 0, onSiteActive: 0, daysInSite: 0 };
  for (const row of rows) {
    if (row.status !== 'GA_PROCESSED') continue;
    const travels = arrangements(row);
    if (travels.some((entry) => entry.travelType === 'TRAVEL_IN')) result.totalTravelIn++;
    if (travels.some((entry) => entry.travelType === 'TRAVEL_OUT')) result.totalTravelOut++;
    if (row.start_date && row.end_date && row.start_date <= today && row.end_date >= today) {
      result.onSiteActive++;
      result.daysInSite += Math.ceil(Math.max(0, Date.parse(row.end_date) - Date.parse(row.start_date)) / 86400000);
    }
  }
  return result;
}
export function weeklyTravel(rows: DashboardRow[], weekStart: string) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
    const date = new Date(weekStart + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10), travelIn = new Set<string>(), travelOut = new Set<string>();
    for (const row of rows) for (const entry of arrangements(row)) {
      if (entry.travelDate !== key) continue;
      if (entry.travelType === 'TRAVEL_IN') travelIn.add(row.id);
      if (entry.travelType === 'TRAVEL_OUT') travelOut.add(row.id);
    }
    return { day, travelIn: travelIn.size, travelOut: travelOut.size };
  });
}
