import React, { useState, useMemo } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { Card, Panel } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Label } from '../components/ui/Form';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Search, MapPin, Clock, Users, CloudRain, Droplets, Truck, Building2 } from 'lucide-react';

// Helper to determine priority since it might not be a native DB column yet
const getPriority = (incident) => {
  if (incident.status === 'NEW' || incident.victimCount > 10) return 'P5';
  if (incident.waterLevel > 2 || incident.rainfall > 50) return 'P4';
  if (incident.status === 'ASSIGNED' || incident.status === 'DISPATCHED') return 'P3';
  if (incident.status === 'RESOLVED') return 'P1';
  return 'P2';
};

export default function IncidentList() {
  const { 
    incidents, selectedIncident, loadingList, loadingDetail, 
    errorList, errorDetail, isEmpty, retryList, selectIncident, retryDetail 
  } = useIncidents();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Filter and sort the incidents
  const filteredIncidents = useMemo(() => {
    let result = [...incidents].map(inc => ({ ...inc, priority: getPriority(inc) }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inc => 
        inc.title?.toLowerCase().includes(q) || 
        inc.description?.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q)
      );
    }

    if (filterPriority !== 'ALL') {
      result = result.filter(inc => inc.priority === filterPriority);
    }
    if (filterStatus !== 'ALL') {
      result = result.filter(inc => inc.status === filterStatus);
    }
    if (filterType !== 'ALL') {
      result = result.filter(inc => (inc.type || 'OTHER') === filterType);
    }

    // Sort: P5 first, then by creation date (newest first)
    result.sort((a, b) => {
      if (a.priority === 'P5' && b.priority !== 'P5') return -1;
      if (b.priority === 'P5' && a.priority !== 'P5') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return result;
  }, [incidents, searchQuery, filterPriority, filterStatus, filterType]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-surface">
      
      {/* LEFT COLUMN: Master List */}
      <div className="flex h-full w-full flex-col border-r border-outline-variant/30 bg-surface-container-lowest lg:w-[450px] shrink-0">
        
        {/* Filters & Search Header */}
        <div className="p-4 border-b border-outline-variant/30 space-y-4">
          <div>
            <h2 className="text-xl font-bold">Incident Directory</h2>
            <p className="text-sm text-on-surface-variant">Manage and triage reported emergencies.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={18} />
            <Input 
              placeholder="Search ID, title, or description..." 
              className="pl-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-xs py-1.5 px-2">
              <option value="ALL">All Priorities</option>
              <option value="P5">P5 Critical</option>
              <option value="P4">P4 High</option>
              <option value="P3">P3 Mod</option>
              <option value="P2">P2 Low</option>
              <option value="P1">P1 Info</option>
            </Select>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs py-1.5 px-2">
              <option value="ALL">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="ANALYZING">ANALYZING</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="RESOLVED">RESOLVED</option>
            </Select>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs py-1.5 px-2">
              <option value="ALL">All Types</option>
              <option value="FLOOD">FLOOD</option>
              <option value="MEDICAL">MEDICAL</option>
              <option value="FIRE">FIRE</option>
              <option value="OTHER">OTHER</option>
            </Select>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errorList && (
            <Alert variant="error" title="Failed to load">
              {errorList} <Button variant="ghost" onClick={retryList} className="mt-2 text-xs">Retry</Button>
            </Alert>
          )}
          
          {loadingList && <div className="p-4 text-center text-sm font-bold animate-pulse text-on-surface-variant">Loading incidents...</div>}
          
          {isEmpty && <div className="p-8 text-center text-sm text-on-surface-variant">No incidents found matching your criteria.</div>}
          
          {!loadingList && !errorList && filteredIncidents.map(incident => {
            const isSelected = selectedIncident?.id === incident.id;
            const isCritical = incident.priority === 'P5';
            
            return (
              <button 
                key={incident.id}
                onClick={() => selectIncident(incident.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  isSelected 
                    ? 'border-secondary bg-secondary-container/10' 
                    : isCritical
                      ? 'border-[var(--color-priority-p5)]/50 bg-[var(--color-priority-p5-container)]/10 hover:bg-[var(--color-priority-p5-container)]/20'
                      : 'border-outline-variant/40 bg-surface-container hover:bg-surface-container-high'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2">
                    <PriorityBadge level={incident.priority} />
                    <StatusBadge status={incident.status} />
                  </div>
                  <span className="text-[10px] font-mono text-outline">{incident.id.split('-').pop()}</span>
                </div>
                <h3 className="font-bold text-sm truncate">{incident.title}</h3>
                <div className="mt-2 flex items-center gap-4 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1"><MapPin size={12}/> {incident.locationLat?.toFixed(3)}, {incident.locationLng?.toFixed(3)}</span>
                  <span className="flex items-center gap-1"><Clock size={12}/> {new Date(incident.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Detail View */}
      <div className="flex-1 overflow-y-auto bg-surface-container-low p-4 lg:p-8">
        {!selectedIncident && !loadingDetail && !errorDetail && (
          <div className="flex h-full flex-col items-center justify-center text-center text-on-surface-variant">
            <div className="mb-4 rounded-full bg-surface-container p-4">
              <Search size={32} className="opacity-50" />
            </div>
            <h3 className="text-lg font-bold">No Incident Selected</h3>
            <p className="max-w-sm">Select an incident from the directory to view deep analytical details and response status.</p>
          </div>
        )}

        {loadingDetail && (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm font-bold animate-pulse text-secondary">Fetching deep analysis...</div>
          </div>
        )}

        {errorDetail && (
          <Alert variant="error" title="Detail Fetch Failed">
            {errorDetail} <Button variant="secondary" onClick={retryDetail} className="mt-2">Retry</Button>
          </Alert>
        )}

        {selectedIncident && !loadingDetail && !errorDetail && (() => {
          const inc = selectedIncident;
          const activePlan = inc.dispatchPlans?.[0]; // Get most recent plan if available
          
          return (
            <div className="mx-auto max-w-4xl space-y-6">
              
              {/* Header */}
              <header className="space-y-4 pb-6 border-b border-outline-variant/30">
                <div className="flex flex-wrap items-center gap-3">
                  <PriorityBadge level={getPriority(inc)} />
                  <StatusBadge status={inc.status} />
                  <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-mono font-bold">TYPE: {inc.type || 'UNKNOWN'}</span>
                  <span className="ml-auto text-xs font-mono text-outline">ID: {inc.id}</span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{inc.title}</h2>
                  <p className="mt-2 text-lg text-on-surface-variant">{inc.description || 'No detailed description provided by reporter.'}</p>
                </div>
              </header>

              {/* Data Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                
                {/* Meta & Location */}
                <Panel title="Spatial & Temporal Data">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <MapPin className="text-secondary shrink-0 mt-0.5" size={18} />
                      <div>
                        <Label>Reported Coordinates</Label>
                        <p className="font-mono text-sm">{inc.locationLat}, {inc.locationLng}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Clock className="text-secondary shrink-0 mt-0.5" size={18} />
                      <div>
                        <Label>Timeline</Label>
                        <p className="text-sm">Created: {formatDate(inc.createdAt)}</p>
                        <p className="text-sm">Updated: {formatDate(inc.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* Victims */}
                <Panel title="Triage & Victims">
                  <div className="flex items-start gap-3">
                    <Users className="text-error shrink-0 mt-0.5" size={18} />
                    <div className="w-full">
                      <Label>Impacted Individuals</Label>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div className="rounded border border-outline-variant/30 p-2 text-center">
                          <p className="text-2xl font-bold text-error">{inc.victimCount || 0}</p>
                          <p className="text-xs uppercase tracking-wider text-outline">Total</p>
                        </div>
                        <div className="rounded border border-outline-variant/30 p-2 text-center">
                          <p className="text-2xl font-bold">{inc.elderlyCount || 0}</p>
                          <p className="text-xs uppercase tracking-wider text-outline">Elderly</p>
                        </div>
                        <div className="rounded border border-outline-variant/30 p-2 text-center">
                          <p className="text-2xl font-bold">{inc.childrenCount || 0}</p>
                          <p className="text-xs uppercase tracking-wider text-outline">Children</p>
                        </div>
                        <div className="rounded border border-outline-variant/30 p-2 text-center">
                          <p className="text-2xl font-bold">{inc.disabledCount || 0}</p>
                          <p className="text-xs uppercase tracking-wider text-outline">Disabled</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* Environmental */}
                <Panel title="Environmental Sensors">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-3">
                        <Droplets className="text-secondary" size={18} />
                        <span className="font-bold">Water Level</span>
                      </div>
                      <span className="font-mono">{inc.waterLevel != null ? `${inc.waterLevel} meters` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-3">
                        <CloudRain className="text-secondary" size={18} />
                        <span className="font-bold">Rainfall</span>
                      </div>
                      <span className="font-mono">{inc.rainfall != null ? `${inc.rainfall} mm/hr` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Truck className="text-secondary" size={18} />
                        <span className="font-bold">Road Access</span>
                      </div>
                      <StatusBadge status={inc.roadAccess || 'UNKNOWN'} />
                    </div>
                  </div>
                </Panel>

                {/* AI Dispatch Plan */}
                <Panel title="Response Plan" className="bg-secondary-container/10 border-secondary/30">
                  {activePlan ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Plan Status</span>
                        <StatusBadge status={activePlan.status} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Assigned Resources</Label>
                        <div className="flex flex-wrap gap-2">
                          {activePlan.details?.recommendedResources?.map((res, i) => (
                            <span key={i} className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs font-bold text-on-secondary">
                              <Truck size={12} /> {res}
                            </span>
                          )) || <span className="text-sm text-outline">None assigned</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Target Hospital</Label>
                        <div className="flex items-center gap-2 rounded border border-outline-variant/40 p-2">
                          <Building2 size={16} className="text-secondary" />
                          <span className="text-sm">{activePlan.details?.recommendedHospitalId || 'None assigned'}</span>
                        </div>
                      </div>
                      
                      {activePlan.status === 'PENDING' && (
                        <Button className="w-full mt-2">Approve Execution</Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center text-on-surface-variant">
                      <p className="text-sm">No response plan generated yet.</p>
                      <Button variant="secondary" className="mt-4">Request AI Analysis</Button>
                    </div>
                  )}
                </Panel>
              </div>

            </div>
          );
        })()}
      </div>
    </div>
  );
}
