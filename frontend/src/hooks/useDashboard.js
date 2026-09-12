import { useState, useEffect, useCallback } from 'react';
import { API_URL, apiFetch } from '../services/api';
import { fetchMockAIResponsePlan } from '../services/mockAiService';

const initialAgents = [
  ['Situation Agent', 'What is happening?'], ['Risk Agent', 'How urgent is it?'],
  ['Resource Agent', 'Who should respond?'], ['Route Agent', 'How do we reach them?'],
  ['Predictive Agent', 'What happens next?'], ['Master Coordinator', 'What should we do?'],
].map(([name, question]) => ({ name, question, status: 'idle' }));

export function useDashboard(regionId) {
  const [connection, setConnection] = useState('Checking dispatch network...');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [agents, setAgents] = useState(initialAgents);
  const [incidents, setIncidents] = useState([]);
  const [dispatchPlan, setDispatchPlan] = useState(null);

  const loadIncidents = useCallback(async () => {
    try {
      const response = await apiFetch('/incidents');
      if (!response.ok) throw new Error('Unable to load incidents');
      setIncidents(await response.json());
    } catch (error) {
      console.warn("Backend offline, loading mock incidents for UI development.");
      const mockIncidents = await import('../services/mockDashboardService').then(m => m.fetchMockIncidents());
      setIncidents(mockIncidents);
      setErrorMessage(null); // Clear the error banner since we successfully loaded mocks
    }
  }, []);

  // Health check on mount
  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/health', { signal: controller.signal })
      .then((response) => { 
        if (!response.ok) throw new Error(); 
        setConnection('Dispatch network connected'); 
      })
      .catch(() => setConnection('Dispatch network unavailable'));
    return () => controller.abort();
  }, []);

  // SSE Stream and incident loading
  useEffect(() => {
    // Check if we have a token before trying to load authenticated routes or streams
    if (!localStorage.getItem('disasterlink_token')) return;

    loadIncidents().catch(() => setErrorMessage('Unable to load the live incident feed.'));
    
    const stream = new EventSource(`${API_URL}/events`);
    const refresh = () => {
      loadIncidents().catch(() => {});
      setAgents(initialAgents.map((agent, index) => ({ 
        ...agent, 
        status: index < 5 ? 'complete' : 'processing', 
        summary: index < 5 ? 'Live backend event processed.' : undefined 
      })));
    };
    
    const events = [
      'SOS_RECEIVED', 'INCIDENT_UPDATED', 'INCIDENT_REPORT_RECEIVED', 
      'PREDICTION_UPDATED', 'DISPATCH_PLANNED', 'DISPATCH_APPROVED', 
      'ROAD_BLOCKED', 'ROAD_UPDATED', 'HOSPITAL_FULL', 
      'HOSPITAL_CAPACITY_CHANGED', 'RESOURCE_AVAILABLE', 'RESOURCE_UNAVAILABLE', 
      'MESH_MESSAGE_RECEIVED'
    ];
    
    events.forEach((name) => stream.addEventListener(name, refresh));
    
    stream.onopen = () => setConnection('Dispatch network connected');
    stream.onerror = () => setConnection('Dispatch network reconnecting...');
    
    return () => stream.close();
  }, [loadIncidents]);

  const requestPlan = async (incident) => {
    setLoading(true); setErrorMessage(null);
    try {
      const response = await apiFetch('/dispatch/plan', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ incidentId: incident.id }) 
      });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || 'Unable to create dispatch plan');
      setDispatchPlan(plan);
    } catch (error) { 
      console.warn("Backend AI dispatch failed, falling back to mock AI response", error);
      try {
        const mockResponse = await fetchMockAIResponsePlan(incident.id);
        setDispatchPlan({
          id: 'mock-plan-id',
          status: 'PENDING',
          details: mockResponse
        });
      } catch (mockError) {
        setErrorMessage("Both backend and mock AI services failed.");
      }
    } finally { setLoading(false); }
  };

  const executePlan = async () => {
    if (!dispatchPlan) return;
    setLoading(true); setErrorMessage(null);
    try {
      const response = await apiFetch('/dispatch/execute', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ planId: dispatchPlan.id }) 
      });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || 'Unable to execute dispatch');
      setDispatchPlan(plan);
      await loadIncidents();
    } catch (error) { setErrorMessage(error.message); } finally { setLoading(false); }
  };

  return {
    connection, loading, errorMessage, setErrorMessage,
    agents, incidents, dispatchPlan,
    requestPlan, executePlan, setLoading, setAgents, initialAgents
  };
}
