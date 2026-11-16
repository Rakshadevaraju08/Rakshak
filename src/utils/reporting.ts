import type { Incident } from '../services/incidentService';

export interface IncidentReportFilters {
  status: string;
  category: string;
  startDate: string;
  endDate: string;
}

export interface IncidentTrendPoint {
  date: string;
  label: string;
  count: number;
}

function dateInputBoundary(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

export function filterIncidentReports(
  incidents: Incident[],
  filters: IncidentReportFilters,
): Incident[] {
  const start = dateInputBoundary(filters.startDate, false);
  const end = dateInputBoundary(filters.endDate, true);

  return incidents.filter(incident => {
    if (filters.status && incident.status !== filters.status) return false;
    if (filters.category && incident.type !== filters.category) return false;
    if (start === null && end === null) return true;

    const createdAt = incident.createdAt ? Date.parse(incident.createdAt) : Number.NaN;
    if (!Number.isFinite(createdAt)) return false;
    if (start !== null && (!Number.isFinite(start) || createdAt < start)) return false;
    if (end !== null && (!Number.isFinite(end) || createdAt > end)) return false;
    return true;
  });
}

export function getIncidentStatusCounts(incidents: Incident[]): Map<string, number> {
  const counts = new Map<string, number>();
  incidents.forEach(incident => {
    const status = incident.status?.trim() || 'Status not provided';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return counts;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getIncidentTrend(
  incidents: Incident[],
  now = new Date(),
): IncidentTrendPoint[] {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return getIncidentTrendForRange(incidents, localDateKey(firstDay), localDateKey(lastDay));
}

export function getIncidentTrendForRange(
  incidents: Incident[],
  startDate: string,
  endDate: string,
): IncidentTrendPoint[] {
  const firstDay = new Date(`${startDate}T00:00:00`);
  const lastDay = new Date(`${endDate}T00:00:00`);
  if (
    !startDate ||
    !endDate ||
    Number.isNaN(firstDay.getTime()) ||
    Number.isNaN(lastDay.getTime()) ||
    firstDay > lastDay
  ) {
    return [];
  }

  const buckets = new Map<string, number>();
  for (
    let day = firstDay;
    day <= lastDay;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    buckets.set(localDateKey(day), 0);
  }

  incidents.forEach(incident => {
    if (!incident.createdAt) return;
    const date = new Date(incident.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = localDateKey(date);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  return [...buckets.entries()].map(([date, count]) => {
    const parsedDate = new Date(`${date}T00:00:00`);
    return {
      date,
      label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsedDate),
      count,
    };
  });
}
