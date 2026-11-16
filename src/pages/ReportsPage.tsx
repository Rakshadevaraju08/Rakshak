import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  LoaderCircle,
  Radio,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  fetchResources,
  isJsonRecord,
  subscribeOperationalEvents,
  type Incident,
  type OperationalEvent,
  type OperationalEventConnection,
  type OperationalEventType,
  type Resource,
} from '../services/api';
import { useIncidents } from '../hooks/useIncidents';
import {
  formatAbsoluteTime,
  formatLocationCoordinates,
  formatRelativeTime,
  formatStatusLabel,
} from '../utils/incidentFilters';
import {
  filterIncidentReports,
  getIncidentStatusCounts,
  getIncidentTrendForRange,
  type IncidentReportFilters,
} from '../utils/reporting';

interface ReceivedEvent extends OperationalEvent {
  key: number;
}

interface ActivityRecord {
  key: string;
  title: string;
  description: string;
  timestamp: string | null;
  incidentId?: string;
  kind: 'incident' | 'resource' | 'event';
}

interface OperationalAlert {
  key: number;
  title: string;
  description: string;
  timestamp: string | null;
  incidentId: string | null;
}

type ActivityRange = '7d' | '30d' | 'custom';

interface DateInputRange {
  startDate: string;
  endDate: string;
}

const EVENT_TITLES: Record<OperationalEventType, string> = {
  SOS_RECEIVED: 'Emergency SOS received',
  INCIDENT_UPDATED: 'Incident updated',
  INCIDENT_REPORT_RECEIVED: 'Incident report received',
  INCIDENT_RESOLVED: 'Incident resolved',
  RESOURCE_AVAILABLE: 'Resource available',
  RESOURCE_UNAVAILABLE: 'Resource unavailable',
  HOSPITAL_CAPACITY_CHANGED: 'Hospital capacity changed',
  HOSPITAL_FULL: 'Hospital reported full',
  ROAD_BLOCKED: 'Road blocked',
  ROAD_UPDATED: 'Road updated',
  DISPATCH_PLANNED: 'Dispatch planned',
  DISPATCH_APPROVED: 'Dispatch approved',
  PREDICTION_UPDATED: 'Incident prediction updated',
  WEATHER_CHANGED: 'Weather observation received',
  WATER_LEVEL_CHANGED: 'Water-level observation received',
  MESH_MESSAGE_RECEIVED: 'Mesh message received',
  DISPATCH_PLAN_UPDATED: 'Dispatch plan updated',
  DISPATCH_EXECUTED: 'Dispatch executed',
};

function getString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getIncidentId(payload: Record<string, unknown> | null): string | undefined {
  const directId = getString(payload, 'incidentId');
  if (directId) return directId;
  const incident = payload?.incident;
  return isJsonRecord(incident) ? getString(incident, 'id') ?? undefined : undefined;
}

function statusSlug(status: string): string {
  const slug = status.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return ['new', 'active', 'resolved'].includes(slug) ? slug : 'unknown';
}

