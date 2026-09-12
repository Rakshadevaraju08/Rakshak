import SimulationPanel from './SimulationPanel';

export default function SimulationDashboard() {
  return (
    <main className="mx-auto max-w-4xl p-4 lg:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Simulation Hub</h2>
        <p className="mt-2 text-on-surface-variant">Inject demo events into the backend to trigger the AI pipeline and test operator workflows.</p>
      </div>
      
      <div className="grid gap-6">
        <SimulationPanel />
      </div>
    </main>
  );
}
