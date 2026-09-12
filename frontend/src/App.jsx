import { useEffect, useState } from 'react';
import OperatorSignupPage from './pages/OperatorSignupPage';
import AgentPipelinePanel from './components/AgentPipelinePanel';
import OperatorMap from './components/OperatorMap';

const initialAgents = [
  ['Situation Agent', 'What is happening?'], ['Risk Agent', 'How urgent is it?'],
  ['Resource Agent', 'Who should respond?'], ['Route Agent', 'How do we reach them?'],
  ['Predictive Agent', 'What happens next?'], ['Master Coordinator', 'What should we do?'],
].map(([name, question]) => ({ name, question, status: 'idle' }));

// Temporary client-side assignments. Replace with GET /api/auth/me after backend auth is available.
const operatorRegions = {
  mysore: {
    label: 'Mysore, Karnataka', center: [12.2958, 76.6394], zoom: 12, radius: 11_000,
    incidents: [
      { id: 'INC-MYS-104', title: 'Medical assistance', priority: 'P1', status: 'Awaiting dispatch', position: [12.3074, 76.6444] },
      { id: 'INC-MYS-111', title: 'Road obstruction', priority: 'P2', status: 'Field review', position: [12.2827, 76.6326] },
    ],
  },
  assam: {
    label: 'Assam state', center: [26.2006, 92.9376], zoom: 7, radius: 310_000,
    incidents: [
      { id: 'INC-ASM-208', title: 'Flood rescue request', priority: 'P1', status: 'Boat unit assigned', position: [26.1445, 91.7362] },
      { id: 'INC-ASM-214', title: 'Landslide route hazard', priority: 'P2', status: 'Route assessment', position: [27.0844, 93.6053] },
    ],
  },
};

function App() {
  const [screen, setScreen] = useState('signup');
  const [connection, setConnection] = useState('Checking dispatch network…');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [agents, setAgents] = useState(initialAgents);
  const [regionId, setRegionId] = useState('mysore');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/health`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); setConnection('Dispatch network connected'); })
      .catch(() => setConnection('Dispatch network unavailable — demo mode'));
    return () => controller.abort();
  }, []);

  const provisionOperator = async () => {
    setLoading(true);
    setErrorMessage(null);
    // Credentials remain client-side until the backend exposes an authentication endpoint.
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    setLoading(false);
    setScreen('command');
    setAgents(initialAgents.map((agent, index) => ({ ...agent, status: index === 0 ? 'processing' : 'idle' })));
  };

  if (screen === 'signup') {
    return <OperatorSignupPage onSubmit={provisionOperator} isLoading={loading} errorMessage={errorMessage} onNavigateToLogin={() => setErrorMessage('Sign-in is not available until the backend authentication route is implemented.')} />;
  }

  const region = operatorRegions[regionId];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant/40 bg-surface-container-lowest px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div><p className="font-mono text-xs font-bold tracking-widest text-primary">DISASTERLINK CORE</p><h1 className="mt-1 text-lg font-bold">Operator Command</h1></div>
          <div className="flex flex-wrap items-center gap-2"><label className="font-mono text-[10px] text-outline" htmlFor="demo-region">DEMO ASSIGNMENT</label><select id="demo-region" value={regionId} onChange={(event) => setRegionId(event.target.value)} className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-bold text-on-surface"><option value="mysore">Mysore operator</option><option value="assam">Assam operator</option></select><span className="rounded-full border border-secondary/30 bg-secondary-container/20 px-3 py-1.5 font-mono text-xs text-secondary">{connection}</span></div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
        <div className="space-y-5">
          <OperatorMap region={region} />
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5"><p className="font-mono text-xs font-bold tracking-widest text-primary">OPERATOR SESSION READY</p><h2 className="mt-2 text-2xl font-bold">Triage stream</h2><p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">The map is currently driven by the demo assignment selector. Once backend authentication is connected, its assigned-region response should set this viewport and supply the incidents shown on the map.</p><button onClick={() => setAgents(initialAgents.map((agent, index) => ({ ...agent, status: index < 5 ? 'complete' : 'processing', summary: index < 5 ? 'Live analysis complete.' : undefined })))} className="mt-6 rounded-lg bg-secondary-container px-4 py-3 text-sm font-bold text-on-secondary-container">Run incident analysis</button></section>
        </div>
        <AgentPipelinePanel agentStates={agents} incidentId={region.incidents[0].id} className="lg:rounded-xl lg:border" />
      </main>
    </div>
  );
}

export default App;
