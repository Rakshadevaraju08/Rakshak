import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ClipboardList,
  FileText,
  Hospital,
  LayoutDashboard,
  Menu,
  Radio,
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
import SearchRoutingPage from './pages/SearchRoutingPage';
import { AnalysisProvider } from './contexts/AnalysisContext';

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
  const activeSection = sections.find(section => section.path === pathname) ?? sections[0];

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
              <Route path="/decisions" element={<PlaceholderPage section={sections[4]} />} />
              <Route path="/dispatch" element={<PlaceholderPage section={sections[5]} />} />
              <Route path="/hospitals" element={<PlaceholderPage section={sections[6]} />} />
              <Route path="/reports" element={<PlaceholderPage section={sections[7]} />} />
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
          <span className="section-note">Integrations not configured</span>
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

      <section className="activity-panel" aria-labelledby="activity-title">
        <div className="activity-heading">
          <div>
            <h2 id="activity-title">Recent activity</h2>
            <p>Updates from connected operational services.</p>
          </div>
          <span className="quiet-badge">Waiting for connection</span>
        </div>
        <div className="activity-empty">
          <span className="empty-icon"><Radio size={19} /></span>
          <div>
            <strong>No activity to show yet</strong>
            <p>Connect backend services to see incident and response updates here.</p>
          </div>
        </div>
      </section>
    </>
  );
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
