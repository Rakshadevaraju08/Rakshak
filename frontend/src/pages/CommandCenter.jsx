import React, { useState, useEffect } from 'react';
import OperatorMap from '../components/OperatorMap';
import AgentPipelinePanel from '../components/AgentPipelinePanel';
import { Card, Panel } from '../components/ui/Card';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import AIResponsePanel from '../components/AIResponsePanel';
import { 
  fetchDashboardMetrics, 
  fetchPredictiveRisks, 
  fetchActiveOperations, 
  fetchSystemEvents,
  fetchMapEntities
} from '../services/mockDashboardService';
import { Activity, AlertTriangle, Building2, Truck, Clock } from 'lucide-react';

export default function CommandCenter({ 
  region, 
  incidents = [], 
  errorMessage, 
  loading, 
  requestPlan, 
  dispatchPlan, 
  executePlan, 
  agents 
}) {
  const [metrics, setMetrics] = useState(null);
  const [risks, setRisks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [events, setEvents] = useState([]);
  const [mapData, setMapData] = useState({ hospitals: [], resources: [], routes: [] });

  useEffect(() => {
    async function loadMockData() {
      const [m, r, o, e, mapEnts] = await Promise.all([
        fetchDashboardMetrics(),
        fetchPredictiveRisks(),
        fetchActiveOperations(),
        fetchSystemEvents(),
        fetchMapEntities(region.center)
      ]);
      setMetrics(m);
      setRisks(r);
      setOperations(o);
      setEvents(e);
      setMapData(mapEnts);
    }
    loadMockData();
  }, [region.center]);

  // Time formatter for events
  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto max-w-screen-2xl p-4 lg:p-6 space-y-6">
      
      {/* ERROR BANNER */}
      {errorMessage && (
        <Alert variant="error" title="System Error">
          {errorMessage}
        </Alert>
      )}

      {/* ROW 1: KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface-variant">Active Incidents</p>
            <p className="text-2xl font-bold">{incidents.length || metrics?.activeIncidents || 0}</p>
          </div>
        </Card>
        
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-priority-p5-container)] text-[var(--color-priority-p5)]">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface-variant">Critical (P5/P4)</p>
            <p className="text-2xl font-bold">
              {incidents.filter(i => i.priority === 'P1' || i.priority === 'P5' || i.status === 'NEW').length || metrics?.criticalIncidents || 0}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary/20 text-tertiary">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface-variant">Available Resources</p>
            <p className="text-2xl font-bold">
              {metrics?.availableResources.idle || 0} <span className="text-sm font-normal text-outline">/ {metrics?.availableResources.total || 0}</span>
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-status-resolved)]/20 text-[var(--color-status-resolved)]">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface-variant">Hospitals Available</p>
            <p className="text-2xl font-bold">
              {metrics?.hospitals.withCapacity || 0} <span className="text-sm font-normal text-outline">/ {metrics?.hospitals.total || 0}</span>
            </p>
          </div>
        </Card>
      </div>

      {/* ROW 2: TACTICAL MAP & AI INSIGHTS */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col rounded-xl overflow-hidden shadow-sm h-[500px] border border-outline-variant/40">
          <OperatorMap 
            regionCenter={region.center} 
            jurisdictionRadius={region.radius}
            incidents={incidents}
            hospitals={mapData.hospitals}
            resources={mapData.resources}
            routes={mapData.routes}
          />
        </div>
        
        {/* Predictive Risks & AI Pipeline */}
        <div className="flex flex-col gap-6">
          {/* Risks */}
          <section>
            <h3 className="mb-3 font-bold uppercase tracking-wider text-outline text-xs">Predictive Risk Warnings</h3>
            <div className="space-y-3">
              {risks.map(risk => (
                <Alert key={risk.id} variant={risk.type} title={risk.title}>
                  {risk.description}
                </Alert>
              ))}
              {risks.length === 0 && <p className="text-sm text-outline">No predictive risks detected.</p>}
            </div>
          </section>

          {/* AI Pipeline */}
          <AgentPipelinePanel agentStates={agents} incidentId={incidents[0]?.id} className="flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-low" />
        </div>
      </div>

      {/* ROW 3: INCIDENT QUEUE & SYSTEM EVENTS */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        
        {/* Incident Priority Queue */}
        <Panel title="Incident Priority Queue">
          {incidents.length > 0 ? (
            <Table>
              <TableHead>
                <TableRow hover={false}>
                  <TableCell isHeader>ID</TableCell>
                  <TableCell isHeader>Priority</TableCell>
                  <TableCell isHeader>Status</TableCell>
                  <TableCell isHeader>Description</TableCell>
                  <TableCell isHeader>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map(incident => (
                  <TableRow key={incident.id}>
                    <TableCell className="font-mono text-xs">{incident.id.split('-').pop() || incident.id}</TableCell>
                    <TableCell><PriorityBadge level={incident.priority} /></TableCell>
                    <TableCell><StatusBadge status={incident.status} /></TableCell>
                    <TableCell className="max-w-xs truncate" title={incident.title}>{incident.title}</TableCell>
                    <TableCell>
                      <Button 
                        variant="secondary" 
                        disabled={loading} 
                        onClick={() => requestPlan(incident)}
                        className="py-1 px-3 text-xs"
                      >
                        Plan
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-on-surface-variant">
              <p>No active incidents requiring attention.</p>
            </div>
          )}

          {/* AI Response Panel */}
          {dispatchPlan && (
            <div className="mt-6 h-[600px] overflow-hidden">
              <AIResponsePanel 
                plan={dispatchPlan.details} 
                onApprove={executePlan} 
                isExecuting={loading} 
              />
            </div>
          )}
        </Panel>

        {/* Operational Feeds (Operations & Events) */}
        <div className="flex flex-col gap-6">
          <Panel title="Active Operations" className="flex-1">
            <div className="space-y-3">
              {operations.map(op => (
                <div key={op.id} className="flex items-center justify-between border-b border-outline-variant/30 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold">{op.title}</p>
                    <p className="text-xs text-on-surface-variant">{op.units} units deployed</p>
                  </div>
                  <StatusBadge status={op.status} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="System Events" className="flex-1">
            <div className="space-y-4">
              {events.map(event => (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-0.5 text-outline">
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-outline">{formatTime(event.timestamp)}</p>
                    <p className="text-sm text-on-surface-variant leading-tight">{event.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