function describeEvent(event: ReceivedEvent): string {
  const payload = isJsonRecord(event.payload) ? event.payload : null;
  const status = getString(payload, 'status');
  const name = getString(payload, 'name') || getString(payload, 'title');
  const incidentId = getIncidentId(payload);

  switch (event.type) {
    case 'SOS_RECEIVED':
      return name || 'A new emergency was added to the incident queue.';
    case 'INCIDENT_UPDATED':
      return [name || incidentId, status ? `Status: ${formatStatusLabel(status)}` : null].filter(Boolean).join(' · ')
        || 'Incident details were updated.';
    case 'INCIDENT_REPORT_RECEIVED':
      return getString(payload, 'content') || `A follow-up report was received${incidentId ? ` for incident ${incidentId}` : ''}.`;
    case 'INCIDENT_RESOLVED': {
      const incident = isJsonRecord(payload?.incident) ? payload.incident : null;
      return getString(incident, 'title') || incidentId || 'An incident was resolved.';
    }
    case 'RESOURCE_AVAILABLE':
    case 'RESOURCE_UNAVAILABLE':
      return [name, status ? `Status: ${formatStatusLabel(status)}` : null].filter(Boolean).join(' · ')
        || 'Resource status changed.';
    case 'HOSPITAL_FULL':
    case 'HOSPITAL_CAPACITY_CHANGED':
      return getString(payload, 'hospitalId') || 'Hospital capacity was updated.';
    case 'ROAD_BLOCKED':
    case 'ROAD_UPDATED':
      return [name, status ? `Status: ${formatStatusLabel(status)}` : null].filter(Boolean).join(' · ')
        || 'Road status changed.';
    case 'DISPATCH_PLANNED':
    case 'DISPATCH_APPROVED':
      return [incidentId, status ? `Status: ${status}` : null].filter(Boolean).join(' · ')
        || 'A dispatch plan was updated.';
    case 'PREDICTION_UPDATED': {
      const risk = typeof payload?.predictedRisk === 'number' ? `Risk score: ${payload.predictedRisk}` : null;
      const worsening = typeof payload?.predictedWorsening === 'boolean'
        ? `Worsening predicted: ${payload.predictedWorsening ? 'Yes' : 'No'}`
        : null;
      return [incidentId, risk, worsening].filter(Boolean).join(' · ') || 'A prediction record was updated.';
    }
    case 'WEATHER_CHANGED':
      return typeof payload?.rainfallMm === 'number'
        ? `Reported rainfall: ${payload.rainfallMm} mm`
        : 'A weather observation was received.';
    case 'WATER_LEVEL_CHANGED':
      return typeof payload?.levelMeters === 'number'
        ? `Reported water level: ${payload.levelMeters} m`
        : 'A water-level observation was received.';
    case 'MESH_MESSAGE_RECEIVED':
      return getString(payload, 'senderId') || 'A field mesh message was received.';
  }
}

function getOperationalAlert(event: ReceivedEvent): OperationalAlert | null {
  const payload = isJsonRecord(event.payload) ? event.payload : null;
  const incidentId = getIncidentId(payload) ?? null;

  if (event.type === 'HOSPITAL_FULL') {
    const hospitalId = getString(payload, 'hospitalId');
    return {
      key: event.key,
      title: EVENT_TITLES[event.type],
      description: hospitalId
        ? `Hospital ${hospitalId} reported no available beds.`
        : 'A hospital reported that it has no available beds.',
      timestamp: event.occurredAt,
      incidentId,
    };
  }

  if (event.type === 'ROAD_BLOCKED') {
    const roadName = getString(payload, 'name');
    return {
      key: event.key,
      title: EVENT_TITLES[event.type],
      description: roadName ? `${roadName} was reported blocked.` : 'A road was reported blocked.',
      timestamp: event.occurredAt,
      incidentId,
    };
  }

  if (event.type === 'RESOURCE_UNAVAILABLE') {
    const resourceName = getString(payload, 'name');
    const status = getString(payload, 'status');
    return {
      key: event.key,
      title: EVENT_TITLES[event.type],
      description: [
        resourceName || 'A response resource',
        status ? `reported status ${formatStatusLabel(status)}` : 'is no longer available',
      ].join(' '),
      timestamp: event.occurredAt,
      incidentId,
    };
  }

  return null;
}

