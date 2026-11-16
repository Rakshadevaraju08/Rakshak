import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BrainCircuit,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  FileText,
  Filter,
  FilterX,
  Info,
  LoaderCircle,
  MapPin,
  MessageSquarePlus,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  addIncidentReport,
  analyzeIncident,
  ApiRequestError,
  isJsonRecord,
  updateIncidentStatus,
  type FullResponsePlan,
  type Incident,
  type IncidentReport,
  type IncidentStatus,
  type IncidentUpdate,
  type JsonRecord,
} from '../services/api';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import { useIncident, useIncidents } from '../hooks/useIncidents';
import {
  filterAndSortIncidents,
  formatAbsoluteTime,
  formatLocationCoordinates,
  formatPriorityLabel,
  formatRelativeTime,
  formatStatusLabel,
  formatVictimSummary,
  PRIORITY_RANK,
  type DateRangeKey,
  type SortKey,
} from '../utils/incidentFilters';
import {
  getMissingIncidentDetails,
  groupAnalysisWarnings,
  isPredictionAvailable,
} from '../services/analysisPresentation';

const ITEMS_PER_PAGE = 10;

const VALID_STATUSES: IncidentStatus[] = ['NEW', 'ACTIVE', 'RESOLVED'];

function getString(record: JsonRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getNumber(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBoolean(record: JsonRecord | null, key: string): boolean | null {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : null;
}

function getRecord(record: JsonRecord | null, key: string): JsonRecord | null {
  const value = record?.[key];
  return isJsonRecord(value) ? value : null;
}

function getRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isJsonRecord) : [];
}

function getStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatConfidence(value: number | null): string {
  return value === null ? 'Not returned' : `${Math.round(value * 100)}%`;
}

function slug(value: string | null | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'unknown';
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'An unexpected error occurred.';
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return `${error.message}. This endpoint requires an OPERATOR or ADMIN bearer token when backend JWT authentication is enabled.`;
    }
    if (error.status === 403) {
      return `${error.message}. The current account must have the OPERATOR or ADMIN role.`;
    }
    if (error.status === 404) {
      return 'The requested incident record was not found (HTTP 404). It may have been removed or never created.';
    }
  }
  return error.message;
}

