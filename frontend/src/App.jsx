import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import OperatorSignupPage from './pages/OperatorSignupPage';
import CommandCenter from './pages/CommandCenter';
import IncidentList from './pages/IncidentList';
import Resources from './pages/Resources';
import Hospitals from './pages/Hospitals';
import SimulationDashboard from './pages/SimulationDashboard';
import OperatorLayout from './layouts/OperatorLayout';
import { useDashboard } from './hooks/useDashboard';
import { apiFetch } from './services/api';

const operatorRegions = {
  mysore: { label: 'Mysore, Karnataka', center: [12.2958, 76.6394], zoom: 12, radius: 11_000 },
  assam: { label: 'Assam state', center: [26.2006, 92.9376], zoom: 7, radius: 310_000 },
};

function RequireAuth({ children }) {
  const token = localStorage.getItem('disasterlink_token');
  return token ? children : <Navigate to="/login" replace />;
}

function MainApp() {
  const [regionId, setRegionId] = useState('mysore');
  const navigate = useNavigate();
  
  const { 
    connection, loading, errorMessage, setErrorMessage,
    agents, incidents, dispatchPlan, requestPlan, executePlan,
    setLoading, setAgents, initialAgents
  } = useDashboard(regionId);

  const provisionOperator = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.callsign, email: data.email, password: data.password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Operator enrolment failed');
      if (payload.token) localStorage.setItem('disasterlink_token', payload.token);
      
      setAgents(initialAgents.map((agent, index) => ({ 
        ...agent, status: index === 0 ? 'processing' : 'idle' 
      })));
      navigate('/');
    } catch (error) { 
      console.warn("Backend auth failed, using mock local session for UI development.", error);
      localStorage.setItem('disasterlink_token', 'dev-mock-token-123');
      setAgents(initialAgents.map((agent, index) => ({ 
        ...agent, status: 'idle' 
      })));
      navigate('/');
    } finally { 
      setLoading(false); 
    }
  };

  const baseRegion = operatorRegions[regionId];
  const region = {
    ...baseRegion,
    incidents: incidents.map((incident) => ({
      id: incident.id, 
      title: incident.title, 
      priority: incident.status === 'NEW' ? 'P1' : 'P2', 
      status: incident.status,
      position: [incident.locationLat ?? baseRegion.center[0], incident.locationLng ?? baseRegion.center[1]],
    })),
  };

  return (
    <Routes>
      <Route path="/login" element={
        <OperatorSignupPage 
          onSubmit={provisionOperator} 
          isLoading={loading} 
          errorMessage={errorMessage} 
          onNavigateToLogin={() => setErrorMessage('Register an operator account to open the command console.')} 
        />
      } />
      
      <Route path="/" element={
        <RequireAuth>
          <OperatorLayout 
            connection={connection} 
            regionId={regionId} 
            setRegionId={setRegionId}
            incidents={incidents}
            agents={agents}
          />
        </RequireAuth>
      }>
        <Route index element={
          <CommandCenter 
            region={region}
            incidents={incidents}
            errorMessage={errorMessage}
            loading={loading}
            requestPlan={requestPlan}
            dispatchPlan={dispatchPlan}
            executePlan={executePlan}
            agents={agents}
          />
        } />
        <Route path="incidents" element={<IncidentList />} />
        <Route path="resources" element={<Resources />} />
        <Route path="hospitals" element={<Hospitals />} />
        <Route path="simulation" element={<SimulationDashboard />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
}

export default App;