function makeActivityRecords(
  incidents: Incident[],
  resources: Resource[],
  events: ReceivedEvent[],
): ActivityRecord[] {
  const incidentActivity = incidents.flatMap((incident): ActivityRecord[] => {
    const timestamp = incident.updatedAt || incident.createdAt;
    if (!timestamp) return [];
    const updated = Boolean(
      incident.updatedAt &&
      incident.createdAt &&
      Date.parse(incident.updatedAt) > Date.parse(incident.createdAt),
    );
    return [{
      key: `incident-${incident.id}`,
      title: updated ? 'Incident record updated' : 'Incident logged',
      description: [incident.title, formatStatusLabel(incident.status)].join(' · '),
      timestamp,
      incidentId: incident.id,
      kind: 'incident',
    }];
  });

  const resourceActivity = resources.flatMap((resource): ActivityRecord[] => {
    const timestamp = resource.updatedAt || resource.createdAt;
    if (!timestamp) return [];
    const updated = Boolean(
      resource.updatedAt &&
      resource.createdAt &&
      Date.parse(resource.updatedAt) > Date.parse(resource.createdAt),
    );
    return [{
      key: `resource-${resource.id}`,
      title: updated ? 'Resource record updated' : 'Resource registered',
      description: [resource.name, resource.status ? formatStatusLabel(resource.status) : null]
        .filter(Boolean)
        .join(' · '),
      timestamp,
      kind: 'resource',
    }];
  });

  const eventActivity = events.map(event => ({
    key: `event-${event.key}`,
    title: EVENT_TITLES[event.type],
    description: describeEvent(event),
    timestamp: event.occurredAt,
    incidentId: getIncidentId(isJsonRecord(event.payload) ? event.payload : null),
    kind: 'event' as const,
  }));

  return [...incidentActivity, ...resourceActivity, ...eventActivity]
    .sort((left, right) => {
      const leftTime = left.timestamp ? Date.parse(left.timestamp) : Number.NaN;
      const rightTime = right.timestamp ? Date.parse(right.timestamp) : Number.NaN;
      if (!Number.isFinite(leftTime)) return Number.isFinite(rightTime) ? 1 : 0;
      if (!Number.isFinite(rightTime)) return -1;
      return rightTime - leftTime;
    })
    .slice(0, 10);
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getActivityDateRange(range: Exclude<ActivityRange, 'custom'>, now = new Date()): DateInputRange {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const numberOfDays = range === '7d' ? 7 : 30;
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - numberOfDays + 1);
  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
}

