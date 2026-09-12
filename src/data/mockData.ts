import { IncidentItem, HospitalStatus } from '../types';

export const INITIAL_INCIDENTS: IncidentItem[] = [
  {
    id: 'INC-4092',
    title: 'Flash Flood Trapped',
    description: 'Elderly couple (78, 81) stranded in attic crawlspace. Rising surge entering upper drywall. Cell battery critical 9%.',
    priority: 'P1',
    priorityLabel: 'P1 CRITICAL',
    timeAgo: '4m ago',
    sector: 'SEC-4',
    coordinates: '37.7749, -122.4194',
    victims: 2,
    waterLevel: '+0.8m',
    syncType: 'OFFLINE SYNC',
    status: 'VIEWING',
    statusColor: 'text-secondary',
    activeUnit: 'Rescue-Boat-2'
  },
  {
    id: 'INC-4089',
    title: 'Structural Collapse',
    description: 'Roof cave-in at industrial warehouse. Heavy timbers compromised by storm runoff. 5 workers trapped in dispatch bay.',
    priority: 'P1',
    priorityLabel: 'P1 CRITICAL',
    timeAgo: '9m ago',
    sector: 'SEC-2 • Delta Warehouse',
    coordinates: '37.7712, -122.4132',
    victims: 5,
    syncType: 'DIRECT SATELLITE',
    status: 'RE-EVALUATING',
    statusColor: 'text-tertiary',
    activeUnit: 'SAR-Squad-4'
  },
  {
    id: 'INC-4084',
    title: 'Severe Cardiac Arrest',
    description: 'Patient unresponsive in total electrical blackout zone. Automated external defibrillator (AED) in transit via drone relay.',
    priority: 'P1',
    priorityLabel: 'P1 CRITICAL',
    timeAgo: '14m ago',
    sector: 'SEC-6 • North Highlands',
    coordinates: '37.7801, -122.4289',
    victims: 1,
    syncType: 'OFFLINE SYNC',
    status: 'DRONE-03 EN ROUTE',
    statusColor: 'text-secondary',
    activeUnit: 'Drone-03'
  },
  {
    id: 'INC-4078',
    title: 'Electrical Substation Arc',
    description: 'Substation B explosion caused by water ingress. Arc flash danger. Zero civilian casualties confirmed. Grid isolate active.',
    priority: 'P2',
    priorityLabel: 'P2 HIGH',
    timeAgo: '21m ago',
    sector: 'SEC-3 • Grid Terminal B',
    coordinates: '37.7665, -122.4088',
    victims: 0,
    syncType: 'HAZMAT CONTAINS',
    status: 'CONTAINED',
    statusColor: 'text-secondary',
    activeUnit: 'Fire Squad 9'
  },
  {
    id: 'INC-4071',
    title: 'Mudslide Route 9',
    description: '3 passenger sedans immobilized between mile markers 14 and 16. Road embankment sliding into canyon. Occupants safe on roof.',
    priority: 'P2',
    priorityLabel: 'P2 HIGH',
    timeAgo: '28m ago',
    sector: 'SEC-8 • Route 9 Pass',
    coordinates: '37.7590, -122.4350',
    victims: 3,
    syncType: 'ROAD CLOSED',
    status: 'HELO EN ROUTE',
    statusColor: 'text-tertiary',
    activeUnit: 'HELO-1'
  }
];

export const INITIAL_HOSPITALS: HospitalStatus[] = [
  {
    name: 'Mercy General Hospital',
    occupancyPercent: 94,
    statusLabel: '94% FULL',
    statusType: 'critical',
    erInflux: '+11/hr',
    availableBeds: 4,
    highlightNote: 'DIVERSION ACTIVE'
  },
  {
    name: 'St. Jude Trauma Center',
    occupancyPercent: 62,
    statusLabel: '62% NORMAL',
    statusType: 'normal',
    erInflux: '+5/hr',
    availableBeds: 38,
    highlightNote: '8 BEDS HELD FOR INC-4092'
  },
  {
    name: 'Valley Medical Center',
    occupancyPercent: 78,
    statusLabel: '78% ELEVATED',
    statusType: 'elevated',
    erInflux: '+8/hr',
    availableBeds: 14,
    highlightNote: 'STANDBY BUFFER'
  }
];
