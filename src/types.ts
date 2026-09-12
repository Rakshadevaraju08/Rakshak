export type AppScreen = 'operator-command' | 'citizen-portal';

export type CitizenViewMode = 'all' | 'phase-1' | 'phase-2' | 'phase-3';

export type EmergencyCategory = 'Flood' | 'Fire' | 'Medical' | 'Collapse' | 'Trapped' | 'Other';

export interface IncidentItem {
  id: string;
  title: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  priorityLabel: string;
  timeAgo: string;
  sector: string;
  coordinates: string;
  victims: number;
  waterLevel?: string;
  syncType: string;
  status: string;
  statusColor?: string;
  activeUnit?: string;
}

export interface HospitalStatus {
  name: string;
  occupancyPercent: number;
  statusLabel: string;
  statusType: 'critical' | 'normal' | 'elevated';
  erInflux: string;
  availableBeds: number;
  highlightNote: string;
}

export interface ScenarioState {
  hwy101Blocked: boolean;
  mercyGeneralDiverted: boolean;
  waterRiseRate: number; // e.g. 2.4 ft/hr
  waterLevelSurge: number; // e.g. 0.8m or +2ft
  rainIntensity: number; // mm/h
  medic4Operational: boolean;
  activePlanId: string;
  replanTimestamp: string;
  selectedIncidentId: string;
  activeTabFilter: 'all' | 'p1' | 'offline' | 'ai';
  isDispatched: boolean;
}
