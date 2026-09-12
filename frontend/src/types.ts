export type AgentStatus = 'idle' | 'processing' | 'complete';

export interface AgentState {
  name: string;
  question: string;
  status: AgentStatus;
  summary?: string;
}

export interface OperatorSignupData {
  callsign: string;
  email: string;
  sector: string;
  role: string;
  password: string;
}

export type AuthorizationRole = 'Dispatcher' | 'Supervisor' | 'Administrator';

export interface IncidentRecord {
  id: string;
  code: string;
  priority: 'P1 CRITICAL' | 'P2 HIGH' | 'P3 MED' | 'RESOLVED';
  title: string;
  summary: string;
  elapsedTime: string;
  victims: string;
  meshChannel: string;
  sector: string;
  agentStates: AgentState[];
}
