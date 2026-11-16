import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  FileText,
  Hospital,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Radio,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import IncidentsPage from './pages/IncidentsPage';
import AiIntelligencePage from './pages/AiIntelligencePage';
import DecisionEnginePage from './pages/DecisionEnginePage';
import SearchRoutingPage from './pages/SearchRoutingPage';
import HospitalsPage from './pages/HospitalsPage';
import DispatchPage from './pages/DispatchPage';
import ReportsPage from './pages/ReportsPage';
import { AnalysisProvider } from './contexts/AnalysisContext';
import OverviewIncidentMap from './components/OverviewIncidentMap';
import { useIncidents } from './hooks/useIncidents';
import { formatRelativeTime, formatStatusLabel } from './utils/incidentFilters';

type Section = {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyMessage: string;
};

const sections: Section[] = [
  {
    path: '/',
    title: 'Overview',
    description: 'A clear starting point for coordinated emergency response.',
    icon: LayoutDashboard,
    emptyTitle: '',
    emptyMessage: '',
  },
  {
    path: '/incidents',
    title: 'Incidents',
    description: 'Review and coordinate incoming emergency reports.',
    icon: ClipboardList,
    emptyTitle: 'Incident feed not connected',
    emptyMessage: 'Connect the incident API to review incoming reports and coordinate response.',
  },
  {
    path: '/intelligence',
    title: 'AI Intelligence',
    description: 'Inspect real AI analysis outputs, safety checks, and execution traces.',
    icon: BrainCircuit,
    emptyTitle: 'AI analysis is not available yet',
    emptyMessage: 'Connect incident data and the AI service to surface analysis in this workspace.',
  },
  {
    path: '/routing',
    title: 'Search & Routing',
    description: 'Compare BFS, DFS, Greedy Best-First, and A* on a simulated disaster-area grid.',
    icon: RouteIcon,
    emptyTitle: 'Route data not connected',
    emptyMessage: 'Connect road and routing data to review accessible response routes here.',
  },
  {
    path: '/decisions',
    title: 'Decision Engine',
    description: 'Bring context and response priorities together for informed decisions.',
    icon: SlidersHorizontal,
    emptyTitle: 'Decision support is not configured',
    emptyMessage: 'Recommendations will appear here when the required operational data is connected.',
  },
  {
    path: '/dispatch',
    title: 'Planning & Dispatch',
    description: 'Plan response activity and coordinate available resources.',
    icon: Truck,
    emptyTitle: 'Dispatch workspace is not connected',
    emptyMessage: 'Connect resource and dispatch data to begin coordinating response plans.',
  },
  {
    path: '/hospitals',
    title: 'Hospitals',
    description: 'Coordinate receiving facilities as part of the response.',
    icon: Hospital,
    emptyTitle: 'Hospital directory not connected',
    emptyMessage: 'Connect hospital data to review receiving facilities in this workspace.',
  },
  {
    path: '/reports',
    title: 'Reports',
    description: 'Prepare operational summaries from connected response data.',
    icon: FileText,
    emptyTitle: 'No reports to display',
    emptyMessage: 'Reports will be available when operational data is connected.',
  },
];

function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  );
}

function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');
  const activeSection = sections.find(section => section.path === normalizedPath) ?? sections[0];

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim is-visible"
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <Link className="brand" to="/" onClick={() => setSidebarOpen(false)}>
          <span className="brand-mark"><ShieldCheck size={22} strokeWidth={2.2} /></span>
          <span className="brand-copy">
            <strong>rakshak</strong>
            <span>RESPONSE SYSTEM</span>
          </span>
        </Link>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <NavLink
                key={section.path}
                to={section.path}
                end={section.path === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{section.title}</span>
                {section.path === '/intelligence' && <span className="nav-accent" aria-hidden="true" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-icon"><Radio size={17} /></span>
            <strong>Connect your workspace</strong>
            <p>Operational data will appear here when integrations are configured.</p>
          </div>
          <div className="workspace-profile">
            <span className="profile-mark">R</span>
            <span className="profile-copy">
              <strong>Admin console</strong>
              <span>Rakshak workspace</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setSidebarOpen(open => !open)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumbs">
            <span>Operations</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activeSection.title}</strong>
          </div>
          <div className="topbar-status">
            <span className="status-dot" />
            <span>Workspace setup</span>
          </div>
        </header>

        <div className="page-content">
          <AnalysisProvider>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/intelligence" element={<AiIntelligencePage />} />
              <Route path="/routing" element={<SearchRoutingPage />} />
              <Route path="/decisions" element={<DecisionEnginePage />} />
              <Route path="/dispatch" element={<DispatchPage />} />
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnalysisProvider>
        </div>
      </main>
    </div>
  );
}

