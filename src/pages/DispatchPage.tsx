/**
 * Planning, Resource Allocation & Dispatch Workspace Page
 *
 * Implements the end-to-end Dispatch interface:
 * 1. Plan Overview List with search, filtering, and sorting.
 * 2. Incident -> Resource Allocation -> Destination Hospital workflow chain.
 * 3. Resource Allocation View distinguishing SUGGESTED vs CONFIRMED assignments.
 * 4. Destination Hospital details with real bed capacity metrics.
 * 5. Strict Route & ETA presentation (never fabricated; displays "Not available" when absent).
 * 6. Incomplete plan indicators and independent loading/error sub-states.
 * 7. Dispatch Execution with accessible review confirmation modal, double-submission protection,
 *    no optimistic updates, aria-live feedback, error retry, and shared cache synchronization.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Clock3,
  ExternalLink,
  Filter,
  FilterX,
  Hospital as HospitalIcon,
  Info,
  LoaderCircle,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  approveDispatchPlan,
  canApproveDispatchPlan,
  canExecuteDispatchPlan,
  executeDispatchPlan,
  fetchDispatchContextData,
  fetchIncidentById,
  fetchIncidents,
  filterDispatchPlans,
  formatAssignmentStatus,
  formatDateTime,
  formatDispatchPlanStatus,
  formatDispatchSummary,
  formatRouteDistance,
  formatRouteDuration,
  getExecutionStatusBadge,
  getIncompletePlanItems,
  getPlanResourceBreakdown,
  groupDispatchPlanVersions,
  isJsonRecord,
  setDispatchPlanHospital,
  sortDispatchPlans,
  updateCachedIncident,
  useDispatchPlans,
  type DispatchPlan,
  type DispatchPlanStatus,
  type DispatchSortOrder,
  type Hospital,
  type Incident,
  type Resource,
  type ResourceAssignment,
} from '../services/api';

function formatLocation(lat: number | null | undefined, lng: number | null | undefined): string {
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `Lat ${lat.toFixed(4)}, Long ${lng.toFixed(4)}`;
  }
  return 'Location not provided';
}

function formatResourceName(resource: ResourceAssignment): string {
  if (resource.resourceName && resource.resourceName.trim()) {
    return resource.resourceName.trim();
  }
  return resource.resourceId;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function DispatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state persistence
  const queryParam = searchParams.get('q') || '';
  const statusParam = (searchParams.get('status') || 'ALL').toUpperCase();
  const incidentParam = searchParams.get('incident') || 'ALL';
  const sortParam = (searchParams.get('sort') || 'newest') as DispatchSortOrder;
  const selectedPlanIdParam = searchParams.get('planId') || null;

  // Local filter states
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [incidentFilter, setIncidentFilter] = useState(incidentParam);
  const [sortOrder, setSortOrder] = useState<DispatchSortOrder>(sortParam);
  const [showSkippedNotice, setShowSkippedNotice] = useState(true);

  // Execution states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isSavingHospital, setIsSavingHospital] = useState(false);
  const [hospitalSaveError, setHospitalSaveError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; planId: string } | null>(null);
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>('');

  // Context data state (Hospitals & Resources for metadata enrichment)
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [contextLoading, setContextLoading] = useState<boolean>(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextRefreshKey, setContextRefreshKey] = useState<number>(0);

  // Maps for fast lookup
  const knownHospitals = useMemo(() => new Map<string, Hospital>(hospitals.map(h => [h.id, h])), [hospitals]);
  const knownResources = useMemo(() => new Map<string, Resource>(resources.map(r => [r.id, r])), [resources]);
  const incidentsMap = useMemo(() => new Map<string, Incident>(incidents.map(inc => [inc.id, inc])), [incidents]);

  // Load context data (hospitals, resources, incidents) with independent lifecycle
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setContextLoading(true);
    setContextError(null);

    Promise.allSettled([
      fetchDispatchContextData({ signal: controller.signal }),
      fetchIncidents({ signal: controller.signal }),
    ])
      .then(([ctxResult, incResult]) => {
        if (!mounted) return;

        if (ctxResult.status === 'fulfilled') {
          setHospitals(ctxResult.value.hospitals);
          setResources(ctxResult.value.resources);
        } else {
          setContextError(
            ctxResult.reason instanceof Error
              ? ctxResult.reason.message
              : 'Could not load hospital and resource context.'
          );
        }

        if (incResult.status === 'fulfilled') {
          setIncidents(incResult.value);
        }
      })
      .finally(() => {
        if (mounted) setContextLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [contextRefreshKey]);

  // Primary Dispatch Plans Hook
  const {
    data: plans,
    loading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useDispatchPlans({
    knownResources,
    knownHospitals,
  });

  // Sync state to URL search parameters
  const updateQueryParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'ALL' || (key === 'sort' && value === 'newest')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    updateQueryParams({ q: val.trim() || null });
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    updateQueryParams({ status: val });
  };

  const handleIncidentChange = (val: string) => {
    setIncidentFilter(val);
    updateQueryParams({ incident: val });
  };

  const handleSortChange = (val: DispatchSortOrder) => {
    setSortOrder(val);
    updateQueryParams({ sort: val });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setIncidentFilter('ALL');
    setSortOrder('newest');
    const next = new URLSearchParams();
    if (selectedPlanIdParam) next.set('planId', selectedPlanIdParam);
    setSearchParams(next, { replace: true });
  };

  // Filter and sort plans based on loaded data
  const filteredPlans = useMemo(() => {
    const filtered = filterDispatchPlans(plans, {
      query: searchQuery,
      status: statusFilter,
      incidentId: incidentFilter,
      incidentsMap,
    });
    return sortDispatchPlans(filtered, sortOrder);
  }, [plans, searchQuery, statusFilter, incidentFilter, incidentsMap, sortOrder]);
  const planGroups = useMemo(
    () => groupDispatchPlanVersions(filteredPlans, plans),
    [filteredPlans, plans]
  );

  // Determine selected plan (URL param or fallback to first filtered plan)
  const selectedPlan: DispatchPlan | null = useMemo(() => {
    if (selectedPlanIdParam) {
      const match = plans.find(p => p.id === selectedPlanIdParam);
      if (match) return match;
    }
    return filteredPlans.length > 0 ? filteredPlans[0] : null;
  }, [selectedPlanIdParam, plans, filteredPlans]);

  const handleSelectPlan = (planId: string) => {
    setExecutionError(null);
    setApprovalError(null);
    setHospitalSaveError(null);
    updateQueryParams({ planId });
  };

  const handleRefreshAll = () => {
    refetchPlans();
    setContextRefreshKey(k => k + 1);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'ALL' || incidentFilter !== 'ALL';
  const selectedIncident = selectedPlan ? incidentsMap.get(selectedPlan.incidentId) ?? null : null;
  const incompleteItems = selectedPlan ? getIncompletePlanItems(selectedPlan, selectedIncident) : [];

  // Execution Precondition Validation
  const approvalValidation = useMemo(
    () => canApproveDispatchPlan(selectedPlan, selectedIncident, knownResources, knownHospitals),
    [selectedPlan, selectedIncident, knownResources, knownHospitals]
  );
  const executionValidation = useMemo(
    () => canExecuteDispatchPlan(selectedPlan, knownResources, knownHospitals),
    [selectedPlan, knownResources, knownHospitals]
  );

  const handleApprovePlan = async () => {
    if (!selectedPlan || isApproving || !approvalValidation.canApprove) return;
    setIsApproving(true);
    setApprovalError(null);
    setAriaLiveMessage(`Approving dispatch plan ${selectedPlan.id}...`);
    try {
      const approved = await approveDispatchPlan(
        { planId: selectedPlan.id },
        { knownResources, knownHospitals }
      );
      await refetchPlans();
      setAriaLiveMessage(`Plan ${approved.id} was approved for dispatch review.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plan approval failed.';
      setApprovalError(message);
      setAriaLiveMessage(`Plan approval failed: ${message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveHospital = async (hospitalId: string | null) => {
    if (!selectedPlan || isSavingHospital) return;
    setIsSavingHospital(true);
    setHospitalSaveError(null);
    try {
      await setDispatchPlanHospital(
        { planId: selectedPlan.id, hospitalId },
        { knownResources, knownHospitals }
      );
      await refetchPlans();
      setContextRefreshKey(key => key + 1);
      setAriaLiveMessage(hospitalId
        ? 'Receiving hospital assignment saved.'
        : 'Receiving hospital assignment cleared.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hospital assignment could not be saved.';
      setHospitalSaveError(message);
      setAriaLiveMessage(`Hospital assignment failed: ${message}`);
    } finally {
      setIsSavingHospital(false);
    }
  };

  // Handle Execution Trigger (Opens Review Modal)
  const handleOpenExecutionModal = () => {
    if (!selectedPlan || !executionValidation.canExecute) return;
    setExecutionError(null);
    setShowConfirmModal(true);
  };

  // Execute Dispatch Plan (No optimistic updates; verifies real backend response)
  const handleConfirmExecution = async () => {
    if (!selectedPlan || isExecuting) return;

    setIsExecuting(true);
    setExecutionError(null);
    setAriaLiveMessage(`Initiating dispatch execution for plan ${selectedPlan.id}...`);

    try {
      const result = await executeDispatchPlan(
        { planId: selectedPlan.id },
        { knownResources, knownHospitals }
      );

      // Verify that backend returned success
      if (result.success && result.plan) {
        setShowConfirmModal(false);

        const summary = formatDispatchSummary(result.plan, selectedIncident);
        const toastMsg = `Dispatch plan #${result.plan.id.slice(0, 8)} executed: ${summary.unitCount} emergency unit(s) dispatched to ${summary.incidentTitle}.`;

        setSuccessToast({
          message: toastMsg,
          planId: result.plan.id,
        });
        setAriaLiveMessage(toastMsg);

        // 1. Refresh dispatch plans list
        await refetchPlans();

        // 2. Refresh context data so resources show DISPATCHED
        setContextRefreshKey(k => k + 1);

        // 3. Synchronize shared incident cache so IncidentsPage and DecisionEnginePage reflect status
        if (selectedPlan.incidentId) {
          try {
            const updatedInc = await fetchIncidentById(selectedPlan.incidentId);
            updateCachedIncident(updatedInc);
          } catch {
            // Non-critical background sync
          }
        }
      } else {
        throw new Error('Dispatch execution response did not confirm plan execution.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dispatch execution failed due to an unexpected error.';
      setExecutionError(msg);
      setAriaLiveMessage(`Dispatch execution failed: ${msg}`);
      setShowConfirmModal(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Auto-dismiss success toast after 6 seconds
  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => {
      setSuccessToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [successToast]);

  return (
    <div className="dispatch-workspace-wrapper">
      {/* Screen reader live announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaLiveMessage}
      </div>

      {/* Workspace Top Header */}
      <header className="dispatch-header">
        <div className="dispatch-header-copy">
          <div className="dispatch-title-row">
            <span className="dispatch-header-icon" aria-hidden="true">
              <Truck size={22} />
            </span>
            <h1>Planning &amp; Dispatch</h1>
            <span className="quiet-badge">
              <span className="status-dot" aria-hidden="true" />
              <span>Operational Execution Hub</span>
            </span>
          </div>
          <p>
            Review each plan, confirm safety and hospital capacity where relevant, record approval,
            then execute an approved dispatch only when current resource availability is verified.
          </p>
        </div>

        <div className="dispatch-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefreshAll}
            disabled={plansLoading || contextLoading || isExecuting}
            title="Refresh dispatch plans and context"
          >
            <RefreshCw
              size={14}
              className={plansLoading || contextLoading ? 'is-spinning' : ''}
              aria-hidden="true"
            />
            <span>Refresh Workspace</span>
          </button>
        </div>
      </header>

      {/* Global Success Feedback Banner / Toast */}
      {successToast && (
        <div className="dispatch-success-banner" role="status">
          <div className="banner-icon-col">
            <CheckCircle2 size={18} className="banner-icon is-success" aria-hidden="true" />
          </div>
          <div className="banner-text-col">
            <strong>Execution Confirmed:</strong>
            <p>{successToast.message}</p>
          </div>
          <button
            type="button"
            className="banner-close-btn"
            onClick={() => setSuccessToast(null)}
            aria-label="Dismiss confirmation"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Non-blocking Notice for Degraded or Skipped Plans */}
      {showSkippedNotice && plans.some(p => p.fallbackUsed || p.degraded) && (
        <div className="dispatch-skipped-notice" role="status">
          <Info size={16} className="skipped-notice-icon" aria-hidden="true" />
          <div className="skipped-notice-text">
            <strong>Fallback used in analysis:</strong> One or more saved plans report degraded analysis or a fallback component.
            Review their safety results before approval.
          </div>
          <button
            type="button"
            className="skipped-notice-dismiss"
            onClick={() => setShowSkippedNotice(false)}
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Filter & Search Controls Bar */}
      <section className="dispatch-controls" aria-label="Dispatch filters">
        <div className="dispatch-search-box">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="dispatch-search-input"
            placeholder="Search plans, incidents, units, hospitals..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label="Search dispatch plans"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => handleSearchChange('')}
              aria-label="Clear search query"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="dispatch-filters-group">
          {/* Status Filter Dropdown */}
          <div className="filter-select-wrapper">
            <label htmlFor="dispatch-status-filter" className="sr-only">Filter by Status</label>
            <select
              id="dispatch-status-filter"
              className="dispatch-filter-select"
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="EXECUTED">Execution recorded</option>
              <option value="APPROVED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="UNKNOWN">Unknown Status</option>
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Incident Filter Dropdown */}
          <div className="filter-select-wrapper">
            <label htmlFor="dispatch-incident-filter" className="sr-only">Filter by Incident</label>
            <select
              id="dispatch-incident-filter"
              className="dispatch-filter-select"
              value={incidentFilter}
              onChange={e => handleIncidentChange(e.target.value)}
            >
              <option value="ALL">All Incidents ({incidents.length})</option>
              {incidents.map(inc => (
                <option key={inc.id} value={inc.id}>
                  {inc.type}: {inc.title || inc.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" aria-hidden="true" />
          </div>

          {/* Sort Order Dropdown */}
          <div className="filter-select-wrapper">
            <label htmlFor="dispatch-sort-filter" className="sr-only">Sort Plans</label>
            <select
              id="dispatch-sort-filter"
              className="dispatch-filter-select"
              value={sortOrder}
              onChange={e => handleSortChange(e.target.value as DispatchSortOrder)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ArrowUpDown size={13} className="select-arrow" aria-hidden="true" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={handleClearFilters}
              title="Clear all active filters"
            >
              <FilterX size={14} aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="dispatch-counts-summary">
          <span>
            Showing <strong>{filteredPlans.length}</strong> of {plans.length} plan{plans.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {/* Main Workspace Layout: Side-by-side on wide screens, stacked on narrow */}
      <div className="dispatch-workspace-grid">
        {/* LEFT COLUMN: Dispatch Plans List */}
        <section className="dispatch-list-panel" aria-label="Dispatch plan queue">
          <div className="dispatch-panel-header">
            <h2>Dispatch Queue</h2>
            <span className="dispatch-badge-count">{filteredPlans.length}</span>
          </div>

          {/* Primary Plans Loading State */}
          {plansLoading && (
            <div className="dispatch-skeleton-list" aria-busy="true" aria-label="Loading dispatch plans">
              {[1, 2, 3].map(i => (
                <div key={i} className="dispatch-plan-card skeleton-card">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-sub" />
                  <div className="skeleton-line skeleton-meta" />
                </div>
              ))}
            </div>
          )}

          {/* Primary Plans Error State with Retry */}
          {!plansLoading && plansError && (
            <div className="dispatch-error-state" role="alert">
              <AlertTriangle size={24} className="error-icon" aria-hidden="true" />
              <h3>Failed to load dispatch plans</h3>
              <p>{plansError}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => refetchPlans()}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Retry Fetch</span>
              </button>
            </div>
          )}

          {/* Global Empty State (No plans exist in system) */}
          {!plansLoading && !plansError && plans.length === 0 && (
            <div className="dispatch-empty-state">
              <div className="empty-icon-wrap">
                <Truck size={32} aria-hidden="true" />
              </div>
              <h3>No dispatch plans generated yet</h3>
              <p>
                An operator can request an AI analysis from an incident record. The backend saves each returned plan as a separate version.
              </p>
              <Link to="/incidents" className="secondary-button dispatch-empty-action">
                <span>Go to Incidents</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* Filtered Empty State (No plans matched active filters) */}
          {!plansLoading && !plansError && plans.length > 0 && filteredPlans.length === 0 && (
            <div className="dispatch-empty-state">
              <div className="empty-icon-wrap">
                <FilterX size={28} aria-hidden="true" />
              </div>
              <h3>No matching dispatch plans</h3>
              <p>No plans match your current search and filter settings.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={handleClearFilters}
              >
                <span>Clear All Filters</span>
              </button>
            </div>
          )}

          {/* Populated Plans List */}
          {!plansLoading && !plansError && filteredPlans.length > 0 && (
            <div className="dispatch-cards-scroll" aria-label="Plans grouped by incident">
              {planGroups.map(group => {
                const groupIncident = incidentsMap.get(group.incidentId);
                const latestVisible = group.plans.some(plan => plan.id === group.latestPlanId);
                return (
                  <section className="dispatch-plan-version-group" key={group.incidentId}>
                    <header className="dispatch-plan-version-heading">
                      <div>
                        <h3>{groupIncident?.title || `Incident #${group.incidentId.slice(0, 8)}`}</h3>
                        <span>{group.versionCount} saved plan {group.versionCount === 1 ? 'version' : 'versions'}</span>
                      </div>
                      {!latestVisible && <span>Latest version hidden by filters</span>}
                    </header>
                    <div className="dispatch-plan-version-list" role="list">
                      {group.plans.map(plan => {
                const isSelected = selectedPlan?.id === plan.id;
                const isLatestVersion = plan.id === group.latestPlanId;
                const statusMeta = formatDispatchPlanStatus(plan.status);
                const incident = incidentsMap.get(plan.incidentId);
                const breakdown = getPlanResourceBreakdown(plan.suggestedResources);
                const incomplete = getIncompletePlanItems(plan, incident);

                return (
                  <div
                    key={plan.id}
                    role="listitem"
                    className={`dispatch-plan-card${isSelected ? ' is-selected' : ''}${isLatestVersion ? ' is-latest-version' : ''}`}
                    onClick={() => handleSelectPlan(plan.id)}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPlan(plan.id);
                      }
                    }}
                  >
                    {/* Card Top: Plan ID, Status Badge & Timestamp */}
                    <div className="dispatch-card-top">
                      <div className="dispatch-card-id-block">
                        <strong className="dispatch-plan-id">
                          Plan #{plan.id.slice(0, 8)}
                        </strong>
                        <span className={`dispatch-version-badge${isLatestVersion ? ' is-latest' : ''}`}>
                          {isLatestVersion ? 'Latest version' : 'Previous version'}
                        </span>
                        <span className="dispatch-card-timestamp">
                          <Clock3 size={11} aria-hidden="true" />
                          <span>{formatDateTime(plan.createdAt)}</span>
                        </span>
                      </div>
                      <span className={`dispatch-status-badge ${statusMeta.className}`}>
                        {plan.status === 'EXECUTED' && <CheckCircle2 size={12} aria-hidden="true" />}
                        {plan.status === 'PENDING' && <Clock size={12} aria-hidden="true" />}
                        {plan.status === 'APPROVED' && <ShieldCheck size={12} aria-hidden="true" />}
                        {plan.status === 'CANCELLED' && <XCircle size={12} aria-hidden="true" />}
                        {plan.status === 'UNKNOWN' && <AlertCircle size={12} aria-hidden="true" />}
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>

                    {/* Associated Incident Info */}
                    <div className="dispatch-card-incident">
                      <div className="incident-meta-row">
                        <span className="incident-category-badge">
                          {incident?.type ?? 'INCIDENT'}
                        </span>
                        <span className="incident-status-tag">
                          {incident?.status ?? 'STATUS NOT PROVIDED'}
                        </span>
                        {plan.incidentId && (
                          <Link
                            to={`/incidents?selected=${plan.incidentId}`}
                            className="incident-link-btn"
                            onClick={e => e.stopPropagation()}
                            title="Open incident in Incidents workspace"
                          >
                            <span>View Incident</span>
                            <ExternalLink size={10} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                      <strong className="incident-title-text">
                        {incident?.title || `Incident #${plan.incidentId.slice(0, 8)}`}
                      </strong>
                      <span className="incident-location-text">
                        <MapPin size={11} aria-hidden="true" />
                        <span>{formatLocation(incident?.locationLat, incident?.locationLng)}</span>
                      </span>
                    </div>

                    {/* Assignment Summary */}
                    {plan.recommendedAction && (
                      <div className="dispatch-card-action">
                        <span className="action-label">Recommended Action:</span>
                        <span className="action-value">{plan.recommendedAction}</span>
                      </div>
                    )}

                    {/* Resources Count & Type Breakdown */}
                    <div className="dispatch-card-breakdown">
                      <div className="breakdown-header">
                        <UsersRound size={12} aria-hidden="true" />
                        <span>
                          <strong>{breakdown.total}</strong> resource{breakdown.total === 1 ? '' : 's'} allocated
                        </span>
                      </div>
                      <div className="breakdown-chips">
                        {Object.entries(breakdown.byType).map(([type, count]) => (
                          <span key={type} className="resource-chip">
                            {type}: {count}
                          </span>
                        ))}
                        {breakdown.total === 0 && (
                          <span className="resource-chip is-empty">
                            No resources allocated
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Receiving Hospital Destination */}
                    <div className="dispatch-card-hospital">
                      <HospitalIcon size={12} aria-hidden="true" />
                      <span className="hospital-name-text">
                        {plan.targetHospital?.name ||
                          (plan.targetHospitalId ? `Hospital #${plan.targetHospitalId.slice(0, 8)}` : 'No hospital assigned')}
                      </span>
                      {plan.targetHospital?.availableBeds !== null && plan.targetHospital?.availableBeds !== undefined && (
                        <span className="hospital-beds-tag">
                          {plan.targetHospital.availableBeds} beds avail.
                        </span>
                      )}
                    </div>

                    {/* Incomplete Plan Warning Tag */}
                    {incomplete.length > 0 && (
                      <div className="card-incomplete-tag" title={incomplete.join(', ')}>
                        <AlertTriangle size={11} aria-hidden="true" />
                        <span>Incomplete ({incomplete.length})</span>
                      </div>
                    )}
                  </div>
                );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Dispatch Details & Planning Inspector */}
        <section className="dispatch-details-panel" aria-label="Dispatch plan details">
          {!selectedPlan ? (
            <div className="dispatch-empty-details">
              <Truck size={36} className="empty-details-icon" aria-hidden="true" />
              <h3>Select a dispatch plan</h3>
              <p>
                Choose an item from the dispatch queue on the left to inspect its resource assignments,
                receiving facility readiness, and execute official dispatch orders.
              </p>
            </div>
          ) : (
            <DispatchPlanInspector
              plan={selectedPlan}
              incident={selectedIncident}
              contextLoading={contextLoading}
              contextError={contextError}
              onRetryContext={() => setContextRefreshKey(k => k + 1)}
              hospitals={hospitals}
              isSavingHospital={isSavingHospital}
              hospitalSaveError={hospitalSaveError}
              onSaveHospital={handleSaveHospital}
              canApprove={approvalValidation.canApprove}
              approvalBlockReason={approvalValidation.reason}
              isApproving={isApproving}
              approvalError={approvalError}
              onApprove={handleApprovePlan}
              canExecute={executionValidation.canExecute}
              executionBlockReason={executionValidation.reason}
              isExecuting={isExecuting}
              executionError={executionError}
              onTriggerExecution={handleOpenExecutionModal}
              onClearExecutionError={() => setExecutionError(null)}
            />
          )}
        </section>
      </div>

      {/* Accessible Review & Confirmation Dialog */}
      {showConfirmModal && selectedPlan && (
        <DispatchConfirmModal
          plan={selectedPlan}
          incident={selectedIncident}
          isExecuting={isExecuting}
          onConfirm={handleConfirmExecution}
          onCancel={() => {
            if (!isExecuting) setShowConfirmModal(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Comprehensive Plan Inspector
// ---------------------------------------------------------------------------

interface DispatchPlanInspectorProps {
  plan: DispatchPlan;
  incident: Incident | null;
  contextLoading: boolean;
  contextError: string | null;
  onRetryContext: () => void;
  hospitals: Hospital[];
  isSavingHospital: boolean;
  hospitalSaveError: string | null;
  onSaveHospital: (hospitalId: string | null) => void;
  canApprove: boolean;
  approvalBlockReason: string | null;
  isApproving: boolean;
  approvalError: string | null;
  onApprove: () => void;
  canExecute: boolean;
  executionBlockReason: string | null;
  isExecuting: boolean;
  executionError: string | null;
  onTriggerExecution: () => void;
  onClearExecutionError: () => void;
}

function DispatchPlanInspector({
  plan,
  incident,
  contextLoading,
  contextError,
  onRetryContext,
  hospitals,
  isSavingHospital,
  hospitalSaveError,
  onSaveHospital,
  canApprove,
  approvalBlockReason,
  isApproving,
  approvalError,
  onApprove,
  canExecute,
  executionBlockReason,
  isExecuting,
  executionError,
  onTriggerExecution,
  onClearExecutionError,
}: DispatchPlanInspectorProps) {
  const [selectedHospitalId, setSelectedHospitalId] = useState(plan.targetHospitalId ?? '');
  useEffect(() => {
    setSelectedHospitalId(plan.targetHospitalId ?? '');
  }, [plan.id, plan.targetHospitalId]);

  const statusBadge = getExecutionStatusBadge(plan.status, isExecuting, Boolean(executionError));
  const incompleteItems = getIncompletePlanItems(plan, incident);
  const breakdown = getPlanResourceBreakdown(plan.suggestedResources);
  const selectedHospital = hospitals.find(hospital => hospital.id === selectedHospitalId);
  const selectedHospitalHasCapacity = !selectedHospitalId
    || (selectedHospital?.capacity?.available !== null
      && selectedHospital?.capacity?.available !== undefined
      && selectedHospital.capacity.available > 0);
  const hospitalAssignmentChanged = selectedHospitalId !== (plan.targetHospitalId ?? '');
  const safetyCheck = isJsonRecord(plan.rawDetails?.safety_check) ? plan.rawDetails.safety_check : null;
  const safetyStatus = typeof safetyCheck?.status === 'string' ? safetyCheck.status.toUpperCase() : '';
  const safetyBlockingIssues = getStringArray(safetyCheck?.blocking_issues);
  const safetyWarningItems = [...new Set([
    ...plan.warnings,
    ...getStringArray(safetyCheck?.warnings),
  ])];

  // Split resources into SUGGESTED vs CONFIRMED
  const suggestedResources = plan.suggestedResources.filter(
    r => !r.isConfirmed && r.assignmentStatus !== 'CONFIRMED' && r.assignmentStatus !== 'DISPATCHED'
  );
  const confirmedResources = plan.suggestedResources.filter(
    r => r.isConfirmed || r.assignmentStatus === 'CONFIRMED' || r.assignmentStatus === 'DISPATCHED'
  );

  return (
    <div className="inspector-container">
      {/* Top Banner: Plan ID, Status & Execution Action Control */}
      <div className="inspector-top-banner">
        <div className="inspector-title-meta">
          <div className="inspector-badge-row">
            <span className={`dispatch-status-badge ${statusBadge.className}`}>
              {isExecuting && <LoaderCircle size={13} className="is-spinning" aria-hidden="true" />}
              {!isExecuting && plan.status === 'EXECUTED' && <CheckCircle2 size={13} aria-hidden="true" />}
              {!isExecuting && plan.status === 'PENDING' && <Clock size={13} aria-hidden="true" />}
              {!isExecuting && plan.status === 'APPROVED' && <ShieldCheck size={13} aria-hidden="true" />}
              {!isExecuting && plan.status === 'CANCELLED' && <XCircle size={13} aria-hidden="true" />}
              {!isExecuting && plan.status === 'UNKNOWN' && <AlertCircle size={13} aria-hidden="true" />}
              <span>{statusBadge.label}</span>
            </span>

            <span className="inspector-plan-id">Plan #{plan.id}</span>
          </div>

          <div className="inspector-timestamps">
            <span>Created: {formatDateTime(plan.createdAt)}</span>
            {plan.updatedAt && plan.updatedAt !== plan.createdAt && (
              <span> • Updated: {formatDateTime(plan.updatedAt)}</span>
            )}
          </div>
        </div>

        {/* Current process state; actions are presented in Stage 5 below. */}
        <div className="inspector-execution-action-block">
          {plan.status === 'EXECUTED' ? (
            <div className="dispatched-confirmed-indicator">
              <CheckCircle2 size={15} className="indicator-icon" aria-hidden="true" />
              <span>Dispatch execution recorded in Rakshak; external unit communication is not confirmed.</span>
            </div>
          ) : plan.status === 'CANCELLED' ? (
            <div className="dispatched-cancelled-indicator">
              <XCircle size={15} className="indicator-icon" aria-hidden="true" />
              <span>Plan Cancelled</span>
            </div>
          ) : plan.status === 'APPROVED' ? (
            <div className="dispatch-state-note is-approved">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Approved · awaiting separate dispatch execution</span>
            </div>
          ) : (
            <div className="dispatch-state-note">
              <Clock3 size={15} aria-hidden="true" />
              <span>Pending review · not approved or dispatched</span>
            </div>
          )}
        </div>
      </div>

      {/* Execution Error Banner with Retry */}
      {executionError && (
        <div className="execution-error-banner" role="alert">
          <div className="error-icon-col">
            <AlertTriangle size={18} className="error-icon" aria-hidden="true" />
          </div>
          <div className="error-text-col">
            <strong>Dispatch Execution Failed:</strong>
            <p>{executionError}</p>
          </div>
          <div className="error-action-col">
            <button
              type="button"
              className="retry-execute-btn"
              onClick={onTriggerExecution}
              disabled={isExecuting || !canExecute}
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              className="dismiss-error-btn"
              onClick={onClearExecutionError}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {approvalError && (
        <div className="execution-error-banner" role="alert">
          <div className="error-icon-col"><AlertTriangle size={18} className="error-icon" aria-hidden="true" /></div>
          <div className="error-text-col">
            <strong>Plan approval failed</strong>
            <p>{approvalError}</p>
          </div>
        </div>
      )}

      {/* Incomplete Plan Warning Banner */}
      {incompleteItems.length > 0 && (
        <div className="incomplete-plan-banner" role="alert">
          <div className="incomplete-banner-heading">
            <AlertCircle size={18} className="incomplete-icon" aria-hidden="true" />
            <strong>Dispatch requirements need attention</strong>
          </div>
          <p>Resolve these items before this plan can move through the dispatch process:</p>
          <ul className="incomplete-items-list">
            {incompleteItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sub-Request Context Warning (Non-blocking: resources/hospital directory failure) */}
      {contextError && (
        <div className="context-warning-bar" role="status">
          <AlertTriangle size={15} className="warning-icon" aria-hidden="true" />
          <span>Live hospital/resource directory refresh failed. Showing embedded plan data.</span>
          <button
            type="button"
            className="context-retry-btn"
            onClick={onRetryContext}
            disabled={contextLoading}
          >
            <RefreshCw size={12} className={contextLoading ? 'is-spinning' : ''} aria-hidden="true" />
            <span>Retry Context</span>
          </button>
        </div>
      )}

      {/* Review stages */}
      <section className="workflow-chain-section" aria-label="Dispatch chain">
        <h3 className="section-title">Stage 1 · Review plan</h3>
        <div className="workflow-chain-grid">
          {/* Stage 1: Incident Source */}
          <div className="chain-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">1</span>
              <h4>Incident Source</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-primary-text">
                {incident?.title || (plan.incidentId ? `Incident #${plan.incidentId.slice(0, 8)}` : 'Not provided')}
              </div>
              <div className="stage-meta-row">
                <span className="stage-tag">{incident?.type ?? 'TYPE UNKNOWN'}</span>
                <span className="stage-status">{incident?.status ?? 'STATUS UNKNOWN'}</span>
              </div>
              <div className="stage-sub-text">
                <MapPin size={12} aria-hidden="true" />
                <span>{formatLocation(incident?.locationLat, incident?.locationLng)}</span>
              </div>
              {plan.incidentId && (
                <Link
                  to={`/incidents?selected=${plan.incidentId}`}
                  className="stage-action-link"
                >
                  <span>Open Incident Workspace</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          <div className="chain-connector" aria-hidden="true">
            <ArrowRight size={18} />
          </div>

          {/* Stage 2: Resource assignment */}
          <div className="chain-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">2</span>
              <h4>Resource assignment</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-primary-text">
                {breakdown.total} Emergency Unit{breakdown.total === 1 ? '' : 's'}
              </div>
              <div className="stage-meta-row">
                <span className="stage-tag">{breakdown.confirmedCount} Confirmed</span>
                <span className="stage-status">{breakdown.suggestedCount} Suggested</span>
              </div>
              <div className="stage-sub-text">
                <Activity size={12} aria-hidden="true" />
                <span>Action: {plan.recommendedAction || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div className="chain-connector" aria-hidden="true">
            <ArrowRight size={18} />
          </div>

          {/* Stage 3: Hospital assignment */}
          <div className="chain-stage-card">
            <div className="stage-card-header">
              <span className="stage-number">3</span>
              <h4>Receiving hospital</h4>
            </div>
            <div className="stage-card-body">
              <div className="stage-primary-text">
                {plan.targetHospital?.name ||
                  (plan.targetHospitalId ? `Hospital #${plan.targetHospitalId.slice(0, 8)}` : 'Not provided')}
              </div>
              <div className="stage-meta-row">
                {plan.targetHospital?.availableBeds !== null && plan.targetHospital?.availableBeds !== undefined ? (
                  <span className="stage-tag">
                    {plan.targetHospital.availableBeds} / {plan.targetHospital.totalBeds ?? '—'} Beds Available
                  </span>
                ) : (
                  <span className="stage-tag is-missing">Bed capacity not provided</span>
                )}
              </div>
              <div className="stage-sub-text">
                <MapPin size={12} aria-hidden="true" />
                <span>{formatLocation(plan.targetHospital?.locationLat, plan.targetHospital?.locationLng)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RESOURCE ALLOCATION SECTION */}
      <section className="resource-allocation-section" aria-label="Resource allocations">
        <div className="section-header-row">
          <div className="section-header-copy">
            <h3 className="section-title">Stage 2 · Resource assignment</h3>
            <p className="section-desc">
              Review the resources returned by the analysis. The current backend has no plan-level
              reassignment operation; changing units would also require route and safety revalidation.
            </p>
          </div>
        </div>

        {/* Legend Explaining Suggested vs Confirmed */}
        <div className="allocation-legend-box">
          <div className="legend-entry">
            <span className="allocation-badge badge-suggested">
              <Clock3 size={12} aria-hidden="true" />
              <span>SUGGESTED</span>
            </span>
            <span className="legend-text">
              Proposed allocation generated by AI or rule-based fallback. Units remain on standby until confirmed.
            </span>
          </div>

          <div className="legend-entry">
            <span className="allocation-badge badge-confirmed">
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>CONFIRMED</span>
            </span>
            <span className="legend-text">
              Backend execution is recorded and resources are marked DISPATCHED. This does not confirm external unit communication.
            </span>
          </div>
        </div>

        {/* Total absence of suitable resources */}
        {plan.suggestedResources.length === 0 && (
          <div className="resource-empty-alert" role="alert">
            <AlertTriangle size={20} className="alert-icon" aria-hidden="true" />
            <div className="empty-alert-text">
              <strong>No suitable resources available</strong>
              <p>
                {plan.notes ||
                  'The optimization service could not find available emergency units matching incident proximity and requirements.'}
              </p>
            </div>
          </div>
        )}

        {/* SECTION A: Confirmed Dispatches */}
        {confirmedResources.length > 0 && (
          <div className="allocation-subgroup">
            <div className="subgroup-heading">
              <CheckCircle2 size={15} className="subgroup-icon is-confirmed" aria-hidden="true" />
              <h4>Confirmed Dispatches ({confirmedResources.length})</h4>
              <span className="subgroup-caption">Units mobilized in the field</span>
            </div>

            <div className="resource-cards-grid">
              {confirmedResources.map(resource => (
                <ResourceCard key={resource.resourceId} resource={resource} />
              ))}
            </div>
          </div>
        )}

        {/* SECTION B: Suggested Allocations */}
        {suggestedResources.length > 0 && (
          <div className="allocation-subgroup">
            <div className="subgroup-heading">
              <Clock3 size={15} className="subgroup-icon is-suggested" aria-hidden="true" />
              <h4>Suggested Allocations ({suggestedResources.length})</h4>
              <span className="subgroup-caption">Awaiting operator execution</span>
            </div>

            <div className="resource-cards-grid">
              {suggestedResources.map(resource => (
                <ResourceCard key={resource.resourceId} resource={resource} />
              ))}
            </div>
          </div>
        )}

        {/* Quiet empty notice if one subgroup is zero */}
        {plan.suggestedResources.length > 0 && suggestedResources.length === 0 && (
          <div className="subgroup-quiet-notice">
            <span>All allocated units for this plan have been confirmed and dispatched.</span>
          </div>
        )}
        {plan.suggestedResources.length > 0 && confirmedResources.length === 0 && (
          <div className="subgroup-quiet-notice">
            <span>No units have been executed yet. All allocations remain suggested pending operator action.</span>
          </div>
        )}
      </section>

      {/* DESTINATION HOSPITAL & MEDICAL CAPACITY SECTION */}
      <section className="destination-hospital-section" aria-label="Receiving hospital">
        <h3 className="section-title">Stage 3 · Receiving hospital</h3>
        <p className="dispatch-stage-description">
          Hospital assignment is optional. Select a receiving hospital only when patient transport is required.
          Availability is checked against the latest capacity report and is not reserved by this assignment.
        </p>
        <div className="dispatch-hospital-assignment">
          <label htmlFor={`dispatch-hospital-${plan.id}`}>Receiving hospital</label>
          <select
            id={`dispatch-hospital-${plan.id}`}
            value={selectedHospitalId}
            onChange={event => setSelectedHospitalId(event.target.value)}
            disabled={plan.status !== 'PENDING' || contextLoading || isSavingHospital}
          >
            <option value="">No hospital selected (optional)</option>
            {hospitals.map(hospital => {
              const available = hospital.capacity?.available;
              const hasCapacity = typeof available === 'number' && available > 0;
              return (
                <option
                  key={hospital.id}
                  value={hospital.id}
                  disabled={!hasCapacity && hospital.id !== plan.targetHospitalId}
                >
                  {hospital.name} — {available === null || available === undefined
                    ? 'capacity not reported'
                    : `${available} beds available`}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSaveHospital(selectedHospitalId || null)}
            disabled={plan.status !== 'PENDING' || !hospitalAssignmentChanged || !selectedHospitalHasCapacity || contextLoading || isSavingHospital}
          >
            {isSavingHospital
              ? <LoaderCircle size={14} className="is-spinning" />
              : <Check size={14} />}
            {isSavingHospital ? 'Saving assignment…' : 'Save hospital'}
          </button>
          {hospitalSaveError && <p className="dispatch-inline-error" role="alert">{hospitalSaveError}</p>}
          {plan.status !== 'PENDING' && <p className="dispatch-stage-hint">Hospital assignment is locked after plan approval.</p>}
        </div>

        {!plan.targetHospital && !plan.targetHospitalId ? (
          <div className="hospital-missing-alert">
            <AlertCircle size={18} className="alert-icon" aria-hidden="true" />
            <div className="missing-alert-content">
              <strong>No receiving hospital selected</strong>
              <p>
                No hospital assignment is recorded. This does not block approval unless a hospital is selected
                but has no current capacity report.
              </p>
            </div>
          </div>
        ) : (
          <div className="hospital-detail-card">
            <div className="hospital-card-top">
              <div className="hospital-icon-wrap">
                <Building2 size={24} aria-hidden="true" />
              </div>
              <div className="hospital-card-info">
                <h4>
                  {plan.targetHospital?.name || `Hospital #${plan.targetHospitalId}`}
                </h4>
                <div className="hospital-meta-row">
                  <span className="hospital-id-tag">ID: {plan.targetHospital?.id || plan.targetHospitalId}</span>
                  <span className="hospital-loc-text">
                    <MapPin size={12} aria-hidden="true" />
                    <span>{formatLocation(plan.targetHospital?.locationLat, plan.targetHospital?.locationLng)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bed Metrics */}
            <div className="hospital-beds-panel">
              <div className="bed-metric-col">
                <span className="bed-metric-num">
                  {plan.targetHospital?.availableBeds !== null && plan.targetHospital?.availableBeds !== undefined
                    ? plan.targetHospital.availableBeds
                    : 'Not provided'}
                </span>
                <span className="bed-metric-label">Available Beds</span>
              </div>
              <div className="bed-metric-col">
                <span className="bed-metric-num">
                  {plan.targetHospital?.totalBeds !== null && plan.targetHospital?.totalBeds !== undefined
                    ? plan.targetHospital.totalBeds
                    : 'Not provided'}
                </span>
                <span className="bed-metric-label">Total Beds</span>
              </div>
              <div className="bed-metric-col">
                <span className="bed-metric-num">
                  {plan.targetHospital?.availableBeds !== null &&
                  plan.targetHospital?.totalBeds !== null &&
                  plan.targetHospital?.totalBeds !== undefined &&
                  plan.targetHospital?.availableBeds !== undefined &&
                  plan.targetHospital.totalBeds > 0
                    ? `${Math.round(((plan.targetHospital.totalBeds - plan.targetHospital.availableBeds) / plan.targetHospital.totalBeds) * 100)}%`
                    : 'Not provided'}
                </span>
                <span className="bed-metric-label">Bed Occupancy</span>
              </div>
            </div>

            {/* Hospital Route & Transit ETA */}
            <div className="hospital-route-box">
              <div className="route-box-title">
                <Navigation size={13} aria-hidden="true" />
                <span>Transit Route to Hospital</span>
              </div>
              <div className="route-metrics-row">
                <div className="route-pill">
                  <span className="pill-label">Distance:</span>
                  <span className="pill-value">{formatRouteDistance(plan.targetHospital?.route?.distanceKm)}</span>
                </div>
                <div className="route-pill">
                  <span className="pill-label">Est. Duration:</span>
                  <span className="pill-value">
                    {formatRouteDuration(plan.targetHospital?.route?.estimatedDurationMins)}
                  </span>
                </div>
                <div className="route-pill">
                  <span className="pill-label">Road Access:</span>
                  <span className="pill-value">
                    {plan.targetHospital?.route?.routeStatus || 'Route information not available'}
                  </span>
                </div>
              </div>
              {plan.targetHospital?.route?.pathSummary && (
                <div className="route-path-summary">
                  <strong>Path:</strong> {plan.targetHospital.route.pathSummary}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ROUTE, ROAD ACCESS & OPTIMISATION DETAILS */}
      <section className="route-details-section" aria-label="Route and optimization details">
        <h3 className="section-title">Stage 4 · Route and safety review</h3>
        <p className="dispatch-stage-description">
          Distances, route status and ETA are shown only when returned by the analysis. The response does not
          identify route-provider verification, so treat these as recommendations and confirm current access.
        </p>
        {!safetyCheck || !['SAFE', 'REVIEW_REQUIRED', 'BLOCKED'].includes(safetyStatus) ? (
          <div className="dispatch-safety-callout is-blocked" role="alert">
            <ShieldAlert size={16} />
            <div><strong>Safety result unavailable or unrecognized</strong><p>This plan cannot be approved without a recognized safety status.</p></div>
          </div>
        ) : safetyStatus === 'BLOCKED' || safetyBlockingIssues.length > 0 ? (
          <div className="dispatch-safety-callout is-blocked" role="alert">
            <ShieldAlert size={16} />
            <div>
              <strong>Approval blocked by safety check</strong>
              {safetyBlockingIssues.length > 0
                ? <ul>{safetyBlockingIssues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
                : <p>The plan was marked BLOCKED by the safety checker.</p>}
            </div>
          </div>
        ) : safetyWarningItems.length > 0 ? (
          <div className="dispatch-safety-callout" role="status">
            <AlertTriangle size={16} />
            <div>
              <strong>Review these plan warnings</strong>
              <ul>{safetyWarningItems.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
            </div>
          </div>
        ) : (
          <div className="dispatch-safety-callout is-clear" role="status">
            <ShieldCheck size={16} />
            <div><strong>No safety warnings returned</strong><p>Confirm current conditions and route access before dispatch.</p></div>
          </div>
        )}

        <details className="dispatch-optimization-details">
          <summary>Road access and optimization details</summary>
          <div className="optimisation-trace-card">
          {/* Usable Road Corridors */}
          <div className="trace-row">
            <span className="trace-label">Usable Road Corridors:</span>
            <div className="roads-tags-list">
              {plan.usableRoadIds && plan.usableRoadIds.length > 0 ? (
                plan.usableRoadIds.map(roadId => (
                  <span key={roadId} className="road-tag">
                    {roadId}
                  </span>
                ))
              ) : (
                <span className="trace-empty">Not provided (no specific road restrictions logged)</span>
              )}
            </div>
          </div>

          {/* Optimization Explanations */}
          {plan.explanation && plan.explanation.length > 0 && (
            <div className="trace-row">
              <span className="trace-label">Engine Reasoning:</span>
              <ul className="trace-bullets-list">
                {plan.explanation.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan Notes */}
          {plan.notes && (
            <div className="trace-row">
              <span className="trace-label">Operational Notes:</span>
              <p className="trace-notes-text">{plan.notes}</p>
            </div>
          )}

          {/* Strict Data Integrity Guarantee */}
          <div className="data-guarantee-note">
            <ShieldCheck size={14} className="guarantee-icon" aria-hidden="true" />
            <span>
              Route, distance, and ETA values are shown only when returned in the plan. The API does not expose a route-provider verification flag.
            </span>
          </div>
          </div>
        </details>
      </section>

      <section className="dispatch-approval-stage" aria-labelledby="dispatch-approval-title">
        <div className="dispatch-approval-heading">
          <span className="stage-number">5</span>
          <div>
            <span className="dispatch-kicker">FINAL OPERATOR CONTROL</span>
            <h3 id="dispatch-approval-title">Approval and dispatch</h3>
          </div>
          <span className={`dispatch-status-badge ${formatDispatchPlanStatus(plan.status).className}`}>
            {formatDispatchPlanStatus(plan.status).label}
          </span>
        </div>
        {plan.status === 'PENDING' ? (
          <div className="dispatch-approval-action">
            <p>Approval records an operator review but does not dispatch resources. Resolve the listed safety, incident, resource, and hospital requirements first.</p>
            <button type="button" className="dispatch-approve-btn" onClick={onApprove} disabled={!canApprove || isApproving}>
              {isApproving
                ? <LoaderCircle size={15} className="is-spinning" />
                : <ShieldCheck size={15} />}
              {isApproving ? 'Recording approval…' : 'Approve plan'}
            </button>
            {!canApprove && approvalBlockReason && <p className="dispatch-stage-hint" role="note">{approvalBlockReason}</p>}
          </div>
        ) : plan.status === 'APPROVED' ? (
          <div className="dispatch-approval-action">
            <p>Approval is recorded. Dispatch remains a separate, irreversible action and is revalidated by the backend against current resource availability.</p>
            <button
              type="button"
              className="dispatch-execute-btn"
              onClick={onTriggerExecution}
              disabled={!canExecute || isExecuting}
              title={!canExecute ? (executionBlockReason || 'Plan cannot be executed.') : 'Review and execute the approved dispatch'}
            >
              {isExecuting
                ? <LoaderCircle size={15} className="is-spinning" />
                : <Send size={15} />}
              {isExecuting ? 'Executing dispatch…' : 'Review & confirm dispatch'}
            </button>
            {!canExecute && executionBlockReason && <p className="dispatch-stage-hint" role="note">{executionBlockReason}</p>}
          </div>
        ) : plan.status === 'EXECUTED' ? (
          <div className="dispatch-stage-complete" role="status">
            <CheckCircle2 size={17} />
            <p>The backend reports this plan as executed. Assigned resources are marked DISPATCHED.</p>
          </div>
        ) : (
          <div className="dispatch-stage-hint">
            {plan.status === 'CANCELLED'
              ? 'This plan was cancelled and cannot be approved or executed.'
              : 'The plan status is unknown; approval and execution are disabled.'}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Accessible Review & Confirmation Modal
// ---------------------------------------------------------------------------

interface DispatchConfirmModalProps {
  plan: DispatchPlan;
  incident: Incident | null;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DispatchConfirmModal({
  plan,
  incident,
  isExecuting,
  onConfirm,
  onCancel,
}: DispatchConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const summary = formatDispatchSummary(plan, incident);

  // Focus trap and Escape key listener
  useEffect(() => {
    // Set initial focus to cancel button to prevent accidental confirmation
    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExecuting) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExecuting, onCancel]);

  return (
    <div className="dispatch-dialog-scrim" onClick={onCancel} role="presentation">
      <div
        className="dispatch-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-header-icon-wrap">
            <Send size={20} aria-hidden="true" />
          </div>
          <div className="dialog-header-copy">
            <h3 id="confirm-dialog-title">Confirm Emergency Dispatch Execution</h3>
            <span className="dialog-plan-id">Plan #{plan.id}</span>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onCancel}
            disabled={isExecuting}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="dialog-body" id="confirm-dialog-desc">
          <div className="dialog-warning-banner">
            <AlertTriangle size={18} className="warning-icon" aria-hidden="true" />
            <div className="warning-text">
              <strong>Operational Dispatch Warning:</strong> Executing this order transitions the selected
              units to <code>DISPATCHED</code> status in the field and officially commits response resources.
              This action cannot be undone.
            </div>
          </div>

          <div className="dialog-summary-grid">
            <div className="dialog-summary-row">
              <span className="summary-label">Target Incident:</span>
              <strong className="summary-value">{summary.incidentTitle}</strong>
            </div>

            <div className="dialog-summary-row">
              <span className="summary-label">Incident Type:</span>
              <span className="summary-value stage-tag">{incident?.type || 'INCIDENT'}</span>
            </div>

            <div className="dialog-summary-row">
              <span className="summary-label">Emergency Units ({summary.unitCount}):</span>
              <div className="summary-units-list">
                {plan.suggestedResources.map(r => (
                  <span key={r.resourceId} className="unit-badge">
                    {r.type === 'AMBULANCE' ? <Truck size={12} aria-hidden="true" /> : <UsersRound size={12} aria-hidden="true" />}
                    <span>{r.resourceName || r.resourceId} ({r.type || 'UNIT'})</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="dialog-summary-row">
              <span className="summary-label">Designated Receiving Facility:</span>
              <strong className="summary-value">{summary.hospitalName}</strong>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            ref={cancelButtonRef}
            className="dialog-cancel-btn"
            onClick={onCancel}
            disabled={isExecuting}
          >
            Cancel
          </button>

          <button
            type="button"
            ref={confirmButtonRef}
            className="dialog-confirm-btn"
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <LoaderCircle size={14} className="is-spinning" aria-hidden="true" />
                <span>Executing Dispatch...</span>
              </>
            ) : (
              <>
                <Check size={14} aria-hidden="true" />
                <span>Confirm &amp; Execute Dispatch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Resource Card
// ---------------------------------------------------------------------------

interface ResourceCardProps {
  resource: ResourceAssignment;
  key?: string | number;
}

function ResourceCard({ resource }: ResourceCardProps) {
  const isConfirmed = resource.isConfirmed || resource.assignmentStatus === 'CONFIRMED' || resource.assignmentStatus === 'DISPATCHED';
  const assignmentMeta = formatAssignmentStatus(resource.assignmentStatus);

  return (
    <div className={`resource-card${isConfirmed ? ' is-confirmed' : ' is-suggested'}`}>
      <div className="resource-card-top">
        <div className="resource-type-icon">
          {resource.type === 'AMBULANCE' ? (
            <Truck size={18} aria-hidden="true" />
          ) : (
            <UsersRound size={18} aria-hidden="true" />
          )}
        </div>
        <div className="resource-card-title">
          <strong className="resource-name">{formatResourceName(resource)}</strong>
          <span className="resource-id-tag">{resource.resourceId}</span>
        </div>

        <span className={`allocation-badge ${assignmentMeta.className}`}>
          {isConfirmed ? (
            <CheckCircle2 size={11} aria-hidden="true" />
          ) : (
            <Clock3 size={11} aria-hidden="true" />
          )}
          <span>{assignmentMeta.label}</span>
        </span>
      </div>

      <div className="resource-attributes-grid">
        <div className="resource-attr">
          <span className="attr-label">Type:</span>
          <span className="attr-value">{resource.type || 'Not provided'}</span>
        </div>
        <div className="resource-attr">
          <span className="attr-label">Availability:</span>
          <span className={`attr-value status-${resource.availability?.toLowerCase() || 'unknown'}`}>
            {resource.availability || 'Unknown'}
          </span>
        </div>
        <div className="resource-attr">
          <span className="attr-label">Target Action:</span>
          <span className="attr-value">{resource.action || 'Not provided'}</span>
        </div>
      </div>

      {/* Transit Route & ETA for this Resource */}
      <div className="resource-route-summary">
        <div className="route-metric">
          <span className="metric-label">Transit Distance:</span>
          <span className="metric-value">{formatRouteDistance(resource.route?.distanceKm)}</span>
        </div>
        <div className="route-metric">
          <span className="metric-label">Estimated Arrival:</span>
          <span className="metric-value">
            {formatRouteDuration(resource.estimatedArrivalTimeMins ?? resource.route?.estimatedDurationMins)}
          </span>
        </div>
        {resource.route?.routeStatus && (
          <div className="route-metric">
            <span className="metric-label">Route Status:</span>
            <span className="metric-value route-status-tag">{resource.route.routeStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default DispatchPage;
