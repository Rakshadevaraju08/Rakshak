import { useEffect, useState } from 'react';
import OperatorSignupPage from './pages/OperatorSignupPage';
import AgentPipelinePanel from './components/AgentPipelinePanel';
import OperatorMap from './components/OperatorMap';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const apiFetch = (path, options = {}) => {
  const token = localStorage.getItem('disasterlink_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
};
const initialAgents = [
  ['Situation Agent', 'What is happening?'], ['Risk Agent', 'How urgent is it?'],
  ['Resource Agent', 'Who should respond?'], ['Route Agent', 'How do we reach them?'],
  ['Predictive Agent', 'What happens next?'], ['Master Coordinator', 'What should we do?'],
].map(([name, question]) => ({ name, question, status: 'idle' }));

const operatorRegions = {
  mysore: { label: 'Mysore, Karnataka', center: [12.2958, 76.6394], zoom: 12, radius: 11_000 },
  assam: { label: 'Assam state', center: [26.2006, 92.9376], zoom: 7, radius: 310_000 },
};

function App() {
  const [screen, setScreen] = useState('signup');
  const [connection, setConnection] = useState('Checking dispatch network...');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [agents, setAgents] = useState(initialAgents);
  const [regionId, setRegionId] = useState('mysore');
  const [incidents, setIncidents] = useState([]);
  const [dispatchPlan, setDispatchPlan] = useState(null);

  const loadIncidents = async () => {
    const response = await apiFetch('/incidents');
    if (!response.ok) throw new Error('Unable to load incidents');
    setIncidents(await response.json());
  };

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/health', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); setConnection('Dispatch network connected'); })
      .catch(() => setConnection('Dispatch network unavailable'));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (screen !== 'command') return undefined;
    loadIncidents().catch(() => setErrorMessage('Unable to load the live incident feed.'));
    const stream = new EventSource(`${API_URL}/events`);
    const refresh = () => {
      loadIncidents().catch(() => {});
      setAgents(initialAgents.map((agent, index) => ({ ...agent, status: index < 5 ? 'complete' : 'processing', summary: index < 5 ? 'Live backend event processed.' : undefined })));
    };
    ['SOS_RECEIVED', 'INCIDENT_UPDATED', 'INCIDENT_REPORT_RECEIVED', 'PREDICTION_UPDATED', 'DISPATCH_PLANNED', 'DISPATCH_APPROVED', 'ROAD_BLOCKED', 'ROAD_UPDATED', 'HOSPITAL_FULL', 'HOSPITAL_CAPACITY_CHANGED', 'RESOURCE_AVAILABLE', 'RESOURCE_UNAVAILABLE', 'MESH_MESSAGE_RECEIVED'].forEach((name) => stream.addEventListener(name, refresh));
    stream.onopen = () => setConnection('Dispatch network connected');
    stream.onerror = () => setConnection('Dispatch network reconnecting...');
    return () => stream.close();
  }, [screen]);

  const provisionOperator = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.callsign, email: data.email, password: data.password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Operator enrolment failed');
      if (payload.token) localStorage.setItem('disasterlink_token', payload.token);
      setScreen('command');
      setAgents(initialAgents.map((agent, index) => ({ ...agent, status: index === 0 ? 'processing' : 'idle' })));
    } catch (error) { setErrorMessage(error.message); } finally { setLoading(false); }
  };

  const requestPlan = async (incident) => {
    setLoading(true); setErrorMessage(null);
    try {
      const response = await apiFetch('/dispatch/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incidentId: incident.id }) });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || 'Unable to create dispatch plan');
      setDispatchPlan(plan);
    } catch (error) { setErrorMessage(error.message); } finally { setLoading(false); }
  };

  const executePlan = async () => {
    if (!dispatchPlan) return;
    setLoading(true); setErrorMessage(null);
    try {
      const response = await apiFetch('/dispatch/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: dispatchPlan.id }) });
      const plan = await response.json();
      if (!response.ok) throw new Error(plan.error || 'Unable to execute dispatch');
      setDispatchPlan(plan);
      await loadIncidents();
    } catch (error) { setErrorMessage(error.message); } finally { setLoading(false); }
  };

  if (screen === 'signup') return <OperatorSignupPage onSubmit={provisionOperator} isLoading={loading} errorMessage={errorMessage} onNavigateToLogin={() => setErrorMessage('Register an operator account to open the command console.')} />;

  const baseRegion = operatorRegions[regionId];
  const region = {
    ...baseRegion,
    incidents: incidents.map((incident) => ({
      id: incident.id, title: incident.title, priority: incident.status === 'NEW' ? 'P1' : 'P2', status: incident.status,
      position: [incident.locationLat ?? baseRegion.center[0], incident.locationLng ?? baseRegion.center[1]],
    })),
  };

  return <div className="min-h-screen bg-surface text-on-surface">
    <header className="border-b border-outline-variant/40 bg-surface-container-lowest px-4 py-4 sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><div><p className="font-mono text-xs font-bold tracking-widest text-primary">DISASTERLINK CORE</p><h1 className="mt-1 text-lg font-bold">Operator Command</h1></div><div className="flex flex-wrap items-center gap-2"><label className="font-mono text-[10px] text-outline" htmlFor="demo-region">ASSIGNED REGION</label><select id="demo-region" value={regionId} onChange={(event) => setRegionId(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-bold text-on-surface"><option value="mysore">Mysore operator</option><option value="assam">Assam operator</option></select><span className="rounded-full border border-secondary/30 bg-secondary-container/20 px-3 py-1.5 font-mono text-xs text-secondary">{connection}</span></div></div></header>
    <main className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6"><div className="space-y-5"><OperatorMap region={region} /><section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5"><p className="font-mono text-xs font-bold tracking-widest text-primary">LIVE BACKEND TRIAGE</p><h2 className="mt-2 text-2xl font-bold">Incident stream</h2>{errorMessage && <p className="mt-3 rounded bg-error-container p-3 text-sm text-on-error-container">{errorMessage}</p>}<div className="mt-4 space-y-3">{incidents.length ? incidents.map((incident) => <article key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container p-3"><div><p className="font-mono text-xs text-secondary">{incident.status}</p><h3 className="font-bold">{incident.title}</h3><p className="text-sm text-on-surface-variant">{incident.description || 'No description supplied'}</p></div><button disabled={loading} onClick={() => requestPlan(incident)} className="rounded-lg bg-secondary-container px-3 py-2 text-sm font-bold text-on-secondary-container disabled:opacity-50">Create dispatch plan</button></article>) : <p className="text-sm text-on-surface-variant">No live incidents yet.</p>}</div>{dispatchPlan && <div className="mt-4 rounded-lg border border-secondary/40 bg-secondary-container/10 p-4"><p className="font-mono text-xs text-secondary">PLAN {dispatchPlan.status}</p><p className="mt-1 text-sm">Resources: {dispatchPlan.details.recommendedResources?.length || 0} · Hospital: {dispatchPlan.details.recommendedHospitalId || 'none'}</p>{dispatchPlan.status === 'PENDING' && <button disabled={loading} onClick={executePlan} className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:opacity-50">Approve and execute</button>}</div>}</section></div><AgentPipelinePanel agentStates={agents} incidentId={incidents[0]?.id} className="lg:rounded-xl lg:border" /></main>
  </div>;
}

export default App;
