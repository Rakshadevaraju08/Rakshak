import type { Incident } from '../services/incidentService';

export type DateRangeKey = 'ALL' | '24H' | '7D' | '30D';

export type SortKey =
  | 'newest'
  | 'oldest'
  | 'priority-desc'
  | 'priority-asc'
  | 'status'
  | 'title';

export interface IncidentFilterCriteria {
  searchQuery?: string;
  statuses?: string[];
  priorities?: string[];
  types?: string[];
  dateRange?: DateRangeKey;
  sortKey?: SortKey;
}

export const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export const STATUS_RANK: Record<string, number> = {
  NEW: 3,
  ACTIVE: 2,
  RESOLVED: 1,
  UNKNOWN: 0,
};

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Status Unknown';
  const upper = status.trim().toUpperCase();
  if (upper === 'NEW') return 'New';
  if (upper === 'ACTIVE') return 'Active';
  if (upper === 'RESOLVED') return 'Resolved';
  return status;
}

export function formatPriorityLabel(priority: string | null | undefined): string {
  if (!priority) return 'Priority Unknown';
  const upper = priority.trim().toUpperCase();
  if (upper === 'CRITICAL') return 'Critical Priority';
  if (upper === 'HIGH') return 'High Priority';
  if (upper === 'MEDIUM') return 'Medium Priority';
  if (upper === 'LOW') return 'Low Priority';
  return `${priority} Priority`;
}

export function formatLocationCoordinates(incident: Incident): string {
  if (
    typeof incident.locationLat !== 'number' ||
    typeof incident.locationLng !== 'number' ||
    !Number.isFinite(incident.locationLat) ||
    !Number.isFinite(incident.locationLng)
  ) {
    return 'Location not provided';
  }
  return `${incident.locationLat.toFixed(5)}, ${incident.locationLng.toFixed(5)}`;
}

export function formatVictimSummary(incident: Incident): string {
  const info = incident.victimInformation;
  const count = typeof incident.victimCount === 'number' ? incident.victimCount : info?.total;
  const elderly = typeof incident.elderlyCount === 'number' ? incident.elderlyCount : info?.elderly;
  const children = typeof incident.childrenCount === 'number' ? incident.childrenCount : info?.children;
  const disabled = typeof incident.disabledCount === 'number' ? incident.disabledCount : info?.disabled;

  const parts: string[] = [];
  if (typeof count === 'number') parts.push(`${count} reported`);
  if (typeof elderly === 'number') parts.push(`${elderly} elderly`);
  if (typeof children === 'number') parts.push(`${children} ${children === 1 ? 'child' : 'children'}`);
  if (typeof disabled === 'number') parts.push(`${disabled} with disabilities`);

  return parts.length > 0 ? parts.join(' · ') : 'Victim information not reported';
}

export function formatRelativeTime(isoString?: string | null, referenceNow = Date.now()): string {
  if (!isoString) return 'Time not provided';
  const date = new Date(isoString);
  const time = date.getTime();
  if (Number.isNaN(time)) return isoString;

  const diffMs = referenceNow - time;
  // Future dates or less than 45 seconds ago
  if (diffMs < 45_000) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date(referenceNow).getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

export function formatAbsoluteTime(isoString?: string | null): string {
  if (!isoString) return 'Time not provided';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date);
}

/**
 * Case-insensitive search that matches across ID, title, type, description, location,
 * victim info, status, and priority, safely ignoring null fields and special characters.
 */
export function matchesSearch(incident: Incident, term: string): boolean {
  if (!term) return true;
  const clean = term.trim().toLowerCase();
  if (!clean) return true;

  const id = incident.id ? incident.id.toLowerCase() : '';
  const title = incident.title ? incident.title.toLowerCase() : '';
  const type = incident.type ? String(incident.type).toLowerCase() : '';
  const desc = incident.description ? incident.description.toLowerCase() : '';
  const loc = formatLocationCoordinates(incident).toLowerCase();
  const victims = formatVictimSummary(incident).toLowerCase();
  const status = incident.status ? String(incident.status).toLowerCase() : '';
  const priority = incident.priority ? String(incident.priority).toLowerCase() : '';

  return (
    id.includes(clean) ||
    title.includes(clean) ||
    type.includes(clean) ||
    desc.includes(clean) ||
    loc.includes(clean) ||
    victims.includes(clean) ||
    status.includes(clean) ||
    priority.includes(clean)
  );
}