function OverviewPage() {
  const featuredSections = sections.slice(2, 6);
  const {
    data: incidents,
    loading: isLoading,
    error: loadError,
    refetch,
  } = useIncidents();

  const incidentCounts = new Map<string, number>();
  incidents.forEach(incident => {
    const status = incident.status?.trim() || 'Status not provided';
    incidentCounts.set(status, (incidentCounts.get(status) ?? 0) + 1);
  });
  const recentIncidents = [...incidents]
    .sort((left, right) => {
      const leftTimestamp = left.timestamp || left.createdAt;
      const rightTimestamp = right.timestamp || right.createdAt;
      const leftTime = leftTimestamp ? Date.parse(leftTimestamp) : Number.NaN;
      const rightTime = rightTimestamp ? Date.parse(rightTimestamp) : Number.NaN;
      if (Number.isNaN(leftTime)) return Number.isNaN(rightTime) ? 0 : 1;
      if (Number.isNaN(rightTime)) return -1;
      return rightTime - leftTime;
    })
    .slice(0, 5);
  const statusCount = (status: string) => incidents.filter(
    incident => incident.status?.trim().toUpperCase() === status,
  ).length;
  const activeCount = statusCount('ACTIVE');
  const newCount = statusCount('NEW');
  const resolvedCount = statusCount('RESOLVED');

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span /> RESPONSE OPERATIONS</div>
          <h1>Command with clarity.</h1>
          <p>One workspace for understanding emergencies and coordinating a considered response.</p>
        </div>
      </div>

      <section className="overview-hero" aria-labelledby="overview-hero-title">
        <div className="hero-copy">
          <div className="hero-label"><Activity size={15} /> AI-ASSISTED RESPONSE FRAMEWORK</div>
          <h2 id="overview-hero-title">From first report to coordinated response.</h2>
          <p>
            Rakshak brings incident understanding, route intelligence, decision support, and
            resource planning into a single operational workspace.
          </p>
          <Link className="primary-button" to="/incidents">
            Explore incidents <ArrowRight size={16} />
          </Link>
        </div>
        <div className="response-flow" aria-label="Response workflow">
          <div className="flow-heading">
            <span>RESPONSE WORKFLOW</span>
            <span className="flow-badge">WORKSPACE OVERVIEW</span>
          </div>
          <div className="flow-steps">
            {[
              { number: '01', label: 'Understand', detail: 'Incident context', icon: ClipboardList },
              { number: '02', label: 'Analyze', detail: 'AI intelligence', icon: BrainCircuit },
              { number: '03', label: 'Navigate', detail: 'Route search', icon: RouteIcon },
              { number: '04', label: 'Coordinate', detail: 'Plan & dispatch', icon: Truck },
            ].map(step => {
              const Icon = step.icon;
              return (
                <div className="flow-step" key={step.number}>
                  <span className="flow-icon"><Icon size={17} /></span>
                  <span className="flow-step-copy">
                    <span className="flow-step-label">{step.label}</span>
                    <span className="flow-step-detail">{step.detail}</span>
                  </span>
                  <span className="flow-step-number">{step.number}</span>
                </div>
              );
            })}
          </div>
          <p className="flow-note">A connected workflow, designed to keep people in control.</p>
        </div>
      </section>

      <section className="workspace-section" aria-labelledby="workspace-section-title">
        <div className="section-heading">
          <div>
            <h2 id="workspace-section-title">Response workspace</h2>
            <p>Tools to support informed, coordinated action.</p>
          </div>
          <Link className="section-note overview-incidents-link" to="/incidents">View incident management</Link>
        </div>
        <div className="module-grid">
          {featuredSections.map(section => {
            const Icon = section.icon;
            return (
              <Link className="module-card" to={section.path} key={section.path}>
                <span className="module-icon"><Icon size={19} /></span>
                <span className="module-title">{section.title}</span>
                <span className="module-description">{section.description}</span>
                <span className="module-link">Open workspace <ArrowRight size={14} /></span>
              </Link>
            );
          })}
        </div>
      </section>

      {loadError ? (
        <section className="overview-data-error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not load incident overview</strong>
            <p>{loadError}</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refetch()}
          >
            <RefreshCw size={14} /> Try again
          </button>
        </section>
      ) : (
        <>
          <section className="overview-stats" aria-label="Incident statistics" aria-busy={isLoading}>
            {[
              { label: 'Total incidents', count: incidents.length, tone: 'total' },
              { label: 'New', count: newCount, tone: 'new' },
              { label: 'Active', count: activeCount, tone: 'active' },
              { label: 'Resolved', count: resolvedCount, tone: 'resolved' },
            ].map(stat => (
              <article className={`overview-stat overview-stat-${stat.tone}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{isLoading ? '—' : stat.count}</strong>
              </article>
            ))}
          </section>

          <div className="overview-data-grid">
            <section className="overview-panel overview-recent" aria-labelledby="recent-incidents-title">
              <div className="overview-panel-heading">
                <div>
                  <h2 id="recent-incidents-title">Recent incidents</h2>
                  <p>Latest records from the incident service.</p>
                </div>
                <Link to="/incidents">All incidents <ArrowRight size={14} /></Link>
              </div>

              {isLoading ? (
                <div className="overview-state" role="status">
                  <LoaderCircle size={18} className="is-spinning" /> Loading incidents…
                </div>
              ) : recentIncidents.length === 0 ? (
                <div className="overview-state">
                  <Radio size={18} />
                  <span>No incidents have been returned.</span>
                </div>
              ) : (
                <div className="activity-list overview-recent-list">
                  {recentIncidents.map(incident => (
                    <Link
                      className="activity-item overview-recent-item"
                      to={`/incidents?selected=${encodeURIComponent(incident.id)}`}
                      key={incident.id}
                    >
                      <span className="activity-icon overview-recent-icon"><ClipboardList size={16} /></span>
                      <span className="activity-copy overview-recent-copy">
                        <strong>{incident.title}</strong>
                        <span>
                          {incident.type || 'Incident'} · {formatStatusLabel(incident.status)} ·{' '}
                          {formatRelativeTime(incident.timestamp || incident.createdAt)}
                        </span>
                      </span>
                      <ArrowRight size={13} className="activity-arrow" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="overview-panel overview-status-panel" aria-labelledby="incident-status-title">
              <div className="overview-panel-heading">
                <div>
                  <h2 id="incident-status-title">Status summary</h2>
                  <p>Counts grouped by status returned by the backend.</p>
                </div>
              </div>
              {isLoading ? (
                <div className="overview-state" role="status">
                  <LoaderCircle size={18} className="is-spinning" /> Calculating status totals…
                </div>
              ) : incidentCounts.size === 0 ? (
                <div className="overview-state">No status data available.</div>
              ) : (
                <div className="overview-status-list">
                  {[...incidentCounts.entries()].map(([status, count]) => (
                    <div className="overview-status-row" key={status}>
                      <span className={`status-indicator status-indicator-${statusSlug(status)}`} />
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overview-panel overview-map-panel" aria-labelledby="incident-map-title">
              <div className="overview-panel-heading">
                <div>
                  <h2 id="incident-map-title">Incident locations</h2>
                  <p>Mapped from records with valid coordinates.</p>
                </div>
                <Link to="/incidents">Manage incidents <ArrowRight size={14} /></Link>
              </div>
              {isLoading ? (
                <div className="overview-map-state" role="status">
                  <LoaderCircle size={18} className="is-spinning" /> Loading incident locations…
                </div>
              ) : (
                <OverviewIncidentMap incidents={incidents} />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function statusSlug(status?: string | null): string {
  return status?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'unknown';
}

function PlaceholderPage({ section }: { section: Section }) {
  const Icon = section.icon;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span /> RAKSHAK WORKSPACE</div>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
        </div>
        <span className="quiet-badge"><span className="status-dot" /> Not connected</span>
      </div>
      <section className="placeholder-panel">
        <div className="placeholder-content">
          <span className="placeholder-icon"><Icon size={25} strokeWidth={1.7} /></span>
          <span className="placeholder-kicker">WORKSPACE SETUP</span>
          <h2>{section.emptyTitle}</h2>
          <p>{section.emptyMessage}</p>
          <div className="placeholder-footnote">
            <ShieldCheck size={15} />
            <span>No sample or live operational data is displayed.</span>
          </div>
        </div>
      </section>
    </>
  );
}

export default App;
