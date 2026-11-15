import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  FilterX,
  Info,
  LoaderCircle,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  fetchHospitals,
  fetchResources,
  type Hospital,
  type Resource,
} from '../services/api';
import {
  filterHospitals as filterHospitalRecords,
  filterResourcesByStatus,
  getHospitalBedMetrics,
  getHospitalCapacitySummary,
  NO_STATUS_FILTER,
} from '../utils/hospitalManagement';

function formatStatus(status: string | null): string {
  if (!status) return 'Status not provided';
  return status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function resourceStatusClass(status: string | null): string {
  if (status === 'AVAILABLE') return 'is-available';
  return status ? 'is-other' : 'is-unknown';
}

function formatLocation(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) return 'Location not provided';
  return `Lat ${latitude}, long ${longitude}`;
}

function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [hospitalLoading, setHospitalLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [resourceStatus, setResourceStatus] = useState('');

  useEffect(() => {
    let active = true;
    const hospitalController = new AbortController();
    const resourceController = new AbortController();
    setHospitalLoading(true);
    setResourceLoading(true);
    setHospitalError(null);
    setResourceError(null);

    void fetchHospitals({ signal: hospitalController.signal })
      .then(data => {
        if (active) setHospitals(data);
      })
      .catch((error: unknown) => {
        if (active) setHospitalError(error instanceof Error ? error.message : 'Could not load hospitals.');
      })
      .finally(() => {
        if (active) setHospitalLoading(false);
      });

    void fetchResources({ signal: resourceController.signal })
      .then(data => {
        if (active) setResources(data);
      })
      .catch((error: unknown) => {
        if (active) setResourceError(error instanceof Error ? error.message : 'Could not load resources.');
      })
      .finally(() => {
        if (active) setResourceLoading(false);
      });

    return () => {
      active = false;
      hospitalController.abort();
      resourceController.abort();
    };
  }, [refreshKey]);

  const filteredHospitals = useMemo(() => {
    return filterHospitalRecords(hospitals, hospitalQuery);
  }, [hospitalQuery, hospitals]);

  const resourceStatuses = useMemo(
    () => [...new Set(resources.map(resource => resource.status ?? NO_STATUS_FILTER))].sort(),
    [resources],
  );
  const filteredResources = useMemo(
    () => filterResourcesByStatus(resources, resourceStatus),
    [resourceStatus, resources],
  );

  const capacitySummary = getHospitalCapacitySummary(hospitals);
  const availableResourceRecords = resources.filter(resource => resource.status === 'AVAILABLE').length;
  const hasFilters = Boolean(hospitalQuery || resourceStatus);
  const clearFilters = () => {
    setHospitalQuery('');
    setResourceStatus('');
  };
  const retry = () => setRefreshKey(key => key + 1);

  return (
    <div className="hospitals-page">
      <div className="page-heading hospitals-page-heading">
        <div>
          <div className="eyebrow"><span /> FACILITIES & RESOURCES</div>
          <h1>Hospitals & resources</h1>
          <p>Review facility capacity and emergency resource availability from connected records.</p>
        </div>
        <button className="secondary-button" type="button" onClick={retry} disabled={hospitalLoading || resourceLoading}>
          {hospitalLoading || resourceLoading
            ? <LoaderCircle size={14} className="is-spinning" />
            : <RefreshCw size={14} />}
          Refresh data
        </button>
      </div>

      <aside className="hospital-data-note" aria-label="Available data details">
        <Info size={17} />
        <p>
          The current API provides hospital names, coordinates, and bed totals; it does not provide
          street addresses, contact details, or hospital operational status. Resources are not linked
          to hospitals or units. Occupied beds are derived only when returned capacity values are consistent.
        </p>
      </aside>

      <section className="hospital-capacity-section" aria-labelledby="hospital-capacity-title">
        <div className="section-heading hospitals-section-heading">
          <div>
            <h2 id="hospital-capacity-title">Hospital capacity</h2>
            <p>Latest capacity snapshot returned for each facility.</p>
          </div>
          {!hospitalLoading && !hospitalError && (
            <span className="section-note">{hospitals.length} {hospitals.length === 1 ? 'hospital' : 'hospitals'}</span>
          )}
        </div>

        {!hospitalLoading && !hospitalError && capacitySummary && (
          <div className="hospital-capacity-summary" aria-label="Reported hospital capacity totals">
            <article>
              <span>Total beds</span>
              <strong>{capacitySummary.totalBeds}</strong>
              <small>Across {capacitySummary.hospitalCount} facilities with consistent data</small>
            </article>
            <article>
              <span>Occupied beds</span>
              <strong>{capacitySummary.occupiedBeds}</strong>
              <small>Derived: total beds minus available beds</small>
            </article>
            <article>
              <span>Available beds</span>
              <strong>{capacitySummary.availableBeds}</strong>
              <small>As reported by the latest capacity snapshots</small>
            </article>
          </div>
        )}

        <div className="hospital-toolbar">
          <label className="hospital-search">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Search hospitals by name or location</span>
            <input
              type="search"
              value={hospitalQuery}
              onChange={event => setHospitalQuery(event.target.value)}
              placeholder="Search hospitals by name or coordinates"
            />
          </label>
          {hasFilters && (
            <button type="button" className="secondary-button hospital-clear-button" onClick={clearFilters}>
              <FilterX size={14} /> Clear filters
            </button>
          )}
        </div>

        {hospitalLoading ? (
          <div className="hospital-state" role="status">
            <LoaderCircle size={19} className="is-spinning" /> Loading hospital records…
          </div>
        ) : hospitalError ? (
          <div className="hospital-error" role="alert">
            <AlertTriangle size={18} />
            <div><strong>Could not load hospitals</strong><p>{hospitalError}</p></div>
            <button type="button" className="secondary-button" onClick={retry}><RefreshCw size={14} /> Retry</button>
          </div>
        ) : filteredHospitals.length === 0 ? (
          <div className="hospital-state hospital-empty-state">
            <Building2 size={20} />
            <strong>{hospitals.length ? 'No hospitals match this search' : 'No hospital records returned'}</strong>
            <span>{hospitals.length ? 'Try another name or coordinate, or clear the search.' : 'The hospital directory is empty.'}</span>
            {hospitalQuery && <button type="button" className="text-button" onClick={clearFilters}>Clear search</button>}
          </div>
        ) : (
          <div className="hospital-card-grid">
            {filteredHospitals.map(hospital => {
              const capacity = hospital.capacity;
              const bedMetrics = getHospitalBedMetrics(hospital);
              const occupied = bedMetrics?.occupiedBeds ?? null;
              const occupancyPercent = bedMetrics?.occupancyPercent ?? null;

              return (
                <article className="hospital-card" key={hospital.id}>
                  <div className="hospital-card-heading">
                    <span className="hospital-card-icon"><Building2 size={19} /></span>
                    <div className="hospital-card-title">
                      <h3>{hospital.name}</h3>
                      <span className="hospital-status-unavailable">Operational status not provided</span>
                    </div>
                  </div>
                  <p className="hospital-location"><MapPin size={14} /> {formatLocation(hospital.locationLat, hospital.locationLng)}</p>
                  <div className="hospital-bed-details">
                    {capacity ? (
                      <>
                        <div className="hospital-bed-metrics">
                          <span><strong>{capacity.totalBeds ?? '—'}</strong>Total beds</span>
                          <span><strong>{capacity.available ?? '—'}</strong>Available</span>
                          <span><strong>{occupied ?? '—'}</strong>Occupied*</span>
                        </div>
                        {occupancyPercent !== null ? (
                          <div className="hospital-occupancy">
                            <div><span>Occupancy*</span><strong>{occupancyPercent}%</strong></div>
                            <progress value={occupancyPercent} max={100} aria-label={`${hospital.name} occupancy ${occupancyPercent}%`} />
                          </div>
                        ) : (
                          <p className="hospital-capacity-note">Occupancy unavailable: returned bed values are incomplete or inconsistent.</p>
                        )}
                        {capacity.updatedAt && <small className="capacity-updated">Updated {new Date(capacity.updatedAt).toLocaleString()}</small>}
                      </>
                    ) : (
                      <div className="hospital-capacity-missing"><BedDouble size={17} /> Bed capacity not reported</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="hospital-derived-note">* Occupied beds and occupancy are calculated from total and available beds when available beds do not exceed total beds.</p>
      </section>

      <section className="hospital-resource-section" aria-labelledby="hospital-resources-title">
        <div className="section-heading hospitals-section-heading">
          <div>
            <h2 id="hospital-resources-title">Emergency resources</h2>
            <p>Individual resource records from the resource service; no hospital or unit association is returned.</p>
          </div>
          {!resourceLoading && !resourceError && (
            <span className="section-note">{availableResourceRecords} available of {resources.length} records</span>
          )}
        </div>

        {!resourceLoading && !resourceError && resources.length > 0 && (
          <div className="resource-toolbar">
            <label>
              <span>Filter by status</span>
              <select value={resourceStatus} onChange={event => setResourceStatus(event.target.value)}>
                <option value="">All statuses</option>
                {resourceStatuses.map(status => (
                  <option value={status} key={status}>
                    {status === NO_STATUS_FILTER ? 'Status not provided' : formatStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            {resourceStatus && (
              <button type="button" className="secondary-button hospital-clear-button" onClick={clearFilters}>
                <FilterX size={14} /> Clear filters
              </button>
            )}
          </div>
        )}

        {resourceLoading ? (
          <div className="hospital-state" role="status">
            <LoaderCircle size={19} className="is-spinning" /> Loading resource records…
          </div>
        ) : resourceError ? (
          <div className="hospital-error" role="alert">
            <AlertTriangle size={18} />
            <div><strong>Could not load resources</strong><p>{resourceError}</p></div>
            <button type="button" className="secondary-button" onClick={retry}><RefreshCw size={14} /> Retry</button>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="hospital-state hospital-empty-state">
            <PackageCheck size={20} />
            <strong>{resources.length ? 'No resources match this status' : 'No resource records returned'}</strong>
            <span>{resources.length ? 'Clear the status filter to view all resource records.' : 'The resource service returned no records.'}</span>
            {resourceStatus && <button type="button" className="text-button" onClick={clearFilters}>Clear filter</button>}
          </div>
        ) : (
          <div className="resource-card-grid">
            {filteredResources.map(resource => (
              <article className="resource-card" key={resource.id}>
                <div className="resource-card-heading">
                  <span className="resource-card-icon"><PackageCheck size={18} /></span>
                  <div><h3>{resource.name}</h3><span>{resource.type ?? 'Type not provided'}</span></div>
                  <span className={`resource-status ${resourceStatusClass(resource.status)}`}>
                    <span aria-hidden="true" />{formatStatus(resource.status)}
                  </span>
                </div>
                <div className="resource-card-details">
                  {resource.ambulancePlateNumbers.map((plate, index) => (
                    <span key={`${plate}-${index}`}>Plate {plate}</span>
                  ))}
                  {resource.rescuePersonnel.map((personnel, index) => (
                    <span key={`${resource.id}-team-${index}`}>{personnel} personnel</span>
                  ))}
                  {resource.locationLat !== null && resource.locationLng !== null && (
                    <span><MapPin size={12} /> {formatLocation(resource.locationLat, resource.locationLng)}</span>
                  )}
                  {resource.ambulancePlateNumbers.length === 0 &&
                    resource.rescuePersonnel.length === 0 &&
                    (resource.locationLat === null || resource.locationLng === null) && (
                      <span className="resource-detail-missing">No additional details returned</span>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HospitalsPage;