function ReportsPage() {
  const {
    data: incidents,
    loading: incidentsLoading,
    error: incidentsError,
    refetch: refetchIncidents,
  } = useIncidents();
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [events, setEvents] = useState<ReceivedEvent[]>([]);
  const [eventConnection, setEventConnection] = useState<OperationalEventConnection>('connecting');
  const eventSequence = useRef(0);
  const [filters, setFilters] = useState<IncidentReportFilters>({
    status: '',
    category: '',
    startDate: '',
    endDate: '',
  });
  const [activityRange, setActivityRange] = useState<ActivityRange>('7d');
  const [customActivityRange, setCustomActivityRange] = useState<DateInputRange>(
    () => getActivityDateRange('7d'),
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResourcesLoading(true);
    setResourcesError(null);
    void fetchResources({ signal: controller.signal })
      .then(data => {
        if (active) setResources(data);
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setResourcesError(error instanceof Error ? error.message : 'Could not load resource records.');
        }
      })
      .finally(() => {
        if (active) setResourcesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey]);

  useEffect(() => subscribeOperationalEvents(
    event => {
      eventSequence.current += 1;
      const received = { ...event, key: eventSequence.current };
      setEvents(previous => [received, ...previous].slice(0, 30));
    },
    setEventConnection,
  ), []);

  const filteredIncidents = useMemo(
    () => filterIncidentReports(incidents, filters),
    [filters, incidents],
  );
  const statuses = useMemo(
    () => [...new Set(incidents.map(incident => incident.status).filter(Boolean))].sort(),
    [incidents],
  );
  const categories = useMemo(
    () => [...new Set(incidents.map(incident => incident.type).filter(Boolean))].sort(),
    [incidents],
  );
  const statusCounts = useMemo(() => getIncidentStatusCounts(incidents), [incidents]);
  const activityDateRange = useMemo(
    () => activityRange === 'custom' ? customActivityRange : getActivityDateRange(activityRange),
    [activityRange, customActivityRange],
  );
  const isActivityRangeValid = Boolean(
    activityDateRange.startDate &&
    activityDateRange.endDate &&
    activityDateRange.startDate <= activityDateRange.endDate,
  );
  const trend = useMemo(
    () => isActivityRangeValid
      ? getIncidentTrendForRange(incidents, activityDateRange.startDate, activityDateRange.endDate)
      : [],
    [activityDateRange, incidents, isActivityRangeValid],
  );
  const trendMaximum = Math.max(1, ...trend.map(point => point.count));
  const activity = useMemo(
    () => makeActivityRecords(incidents, resources, events),
    [events, incidents, resources],
  );
  const alerts = useMemo(
    () => events.flatMap(event => {
      const alert = getOperationalAlert(event);
      return alert ? [alert] : [];
    }),
    [events],
  );
  const newCount = incidents.filter(incident => incident.status === 'NEW').length;
  const activeCount = incidents.filter(incident => incident.status === 'ACTIVE').length;
  const resolvedCount = incidents.filter(incident => incident.status === 'RESOLVED').length;
  const isRefreshing = incidentsLoading || resourcesLoading;
  const incidentDataUnavailable = Boolean(incidentsError && incidents.length === 0);
  const resourceDataUnavailable = Boolean(resourcesError && resources.length === 0);

  const refresh = () => {
    void refetchIncidents();
    setRefreshKey(key => key + 1);
  };
  const updateFilter = (key: keyof IncidentReportFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
  };
  const clearFilters = () => setFilters({ status: '', category: '', startDate: '', endDate: '' });
  const hasFilters = Object.values(filters).some(Boolean);
  const toggleStatusFilter = (status: string) => {
    setFilters(current => ({ ...current, status: current.status === status ? '' : status }));
  };

  return (
    <div className="reports-page">
      <div className="page-heading reports-page-heading">
        <div>
          <div className="eyebrow"><span /> REPORTS & MONITORING</div>
          <h1>Reports & operations</h1>
          <p>Review incident trends and monitor the latest operational records and live system events.</p>
        </div>
        <button className="secondary-button" type="button" onClick={refresh} disabled={isRefreshing}>
          {isRefreshing ? <LoaderCircle size={14} className="is-spinning" /> : <RefreshCw size={14} />}
          Refresh data
        </button>
      </div>

      {incidentsError && (
        <div className="reports-error" role="alert">
          <AlertTriangle size={17} />
          <div><strong>Incident data could not be loaded</strong><p>{incidentsError}</p></div>
          <button type="button" className="text-button" onClick={() => { void refetchIncidents(); }}>Try again</button>
        </div>
      )}
      {resourcesError && (
        <div className="reports-error" role="alert">
          <AlertTriangle size={17} />
          <div><strong>Resource updates are unavailable</strong><p>{resourcesError}</p></div>
          <button type="button" className="text-button" onClick={() => setRefreshKey(key => key + 1)}>Try again</button>
        </div>
      )}

      <section className="reports-stats" aria-label="Incident summary" aria-busy={incidentsLoading}>
        {[
          { label: 'Total incidents', count: incidents.length, tone: 'total' },
          { label: 'New', count: newCount, tone: 'new' },
          { label: 'Active', count: activeCount, tone: 'active' },
          { label: 'Resolved', count: resolvedCount, tone: 'resolved' },
        ].map(stat => (
          <article className={`overview-stat overview-stat-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{incidentsLoading || incidentDataUnavailable ? '—' : stat.count}</strong>
          </article>
        ))}
      </section>

      <div className="reports-summary-grid">
        <section className="overview-panel reports-chart-panel" aria-labelledby="reports-trend-title">
          <div className="overview-panel-heading">
            <div>
              <h2 id="reports-trend-title">Incident activity</h2>
              <p>Incident records created per day in the selected date range.</p>
            </div>
          </div>
          <div className="reports-range-controls" role="group" aria-label="Incident activity date range">
            <button type="button" aria-pressed={activityRange === '7d'} onClick={() => setActivityRange('7d')}>
              Last 7 days
            </button>
            <button type="button" aria-pressed={activityRange === '30d'} onClick={() => setActivityRange('30d')}>
              Last 30 days
            </button>
            <button
              type="button"
              aria-pressed={activityRange === 'custom'}
              onClick={() => setActivityRange('custom')}
            >
              <CalendarDays size={14} aria-hidden="true" />
              Custom range
            </button>
          </div>
          {activityRange === 'custom' && (
            <div className="reports-custom-range">
              <label>
                <span>From</span>
                <input
                  type="date"
                  aria-label="Activity start date"
                  max={customActivityRange.endDate || undefined}
                  value={customActivityRange.startDate}
                  onChange={event => setCustomActivityRange(current => ({
                    ...current,
                    startDate: event.target.value,
                  }))}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  aria-label="Activity end date"
                  min={customActivityRange.startDate || undefined}
                  value={customActivityRange.endDate}
                  onChange={event => setCustomActivityRange(current => ({
                    ...current,
                    endDate: event.target.value,
                  }))}
                />
              </label>
            </div>
          )}
          {incidentsLoading && incidents.length === 0 ? (
            <div className="reports-state" role="status"><LoaderCircle size={17} className="is-spinning" /> Loading trend data…</div>
          ) : incidentsError && incidents.length === 0 ? (
            <div className="reports-state">Trend data is unavailable until incident records load.</div>
          ) : !isActivityRangeValid ? (
            <div className="reports-state" role="status">Choose a valid start and end date to view activity.</div>
          ) : (
            <>
              <p className="reports-trend-scale">Daily incidents · scale 0–{trendMaximum}</p>
              <div className="reports-trend-scroll">
                <div
                  className={`reports-trend${trend.length > 7 ? ' reports-trend-dense' : ''}`}
                  role="list"
                  aria-label={`Incident counts from ${activityDateRange.startDate} through ${activityDateRange.endDate}`}
                  style={trend.length > 7 ? {
                    gridTemplateColumns: `repeat(${trend.length}, minmax(44px, 1fr))`,
                    minWidth: `${trend.length * 44 + (trend.length - 1) * 8}px`,
                  } : undefined}
                >
                  {trend.map(point => (
                    <div
                      className="reports-trend-day"
                      key={point.date}
                      role="listitem"
                      title={`${point.date}: ${point.count} incident${point.count === 1 ? '' : 's'}`}
                      aria-label={`${point.date}: ${point.count} incident${point.count === 1 ? '' : 's'}`}
                    >
                      <strong>{point.count}</strong>
                      <div className="reports-trend-track">
                        <span style={{ height: `${point.count ? Math.max(6, (point.count / trendMaximum) * 100) : 0}%` }} />
                      </div>
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="overview-panel reports-status-panel" aria-labelledby="reports-status-title">
          <div className="overview-panel-heading">
            <div>
              <h2 id="reports-status-title">Incidents by status</h2>
              <p>Select a status to filter the incident reports below.</p>
            </div>
            <ClipboardList size={17} aria-hidden="true" />
          </div>
          {incidentsLoading && incidents.length === 0 ? (
            <div className="reports-state" role="status"><LoaderCircle size={17} className="is-spinning" /> Loading status totals…</div>
          ) : incidentsError && incidents.length === 0 ? (
            <div className="reports-state">Status totals are unavailable until incident records load.</div>
          ) : statusCounts.size === 0 ? (
            <div className="reports-state">No incident status data has been returned.</div>
          ) : (
            <div className="overview-status-list">
              {[...statusCounts.entries()].map(([status, count]) => (
                <button
                  className={`overview-status-row reports-status-row${filters.status === status ? ' is-selected' : ''}`}
                  key={status}
                  type="button"
                  aria-pressed={filters.status === status}
                  onClick={() => toggleStatusFilter(status)}
                >
                  <span className={`status-indicator status-indicator-${statusSlug(status)}`} />
                  <span>{formatStatusLabel(status)}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          )}
          <div className="reports-resource-count">
            <Truck size={15} />
            <span>Resources tracked</span>
            <strong>{resourcesLoading || resourceDataUnavailable ? '—' : resources.length}</strong>
          </div>
        </section>
      </div>

      <section className="overview-panel reports-table-panel" aria-labelledby="incident-reports-title">
        <div className="reports-section-heading">
          <div>
            <h2 id="incident-reports-title">Incident reports</h2>
            <p>Structured records from the incident service. Filters apply to this table.</p>
          </div>
          <span className="section-note">
            {incidentsLoading ? 'Loading records…' : `${filteredIncidents.length} of ${incidents.length} records`}
          </span>
        </div>

        <div className="reports-filters" aria-label="Filter incident reports">
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {statuses.map(status => <option value={status} key={status}>{formatStatusLabel(status)}</option>)}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value)}>
              <option value="">All categories</option>
              {categories.map(category => <option value={category} key={category}>{category.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label>
            <span>Created from</span>
            <input type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label>
            <span>Created to</span>
            <input type="date" value={filters.endDate} min={filters.startDate || undefined} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          {hasFilters && (
            <button type="button" className="text-button reports-clear-filters" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {incidentsLoading && incidents.length === 0 ? (
          <div className="reports-state" role="status"><LoaderCircle size={17} className="is-spinning" /> Loading incident reports…</div>
        ) : incidentsError && incidents.length === 0 ? (
          <div className="reports-state">Incident reports are unavailable.</div>
        ) : filteredIncidents.length === 0 ? (
          <div className="reports-state">
            {incidents.length === 0 ? 'No incident records have been returned.' : 'No incident records match these filters.'}
          </div>
        ) : (
          <div className="reports-table-scroll">
            <table className="reports-table">
              <thead>
                <tr>
                  <th scope="col">Incident ID</th>
                  <th scope="col">Category / type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Current status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map(incident => (
                  <tr key={incident.id}>
                    <td className="reports-id-cell">
                      <Link to={`/incidents?selected=${encodeURIComponent(incident.id)}`} title={incident.id}>
                        {incident.id}
                      </Link>
                    </td>
                    <td>{incident.type || 'Type not provided'}</td>
                    <td>{formatLocationCoordinates(incident)}</td>
                    <td><span className={`reports-status reports-status-${statusSlug(incident.status)}`}>{formatStatusLabel(incident.status)}</span></td>
                    <td title={formatAbsoluteTime(incident.createdAt)}>{formatRelativeTime(incident.createdAt)}</td>
                    <td title={formatAbsoluteTime(incident.updatedAt)}>{formatRelativeTime(incident.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="reports-monitoring-grid">
        <section className="overview-panel reports-activity-panel" aria-labelledby="reports-activity-title">
          <div className="overview-panel-heading">
            <div>
              <h2 id="reports-activity-title">Operational activity</h2>
              <p>Latest incident and resource record timestamps, plus live backend events.</p>
            </div>
            <Activity size={17} aria-hidden="true" />
          </div>
          {activity.length === 0 ? (
            <div className="reports-state">
              {incidentsLoading || resourcesLoading ? 'Loading operational records…' : 'No timestamped incident, resource, or live event activity is available.'}
            </div>
          ) : (
            <div className="reports-activity-list">
              {activity.map(item => {
                const content = (
                  <>
                    <span className={`reports-activity-icon reports-activity-${item.kind}`}>
                      {item.kind === 'resource' ? <Truck size={15} /> : item.kind === 'incident' ? <ClipboardList size={15} /> : <Activity size={15} />}
                    </span>
                    <span className="reports-activity-copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </span>
                    <time dateTime={item.timestamp || undefined} title={formatAbsoluteTime(item.timestamp)}>
                      {formatRelativeTime(item.timestamp)}
                    </time>
                    {item.incidentId && <ArrowUpRight size={14} className="reports-activity-link-icon" aria-hidden="true" />}
                  </>
                );
                return item.incidentId ? (
                  <Link className="reports-activity-item" to={`/incidents?selected=${encodeURIComponent(item.incidentId)}`} key={item.key}>
                    {content}
                  </Link>
                ) : (
                  <div className="reports-activity-item" key={item.key}>{content}</div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overview-panel reports-alerts-panel" aria-labelledby="reports-alerts-title">
          <div className="overview-panel-heading">
            <div>
              <h2 id="reports-alerts-title">Live operational alerts</h2>
              <p>Derived from blocked-road, full-hospital, and unavailable-resource events.</p>
            </div>
            <span className={`reports-live-indicator reports-live-${eventConnection}`}>
              <span /> {eventConnection === 'connected' ? 'Live' : eventConnection === 'connecting' ? 'Connecting' : 'Reconnecting'}
            </span>
          </div>
          <div className="reports-alert-note">
            <Radio size={15} />
            <span>The backend has no persisted alert history, severity, or acknowledgement status. Only qualifying events received while this page is open appear here.</span>
          </div>
          {alerts.length === 0 ? (
            <div className="reports-state">
              {eventConnection === 'connected'
                ? 'No qualifying alert events have arrived during this session.'
                : 'No alert events have been received. The live event stream will reconnect automatically.'}
            </div>
          ) : (
            <div className="reports-alert-list">
              {alerts.map(alert => (
                <article className="reports-alert-item" key={alert.key}>
                  <span className="reports-alert-icon"><AlertTriangle size={16} /></span>
                  <div className="reports-alert-copy">
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                    <div className="reports-alert-meta">
                      <time dateTime={alert.timestamp || undefined} title={formatAbsoluteTime(alert.timestamp)}>
                        {formatRelativeTime(alert.timestamp)}
                      </time>
                      {alert.incidentId && (
                        <Link to={`/incidents?selected=${encodeURIComponent(alert.incidentId)}`}>
                          Incident {alert.incidentId}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ReportsPage;
