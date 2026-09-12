import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet';
import { Toaster, toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

const demoOperator = { name: 'Arjun Kumar', rank: 'Incident Commander', status: 'ONLINE' };
const systemSummary = [
  { label: 'Active Incidents', value: '04', tone: 'cyan' },
  { label: 'Units Ready', value: '11', tone: 'emerald' },
  { label: 'Avg. ETA', value: '14 min', tone: 'amber' },
  { label: 'Critical Path', value: 'Flood / Kodagu', tone: 'rose' },
];

const liveTrendSeries = [42, 56, 48, 68, 74, 82, 90, 84, 91];

const initialIncidents = [
  {
    id: 'INC-1042',
    disasterType: 'FLOOD',
    title: 'Flood emergency',
    location: 'Kodagu',
    latitude: 12.304,
    longitude: 76.653,
    victims: 6,
    vulnerable: 2,
    priority: 5,
    severity: 'CRITICAL',
    timeReceivedMinutesAgo: 8,
    status: 'NEW',
    relatedReports: ['R-101', 'R-102', 'R-103', 'R-104'],
    routeDistanceKm: 12.4,
    etaMinutes: 14,
    hospital: 'District Hospital',
    prediction: 'Flood risk worsening',
    recommendation: 'DISPATCH IMMEDIATELY',
    reason: 'High victim count and reduced road access',
  },
  {
    id: 'INC-1043',
    disasterType: 'LANDSLIDE',
    title: 'Landslide alert',
    location: 'Madikeri',
    latitude: 12.274,
    longitude: 76.668,
    victims: 3,
    vulnerable: 1,
    priority: 4,
    severity: 'HIGH',
    timeReceivedMinutesAgo: 16,
    status: 'INVESTIGATING',
    relatedReports: ['R-201', 'R-202'],
    routeDistanceKm: 9.6,
    etaMinutes: 18,
    hospital: 'City Emergency Hospital',
    prediction: 'Slope instability increasing',
    recommendation: 'DISPATCH RESCUE UNIT',
    reason: 'Road access reduced and vulnerable occupants present',
  },
  {
    id: 'INC-1044',
    disasterType: 'MEDICAL',
    title: 'Medical emergency',
    location: 'Mysore Road',
    latitude: 12.312,
    longitude: 76.628,
    victims: 2,
    vulnerable: 0,
    priority: 3,
    severity: 'MEDIUM',
    timeReceivedMinutesAgo: 23,
    status: 'NEW',
    relatedReports: ['R-301'],
    routeDistanceKm: 6.8,
    etaMinutes: 10,
    hospital: 'Taluk Hospital',
    prediction: 'Condition stable',
    recommendation: 'DISPATCH AMBULANCE',
    reason: 'Priority medical transfer required',
  },
  {
    id: 'INC-1045',
    disasterType: 'FIRE',
    title: 'Warehouse fire',
    location: 'Industrial Belt',
    latitude: 12.326,
    longitude: 76.684,
    victims: 5,
    vulnerable: 2,
    priority: 2,
    severity: 'HIGH',
    timeReceivedMinutesAgo: 11,
    status: 'DISPATCHED',
    relatedReports: ['R-401', 'R-402'],
    routeDistanceKm: 8.3,
    etaMinutes: 15,
    hospital: 'District Hospital',
    prediction: 'Fire spread contained',
    recommendation: 'RESCUE TEAM RESPONSE',
    reason: 'Rapid spread hazard and nearby population exposure',
  },
];

const initialResources = [
  { id: 'AMB-01', type: 'AMBULANCE', label: 'Ambulance 01', status: 'AVAILABLE', latitude: 12.308, longitude: 76.632 },
  { id: 'AMB-02', type: 'AMBULANCE', label: 'Ambulance 02', status: 'BUSY', latitude: 12.282, longitude: 76.665 },
  { id: 'AMB-03', type: 'AMBULANCE', label: 'Ambulance 03', status: 'AVAILABLE', latitude: 12.318, longitude: 76.647 },
  { id: 'AMB-04', type: 'AMBULANCE', label: 'Ambulance 04', status: 'DISPATCHED', latitude: 12.287, longitude: 76.621 },
  { id: 'RES-01', type: 'RESCUE_TEAM', label: 'Rescue Team 01', status: 'AVAILABLE', latitude: 12.334, longitude: 76.665 },
  { id: 'RES-02', type: 'RESCUE_TEAM', label: 'Rescue Team 02', status: 'DISPATCHED', latitude: 12.284, longitude: 76.61 },
  { id: 'RES-03', type: 'RESCUE_TEAM', label: 'Rescue Team 03', status: 'AVAILABLE', latitude: 12.316, longitude: 76.607 },
];

const initialHospitals = [
  { id: 'H-01', name: 'District Hospital', status: 'AVAILABLE', capacity: 96, latitude: 12.285, longitude: 76.675 },
  { id: 'H-02', name: 'City Emergency Hospital', status: 'AVAILABLE', capacity: 81, latitude: 12.322, longitude: 76.688 },
  { id: 'H-03', name: 'Taluk Hospital', status: 'LIMITED', capacity: 34, latitude: 12.338, longitude: 76.61 },
];

const initialRoads = [
  { id: 'RD-01', name: 'Mysore-Kodagu Link', blocked: false, routePoints: [[12.315, 76.639], [12.304, 76.653], [12.295, 76.666]] },
  { id: 'RD-02', name: 'Madikeri Ridge Road', blocked: true, routePoints: [[12.318, 76.647], [12.312, 76.65], [12.274, 76.668]] },
  { id: 'RD-03', name: 'Waterfront Access Road', blocked: false, routePoints: [[12.334, 76.665], [12.316, 76.647], [12.307, 76.639]] },
];

const initialNotifications = [
  { id: 'N-01', text: 'SOS_RECEIVED: Flood emergency reported in Kodagu.', time: 'just now' },
  { id: 'N-02', text: 'RESOURCE_STATUS_CHANGED: AMB-03 available for dispatch.', time: '2 min ago' },
  { id: 'N-03', text: 'ROAD_BLOCKED: Alternate route recommended near Madikeri.', time: '6 min ago' },
];

const demoPrediction = { current: 'HIGH', next20Min: 'HIGH', next45Min: 'CRITICAL', trend: 'WORSENING' };
const demoRCA = {
  rootCause: 'Heavy rainfall',
  evidence: ['Rainfall', 'Water level', 'Road condition'],
  chain: ['Heavy Rainfall', 'Water Level Rising', 'Flood Risk Increasing', 'Road Accessibility Reduced', 'Rescue Delay'],
};

const getIncidentPlan = (incident) => ({
  priority: `${incident.severity} / ${incident.priority}`,
  situation: incident.title,
  victims: incident.victims,
  vulnerable: incident.vulnerable,
  resource: 'AMB-03',
  resourceStatus: 'AVAILABLE',
  route: `${incident.routeDistanceKm} km`,
  eta: `${incident.etaMinutes} min`,
  hospital: incident.hospital,
  prediction: incident.prediction,
  recommendation: incident.recommendation,
  evidence: ['High victim count', 'Vulnerable persons detected', 'Water level rising', 'Road accessibility reduced', 'Ambulance available nearby'],
});

const getPriorityColor = (priority) => {
  if (priority >= 5) return '#ef4444';
  if (priority >= 4) return '#f97316';
  if (priority >= 3) return '#fbbf24';
  return '#3b82f6';
};

const sidebarItems = [
  { label: 'Overview', icon: 'dashboard', to: '/' },
  { label: 'Incidents', icon: 'warning_amber', to: '/incidents' },
  { label: 'Dispatch', icon: 'route', to: '/dispatch' },
  { label: 'Hospitals', icon: 'local_hospital', to: '/hospitals' },
  { label: 'Reports', icon: 'analytics', to: '/reports' },
  { label: 'Alerts', icon: 'notifications_active', to: '/alerts' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rescuegrid-demo-auth') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ email: 'admin@rescuegrid.io', password: 'rescuegrid123' });
  const [loginError, setLoginError] = useState('');
  const [incidents, setIncidents] = useState(initialIncidents);
  const [selectedIncidentId, setSelectedIncidentId] = useState(initialIncidents[0].id);
  const [resources, setResources] = useState(initialResources);
  const [hospitals] = useState(initialHospitals);
  const [roads] = useState(initialRoads);
  const [selectedResourceId, setSelectedResourceId] = useState('AMB-03');
  const [notifications, setNotifications] = useState(initialNotifications);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'detected' | 'unavailable'>('unavailable');
  const [detectedLocation, setDetectedLocation] = useState('Kodagu, Karnataka');

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocationStatus('detected');
        setDetectedLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      },
      () => setLocationStatus('unavailable')
    );
  }, []);

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId) ?? incidents[0],
    [incidents, selectedIncidentId]
  );

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.id === selectedResourceId) ?? resources[0],
    [resources, selectedResourceId]
  );

  const plan = useMemo(() => getIncidentPlan(selectedIncident), [selectedIncident]);

  const routeState = useMemo(() => {
    if (!roads.some((road) => road.blocked)) {
      return { distanceKm: selectedIncident.routeDistanceKm, etaMinutes: selectedIncident.etaMinutes, reason: 'Primary route active', visible: false };
    }
    return { distanceKm: 15.2, etaMinutes: 21, reason: 'Road blockage detected', visible: true };
  }, [roads, selectedIncident]);

  const handleLoginSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (!email || !password) {
      setLoginError('Email and password are required.');
      return;
    }

    if (email === 'admin@rescuegrid.io' && password === 'rescuegrid123') {
      localStorage.setItem('rescuegrid-demo-auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      toast.success('Login successful');
      return;
    }

    setLoginError('Invalid credentials. Use the demo operator login.');
  };

  const handleLogout = () => {
    localStorage.removeItem('rescuegrid-demo-auth');
    setIsAuthenticated(false);
    setLoginError('');
    toast.success('Signed out');
  };

  const handleIncidentSelect = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setSelectedResourceId('AMB-03');
  };

  const handleApprove = () => setDispatchModalOpen(true);

  const handleDispatchConfirm = () => {
    setResources((current) => current.map((resource) => (resource.id === 'AMB-03' ? { ...resource, status: 'DISPATCHED' } : resource)));
    setIncidents((current) => current.map((incident) => (incident.id === selectedIncidentId ? { ...incident, status: 'DISPATCHED' } : incident)));
    setNotifications((current) => [{ id: `N-${Date.now()}`, text: `DISPATCH_CREATED: Ambulance AMB-03 assigned to ${selectedIncident.id}.`, time: 'just now' }, ...current]);
    toast.success('Dispatch confirmed');
    setDispatchModalOpen(false);
  };

  const handleModify = () => {
    toast('Alternate resource selected for review', { icon: '🛠️' });
    setSelectedResourceId('RES-01');
  };

  const handleReject = () => {
    setIncidents((current) => current.map((incident) => (incident.id === selectedIncidentId ? { ...incident, status: 'REJECTED' } : incident)));
    toast.error('Recommendation rejected');
  };

  const handleSOSSubmit = (payload) => {
    const newIncident = {
      id: `INC-${Math.floor(2000 + Math.random() * 1000)}`,
      disasterType: 'FLOOD',
      title: 'New SOS alert',
      location: payload.location || 'Kodagu',
      latitude: Number(payload.latitude) || 12.2958,
      longitude: Number(payload.longitude) || 76.6394,
      victims: 2,
      vulnerable: 1,
      priority: 4,
      severity: 'HIGH',
      timeReceivedMinutesAgo: 0,
      status: 'NEW',
      relatedReports: [`R-${Math.floor(100 + Math.random() * 100)}`],
      routeDistanceKm: 9.8,
      etaMinutes: 16,
      hospital: 'City Emergency Hospital',
      prediction: 'Flood risk rising',
      recommendation: 'DISPATCH IMMEDIATELY',
      reason: 'New SOS received from field',
    };

    setIncidents((current) => [newIncident, ...current]);
    setSelectedIncidentId(newIncident.id);
    setNotifications((current) => [{ id: `N-${Date.now()}`, text: `SOS_RECEIVED: ${newIncident.id} reported at ${newIncident.location}.`, time: 'just now' }, ...current]);
    toast.success('SOS submitted in demo mode');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-200">
        <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
        <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/60 bg-cyan-500/10 text-2xl font-black text-cyan-300">R</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">State Emergency Operations</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">RESCUEGRID</h1>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Operator Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            {loginError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{loginError}</div>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-300">
              Demo login: admin@rescuegrid.io / rescuegrid123
            </div>

            <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-400">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout onLogout={handleLogout}><OverviewPage incidents={incidents} selectedIncidentId={selectedIncidentId} onIncidentSelect={handleIncidentSelect} selectedResourceId={selectedResourceId} onSelectResource={setSelectedResourceId} resources={resources} hospitals={hospitals} roads={roads} notifications={notifications} locationStatus={locationStatus} detectedLocation={detectedLocation} selectedIncident={selectedIncident} selectedResource={selectedResource} plan={plan} dispatchModalOpen={dispatchModalOpen} setDispatchModalOpen={setDispatchModalOpen} onApprove={handleApprove} onDispatchConfirm={handleDispatchConfirm} onModify={handleModify} onReject={handleReject} onSOSSubmit={handleSOSSubmit} routeState={routeState} /></DashboardLayout>} />
          <Route path="/incidents" element={<DashboardLayout onLogout={handleLogout}><IncidentsPage incidents={incidents} selectedIncidentId={selectedIncidentId} onIncidentSelect={handleIncidentSelect} selectedIncident={selectedIncident} selectedResource={selectedResource} /></DashboardLayout>} />
          <Route path="/dispatch" element={<DashboardLayout onLogout={handleLogout}><DispatchPage selectedIncident={selectedIncident} resources={resources} selectedResourceId={selectedResourceId} onSelectResource={setSelectedResourceId} onApprove={handleApprove} dispatchModalOpen={dispatchModalOpen} setDispatchModalOpen={setDispatchModalOpen} onDispatchConfirm={handleDispatchConfirm} /></DashboardLayout>} />
          <Route path="/hospitals" element={<DashboardLayout onLogout={handleLogout}><HospitalsPage hospitals={hospitals} /></DashboardLayout>} />
          <Route path="/reports" element={<DashboardLayout onLogout={handleLogout}><ReportsPage selectedIncident={selectedIncident} plan={plan} locationStatus={locationStatus} detectedLocation={detectedLocation} onSOSSubmit={handleSOSSubmit} /></DashboardLayout>} />
          <Route path="/alerts" element={<DashboardLayout onLogout={handleLogout}><AlertsPage notifications={notifications} routeState={routeState} /></DashboardLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function DashboardLayout({ children, onLogout }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[260px] flex-shrink-0 border-r border-slate-700 bg-slate-950/80 px-4 py-5 xl:flex xl:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-500/10 text-lg font-black text-cyan-300">R</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Ops</div>
            <div className="text-lg font-black text-white">RESCUEGRID</div>
          </div>
        </div>

        <nav className="space-y-2">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${isActive ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' : 'border-slate-800 bg-slate-900/70 text-slate-200 hover:border-slate-600'} `}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Shift status</div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-200">
            <span>Duty officer</span>
            <span className="font-semibold text-emerald-300">Online</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-200">
            <span>Rural mesh</span>
            <span className="font-semibold text-cyan-300">Stable</span>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="border-b border-slate-700 bg-slate-950/90 px-5 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-500/10 text-cyan-300 xl:hidden">R</div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.28rem] text-cyan-300/80">State Emergency Operations</div>
                <h1 className="text-2xl font-black tracking-tight text-white">RESCUEGRID</h1>
              </div>
            </div>

            <div className="hidden items-center gap-6 text-sm lg:flex">
              <div className="flex items-center gap-2 text-slate-300"><span>Operator:</span><span className="font-semibold text-white">{demoOperator.name}</span></div>
              <div className="flex items-center gap-2 text-slate-300"><span>Rank:</span><span className="font-semibold text-white">{demoOperator.rank}</span></div>
              <div className="flex items-center gap-2 text-slate-300"><span>Status:</span><span className="font-semibold text-emerald-300">{demoOperator.status}</span></div>
              <div className="flex items-center gap-2 text-slate-300"><span>System:</span><span className="font-semibold text-violet-200">LIVE / DEMO</span></div>
              <button type="button" onClick={onLogout} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200 transition hover:border-slate-500 hover:bg-slate-700">
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

function OverviewPage({ incidents, selectedIncidentId, onIncidentSelect, selectedResourceId, onSelectResource, resources, hospitals, roads, notifications, locationStatus, detectedLocation, selectedIncident, selectedResource, plan, dispatchModalOpen, setDispatchModalOpen, onApprove, onDispatchConfirm, onModify, onReject, onSOSSubmit, routeState }) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">DEMO MODE</div>
          <div className="font-semibold text-white">Using fallback data for the RescueGrid operator dashboard.</div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">ACTIVE</span>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {systemSummary.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/20">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
            <div className={`mt-2 text-2xl font-black ${item.tone === 'cyan' ? 'text-cyan-300' : item.tone === 'emerald' ? 'text-emerald-300' : item.tone === 'amber' ? 'text-amber-300' : 'text-rose-300'}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Live network trends</div>
              <div className="mt-1 text-lg font-bold text-white">Response pressure</div>
            </div>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">+18.4%</span>
          </div>
          <div className="flex h-28 items-end gap-2">
            {liveTrendSeries.map((value, index) => (
              <div key={`${value}-${index}`} className="flex-1 rounded-t-xl bg-gradient-to-t from-cyan-500 via-sky-400 to-blue-300" style={{ height: `${value}%`, opacity: index > 5 ? 1 : 0.82 }} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/30">
          <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-slate-400">Resource balance</div>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between"><span>Ambulance availability</span><span className="font-bold text-emerald-300">78%</span></div>
            <div className="h-2 rounded-full bg-slate-800"><div className="h-full w-[78%] rounded-full bg-emerald-400" /></div>
            <div className="flex items-center justify-between"><span>Rescue readiness</span><span className="font-bold text-amber-300">63%</span></div>
            <div className="h-2 rounded-full bg-slate-800"><div className="h-full w-[63%] rounded-full bg-amber-400" /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
        <aside className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase tracking-[0.18em] text-slate-200">Active Incidents</h2>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">{incidents.length}</span>
          </div>

          <div className="space-y-3">
            {incidents.map((incident) => (
              <button type="button" key={incident.id} onClick={() => onIncidentSelect(incident.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedIncidentId === incident.id ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{incident.id}</div>
                  <span className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: `${getPriorityColor(incident.priority)}20`, color: getPriorityColor(incident.priority), borderColor: `${getPriorityColor(incident.priority)}66` }}>{incident.severity}</span>
                </div>
                <div className="mb-1 text-lg font-bold text-white">{incident.disasterType}</div>
                <div className="mb-2 text-sm text-slate-300">{incident.location}</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="rounded-lg bg-slate-800/70 p-2"><div className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Victims</div><div className="mt-1 font-semibold text-white">{incident.victims}</div></div>
                  <div className="rounded-lg bg-slate-800/70 p-2"><div className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Vulnerable</div><div className="mt-1 font-semibold text-white">{incident.vulnerable}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300"><span>Priority {incident.priority}</span><span>{incident.timeReceivedMinutesAgo} min ago</span></div>
                <div className="mt-3 inline-flex rounded-full border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200">{incident.status}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3 shadow-2xl shadow-slate-950/40">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold text-white">LIVE MAP</h3><span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">LIVE</span></div>
              <div className="h-[520px] overflow-hidden rounded-xl border border-slate-700">
                <MapContainer center={[selectedIncident.latitude, selectedIncident.longitude]} zoom={11} scrollWheelZoom className="h-full w-full">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {roads.map((road) => (
                    <Polyline key={road.id} positions={road.routePoints} pathOptions={{ color: road.blocked ? '#ef4444' : '#22c55e', weight: road.blocked ? 5 : 3, dashArray: road.blocked ? '10 8' : '0' }} />
                  ))}
                  {hospitals.map((hospital) => (
                    <CircleMarker key={hospital.id} center={[hospital.latitude, hospital.longitude]} radius={14} pathOptions={{ color: '#ffffff', weight: 2, fillColor: hospital.status === 'AVAILABLE' ? '#10b981' : '#fbbf24', fillOpacity: 0.8 }} />
                  ))}
                  {resources.map((resource) => (
                    <CircleMarker key={resource.id} center={[resource.latitude, resource.longitude]} radius={12} pathOptions={{ color: '#ffffff', weight: 2, fillColor: resource.status === 'AVAILABLE' ? '#22c55e' : resource.status === 'BUSY' ? '#fbbf24' : '#ef4444', fillOpacity: 0.8 }} eventHandlers={{ click: () => onSelectResource(resource.id) }} />
                  ))}
                  {incidents.map((incident) => (
                    <CircleMarker key={incident.id} center={[incident.latitude, incident.longitude]} radius={selectedIncidentId === incident.id ? 20 : 12} pathOptions={{ color: '#ffffff', weight: selectedIncidentId === incident.id ? 3 : 2, fillColor: getPriorityColor(incident.priority), fillOpacity: 0.8 }} eventHandlers={{ click: () => onIncidentSelect(incident.id) }}>
                      <Popup><div className="space-y-1"><strong>{incident.id}</strong><div>{incident.disasterType}</div><div>{incident.location}</div><div>Priority {incident.priority}</div></div></Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                {['Critical Incident', 'High Incident', 'Medium Incident', 'Ambulance', 'Rescue Team', 'Hospital', 'Blocked Road'].map((label, index) => (
                  <div key={label} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#38bdf8', '#10b981', '#ef4444'][index] }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">AI Response Plan</div>
                  <h3 className="mt-1 text-xl font-bold text-white">{plan.situation}</h3>
                </div>
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">{plan.priority}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Victims" value={String(plan.victims)} />
                <InfoCard label="Vulnerable" value={String(plan.vulnerable)} />
                <InfoCard label="Resource" value={plan.resource} />
                <InfoCard label="Route" value={plan.route} />
              </div>

              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Resource Status</div><div className="mt-2 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">{plan.resourceStatus}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">ETA</div><div className="mt-2 text-lg font-bold text-white">{plan.eta}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Hospital</div><div className="mt-2 text-base font-semibold text-white">{plan.hospital}</div></div>
                  <div><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Prediction</div><div className="mt-2 text-base font-semibold text-white">{plan.prediction}</div></div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Recommendation</div><div className="text-lg font-black text-emerald-300">{plan.recommendation}</div></div>
              </div>

              <div className="mt-5">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">WHY?</div>
                <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="text-sm font-semibold text-slate-200">Evidence</div>
                  <ul className="space-y-2 text-sm text-slate-300">
                    {plan.evidence.map((item) => <li key={item} className="flex items-start gap-2"><span className="mt-1 block h-2 w-2 rounded-full bg-cyan-400" /><span>{item}</span></li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={onApprove} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-emerald-400">Approve</button>
                <button type="button" onClick={onModify} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-500/20">Modify</button>
                <button type="button" onClick={onReject} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/20">Reject</button>
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
                <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-cyan-300">Prediction</div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-200">
                    <MetricBox label="Current" value={demoPrediction.current} />
                    <MetricBox label="Next 20 min" value={demoPrediction.next20Min} />
                    <MetricBox label="Next 45 min" value={demoPrediction.next45Min} />
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Trend</div><div className="mt-2 font-bold text-amber-300">{demoPrediction.trend}</div></div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
                <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-cyan-300">Root Cause Analysis</div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Root Cause</div>
                  <div className="mt-2 text-lg font-bold text-white">{demoRCA.rootCause}</div>
                  <div className="mt-4 space-y-2 text-sm text-slate-200">{demoRCA.chain.map((step, index) => <div key={step} className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-[10px] font-bold text-cyan-200">{index + 1}</span><span>{step}</span>{index < demoRCA.chain.length - 1 && <span className="text-slate-500">↓</span>}</div>)}</div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Evidence</div><ul className="mt-3 space-y-2 text-sm text-slate-300">{demoRCA.evidence.map((item) => <li key={item} className="flex items-start gap-2"><span className="mt-1 block h-2 w-2 rounded-full bg-emerald-400" /><span>{item}</span></li>)}</ul></div>
              </section>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold uppercase tracking-[0.18em] text-slate-200">Resources</h3><span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">LIVE</span></div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">Ambulances</div>
                <div className="space-y-2">{resources.filter((resource) => resource.type === 'AMBULANCE').map((resource) => <button type="button" key={resource.id} onClick={() => onSelectResource(resource.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${selectedResourceId === resource.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}><div><div className="font-semibold text-white">{resource.id}</div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{resource.label}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${resource.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-200' : resource.status === 'BUSY' ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-200'}`}>{resource.status}</span></button>)}</div>
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">Fire / Rescue</div>
                <div className="space-y-2">{resources.filter((resource) => resource.type === 'RESCUE_TEAM').map((resource) => <button type="button" key={resource.id} onClick={() => onSelectResource(resource.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${selectedResourceId === resource.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}><div><div className="font-semibold text-white">{resource.id}</div><div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{resource.label}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${resource.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'}`}>{resource.status}</span></button>)}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Ambulances</div><div className="mt-2 text-sm leading-6 text-slate-200"><div>Available: <span className="font-bold text-emerald-300">{resources.filter((r) => r.type === 'AMBULANCE' && r.status === 'AVAILABLE').length}</span></div><div>Busy: <span className="font-bold text-amber-300">{resources.filter((r) => r.type === 'AMBULANCE' && r.status === 'BUSY').length}</span></div><div>Dispatched: <span className="font-bold text-red-300">{resources.filter((r) => r.type === 'AMBULANCE' && r.status === 'DISPATCHED').length}</span></div></div></div><div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Rescue Teams</div><div className="mt-2 text-sm leading-6 text-slate-200"><div>Available: <span className="font-bold text-emerald-300">{resources.filter((r) => r.type === 'RESCUE_TEAM' && r.status === 'AVAILABLE').length}</span></div><div>Dispatched: <span className="font-bold text-red-300">{resources.filter((r) => r.type === 'RESCUE_TEAM' && r.status === 'DISPATCHED').length}</span></div></div></div></div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold uppercase tracking-[0.18em] text-slate-200">Hospitals</h3><span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">DEMO</span></div>
            <div className="space-y-3">{hospitals.map((hospital) => <div key={hospital.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/40 p-3"><div><div className="font-semibold text-white">{hospital.name}</div><div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Capacity {hospital.capacity}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${hospital.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{hospital.status}</span></div>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold uppercase tracking-[0.18em] text-slate-200">Text SOS</h3><span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">{locationStatus === 'detected' ? 'Location detected' : 'Location unavailable'}</span></div>
            <SOSForm onSubmit={onSOSSubmit} locationStatus={locationStatus} detectedLocation={detectedLocation} />
          </section>

          {routeState.visible && <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30"><div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-amber-300">Route Replanning</div><div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><div className="text-sm font-bold uppercase tracking-[0.14em] text-amber-200">⚠ ROAD BLOCKED</div><div className="mt-2 text-sm text-amber-100">CURRENT ROUTE UNAVAILABLE</div><div className="mt-1 text-sm text-amber-100">REPLANNING...</div></div><div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4"><div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">New Route</div><div className="mt-2 text-lg font-bold text-white">ETA {routeState.etaMinutes} min</div><div className="mt-1 text-sm text-slate-300">Distance {routeState.distanceKm} km</div><div className="mt-3 text-sm text-slate-200">Reason: {routeState.reason}</div></div></section>}

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
            <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-cyan-300">Alerts</div>
            <div className="space-y-3">{notifications.map((notification) => <div key={notification.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"><div className="text-sm text-slate-200">{notification.text}</div><div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{notification.time}</div></div>)}</div>
          </section>
        </div>
      </div>

      <aside className="mt-6 hidden w-[360px] shrink-0 lg:block">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Incident detail</div>
              <h3 className="mt-1 text-xl font-bold text-white">{selectedIncident.id}</h3>
            </div>
            <button type="button" onClick={() => onIncidentSelect(incidents[0].id)} className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200">Focus</button>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Priority</div>
                <div className="mt-2 text-2xl font-black text-white">{selectedIncident.severity}</div>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200">{selectedIncident.status}</span>
            </div>
            <div className="mt-4 text-xl font-bold text-white">{selectedIncident.title}</div>
            <div className="mt-2 text-sm text-slate-300">{selectedIncident.location}</div>
          </div>

          <div className="mt-5 space-y-3">
            <InfoRow label="Resource" value={selectedResource?.id || 'AMB-03'} />
            <InfoRow label="ETA" value={`${selectedIncident.etaMinutes} min`} />
            <InfoRow label="Distance" value={`${selectedIncident.routeDistanceKm} km`} />
            <InfoRow label="Hospital" value={selectedIncident.hospital} />
            <InfoRow label="Coordinates" value={`${selectedIncident.latitude}, ${selectedIncident.longitude}`} />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Situation summary</div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{selectedIncident.reason}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-slate-400">Recommended actions</div>
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" /><span>Dispatch unit {selectedResource?.id || 'AMB-03'} to staging point</span></li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" /><span>Reroute rescue convoy via alternate corridor</span></li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" /><span>Notify tertiary medical support on alert</span></li>
            </ul>
          </div>
        </div>
      </aside>

      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-cyan-300">Dispatch Confirmation</div>
            <h3 className="text-2xl font-bold text-white">Confirm Dispatch</h3>
            <div className="mt-5 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
              <div className="flex justify-between"><span className="text-slate-400">Incident</span><span className="font-semibold text-white">{selectedIncident.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Resource</span><span className="font-semibold text-white">AMB-03</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Route</span><span className="font-semibold text-white">{selectedIncident.routeDistanceKm} km</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ETA</span><span className="font-semibold text-white">{selectedIncident.etaMinutes} min</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Hospital</span><span className="font-semibold text-white">{selectedIncident.hospital}</span></div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDispatchModalOpen(false)} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-200">Cancel</button>
              <button type="button" onClick={onDispatchConfirm} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-950">Confirm Dispatch</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IncidentsPage({ incidents, selectedIncidentId, onIncidentSelect, selectedIncident, selectedResource }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Operations</div>
            <h2 className="mt-1 text-2xl font-black text-white">Incidents</h2>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">{incidents.length} active</span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {incidents.map((incident) => (
            <button type="button" key={incident.id} onClick={() => onIncidentSelect(incident.id)} className={`rounded-2xl border p-4 text-left transition ${selectedIncidentId === incident.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{incident.id}</div>
                <span className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: `${getPriorityColor(incident.priority)}20`, color: getPriorityColor(incident.priority), borderColor: `${getPriorityColor(incident.priority)}66` }}>{incident.severity}</span>
              </div>
              <div className="text-xl font-bold text-white">{incident.title}</div>
              <div className="mt-2 text-sm text-slate-300">{incident.location}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Victims</div><div className="mt-2 font-bold text-white">{incident.victims}</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">ETA</div><div className="mt-2 font-bold text-white">{incident.etaMinutes} min</div></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-cyan-300">Selected incident</div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Incident</div>
            <div className="mt-2 text-2xl font-black text-white">{selectedIncident.id}</div>
            <div className="mt-3 text-lg font-bold text-white">{selectedIncident.disasterType}</div>
            <div className="mt-2 text-sm text-slate-300">{selectedIncident.location}</div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Assigned resource</div>
            <div className="mt-2 text-2xl font-black text-white">{selectedResource?.id || 'AMB-03'}</div>
            <div className="mt-2 text-sm text-slate-300">{selectedIncident.hospital}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatchPage({ selectedIncident, resources, selectedResourceId, onSelectResource, onApprove, dispatchModalOpen, setDispatchModalOpen, onDispatchConfirm }) {
  return (
    <div className="space-y-5">
      <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Dispatch control</div>
        <h2 className="mt-1 text-2xl font-black text-white">Resource dispatch</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Selected incident</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{selectedIncident.id}</div>
            <div className="mt-2 text-2xl font-black text-white">{selectedIncident.title}</div>
            <div className="mt-2 text-sm text-slate-300">{selectedIncident.location}</div>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-200">
            <InfoRow label="ETA" value={`${selectedIncident.etaMinutes} min`} />
            <InfoRow label="Route" value={`${selectedIncident.routeDistanceKm} km`} />
            <InfoRow label="Priority" value={selectedIncident.severity} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Available teams</div>
          <div className="space-y-3">
            {resources.map((resource) => (
              <button type="button" key={resource.id} onClick={() => onSelectResource(resource.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${selectedResourceId === resource.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}>
                <div>
                  <div className="font-bold text-white">{resource.id}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{resource.label}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${resource.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-200' : resource.status === 'BUSY' ? 'bg-amber-500/15 text-amber-200' : 'bg-red-500/15 text-red-200'}`}>{resource.status}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onApprove} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950">Approve Dispatch</button>
          <button type="button" onClick={() => setDispatchModalOpen(false)} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-200">Hold</button>
        </div>
      </div>

      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-slate-950/60">
            <div className="mb-4 text-[10px] uppercase tracking-[0.2em] text-cyan-300">Dispatch Confirmation</div>
            <h3 className="text-2xl font-bold text-white">Confirm Dispatch</h3>
            <div className="mt-5 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
              <div className="flex justify-between"><span className="text-slate-400">Incident</span><span className="font-semibold text-white">{selectedIncident.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Resource</span><span className="font-semibold text-white">AMB-03</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ETA</span><span className="font-semibold text-white">{selectedIncident.etaMinutes} min</span></div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDispatchModalOpen(false)} className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-200">Cancel</button>
              <button type="button" onClick={onDispatchConfirm} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] text-slate-950">Confirm Dispatch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HospitalsPage({ hospitals }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Medical coordination</div>
        <h2 className="mt-1 text-2xl font-black text-white">Hospitals</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {hospitals.map((hospital) => (
          <div key={hospital.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold text-white">{hospital.name}</div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${hospital.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{hospital.status}</span>
            </div>
            <div className="mt-4 text-sm text-slate-300">Capacity: {hospital.capacity}</div>
            <div className="mt-4 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, hospital.capacity)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsPage({ selectedIncident, plan, locationStatus, detectedLocation, onSOSSubmit }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Operational intelligence</div>
        <h2 className="mt-1 text-2xl font-black text-white">Reports</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Selected incident</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{selectedIncident.id}</div>
            <div className="mt-2 text-2xl font-black text-white">{plan.situation}</div>
          </div>
          <div className="mt-4 space-y-3">
            <InfoRow label="Victims" value={String(plan.victims)} />
            <InfoRow label="Vulnerable" value={String(plan.vulnerable)} />
            <InfoRow label="ETA" value={plan.eta} />
            <InfoRow label="Prediction" value={plan.prediction} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Send SOS</div>
          <SOSForm onSubmit={onSOSSubmit} locationStatus={locationStatus} detectedLocation={detectedLocation} />
        </div>
      </div>
    </div>
  );
}

function AlertsPage({ notifications, routeState }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Situational awareness</div>
        <h2 className="mt-1 text-2xl font-black text-white">Alerts</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Live alerts</div>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                <div className="text-sm text-slate-200">{notification.text}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{notification.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-cyan-300">Route change</div>
          {routeState.visible ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="text-sm font-bold uppercase tracking-[0.14em] text-amber-200">⚠ Road blocked</div>
              <div className="mt-2 text-sm text-amber-100">Alternative route active</div>
              <div className="mt-3 text-lg font-black text-white">ETA {routeState.etaMinutes} min</div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-200">No active route alert.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-center">
      <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 font-black text-white">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function SOSForm({ onSubmit, locationStatus, detectedLocation }) {
  const [message, setMessage] = useState('I am trapped in flood water with two children.');
  const [location, setLocation] = useState('Kodagu, Karnataka');
  const [latitude, setLatitude] = useState('12.2958');
  const [longitude, setLongitude] = useState('76.6394');
  const [imagePreview, setImagePreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleVideo = (event) => {
    const file = event.target.files?.[0];
    if (file) setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ message, location, latitude, longitude });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">SOS message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" />
      </div>

      <div><label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></div>
      <div className="grid gap-3 md:grid-cols-2"><div><label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Latitude</label><input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></div><div><label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Longitude</label><input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></div></div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Upload Image</label>
          <input type="file" accept="image/*" onChange={handleImage} className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-500/15 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.18em] file:text-cyan-200" />
          {imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 h-20 w-full rounded-xl object-cover" />}
          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{imagePreview ? 'IMAGE ATTACHED' : 'AI IMAGE ANALYSIS UNAVAILABLE'}</div>
        </div>
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Upload Video</label>
          <input type="file" accept="video/*" onChange={handleVideo} className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-violet-500/15 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.18em] file:text-violet-200" />
          {videoPreview && <video src={videoPreview} controls className="mt-2 h-20 w-full rounded-xl object-cover" />}
          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{videoPreview ? 'VIDEO ATTACHED' : 'AI VIDEO ANALYSIS UNAVAILABLE'}</div>
        </div>
      </div>

      <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-400">Send SOS</button>
      <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-[10px] uppercase tracking-[0.18em] text-slate-400">{locationStatus === 'detected' ? `Location detected: ${detectedLocation}` : 'Location unavailable'}</div>
    </form>
  );
}
