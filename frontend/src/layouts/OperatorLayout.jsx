import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Truck, 
  Hospital, 
  PlaySquare, 
  User, 
  Activity, 
  Server, 
  BrainCircuit,
  Menu,
  X
} from 'lucide-react';

export default function OperatorLayout({ connection, regionId, setRegionId, incidents = [], agents = [] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
    { name: 'Resources', href: '/resources', icon: Truck },
    { name: 'Hospitals', href: '/hospitals', icon: Hospital },
    { name: 'Simulation', href: '/simulation', icon: PlaySquare },
  ];

  // System status calculations
  const backendConnected = connection.includes('connected');
  const aiAvailable = agents.length > 0 && agents.every(a => a.status !== 'error');
  const criticalIncidents = incidents.filter(i => i.status === 'NEW' || i.priority === 'P1').length;
  const operatorName = 'Demo Operator'; // Would typically come from Auth context

  return (
    <div className="flex min-h-screen bg-surface text-on-surface">
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform flex-col border-r border-outline-variant/40 bg-surface-container-lowest transition-transform lg:static lg:flex lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 flex' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-outline-variant/40 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-on-surface">DL</div>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-widest text-primary">DISASTERLINK</p>
            <h1 className="text-sm font-bold">Command Center</h1>
          </div>
          <button 
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                  isActive 
                    ? 'bg-secondary-container/20 text-secondary' 
                    : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-secondary' : 'text-on-surface-variant'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Area */}
        <div className="border-t border-outline-variant/40 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-bold">{operatorName}</p>
              <p className="text-xs text-on-surface-variant">Active Duty</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/40 bg-surface-container-lowest px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-on-surface-variant hover:text-on-surface"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="hidden text-lg font-bold sm:block">
              {navigation.find(n => n.href === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Critical Incidents Warning */}
            {criticalIncidents > 0 && (
              <div className="hidden items-center gap-2 rounded-full border border-[var(--color-priority-p5)]/30 bg-[var(--color-priority-p5-container)] px-3 py-1 text-xs font-bold text-[var(--color-priority-p5)] sm:flex">
                <AlertTriangle size={14} />
                <span>{criticalIncidents} Critical Active</span>
              </div>
            )}

            {/* System Status */}
            <div className="flex items-center gap-4 border-l border-outline-variant/40 pl-4 sm:pl-6">
              <div className="flex items-center gap-2" title={connection}>
                <Server size={14} className={backendConnected ? 'text-[var(--color-status-resolved)]' : 'text-error'} />
                <span className="hidden text-xs font-bold sm:block">{backendConnected ? 'Backend OK' : 'Backend offline'}</span>
              </div>
              <div className="flex items-center gap-2" title="AI Service Status">
                <BrainCircuit size={14} className={aiAvailable ? 'text-[var(--color-status-analyzing)]' : 'text-error'} />
                <span className="hidden text-xs font-bold sm:block">{aiAvailable ? 'AI Ready' : 'AI Offline'}</span>
              </div>
            </div>

            {/* Region Selector */}
            <div className="flex items-center gap-2 border-l border-outline-variant/40 pl-4 sm:pl-6">
              <label className="hidden font-mono text-[10px] text-outline sm:block" htmlFor="demo-region">REGION</label>
              <select 
                id="demo-region" 
                value={regionId} 
                onChange={(event) => setRegionId(event.target.value)} 
                className="rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 text-xs font-bold text-on-surface focus:border-secondary focus:outline-none"
              >
                <option value="mysore">Mysore</option>
                <option value="assam">Assam</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Outlet */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