function IncidentsPage() {
  const { recordAnalysis } = useAnalysisContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    data: incidents,
    droppedCount,
    loading: isLoading,
    error: loadError,
    refetch: refetchList,
  } = useIncidents();

  // Search & Filter state derived from URL query parameters
  const qParam = searchParams.get('q') || '';
  const statusParam = searchParams.get('status');
  const priorityParam = searchParams.get('priority');
  const typeParam = searchParams.get('type');
  const rangeParam = (searchParams.get('range') as DateRangeKey) || 'ALL';
  const sortParam = (searchParams.get('sort') as SortKey) || 'newest';
  const selectedParam = searchParams.get('selected') || null;
  const pageParam = parseInt(searchParams.get('page') || '1', 10) || 1;

  const [searchInput, setSearchInput] = useState<string>(qParam);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(qParam);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    statusParam ? statusParam.split(',').filter(Boolean) : []
  );
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(
    priorityParam ? priorityParam.split(',').filter(Boolean) : []
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    typeParam ? typeParam.split(',').filter(Boolean) : []
  );
  const [dateRange, setDateRange] = useState<DateRangeKey>(rangeParam);
  const [sortKey, setSortKey] = useState<SortKey>(sortParam);
  const [currentPage, setCurrentPage] = useState<number>(pageParam);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(selectedParam);

  const [activePopover, setActivePopover] = useState<'status' | 'priority' | 'type' | null>(null);

  // Analysis state for the right-hand panel
  const [analysis, setAnalysis] = useState<FullResponsePlan | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingIncidentId, setAnalyzingIncidentId] = useState<string | null>(null);

  // Load detailed single incident (including sub-records: reports, predictions, dispatchPlans)
  const {
    data: detailedIncident,
    loading: isDetailLoading,
    error: detailError,
    isNotFound: isDetailNotFound,
    refetch: refetchDetail,
  } = useIncident(selectedIncidentId);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Synchronize state when URL query parameters change (e.g. Back/Forward navigation)
  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== searchInput) {
      setSearchInput(urlQ);
      setDebouncedQuery(urlQ);
    }

    const s = searchParams.get('status');
    setSelectedStatuses(s ? s.split(',').filter(Boolean) : []);

    const p = searchParams.get('priority');
    setSelectedPriorities(p ? p.split(',').filter(Boolean) : []);

    const t = searchParams.get('type');
    setSelectedTypes(t ? t.split(',').filter(Boolean) : []);

    setDateRange((searchParams.get('range') as DateRangeKey) || 'ALL');
    setSortKey((searchParams.get('sort') as SortKey) || 'newest');
    setCurrentPage(parseInt(searchParams.get('page') || '1', 10) || 1);
    setSelectedIncidentId(searchParams.get('selected') || null);
  }, [searchParams]);

  // Update query parameters cleanly in URL
  const updateQueryParams = (updates: {
    q?: string;
    status?: string[];
    priority?: string[];
    type?: string[];
    range?: DateRangeKey;
    sort?: SortKey;
    page?: number;
    selected?: string | null;
  }) => {
    const next = new URLSearchParams(searchParams);

    if ('q' in updates) {
      if (updates.q && updates.q.trim()) next.set('q', updates.q.trim());
      else next.delete('q');
    }
    if ('status' in updates) {
      if (updates.status && updates.status.length) next.set('status', updates.status.join(','));
      else next.delete('status');
    }
    if ('priority' in updates) {
      if (updates.priority && updates.priority.length) next.set('priority', updates.priority.join(','));
      else next.delete('priority');
    }
    if ('type' in updates) {
      if (updates.type && updates.type.length) next.set('type', updates.type.join(','));
      else next.delete('type');
    }
    if ('range' in updates) {
      if (updates.range && updates.range !== 'ALL') next.set('range', updates.range);
      else next.delete('range');
    }
    if ('sort' in updates) {
      if (updates.sort && updates.sort !== 'newest') next.set('sort', updates.sort);
      else next.delete('sort');
    }
    if ('page' in updates) {
      if (updates.page && updates.page > 1) next.set('page', String(updates.page));
      else next.delete('page');
    }
    if ('selected' in updates) {
      if (updates.selected) next.set('selected', updates.selected);
      else next.delete('selected');
    }

    setSearchParams(next, { replace: true });
  };

  // Sync debounced search to URL
  useEffect(() => {
    const currentQ = searchParams.get('q') || '';
    if (debouncedQuery.trim() !== currentQ) {
      setCurrentPage(1);
      updateQueryParams({ q: debouncedQuery, page: 1 });
    }
  }, [debouncedQuery]);

  // Dynamic filter options derived from actual loaded records
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const inc of incidents) {
      if (inc.status) set.add(String(inc.status));
    }
    return Array.from(set).sort();
  }, [incidents]);

  const availablePriorities = useMemo(() => {
    const set = new Set<string>();
    for (const inc of incidents) {
      if (inc.priority) set.add(String(inc.priority));
    }
    return Array.from(set).sort(
      (a, b) => (PRIORITY_RANK[String(b).toUpperCase()] ?? 0) - (PRIORITY_RANK[String(a).toUpperCase()] ?? 0)
    );
  }, [incidents]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const inc of incidents) {
      if (inc.type) set.add(String(inc.type));
    }
    return Array.from(set).sort();
  }, [incidents]);

  // Combined search, filter, and sort execution
  const filteredIncidents = useMemo(() => {
    return filterAndSortIncidents(incidents, {
      searchQuery: debouncedQuery,
      statuses: selectedStatuses,
      priorities: selectedPriorities,
      types: selectedTypes,
      dateRange,
      sortKey,
    });
  }, [incidents, debouncedQuery, selectedStatuses, selectedPriorities, selectedTypes, dateRange, sortKey]);

  // Pagination calculation
  const totalFilteredCount = filteredIncidents.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedIncidents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredIncidents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredIncidents, safeCurrentPage]);

  // Active incident resolution: prefer detailed record with sub-records, fallback to list item
  const activeIncident = useMemo(() => {
    if (!selectedIncidentId) return null;
    if (detailedIncident && detailedIncident.id === selectedIncidentId) {
      return detailedIncident;
    }
    return incidents.find(incident => incident.id === selectedIncidentId) ?? null;
  }, [selectedIncidentId, detailedIncident, incidents]);

  const handleSelectIncident = (id: string | null) => {
    setSelectedIncidentId(id);
    updateQueryParams({ selected: id });
    setAnalysis(null);
    setAnalysisError(null);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateQueryParams({ page: newPage });
  };

  const toggleStatusFilter = (val: string) => {
    const next = selectedStatuses.includes(val)
      ? selectedStatuses.filter(item => item !== val)
      : [...selectedStatuses, val];
    setSelectedStatuses(next);
    setCurrentPage(1);
    updateQueryParams({ status: next, page: 1 });
  };

  const togglePriorityFilter = (val: string) => {
    const next = selectedPriorities.includes(val)
      ? selectedPriorities.filter(item => item !== val)
      : [...selectedPriorities, val];
    setSelectedPriorities(next);
    setCurrentPage(1);
    updateQueryParams({ priority: next, page: 1 });
  };

  const toggleTypeFilter = (val: string) => {
    const next = selectedTypes.includes(val)
      ? selectedTypes.filter(item => item !== val)
      : [...selectedTypes, val];
    setSelectedTypes(next);
    setCurrentPage(1);
    updateQueryParams({ type: next, page: 1 });
  };

  const handleDateRangeChange = (val: DateRangeKey) => {
    setDateRange(val);
    setCurrentPage(1);
    updateQueryParams({ range: val, page: 1 });
  };

  const handleSortChange = (val: SortKey) => {
    setSortKey(val);
    updateQueryParams({ sort: val });
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedTypes([]);
    setDateRange('ALL');
    setCurrentPage(1);
    setActivePopover(null);
    updateQueryParams({
      q: '',
      status: [],
      priority: [],
      type: [],
      range: 'ALL',
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    debouncedQuery.trim() ||
      selectedStatuses.length > 0 ||
      selectedPriorities.length > 0 ||
      selectedTypes.length > 0 ||
      dateRange !== 'ALL'
  );

  async function handleAnalyze(incident: Incident) {
    if (analyzingIncidentId) return;
    handleSelectIncident(incident.id);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzingIncidentId(incident.id);

    try {
      const response = await analyzeIncident(incident.id);
      setAnalysis(response);
      recordAnalysis(incident, response);
    } catch (error) {
      setAnalysisError(errorMessage(error));
    } finally {
      setAnalyzingIncidentId(null);
    }
  }

  return (
    <>
      <div className="page-heading incidents-page-heading">
        <div>
          <div className="eyebrow"><span /> RESPONSE OPERATIONS</div>
          <h1>Incidents</h1>
          <p>Review incoming reports, manage status lifecycles, and request AI-assisted response analysis.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            void refetchList();
            if (selectedIncidentId) void refetchDetail();
          }}
          disabled={isLoading || isDetailLoading}
          aria-label="Refresh incident feed"
        >
          <RefreshCw size={15} className={isLoading || isDetailLoading ? 'is-spinning' : undefined} />
          Refresh
        </button>
      </div>

      <div className="incident-workspace">
        {/* Left Column: Incidents Listing, Filter, Sort, Pagination */}
        <section className="incident-list-panel" aria-labelledby="incident-list-title">
          <div className="incident-list-heading">
            <div>
              <h2 id="incident-list-title">Incident queue</h2>
              <p>
                {isLoading
                  ? 'Loading incidents…'
                  : `${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'} returned`}
              </p>
            </div>
            <span className="quiet-badge">Backend feed</span>
          </div>

          {/* Non-blocking dropped records notice */}
          {droppedCount > 0 && (
            <div className="dropped-records-notice" role="status">
              <Info size={14} />
              <span>
                {droppedCount} {droppedCount === 1 ? 'record was' : 'records were'} skipped due to missing identifiers.
              </span>
            </div>
          )}

          {/* Search, Filter, Sort Toolbar */}
          <div className="incident-controls">
            <div className="incident-search-bar">
              <Search size={15} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by ID, keyword, type, coordinates, victims, or status…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                aria-label="Search incidents"
              />
              {searchInput && (
                <button
                  type="button"
                  className="incident-clear-input"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedQuery('');
                    setCurrentPage(1);
                    updateQueryParams({ q: '', page: 1 });
                  }}
                  aria-label="Clear search input"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="incident-filter-row">
              <div className="incident-filter-groups">
                {/* Status Filter Popover */}
                <div className="filter-popover-anchor">
                  <button
                    type="button"
                    className={`filter-dropdown-toggle${selectedStatuses.length > 0 ? ' is-active' : ''}`}
                    onClick={() => setActivePopover(prev => (prev === 'status' ? null : 'status'))}
                    aria-expanded={activePopover === 'status'}
                  >
                    <Filter size={13} />
                    <span>Status{selectedStatuses.length > 0 ? ` (${selectedStatuses.length})` : ''}</span>
                    <ChevronDown size={12} />
                  </button>
                  {activePopover === 'status' && (
                    <>
                      <div className="filter-menu-scrim" onClick={() => setActivePopover(null)} />
                      <div className="filter-popover-menu" role="menu">
                        {availableStatuses.length === 0 ? (
                          <span className="filter-checkbox-option">No statuses found</span>
                        ) : (
                          availableStatuses.map(status => (
                            <label key={status} className="filter-checkbox-option">
                              <input
                                type="checkbox"
                                checked={selectedStatuses.includes(status)}
                                onChange={() => toggleStatusFilter(status)}
                              />
                              <span>{formatStatusLabel(status)}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Priority Filter Popover */}
                <div className="filter-popover-anchor">
                  <button
                    type="button"
                    className={`filter-dropdown-toggle${selectedPriorities.length > 0 ? ' is-active' : ''}`}
                    onClick={() => setActivePopover(prev => (prev === 'priority' ? null : 'priority'))}
                    aria-expanded={activePopover === 'priority'}
                  >
                    <AlertTriangle size={13} />
                    <span>Priority{selectedPriorities.length > 0 ? ` (${selectedPriorities.length})` : ''}</span>
                    <ChevronDown size={12} />
                  </button>
                  {activePopover === 'priority' && (
                    <>
                      <div className="filter-menu-scrim" onClick={() => setActivePopover(null)} />
                      <div className="filter-popover-menu" role="menu">
                        {availablePriorities.length === 0 ? (
                          <span className="filter-checkbox-option">No priorities found</span>
                        ) : (
                          availablePriorities.map(priority => (
                            <label key={priority} className="filter-checkbox-option">
                              <input
                                type="checkbox"
                                checked={selectedPriorities.includes(priority)}
                                onChange={() => togglePriorityFilter(priority)}
                              />
                              <span>{formatPriorityLabel(priority)}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Incident Type Filter Popover */}
                <div className="filter-popover-anchor">
                  <button
                    type="button"
                    className={`filter-dropdown-toggle${selectedTypes.length > 0 ? ' is-active' : ''}`}
                    onClick={() => setActivePopover(prev => (prev === 'type' ? null : 'type'))}
                    aria-expanded={activePopover === 'type'}
                  >
                    <span>Category{selectedTypes.length > 0 ? ` (${selectedTypes.length})` : ''}</span>
                    <ChevronDown size={12} />
                  </button>
                  {activePopover === 'type' && (
                    <>
                      <div className="filter-menu-scrim" onClick={() => setActivePopover(null)} />
                      <div className="filter-popover-menu" role="menu">
                        {availableTypes.length === 0 ? (
                          <span className="filter-checkbox-option">No categories found</span>
                        ) : (
                          availableTypes.map(type => (
                            <label key={type} className="filter-checkbox-option">
                              <input
                                type="checkbox"
                                checked={selectedTypes.includes(type)}
                                onChange={() => toggleTypeFilter(type)}
                              />
                              <span>{type}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Date Range Selector */}
                <select
                  className="incident-select"
                  value={dateRange}
                  onChange={e => handleDateRangeChange(e.target.value as DateRangeKey)}
                  aria-label="Filter by time range"
                >
                  <option value="ALL">All Time</option>
                  <option value="24H">Past 24 Hours</option>
                  <option value="7D">Past 7 Days</option>
                  <option value="30D">Past 30 Days</option>
                </select>
              </div>

              {/* Sorting Selector */}
              <div className="incident-sort-select">
                <ArrowUpDown size={13} className="sort-icon" aria-hidden="true" />
                <select
                  className="incident-select"
                  value={sortKey}
                  onChange={e => handleSortChange(e.target.value as SortKey)}
                  aria-label="Sort incidents by"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="priority-desc">Priority: Critical to Low</option>
                  <option value="priority-asc">Priority: Low to Critical</option>
                  <option value="status">Status: New to Resolved</option>
                  <option value="title">Title (A–Z)</option>
                </select>
              </div>
            </div>

            {/* Active Filters Summary & Result Counter */}
            <div className="incident-count-bar">
              <span>
                Showing {totalFilteredCount === 0 ? 0 : paginatedIncidents.length} of {totalFilteredCount}{' '}
                {totalFilteredCount === 1 ? 'incident' : 'incidents'}
                {totalFilteredCount !== incidents.length ? ` (${incidents.length} total)` : ''}
              </span>
              {hasActiveFilters && (
                <button type="button" className="clear-all-link" onClick={clearAllFilters}>
                  Clear all filters
                </button>
              )}
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="active-filters-summary">
                {debouncedQuery.trim() && (
                  <span className="filter-chip">
                    Search: “{debouncedQuery.trim()}”
                    <button
                      type="button"
                      aria-label="Remove search filter"
                      onClick={() => {
                        setSearchInput('');
                        setDebouncedQuery('');
                        setCurrentPage(1);
                        updateQueryParams({ q: '', page: 1 });
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {selectedStatuses.map(status => (
                  <span key={status} className="filter-chip">
                    Status: {formatStatusLabel(status)}
                    <button
                      type="button"
                      aria-label={`Remove status filter ${status}`}
                      onClick={() => toggleStatusFilter(status)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {selectedPriorities.map(priority => (
                  <span key={priority} className="filter-chip">
                    Priority: {formatPriorityLabel(priority)}
                    <button
                      type="button"
                      aria-label={`Remove priority filter ${priority}`}
                      onClick={() => togglePriorityFilter(priority)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {selectedTypes.map(type => (
                  <span key={type} className="filter-chip">
                    Category: {type}
                    <button
                      type="button"
                      aria-label={`Remove category filter ${type}`}
                      onClick={() => toggleTypeFilter(type)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {dateRange !== 'ALL' && (
                  <span className="filter-chip">
                    Range:{' '}
                    {dateRange === '24H'
                      ? 'Past 24 Hours'
                      : dateRange === '7D'
                      ? 'Past 7 Days'
                      : 'Past 30 Days'}
                    <button
                      type="button"
                      aria-label="Remove date range filter"
                      onClick={() => handleDateRangeChange('ALL')}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="incident-list" role="status" aria-busy="true">
              <div className="incident-state">
                <LoaderCircle size={20} className="is-spinning" />
                <span>Loading incidents from the backend…</span>
              </div>
              <div className="skeleton-card">
                <div className="skeleton-line short" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line" />
              </div>
              <div className="skeleton-card">
                <div className="skeleton-line short" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line" />
              </div>
            </div>
          )}

          {/* API Load Error */}
          {!isLoading && loadError && (
            <div className="incident-error" role="alert">
              <AlertTriangle size={18} />
              <div>
                <strong>Could not load incidents</strong>
                <p>{loadError}</p>
              </div>
              <button type="button" className="text-button" onClick={() => void refetchList()}>
                Try again
              </button>
            </div>
          )}

          {/* State 1: Completely Empty Incident List (Backend has 0 incidents) */}
          {!isLoading && !loadError && incidents.length === 0 && (
            <div className="incident-empty">
              <span className="placeholder-icon"><UsersRound size={23} /></span>
              <strong>No incidents returned</strong>
              <p>The backend incident endpoint returned an empty list.</p>
            </div>
          )}

          {/* State 2: Empty After Filtering (Incidents exist, but none match filters) */}
          {!isLoading && !loadError && incidents.length > 0 && filteredIncidents.length === 0 && (
            <div className="incident-empty">
              <span className="placeholder-icon"><FilterX size={23} /></span>
              <strong>No incidents match your filters</strong>
              <p>Try clearing or adjusting your search keyword, active filters, or date range.</p>
              <button type="button" className="secondary-button" onClick={clearAllFilters}>
                <RotateCcw size={14} /> Clear all filters
              </button>
            </div>
          )}

          {/* Filtered Incidents Queue */}
          {!isLoading && !loadError && paginatedIncidents.length > 0 && (
            <div className="incident-list">
              {paginatedIncidents.map(incident => (
                <article
                  className={`incident-card${selectedIncidentId === incident.id ? ' is-selected' : ''}`}
                  key={incident.id}
                  tabIndex={0}
                  role="button"
                  aria-selected={selectedIncidentId === incident.id}
                  onClick={() => handleSelectIncident(incident.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectIncident(incident.id);
                    }
                  }}
                >
                  <div className="incident-card-top">
                    <div className="incident-badges">
                      <span className="incident-category">{incident.type || 'UNKNOWN'}</span>
                      <span className={`risk-badge risk-${slug(incident.priority)}`}>
                        <AlertTriangle size={11} />
                        {formatPriorityLabel(incident.priority)}
                      </span>
                      <span className={`incident-status status-${slug(incident.status)}`}>
                        <span className="status-dot" />
                        {formatStatusLabel(incident.status)}
                      </span>
                    </div>
                  </div>

                  <h3>{incident.title}</h3>

                  <p
                    className="incident-description"
                    title={incident.description || 'No description provided'}
                  >
                    {incident.description || 'No description provided'}
                  </p>

                  <div className="incident-meta">
                    <span>
                      <MapPin size={14} />
                      {formatLocationCoordinates(incident)}
                    </span>
                    <span title={formatAbsoluteTime(incident.timestamp || incident.createdAt)}>
                      <Clock3 size={14} />
                      {formatRelativeTime(incident.timestamp || incident.createdAt)}
                    </span>
                    <span>
                      <UsersRound size={14} />
                      {formatVictimSummary(incident)}
                    </span>
                  </div>

                  <div className="incident-card-actions">
                    <span className="incident-id">ID · {incident.id}</span>
                    <button
                      type="button"
                      className="analyze-button"
                      onClick={e => {
                        e.stopPropagation();
                        void handleAnalyze(incident);
                      }}
                      disabled={analyzingIncidentId !== null}
                      aria-label={`Analyse incident ${incident.id} with AI`}
                    >
                      {analyzingIncidentId === incident.id ? (
                        <LoaderCircle size={15} className="is-spinning" />
                      ) : (
                        <BrainCircuit size={15} />
                      )}
                      {analyzingIncidentId === incident.id ? 'Analysing…' : 'Analyse with AI'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Client-side Pagination Controls */}
          {!isLoading && !loadError && totalPages > 1 && (
            <div className="pagination-controls" aria-label="Incident list pagination">
              <span className="pagination-info">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="pagination-page-btn"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => handlePageChange(safeCurrentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                  .map(pageNumber => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`pagination-page-btn${safeCurrentPage === pageNumber ? ' is-active' : ''}`}
                      onClick={() => handlePageChange(pageNumber)}
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={safeCurrentPage === pageNumber ? 'page' : undefined}
                    >
                      {pageNumber}
                    </button>
                  ))}
                <button
                  type="button"
                  className="pagination-page-btn"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => handlePageChange(safeCurrentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Complete Incident Details View & Status Workflow */}
        <IncidentDetailsPanel
          incident={activeIncident}
          selectedId={selectedIncidentId}
          isLoading={isDetailLoading && !activeIncident}
          isNotFound={isDetailNotFound}
          error={detailError}
          analysis={analysis}
          analysisError={analysisError}
          isAnalyzing={analyzingIncidentId !== null}
          analyzingIncidentId={analyzingIncidentId}
          onSelectIncident={handleSelectIncident}
          onRetryFetch={() => void refetchDetail()}
          onRefetchAll={() => {
            void refetchList();
            void refetchDetail();
          }}
          onAnalyze={handleAnalyze}
        />
      </div>
    </>
  );
}

interface IncidentDetailsPanelProps {
  incident: Incident | null;
  selectedId: string | null;
  isLoading: boolean;
  isNotFound: boolean;
  error: string | null;
  analysis: FullResponsePlan | null;
  analysisError: string | null;
  isAnalyzing: boolean;
  analyzingIncidentId: string | null;
  onSelectIncident: (id: string | null) => void;
  onRetryFetch: () => void;
  onRefetchAll: () => void;
  onAnalyze: (incident: Incident) => Promise<void>;
}

function IncidentDetailsPanel({
  incident,
  selectedId,
  isLoading,
  isNotFound,
  error,
  analysis,
  analysisError,
  isAnalyzing,
  analyzingIncidentId,
  onSelectIncident,
  onRetryFetch,
  onRefetchAll,
  onAnalyze,
}: IncidentDetailsPanelProps) {
  // Status transition state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [updatingTargetStatus, setUpdatingTargetStatus] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);

  // Situation reports & timeline state
  const [newReportContent, setNewReportContent] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSubmitSuccess, setReportSubmitSuccess] = useState<string | null>(null);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);
  const [timelineSortAsc, setTimelineSortAsc] = useState<boolean>(false);

  // Clear transient status / report messages when selected incident changes
  useEffect(() => {
    setStatusUpdateSuccess(null);
    setStatusUpdateError(null);
    setReportSubmitSuccess(null);
    setReportSubmitError(null);
    setNewReportContent('');
  }, [selectedId]);

  // Handle status update workflow (Non-optimistic: updates UI only upon 200 response)
  const handleStatusChange = async (targetStatus: IncidentStatus) => {
    if (!incident || isUpdatingStatus) return;
    if (targetStatus === incident.status) return; // Prevent no-op update

    setIsUpdatingStatus(true);
    setUpdatingTargetStatus(targetStatus);
    setStatusUpdateSuccess(null);
    setStatusUpdateError(null);

    try {
      await updateIncidentStatus(incident.id, targetStatus);
      setStatusUpdateSuccess(`Status successfully transitioned to ${formatStatusLabel(targetStatus)}.`);
      onRefetchAll();
    } catch (err: unknown) {
      setStatusUpdateError(errorMessage(err));
    } finally {
      setIsUpdatingStatus(false);
      setUpdatingTargetStatus(null);
    }
  };

  // Handle adding follow-up situation report
  const handleAddReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!incident || !newReportContent.trim() || isSubmittingReport) return;

    setIsSubmittingReport(true);
    setReportSubmitSuccess(null);
    setReportSubmitError(null);

    try {
      await addIncidentReport(incident.id, newReportContent.trim());
      setNewReportContent('');
      setReportSubmitSuccess('Situation report successfully recorded in the incident log.');
      onRefetchAll();
    } catch (err: unknown) {
      setReportSubmitError(errorMessage(err));
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Compile chronological timeline entries from reports, dispatch plans, predictions, and intake
  const timelineEntries = useMemo(() => {
    if (!incident) return [];

    type TimelineItem = {
      id: string;
      source: string;
      type: 'intake' | 'report' | 'dispatch' | 'prediction';
      timestamp: string | null;
      content: string;
    };

    const items: TimelineItem[] = [];

    // Initial intake entry
    if (incident.createdAt) {
      items.push({
        id: `intake-${incident.id}`,
        source: 'Incident Intake',
        type: 'intake',
        timestamp: incident.createdAt,
        content: incident.description || 'Emergency incident registered into response operations queue.',
      });
    }

    // Situation reports
    if (Array.isArray(incident.reports)) {
      for (const report of incident.reports) {
        items.push({
          id: `report-${report.id}`,
          source: 'Situation Report',
          type: 'report',
          timestamp: report.createdAt,
          content: report.content,
        });
      }
    }

    // Dispatch plans
    if (Array.isArray(incident.dispatchPlans)) {
      for (const plan of incident.dispatchPlans) {
        items.push({
          id: `dispatch-${plan.id}`,
          source: `Dispatch Plan (${plan.status})`,
          type: 'dispatch',
          timestamp: plan.createdAt || plan.updatedAt,
          content: `Response plan generated with status ${plan.status}.`,
        });
      }
    }

    // Predictions
    if (Array.isArray(incident.predictions)) {
      for (const pred of incident.predictions) {
        items.push({
          id: `prediction-${pred.id}`,
          source: 'AI Risk Prediction',
          type: 'prediction',
          timestamp: pred.timestamp,
          content: `Predicted risk index: ${pred.predictedRisk}/100 · Escalation trend: ${
            pred.predictedWorsening ? 'Worsening detected' : 'Stable or improving'
          }.`,
        });
      }
    }

    // Sort chronologically (default newest first, toggleable to oldest first)
    items.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortAsc ? timeA - timeB : timeB - timeA;
    });

    return items;
  }, [incident, timelineSortAsc]);

  // Case 1: No incident selected
  if (!selectedId) {
    return (
      <aside className="analysis-panel incident-detail-aside" aria-labelledby="detail-panel-title">
        <div className="analysis-panel-header">
          <span className="analysis-mark"><FileText size={19} /></span>
          <div>
            <span className="analysis-kicker">INCIDENT MANAGEMENT</span>
            <h2 id="detail-panel-title">Incident details</h2>
          </div>
        </div>

        <div className="analysis-empty">
          <span className="analysis-empty-icon"><FileText size={22} /></span>
          <strong>Select an incident</strong>
          <p>Choose an incident from the queue to view complete details, manage status lifecycle, and review situation reports.</p>
        </div>

        <div className="analysis-dispatch-note">
          <ShieldCheck size={15} />
          <span>Incident lifecycle updates and AI response analyses are logged to the backend event bus.</span>
        </div>
      </aside>
    );
  }

  // Case 2: Loading detail
  if (isLoading) {
    return (
      <aside className="analysis-panel incident-detail-aside" aria-labelledby="detail-panel-title">
        <div className="analysis-panel-header">
          <span className="analysis-mark"><LoaderCircle size={19} className="is-spinning" /></span>
          <div>
            <span className="analysis-kicker">INCIDENT MANAGEMENT</span>
            <h2 id="detail-panel-title">Loading incident…</h2>
          </div>
        </div>
        <div className="analysis-state" role="status">
          <LoaderCircle size={24} className="is-spinning" />
          <strong>Retrieving incident records</strong>
          <p>Fetching incident details and timeline updates from the backend…</p>
        </div>
      </aside>
    );
  }

  // Case 3: 404 Not Found
  if (isNotFound) {
    return (
      <aside className="analysis-panel incident-detail-aside" aria-labelledby="detail-panel-title">
        <div className="analysis-panel-header">
          <span className="analysis-mark"><AlertTriangle size={19} /></span>
          <div>
            <span className="analysis-kicker">INCIDENT MANAGEMENT</span>
            <h2 id="detail-panel-title">Incident not found</h2>
          </div>
        </div>

        <div className="analysis-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Incident resource not found (HTTP 404)</strong>
            <p>The incident with ID “{selectedId}” could not be located in the database.</p>
            <div className="detail-actions-bar">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onSelectIncident(null)}
              >
                <ChevronLeft size={14} /> Back to queue
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Case 4: API Error Loading Detail
  if (error && !incident) {
    return (
      <aside className="analysis-panel incident-detail-aside" aria-labelledby="detail-panel-title">
        <div className="analysis-panel-header">
          <span className="analysis-mark"><AlertTriangle size={19} /></span>
          <div>
            <span className="analysis-kicker">INCIDENT MANAGEMENT</span>
            <h2 id="detail-panel-title">Could not load details</h2>
          </div>
        </div>

        <div className="analysis-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Failed to retrieve incident</strong>
            <p>{error}</p>
            <div className="detail-actions-bar">
              <button type="button" className="secondary-button" onClick={onRetryFetch}>
                <RefreshCw size={13} /> Try again
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectIncident(null)}
              >
                Back to queue
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (!incident) {
    return null;
  }

  return (
    <aside className="analysis-panel incident-detail-aside" aria-labelledby="detail-panel-title">
      {/* Detail Header & Action Bar */}
      <div className="analysis-panel-header">
        <span className="analysis-mark"><FileText size={19} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="analysis-kicker">INCIDENT RECORD</span>
            <button
              type="button"
              className="text-button"
              onClick={() => onSelectIncident(null)}
              aria-label="Deselect incident and return to full queue view"
              style={{ fontSize: '10px', padding: '2px 4px' }}
            >
              <ChevronLeft size={13} /> Back to queue
            </button>
          </div>
          <h2 id="detail-panel-title" style={{ fontSize: '14px', lineHeight: 1.3 }}>
            {incident.title}
          </h2>
        </div>
      </div>

      {/* Incident Header Badges & Actions */}
      <div className="incident-card-top" style={{ padding: '8px 0 2px' }}>
        <div className="incident-badges" style={{ flexWrap: 'wrap' }}>
          <span className="incident-category">{incident.type || 'UNKNOWN'}</span>
          <span className={`risk-badge risk-${slug(incident.priority)}`}>
            <AlertTriangle size={11} />
            {formatPriorityLabel(incident.priority)}
          </span>
          <span className={`incident-status status-${slug(incident.status)}`}>
            <span className="status-dot" />
            {formatStatusLabel(incident.status)}
          </span>
          <span className="incident-id" style={{ marginLeft: 'auto' }}>
            ID · {incident.id}
          </span>
        </div>
      </div>

      {/* Primary Action Row: Initiate AI Analysis */}
      <div className="detail-actions-bar" style={{ paddingBottom: '12px', borderBottom: '1px solid #edf2f5' }}>
        <button
          type="button"
          className="analyze-button"
          onClick={() => void onAnalyze(incident)}
          disabled={isAnalyzing}
          aria-label={`Initiate AI analysis for incident ${incident.id}`}
        >
          {analyzingIncidentId === incident.id ? (
            <LoaderCircle size={15} className="is-spinning" />
          ) : (
            <BrainCircuit size={15} />
          )}
          {analyzingIncidentId === incident.id ? 'Analysing with AI…' : 'Initiate AI analysis'}
        </button>
      </div>

      {/* Section 1: Status Lifecycle Workflow */}
      <div className="status-workflow-panel">
        <div className="status-workflow-header">
          <span className="status-workflow-kicker">STATUS WORKFLOW</span>
          <span style={{ fontSize: '10px', color: '#688496' }}>
            Current: <strong>{formatStatusLabel(incident.status)}</strong>
          </span>
        </div>

        <div className="status-workflow-controls">
          {VALID_STATUSES.map(st => {
            const isCurrent = incident.status === st;
            const isTarget = updatingTargetStatus === st;
            return (
              <button
                key={st}
                type="button"
                className={`status-transition-btn${isCurrent ? ' is-current' : ''}`}
                disabled={isCurrent || isUpdatingStatus}
                onClick={() => void handleStatusChange(st)}
                title={isCurrent ? 'Incident is already at this status' : `Transition to ${formatStatusLabel(st)}`}
              >
                {isTarget ? (
                  <LoaderCircle size={12} className="is-spinning" />
                ) : isCurrent ? (
                  <Check size={12} />
                ) : st === 'ACTIVE' ? (
                  <Play size={11} />
                ) : st === 'RESOLVED' ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <Clock size={11} />
                )}
                <span>
                  {isCurrent
                    ? `${formatStatusLabel(st)} (Current)`
                    : st === 'ACTIVE'
                    ? 'Mark Active'
                    : st === 'RESOLVED'
                    ? 'Resolve Incident'
                    : 'Reset to New'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status transition progress indicator */}
        {isUpdatingStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10px', color: '#4a728b' }}>
            <LoaderCircle size={13} className="is-spinning" />
            <span>Updating incident status to {formatStatusLabel(updatingTargetStatus)}…</span>
          </div>
        )}

        {/* Status update success banner */}
        {statusUpdateSuccess && (
          <div className="status-feedback-success" role="status">
            <Check size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
            {statusUpdateSuccess}
          </div>
        )}

        {/* Status update error banner */}
        {statusUpdateError && (
          <div className="status-feedback-error" role="alert">
            <AlertTriangle size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
            {statusUpdateError}
          </div>
        )}
      </div>

      {/* Section 2: Detailed Incident Attributes (Neutral "Not provided" for missing fields) */}
      <h3 className="detail-section-title">
        <FileText size={14} /> Incident specifications
      </h3>

      <div className="detail-grid">
        <DetailField label="Incident ID" value={incident.id} />
        <DetailField label="Category / Type" value={incident.type} />
        <DetailField
          label="Priority level"
          value={
            incident.priority ? (
              <span className={`risk-badge risk-${slug(incident.priority)}`}>
                <AlertTriangle size={10} />
                {formatPriorityLabel(incident.priority)}
              </span>
            ) : null
          }
        />
        <DetailField
          label="Status"
          value={
            incident.status ? (
              <span className={`incident-status status-${slug(incident.status)}`}>
                <span className="status-dot" />
                {formatStatusLabel(incident.status)}
              </span>
            ) : null
          }
        />
        <DetailField
          label="Location coordinates"
          value={
            incident.locationLat !== null && incident.locationLng !== null
              ? `${incident.locationLat.toFixed(5)}, ${incident.locationLng.toFixed(5)}`
              : incident.location
              ? `${incident.location.lat.toFixed(5)}, ${incident.location.lng.toFixed(5)}`
              : null
          }
        />
        <DetailField
          label="Created / Logged"
          value={
            incident.createdAt
              ? `${formatAbsoluteTime(incident.createdAt)} (${formatRelativeTime(incident.createdAt)})`
              : null
          }
        />
        <DetailField
          label="Last updated"
          value={
            incident.updatedAt
              ? `${formatAbsoluteTime(incident.updatedAt)} (${formatRelativeTime(incident.updatedAt)})`
              : null
          }
        />
        <DetailField
          label="Reporter ID"
          value={incident.reporterId}
        />
        <DetailField
          label="Full description"
          value={incident.description}
          fullWidth
        />
      </div>

      {/* Section 3: Victim Information Breakdown */}
      <h3 className="detail-section-title">
        <UsersRound size={14} /> Victim & population assessment
      </h3>

      <div className="detail-grid">
        <DetailField
          label="Total victims"
          value={incident.victimCount ?? incident.victimInformation?.total ?? null}
        />
        <DetailField
          label="Elderly individuals"
          value={incident.elderlyCount ?? incident.victimInformation?.elderly ?? null}
        />
        <DetailField
          label="Children"
          value={incident.childrenCount ?? incident.victimInformation?.children ?? null}
        />
        <DetailField
          label="Persons with disabilities"
          value={incident.disabledCount ?? incident.victimInformation?.disabled ?? null}
        />
      </div>

      {/* Section 4: Environmental & Infrastructure Indicators */}
      <h3 className="detail-section-title">
        <MapPin size={14} /> Environmental & access indicators
      </h3>

      <div className="detail-grid">
        <DetailField
          label="Water level"
          value={
            incident.waterLevel !== null && incident.waterLevel !== undefined
              ? `${incident.waterLevel} m`
              : null
          }
        />
        <DetailField
          label="Rainfall observation"
          value={
            incident.rainfall !== null && incident.rainfall !== undefined
              ? `${incident.rainfall} mm`
              : null
          }
        />
        <DetailField
          label="Road access condition"
          value={incident.roadAccess}
        />
      </div>

      {/* Section 5: Situation Reports & Chronological Timeline */}
      <h3 className="detail-section-title">
        <Clock3 size={14} /> Situation reports & timeline
      </h3>

      <div className="timeline-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: '#688496', fontWeight: 600 }}>
            {timelineEntries.length} {timelineEntries.length === 1 ? 'event recorded' : 'events recorded'}
          </span>
          {timelineEntries.length > 1 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setTimelineSortAsc(prev => !prev)}
              style={{ fontSize: '9.5px' }}
            >
              <ArrowUpDown size={11} /> {timelineSortAsc ? 'Oldest first' : 'Newest first'}
            </button>
          )}
        </div>

        {/* Timeline Entries List */}
        {timelineEntries.length === 0 ? (
          <div className="incident-empty" style={{ padding: '16px 8px' }}>
            <span className="placeholder-icon"><MessageSquarePlus size={20} /></span>
            <strong>No situation reports or updates yet</strong>
            <p style={{ margin: '4px 0 0' }}>Submit the first situation update using the field report form below.</p>
          </div>
        ) : (
          <ul className="timeline-list">
            {timelineEntries.map(entry => (
              <li className="timeline-item" key={entry.id}>
                <span className="timeline-item-icon">
                  {entry.type === 'report' ? (
                    <MessageSquarePlus size={14} />
                  ) : entry.type === 'dispatch' ? (
                    <ShieldCheck size={14} />
                  ) : entry.type === 'prediction' ? (
                    <Activity size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )}
                </span>
                <div className="timeline-item-body">
                  <div className="timeline-item-meta">
                    <span className="timeline-item-source">{entry.source}</span>
                    <span
                      className="timeline-item-time"
                      title={formatAbsoluteTime(entry.timestamp)}
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="timeline-item-content">{entry.content}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add Situation Report Form */}
        <form className="add-report-form" onSubmit={handleAddReport}>
          <label htmlFor={`report-input-${incident.id}`} className="detail-label">
            Add situation report
          </label>
          <textarea
            id={`report-input-${incident.id}`}
            className="add-report-input"
            placeholder="Log an on-scene update, rescuer observation, road blockage, or casualty change…"
            value={newReportContent}
            onChange={e => setNewReportContent(e.target.value)}
            disabled={isSubmittingReport}
            rows={2}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '9px', color: '#8c9ea8' }}>
              Submits directly to backend situation reports feed
            </span>
            <button
              type="submit"
              className="add-report-submit"
              disabled={!newReportContent.trim() || isSubmittingReport}
            >
              {isSubmittingReport ? (
                <LoaderCircle size={12} className="is-spinning" />
              ) : (
                <Send size={12} />
              )}
              {isSubmittingReport ? 'Submitting…' : 'Submit report'}
            </button>
          </div>

          {reportSubmitSuccess && (
            <div className="status-feedback-success" role="status">
              <Check size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
              {reportSubmitSuccess}
            </div>
          )}

          {reportSubmitError && (
            <div className="status-feedback-error" role="alert">
              <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-top' }} />
              {reportSubmitError}
            </div>
          )}
        </form>
      </div>

      {/* Section 6: AI Decision Support Output */}
      <h3 className="detail-section-title">
        <BrainCircuit size={14} /> AI Decision Support
      </h3>

      {isAnalyzing && (
        <div className="analysis-state" role="status">
          <LoaderCircle size={24} className="is-spinning" />
          <strong>Analysing incident</strong>
          <p>Processing situation summary, risk prediction, and resource dispatch options…</p>
        </div>
      )}

      {!isAnalyzing && analysisError && (
        <div className="analysis-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>AI analysis failed</strong>
            <p>{analysisError}</p>
            <div className="detail-actions-bar">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onAnalyze(incident)}
              >
                Retry analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAnalyzing && !analysisError && analysis && (
        <AnalysisDetails response={analysis} />
      )}

      {!isAnalyzing && !analysisError && !analysis && (
        <div className="analysis-empty">
          <span className="analysis-empty-icon"><BrainCircuit size={22} /></span>
          <strong>Ready for AI decision analysis</strong>
          <p>Click “Initiate AI analysis” above to generate situation assessments, risk escalation forecasts, and dispatch recommendations.</p>
        </div>
      )}

      <div className="analysis-dispatch-note">
        <ShieldCheck size={15} />
        <span>Analysis creates a pending dispatch plan in the backend; it does not execute autonomous dispatch without operator approval.</span>
      </div>
    </aside>
  );
}

function DetailField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}) {
  const isMissing = value === null || value === undefined || value === '';
  return (
    <div className={`detail-field${fullWidth ? ' full-width' : ''}`}>
      <span className="detail-label">{label}</span>
      <div className={`detail-value${isMissing ? ' is-not-provided' : ''}`}>
        {isMissing ? 'Not provided' : value}
      </div>
    </div>
  );
}

function AnalysisDetails({ response }: { response: FullResponsePlan }) {
  const situation = getRecord(response, 'situation');
  const risk = getRecord(response, 'risk');
  const prediction = getRecord(response, 'prediction');
  const dataQuality = getRecord(response, 'data_quality');
  const resourceResult = getRecord(response, 'resource_agent_result');
  const safety = getRecord(response, 'safety_check');
  const autonomy = getRecord(response, 'autonomy_decision');
  const trace = getRecord(response, 'trace');
  const riskLevel = getString(risk, 'risk_level');
  const overallConfidence = getNumber(response, 'overall_confidence');
  const humanReview = getBoolean(response, 'human_review_required')
    ?? getBoolean(autonomy, 'human_review_required');
  const predictionAvailable = isPredictionAvailable(prediction);
  const assignments = getRecords(response.assignments);
  const resourceAssignments = getRecords(resourceResult?.assignments);
  const assignmentsToDisplay = assignments.length ? assignments : resourceAssignments;
  const recommendedResources = resourceAssignments.length ? resourceAssignments : assignments;
  const pipelineWarnings = Array.isArray(response.warnings) ? response.warnings : [];
  const pipelineWarningMessages = pipelineWarnings.flatMap(warning => {
    const record = isJsonRecord(warning) ? warning : null;
    const message = getString(record, 'message');
    return message ? [message] : [];
  });
  const supplementalQualityWarnings = getStrings(dataQuality?.warnings)
    .filter(message => !pipelineWarningMessages.includes(message));
  const warnings = [...pipelineWarnings, ...supplementalQualityWarnings];
  const warningGroups = groupAnalysisWarnings(warnings);
  const blockingIssues = getStrings(safety?.blocking_issues);
  const safetyWarnings = getStrings(safety?.warnings);
  const missingFields = [
    ...getStrings(dataQuality?.missing_fields),
    ...getStrings(situation?.missing_information),
  ];
  const missingIncidentDetails = getMissingIncidentDetails(missingFields);
  const traceSteps = getRecords(trace?.steps);

  return (
    <div className="analysis-details">
      <section className="analysis-summary-card">
        <div className="analysis-summary-heading">
          <span className="analysis-section-label">SITUATION SUMMARY</span>
          <span className={`risk-badge risk-${slug(riskLevel)}`}>{riskLevel || 'Risk not returned'}</span>
        </div>
        <h3>{getString(situation, 'summary') || 'No situation summary was returned.'}</h3>
        <div className="analysis-summary-meta">
          {getString(situation, 'normalized_incident_type') && (
            <span>{getString(situation, 'normalized_incident_type')}</span>
          )}
          {getString(risk, 'severity') && <span>{getString(risk, 'severity')} severity</span>}
          {getNumber(risk, 'score') !== null && <span>Risk score {getNumber(risk, 'score')}/100</span>}
        </div>
        {getString(situation, 'severity_assessment') && (
          <p className="analysis-summary-note">{getString(situation, 'severity_assessment')}</p>
        )}
      </section>

      <section className="analysis-metric-row" aria-label="Analysis overview">
        <div className="analysis-metric">
          <span>RECOMMENDED ACTION</span>
          <strong>{getString(response, 'recommended_action') || 'Not returned'}</strong>
        </div>
        <div className="analysis-metric">
          <span>CONFIDENCE</span>
          <strong>{formatConfidence(overallConfidence)}</strong>
        </div>
        <div className="analysis-metric">
          <span>HUMAN REVIEW</span>
          <strong>{humanReview === null ? 'Not returned' : humanReview ? 'Required' : 'Not required'}</strong>
        </div>
      </section>

      <AnalysisSection title="Prediction">
        {prediction && predictionAvailable ? (
          <>
            <div className="prediction-overview">
              <span>Current risk <strong>{getString(prediction, 'current_risk') || 'Not returned'}</strong></span>
              <span>Escalation <strong>{getBoolean(prediction, 'escalation_detected') === null
                ? 'Not returned'
                : getBoolean(prediction, 'escalation_detected') ? 'Detected' : 'Not detected'}</strong></span>
              <span>Confidence <strong>{formatConfidence(getNumber(prediction, 'confidence'))}</strong></span>
            </div>
            {Array.isArray(prediction.forecast) && prediction.forecast.length > 0 && (
              <ul className="forecast-list">
                {getRecords(prediction.forecast).map((item, index) => (
                  <li key={`${getNumber(item, 'horizon_minutes') ?? index}-${index}`}>
                    <span>{getNumber(item, 'horizon_minutes') ?? '—'} min</span>
                    <span className={`risk-badge risk-${slug(getString(item, 'risk_level'))}`}>
                      {getString(item, 'risk_level') || 'Risk not returned'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <StringList items={getStrings(prediction.explanation)} emptyText="No prediction explanation was returned." />
          </>
        ) : (
          <div className="analysis-notice analysis-notice-info">
            <Info size={16} aria-hidden="true" />
            <span>
              <strong>Trend prediction unavailable</strong>
              <p>No usable forecast was returned for this incident. The other AI assessment results remain available below.</p>
            </span>
          </div>
        )}
      </AnalysisSection>

      <AnalysisSection title="Recommended resources">
        {recommendedResources.length ? (
          <ul className="recommendation-list">
            {recommendedResources.map((assignment, index) => (
              <li key={`${getString(assignment, 'resource_id') ?? 'resource'}-${index}`}>
                <span className="resource-symbol"><UsersRound size={15} /></span>
                <span>
                  <strong>{getString(assignment, 'resource_id') || 'Resource ID not returned'}</strong>
                  <small>{getString(assignment, 'action') || 'Action not returned'}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="analysis-muted">No recommended resources were returned.</p>}
        <StringList
          items={getStrings(resourceResult?.unfulfilled_requirements)}
          emptyText=""
          label="Unfulfilled requirements"
        />
      </AnalysisSection>

      <AnalysisSection title="Resource assignments">
        {assignmentsToDisplay.length ? (
          <div className="assignment-list">
            {assignmentsToDisplay.map((assignment, index) => {
              const route = getRecord(assignment, 'route');
              const arrivalTime = getNumber(assignment, 'estimated_arrival_time_mins')
                ?? getNumber(route, 'estimated_time_mins');
              return (
                <article className="assignment-card" key={`${getString(assignment, 'resource_id') ?? 'assignment'}-${index}`}>
                  <div className="assignment-heading">
                    <strong>{getString(assignment, 'resource_id') || 'Resource ID not returned'}</strong>
                    <span>{getString(assignment, 'action') || 'Action not returned'}</span>
                  </div>
                  <div className="assignment-route">
                    {getString(route, 'route_status') && <span>{getString(route, 'route_status')}</span>}
                    {arrivalTime !== null && <span>ETA {arrivalTime} min</span>}
                    {getNumber(route, 'distance_km') !== null && <span>{getNumber(route, 'distance_km')} km</span>}
                  </div>
                  {getString(route, 'explanation') && <p>{getString(route, 'explanation')}</p>}
                </article>
              );
            })}
          </div>
        ) : <p className="analysis-muted">No resource assignments were returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Recommendation explanation">
        <StringList
          items={[
            ...getStrings(response.explanation),
            ...getStrings(risk?.reasons),
            ...getStrings(resourceResult?.reasons),
          ]}
          emptyText="No explanation was returned."
        />
      </AnalysisSection>

      <AnalysisSection title="Data quality">
        {dataQuality ? (
          <>
            <div className="quality-overview">
              <span className={`quality-badge quality-${slug(getString(dataQuality, 'overall_quality'))}`}>
                {getString(dataQuality, 'overall_quality') || 'Quality not returned'}
              </span>
              <span>Confidence <strong>{formatConfidence(getNumber(dataQuality, 'confidence'))}</strong></span>
            </div>
            <QualityField label="Stale fields" values={getStrings(dataQuality.stale_fields)} />
            <QualityField label="Invalid fields" values={getStrings(dataQuality.invalid_fields)} />
            <QualityField label="Conflicting fields" values={getStrings(dataQuality.conflicting_fields)} />
          </>
        ) : <p className="analysis-muted">No data-quality assessment was returned.</p>}
      </AnalysisSection>

      <AnalysisSection title="Warnings & safety notices">
        <div className="analysis-notice-list">
          {(blockingIssues.length > 0 || getString(safety, 'status') === 'BLOCKED') && (
            <div className="analysis-notice analysis-notice-critical" role="alert">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>
                <strong>Critical safety issue · Do not dispatch</strong>
                <p>Resolve the safety issues below and review the plan before any dispatch is approved.</p>
                {blockingIssues.length > 0 && (
                  <ul className="analysis-notice-list-items">
                    {blockingIssues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
                  </ul>
                )}
              </span>
            </div>
          )}

          {warningGroups.map(group => (
            <div
              className={`analysis-notice analysis-notice-${group.severity}`}
              key={group.key}
              role={group.severity === 'critical' ? 'alert' : 'status'}
            >
              {group.severity === 'info' ? <Info size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
              <span>
                <span className="analysis-notice-heading">
                  <strong>{group.title}</strong>
                  <span>{group.severity === 'info' ? 'Information' : group.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                </span>
                <p>{group.description}</p>
                {group.key === 'INCOMPLETE_INCIDENT' && missingIncidentDetails.length > 0 && (
                  <>
                    <ul className="analysis-missing-list">
                      {missingIncidentDetails.map(detail => (
                        <li key={detail.key}>
                          <strong>{detail.label}</strong>
                          <span>{detail.guidance}</span>
                        </li>
                      ))}
                    </ul>
                    <details className="analysis-notice-details">
                      <summary>Returned field names ({missingFields.length})</summary>
                      <p>{missingFields.join(', ')}</p>
                    </details>
                  </>
                )}
                {group.details.length > 0 && (
                  <details className="analysis-notice-details">
                    <summary>Technical details ({group.details.length})</summary>
                    <ul>
                      {group.details.map((detail, index) => (
                        <li key={`${detail.code}-${detail.source}-${index}`}>
                          <code>{detail.code}</code>
                          <span>{detail.source}</span>
                          <p>{detail.message}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </span>
            </div>
          ))}

          {missingIncidentDetails.length > 0 && !warningGroups.some(group => group.key === 'INCOMPLETE_INCIDENT') && (
            <div className="analysis-notice analysis-notice-warning" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>Incident details need confirmation</strong>
                <p>Confirm these details with the reporting source. No values have been inferred.</p>
                <ul className="analysis-missing-list">
                  {missingIncidentDetails.map(detail => (
                    <li key={detail.key}>
                      <strong>{detail.label}</strong>
                      <span>{detail.guidance}</span>
                    </li>
                  ))}
                </ul>
                <details className="analysis-notice-details">
                  <summary>Returned field names ({missingFields.length})</summary>
                  <p>{missingFields.join(', ')}</p>
                </details>
              </span>
            </div>
          )}

          {safetyWarnings.length > 0 && (
            <div className="analysis-notice analysis-notice-warning" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                <strong>Safety warnings</strong>
                <ul className="analysis-notice-list-items">
                  {safetyWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </span>
            </div>
          )}

          {blockingIssues.length === 0 &&
            getString(safety, 'status') !== 'BLOCKED' &&
            warningGroups.length === 0 &&
            missingIncidentDetails.length === 0 &&
            safetyWarnings.length === 0 && (
              <p className="analysis-muted">No warnings or blocking safety issues were returned.</p>
            )}
        </div>
      </AnalysisSection>

      <AnalysisSection title="Human review & safety">
        <div className="safety-overview">
          <span className={`safety-badge safety-${slug(getString(safety, 'status'))}`}>
            Safety: {getString(safety, 'status')?.replace(/_/g, ' ') || 'Not returned'}
          </span>
          <span className="safety-badge">
            Human review: {humanReview === null ? 'Not returned' : humanReview ? 'Required' : 'Not required'}
          </span>
        </div>
        {getBoolean(safety, 'is_safe_for_autonomous_execution') !== null && (
          <p className="analysis-muted">
            Autonomous execution: {getBoolean(safety, 'is_safe_for_autonomous_execution') ? 'marked safe' : 'not marked safe'}
            {getNumber(safety, 'checks_performed') !== null && ` · ${getNumber(safety, 'checks_performed')} checks performed`}
          </p>
        )}
        {getString(autonomy, 'mode') && (
          <p className="autonomy-reason">
            <strong>{getString(autonomy, 'mode')?.replace(/_/g, ' ')}</strong>
            {getString(autonomy, 'reason') && ` · ${getString(autonomy, 'reason')}`}
          </p>
        )}
      </AnalysisSection>

      {(trace || getString(response, 'trace_id')) && (
        <AnalysisSection title="AI execution trace">
          <div className="trace-meta">
            {(getString(trace, 'trace_id') || getString(response, 'trace_id')) && (
              <span>Trace ID <strong>{getString(trace, 'trace_id') || getString(response, 'trace_id')}</strong></span>
            )}
            {getNumber(trace, 'total_execution_time_ms') !== null && (
              <span>Duration <strong>{getNumber(trace, 'total_execution_time_ms')} ms</strong></span>
            )}
          </div>
          {traceSteps.length > 0 && (
            <ol className="trace-list">
              {traceSteps.map((step, index) => (
                <li key={`${getString(step, 'step_name') ?? 'step'}-${index}`}>
                  <span className={`trace-step-status trace-${slug(getString(step, 'status'))}`} />
                  <span>
                    <strong>{getString(step, 'step_name') || getString(step, 'agent_name') || 'Pipeline step'}</strong>
                    <small>{getString(step, 'agent_name') || getString(step, 'status') || 'Status not returned'}</small>
                  </span>
                  {getNumber(step, 'execution_time_ms') !== null && (
                    <span className="trace-duration">{getNumber(step, 'execution_time_ms')} ms</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </AnalysisSection>
      )}
    </div>
  );
}

function AnalysisSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="analysis-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function StringList({
  items,
  emptyText,
  label,
}: {
  items: string[];
  emptyText: string;
  label?: string;
}) {
  if (!items.length && !emptyText) return null;
  return (
    <div className="string-list-block">
      {label && <h4>{label}</h4>}
      {items.length ? (
        <ul className="string-list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
      ) : <p className="analysis-muted">{emptyText}</p>}
    </div>
  );
}

function QualityField({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="quality-field">
      <strong>{label}</strong>
      <span>{values.join(', ')}</span>
    </div>
  );
}

export default IncidentsPage;