export function matchesDateRange(
  isoString?: string | null,
  range: DateRangeKey = 'ALL',
  referenceNow = Date.now()
): boolean {
  if (range === 'ALL') return true;
  if (!isoString) return false;

  const date = new Date(isoString);
  const time = date.getTime();
  if (Number.isNaN(time)) return false;

  const windowMs: Record<Exclude<DateRangeKey, 'ALL'>, number> = {
    '24H': 24 * 3600 * 1000,
    '7D': 7 * 24 * 3600 * 1000,
    '30D': 30 * 24 * 3600 * 1000,
  };

  const maxAge = windowMs[range];
  return time >= referenceNow - maxAge;
}

export function compareIncidents(a: Incident, b: Incident, sortKey: SortKey): number {
  const getValidTime = (inc: Incident): number | null => {
    const raw = inc.timestamp || inc.createdAt;
    if (!raw) return null;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? null : time;
  };

  if (sortKey === 'newest') {
    const timeA = getValidTime(a);
    const timeB = getValidTime(b);
    // Invalid/missing timestamps sort last
    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeB - timeA;
  }

  if (sortKey === 'oldest') {
    const timeA = getValidTime(a);
    const timeB = getValidTime(b);
    // Invalid/missing timestamps sort last
    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeA - timeB;
  }

  if (sortKey === 'priority-desc') {
    const rankA = PRIORITY_RANK[String(a.priority).toUpperCase()] ?? 0;
    const rankB = PRIORITY_RANK[String(b.priority).toUpperCase()] ?? 0;
    if (rankB !== rankA) return rankB - rankA;

    // Tie-break with timestamp (newest first)
    const timeA = getValidTime(a);
    const timeB = getValidTime(b);
    if (timeA !== null && timeB !== null) return timeB - timeA;
    return 0;
  }

  if (sortKey === 'priority-asc') {
    const rankA = PRIORITY_RANK[String(a.priority).toUpperCase()] ?? 0;
    const rankB = PRIORITY_RANK[String(b.priority).toUpperCase()] ?? 0;
    if (rankA !== rankB) return rankA - rankB;

    const timeA = getValidTime(a);
    const timeB = getValidTime(b);
    if (timeA !== null && timeB !== null) return timeA - timeB;
    return 0;
  }

  if (sortKey === 'status') {
    const rankA = STATUS_RANK[String(a.status).toUpperCase()] ?? 0;
    const rankB = STATUS_RANK[String(b.status).toUpperCase()] ?? 0;
    if (rankB !== rankA) return rankB - rankA;

    const timeA = getValidTime(a);
    const timeB = getValidTime(b);
    if (timeA !== null && timeB !== null) return timeB - timeA;
    return 0;
  }

  if (sortKey === 'title') {
    return a.title.localeCompare(b.title);
  }

  return 0;
}

export function filterAndSortIncidents(
  incidents: Incident[],
  criteria: IncidentFilterCriteria,
  referenceNow = Date.now()
): Incident[] {
  const {
    searchQuery = '',
    statuses = [],
    priorities = [],
    types = [],
    dateRange = 'ALL',
    sortKey = 'newest',
  } = criteria;

  const filtered = incidents.filter(incident => {
    // 1. Search matching
    if (!matchesSearch(incident, searchQuery)) return false;

    // 2. Status matching (multi-select)
    if (statuses.length > 0) {
      const match = statuses.some(
        s => String(s).toUpperCase() === String(incident.status).toUpperCase()
      );
      if (!match) return false;
    }

    // 3. Priority matching (multi-select)
    if (priorities.length > 0) {
      const match = priorities.some(
        p => String(p).toUpperCase() === String(incident.priority).toUpperCase()
      );
      if (!match) return false;
    }

    // 4. Incident Type matching (multi-select)
    if (types.length > 0) {
      const match = types.some(
        t => String(t).toUpperCase() === String(incident.type).toUpperCase()
      );
      if (!match) return false;
    }

    // 5. Date range matching
    if (!matchesDateRange(incident.timestamp || incident.createdAt, dateRange, referenceNow)) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => compareIncidents(a, b, sortKey));
}

