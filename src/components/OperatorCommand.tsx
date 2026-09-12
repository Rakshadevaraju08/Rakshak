import React, { useState, useEffect } from 'react';
import { IncidentItem, HospitalStatus, ScenarioState } from '../types';
import { INITIAL_INCIDENTS, INITIAL_HOSPITALS } from '../data/mockData';
import { playDispatchChime, playChirpSound } from '../utils/audio';

interface OperatorCommandProps {
  onSimulateCitizenSos?: () => void;
}

export const OperatorCommand: React.FC<OperatorCommandProps> = () => {
  const [incidents, setIncidents] = useState<IncidentItem[]>(INITIAL_INCIDENTS);
  const [hospitals, setHospitals] = useState<HospitalStatus[]>(INITIAL_HOSPITALS);
  const [activeTab, setActiveTab] = useState<'all' | 'p1' | 'offline' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('INC-4092');

  // Scenario Injection State
  const [scenario, setScenario] = useState<ScenarioState>({
    hwy101Blocked: true,
    mercyGeneralDiverted: true,
    waterRiseRate: 2.4,
    waterLevelSurge: 0.8,
    rainIntensity: 65,
    medic4Operational: true,
    activePlanId: '#8824',
    replanTimestamp: '2m ago',
    selectedIncidentId: 'INC-4092',
    activeTabFilter: 'all',
    isDispatched: false,
  });

  // Map layer toggle states
  const [showWaterDepth, setShowWaterDepth] = useState(true);
  const [showObstructions, setShowObstructions] = useState(true);
  const [showMeshNodes, setShowMeshNodes] = useState(true);
  const [showContours, setShowContours] = useState(true);

  // Dispatch notification toast
  const [dispatchToast, setDispatchToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Spacebar keyboard shortcut for approve & dispatch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in search input, don't trigger space dispatch
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleApproveDispatch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenario.hwy101Blocked, scenario.mercyGeneralDiverted]);

  const handleApproveDispatch = () => {
    playDispatchChime();
    setScenario((prev) => ({ ...prev, isDispatched: true }));
    setDispatchToast({
      visible: true,
      message:
        'DISPATCH ORDER CONFIRMED: Rescue-Boat-2 deployed to INC-4092 via Crestview Overpass. St. Jude Trauma (8 beds) notified.',
    });
    setTimeout(() => {
      setDispatchToast({ visible: false, message: '' });
    }, 4500);
  };

  // Scenario injection actions
  const handleSimulateNewSos = () => {
    playChirpSound();
    const newId = `INC-${Math.floor(4000 + Math.random() * 900)}`;
    const newIncident: IncidentItem = {
      id: newId,
      title: 'Water Intrusion & Stranded Family',
      description: 'Basement flooded, 3 residents (1 infant) moved to kitchen counter. Power out.',
      priority: 'P1',
      priorityLabel: 'P1 CRITICAL',
      timeAgo: 'Just now',
      sector: 'SEC-4 • Mission corridor',
      coordinates: '37.7735, -122.4210',
      victims: 3,
      waterLevel: `+${(scenario.waterLevelSurge + 0.3).toFixed(1)}m`,
      syncType: 'OFFLINE SYNC',
      status: 'NEW INTAKE',
      statusColor: 'text-[#ff5451]',
    };
    setIncidents([newIncident, ...incidents]);
    setSelectedIncidentId(newId);
    setDispatchToast({
      visible: true,
      message: `NEW CITIZEN SOS ARRIVED: ${newId} registered in Sector 4. Auto-triaged to queue!`,
    });
    setTimeout(() => {
      setDispatchToast({ visible: false, message: '' });
    }, 4000);
  };

  const handleToggleHwy101 = () => {
    playChirpSound();
    const nextState = !scenario.hwy101Blocked;
    setScenario((prev) => ({
      ...prev,
      hwy101Blocked: nextState,
      replanTimestamp: 'Just now',
    }));
    setDispatchToast({
      visible: true,
      message: nextState
        ? 'ALERT: Hwy 101 North is now BLOCKED by debris. Autonomous reroute initiated.'
        : 'NOTICE: Hwy 101 North cleared for limited high-clearance emergency transport.',
    });
    setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3500);
  };

  const handleToggleMercyGeneral = () => {
    playChirpSound();
    const nextDivert = !scenario.mercyGeneralDiverted;
    setScenario((prev) => ({ ...prev, mercyGeneralDiverted: nextDivert }));
    setHospitals((prev) =>
      prev.map((h) =>
        h.name.includes('Mercy')
          ? {
              ...h,
              occupancyPercent: nextDivert ? 94 : 82,
              statusLabel: nextDivert ? '94% FULL' : '82% ELEVATED',
              statusType: nextDivert ? 'critical' : 'elevated',
              highlightNote: nextDivert ? 'DIVERSION ACTIVE' : 'OPEN FOR AMBULANCE',
            }
          : h
      )
    );
  };

  const handleIncreaseRain = () => {
    playChirpSound();
    setScenario((prev) => ({
      ...prev,
      rainIntensity: prev.rainIntensity + 50,
      waterRiseRate: Number((prev.waterRiseRate + 0.8).toFixed(1)),
    }));
    setDispatchToast({
      visible: true,
      message: `RADAR DOPPLER ESCALATION: Rain intensity spiked to ${scenario.rainIntensity + 50}mm/h. Water rise +${(
        scenario.waterRiseRate + 0.8
      ).toFixed(1)}ft/hr.`,
    });
    setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3500);
  };

  const handleSurgeWater = () => {
    playChirpSound();
    setScenario((prev) => ({
      ...prev,
      waterLevelSurge: Number((prev.waterLevelSurge + 0.6).toFixed(1)),
      waterRiseRate: Number((prev.waterRiseRate + 0.5).toFixed(1)),
    }));
    setDispatchToast({
      visible: true,
      message: `HYDROLOGIC SENSOR SURGE: River surge +2ft. Inundation polygon expanded.`,
    });
    setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3500);
  };

  const handleUnitBreakdown = () => {
    playChirpSound();
    setScenario((prev) => ({
      ...prev,
      medic4Operational: !prev.medic4Operational,
      replanTimestamp: 'Just now',
    }));
    setDispatchToast({
      visible: true,
      message: scenario.medic4Operational
        ? 'UNIT FAILURE: Medic-4 axle stuck in 3.2ft floodwater. Autonomous re-assignment triggered!'
        : 'UNIT RESTORED: Medic-4 back online.',
    });
    setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3500);
  };

  const handleResetScenario = () => {
    playChirpSound();
    setIncidents(INITIAL_INCIDENTS);
    setHospitals(INITIAL_HOSPITALS);
    setSelectedIncidentId('INC-4092');
    setScenario({
      hwy101Blocked: true,
      mercyGeneralDiverted: true,
      waterRiseRate: 2.4,
      waterLevelSurge: 0.8,
      rainIntensity: 65,
      medic4Operational: true,
      activePlanId: '#8824',
      replanTimestamp: '2m ago',
      selectedIncidentId: 'INC-4092',
      activeTabFilter: 'all',
      isDispatched: false,
    });
  };

  // Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    if (activeTab === 'p1' && inc.priority !== 'P1') return false;
    if (activeTab === 'offline' && !inc.syncType.includes('OFFLINE')) return false;
    if (activeTab === 'ai' && !inc.status.includes('RE-EVAL')) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        inc.id.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.sector.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex w-full bg-[#0d1320] text-[#dde2f5] min-h-screen pt-16">
      {/* ============================================================ */}
      {/* TACTICAL LEFT SIDEBAR                                        */}
      {/* ============================================================ */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#080e1b] border-r border-[#2f3543]/40 z-40 hidden xl:flex flex-col justify-between py-4 select-none">
        <div className="flex flex-col gap-6 px-3">
          <div className="px-3 flex items-center justify-between text-[#ab8986] uppercase font-mono text-[11px] tracking-wider">
            <span>Tactical Core</span>
            <span className="text-[#ffb3ad] font-mono text-[13px] font-bold">DEFCON 2</span>
          </div>

          <nav className="flex flex-col gap-1">
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2.5 rounded bg-[#242a38] text-[#ffb3ad] border-l-2 border-[#ff5451] font-sans text-[14px] font-bold"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span>Ops Grid</span>
            </a>
            <a
              href="#"
              className="flex items-center justify-between px-3 py-2.5 rounded text-[#e4beba] hover:bg-[#1a1f2d] hover:text-[#dde2f5] font-sans text-[14px] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">emergency</span>
                <span>Incidents Queue</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#ff5451] text-[#5c0008] font-mono text-[11px] font-bold">
                {incidents.length}
              </span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2.5 rounded text-[#e4beba] hover:bg-[#1a1f2d] hover:text-[#dde2f5] font-sans text-[14px] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
              <span>Field Units &amp; Resources</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2.5 rounded text-[#e4beba] hover:bg-[#1a1f2d] hover:text-[#dde2f5] font-sans text-[14px] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">radar</span>
              <span>Predictive Risk Zones</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2.5 rounded text-[#e4beba] hover:bg-[#1a1f2d] hover:text-[#dde2f5] font-sans text-[14px] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <span>System Audit</span>
            </a>
          </nav>
        </div>

        <div className="px-3 flex flex-col gap-3">
          <div className="p-3 rounded bg-[#161b29] border border-[#2f3543]/30 flex flex-col gap-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between text-[#ab8986]">
              <span>STATION TELEMETRY</span>
              <span className="text-[#adc6ff]">SECURE</span>
            </div>
            <div className="text-[#dde2f5] flex justify-between">
              <span>Encrypted Relay</span>
              <span className="font-bold">AES-256-GCM</span>
            </div>
            <div className="text-[#dde2f5] flex justify-between">
              <span>Bandwidth Load</span>
              <span className="text-[#adc6ff]">1.4 GB/s</span>
            </div>
          </div>
          <div className="px-3 py-2 text-center text-[#ab8986] font-mono text-[11px]">
            © 2024 DISASTERLINK SECURE
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN OPERATIONAL COCKPIT                                     */}
      {/* ============================================================ */}
      <div className="w-full xl:pl-64 flex flex-col min-h-screen">
        {/* Floating Toast Notification */}
        {dispatchToast.visible && (
          <div className="fixed top-20 right-8 z-50 bg-[#0566d9] text-[#e6ecff] px-5 py-3 rounded-xl shadow-2xl border border-white/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <span className="material-symbols-outlined text-[24px]">verified</span>
            <span className="font-mono text-[12px] font-semibold">{dispatchToast.message}</span>
          </div>
        )}

        {/* TOP TELEMETRY & URGENT ALERT BANNER */}
        <div className="w-full bg-[#080e1b] p-3 lg:px-6 flex flex-col gap-2 border-b border-[#2f3543]/30">
          {/* Critical Flash Flood Surge Alert Strip */}
          <div className="w-full bg-[#93000a]/40 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-3 border border-[#ff5451]/30">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffb4ab] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ffb4ab]"></span>
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-sans text-[17px] text-[#ffb4ab] font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                  CRITICAL: Flash Flood Surge Sector 4
                </span>
                <span className="font-mono text-[11px] text-[#e4beba]">
                  (Rapid water rise{' '}
                  <strong className="text-[#ffb4ab] font-bold">+{scenario.waterRiseRate}ft/hr</strong>) —
                  Auto-triaging {incidents.length} incoming distress feeds
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="bg-[#2f3543]/80 px-2 py-0.5 rounded text-[#dde2f5]">
                RADAR DOPPLER: <strong className="text-[#ffb95f]">SURGE VELOCITY 3.1 kt</strong>
              </span>
              <span className="bg-[#ff5451] px-2 py-0.5 rounded text-[#5c0008] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span> LIVE AUTO-TRIAGE ON
              </span>
            </div>
          </div>

          {/* Micro Telemetry & Global Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 font-sans">
            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">ACTIVE INCIDENTS</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#dde2f5]">{incidents.length}</span>
                <div className="flex gap-1">
                  <span className="bg-[#ff5451] text-[#5c0008] font-mono text-[10px] font-bold px-1 rounded">3 P1</span>
                  <span className="bg-[#ca8100] text-[#3e2400] font-mono text-[10px] font-bold px-1 rounded">5 P2</span>
                  <span className="bg-[#2f3543] text-[#e4beba] font-mono text-[10px] px-1 rounded">6 P3-4</span>
                </div>
              </div>
            </div>

            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">UNITS DEPLOYED</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#adc6ff]">
                  18 <span className="font-mono text-[11px] text-[#ab8986] font-normal">/ 24</span>
                </span>
                <span className="font-mono text-[10px] text-[#adc6ff] bg-[#242a38] px-1.5 py-0.5 rounded">
                  75% UTIL
                </span>
              </div>
            </div>

            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">REGIONAL ER BEDS</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#ffb4ab]">
                  {scenario.mercyGeneralDiverted ? '82%' : '74%'}
                </span>
                <span className="font-mono text-[10px] text-[#ffb4ab] bg-[#93000a]/30 px-1.5 py-0.5 rounded">
                  {scenario.mercyGeneralDiverted ? 'CRITICAL DIVERSION' : 'NORMAL LOAD'}
                </span>
              </div>
            </div>

            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">OFFLINE MESH NODES</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#dde2f5]">42</span>
                <span className="font-mono text-[10px] text-[#adc6ff] bg-[#242a38] px-1.5 py-0.5 rounded">
                  LORA CH-9
                </span>
              </div>
            </div>

            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">AUTONOMOUS RE-PLANS</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#ffb95f]">9</span>
                <span className="font-mono text-[10px] text-[#ffb95f] bg-[#242a38] px-1.5 py-0.5 rounded">
                  LAST 12m
                </span>
              </div>
            </div>

            <div className="bg-[#161b29] p-2 rounded-lg flex flex-col justify-between border border-[#2f3543]/30">
              <span className="font-mono text-[11px] text-[#ab8986]">DISPATCH EFFICIENCY</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[22px] font-bold text-[#dde2f5]">2.8m</span>
                <span className="font-mono text-[10px] text-[#adc6ff] bg-[#0566d9]/30 text-[#e6ecff] px-1.5 py-0.5 rounded">
                  -42s AVG
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* THREE-COLUMN TACTICAL COCKPIT                                */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 lg:px-6 w-full flex-grow items-start">
          {/* ---------------------------------------------------------- */}
          {/* LEFT PANEL: INCIDENTS QUEUE (lg:col-span-3)                 */}
          {/* ---------------------------------------------------------- */}
          <div className="lg:col-span-3 flex flex-col gap-2 bg-[#080e1b] p-2.5 rounded-lg shadow-md max-h-[860px] border border-[#2f3543]/40">
            {/* Header & Filter Tabs */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ff5451] text-[20px]">queue_play_next</span>
                  <span className="font-sans text-[17px] font-semibold text-[#dde2f5]">Incident Triage</span>
                </div>
                <span className="font-mono text-[11px] text-[#ab8986]">AUTO-SORT: PRIORITY</span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#161b29] p-1 rounded-lg overflow-x-auto text-nowrap">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2 py-1 rounded font-mono text-[11px] font-bold transition-all ${
                    activeTab === 'all'
                      ? 'bg-[#242a38] text-[#ffb3ad] shadow-sm'
                      : 'text-[#e4beba] hover:text-[#dde2f5]'
                  }`}
                >
                  All ({incidents.length})
                </button>
                <button
                  onClick={() => setActiveTab('p1')}
                  className={`px-2 py-1 rounded font-mono text-[11px] transition-all ${
                    activeTab === 'p1'
                      ? 'bg-[#242a38] text-[#ffb3ad] shadow-sm'
                      : 'text-[#e4beba] hover:text-[#dde2f5]'
                  }`}
                >
                  P1 Crit (3)
                </button>
                <button
                  onClick={() => setActiveTab('offline')}
                  className={`px-2 py-1 rounded font-mono text-[11px] transition-all ${
                    activeTab === 'offline'
                      ? 'bg-[#242a38] text-[#ffb3ad] shadow-sm'
                      : 'text-[#e4beba] hover:text-[#dde2f5]'
                  }`}
                >
                  Offline (4)
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-2 py-1 rounded font-mono text-[11px] transition-all ${
                    activeTab === 'ai'
                      ? 'bg-[#242a38] text-[#ffb3ad] shadow-sm'
                      : 'text-[#e4beba] hover:text-[#dde2f5]'
                  }`}
                >
                  AI Pending
                </button>
              </div>

              {/* Search input */}
              <div className="flex items-center bg-[#161b29] px-2.5 py-1.5 rounded-lg text-[#e4beba] border border-[#2f3543]/40">
                <span className="material-symbols-outlined text-[16px] text-[#ab8986] mr-2">search</span>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent font-mono text-[11px] text-[#dde2f5] placeholder:text-[#ab8986] focus:outline-none w-full"
                  placeholder="Filter callsign, sector, condition..."
                  type="text"
                />
                <span className="font-mono text-[#ab8986] uppercase text-[10px] bg-[#242a38] px-1 rounded">⌘K</span>
              </div>
            </div>

            {/* Incidents Feed */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 mt-1 max-h-[720px]">
              {filteredIncidents.map((incident) => {
                const isSelected = selectedIncidentId === incident.id;
                return (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={`p-3 rounded-lg shadow-sm cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-[#1a1f2d] bg-gradient-to-r from-[#ff5451]/20 to-[#1a1f2d] border-[#ff5451]'
                        : 'bg-[#161b29] hover:bg-[#1a1f2d] border-[#2f3543]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            incident.priority === 'P1'
                              ? 'bg-[#ff5451] text-[#5c0008]'
                              : 'bg-[#ca8100] text-[#3e2400]'
                          }`}
                        >
                          {incident.priority === 'P1' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5c0008] animate-ping"></span>
                          )}
                          {incident.priorityLabel}
                        </span>
                        <span
                          className={`font-mono text-[13px] font-bold ${
                            isSelected ? 'text-[#ffb3ad]' : 'text-[#dde2f5]'
                          }`}
                        >
                          {incident.id}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#ab8986] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span> {incident.timeAgo}
                      </span>
                    </div>

                    <h4 className="font-sans text-[16px] text-[#dde2f5] font-semibold mb-1">{incident.title}</h4>
                    <p className="font-sans text-[12px] text-[#e4beba] line-clamp-2 mb-2 leading-relaxed">
                      {incident.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {incident.syncType && (
                        <span className="bg-[#2f3543] text-[#ffb95f] font-mono text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">wifi_off</span> {incident.syncType}
                        </span>
                      )}
                      {incident.waterLevel && (
                        <span className="bg-[#93000a]/30 text-[#ffb4ab] font-mono text-[11px] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">waves</span> WATER{' '}
                          {incident.waterLevel}
                        </span>
                      )}
                      <span className="bg-[#2f3543] text-[#e4beba] font-mono text-[11px] px-1.5 py-0.5 rounded">
                        {incident.victims} {incident.victims === 1 ? 'VICTIM' : 'VICTIMS'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 bg-[#242a38]/40 p-1.5 rounded">
                      <span className="font-mono text-[11px] text-[#ab8986]">{incident.sector}</span>
                      <span
                        className={`font-sans text-[11px] font-bold flex items-center gap-1 ${
                          isSelected ? 'text-[#adc6ff]' : incident.statusColor || 'text-[#ab8986]'
                        }`}
                      >
                        {isSelected ? 'VIEWING' : incident.status}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------------------------------------------------------- */}
          {/* CENTER PANEL: MAIN GIS TACTICAL MAP (lg:col-span-6)         */}
          {/* ---------------------------------------------------------- */}
          <div className="lg:col-span-6 flex flex-col gap-2 relative bg-[#080e1b] p-2.5 rounded-lg shadow-md min-h-[680px] lg:min-h-[860px] border border-[#2f3543]/40">
            {/* Map Header & Telemetry HUD */}
            <div className="flex items-center justify-between px-2 py-1 bg-[#161b29] rounded-lg z-20 border border-[#2f3543]/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">explore</span>
                <span className="font-sans text-[16px] font-semibold text-[#dde2f5]">
                  GIS Tactical Canvas • Sector 4 Flood Theater
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#ab8986] bg-[#242a38] px-2 py-1 rounded">
                  PROJECTION: UTM 10N WGS84
                </span>
                <span className="font-mono text-[11px] text-[#adc6ff] bg-[#242a38] px-2 py-1 rounded flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#adc6ff] animate-pulse"></span> SATELLITE CADENCE 30s
                </span>
              </div>
            </div>

            {/* Vector Map Canvas Container */}
            <div className="relative w-full flex-grow rounded-lg overflow-hidden bg-[#0d1320] shadow-inner min-h-[600px] flex items-center justify-center border border-[#2f3543]/30">
              {/* Tactical Contours & Vector Grid SVG */}
              <svg className="absolute inset-0 w-full h-full opacity-45 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2f3543" strokeWidth="0.5" />
                    <circle cx="0" cy="0" r="1.5" fill="#ab8986" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#tactical-grid)" />

                {/* Topographic Contours */}
                {showContours && (
                  <>
                    <path
                      d="M-50,200 C150,180 200,320 400,280 C600,240 700,450 900,420 C1050,400 1150,550 1300,530"
                      fill="none"
                      stroke="#2f3543"
                      strokeDasharray="4,4"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M-50,300 C120,290 280,420 500,390 C720,360 850,580 1100,560 C1250,540 1350,680 1500,670"
                      fill="none"
                      stroke="#2f3543"
                      strokeWidth="1"
                    />
                    <path
                      d="M-50,100 C100,80 320,160 550,140 C800,120 950,220 1200,200"
                      fill="none"
                      stroke="#2f3543"
                      strokeDasharray="8,4"
                      strokeWidth="1.2"
                    />
                  </>
                )}

                {/* River Surge Basin Simulation Vector */}
                {showWaterDepth && (
                  <path
                    d="M120,0 C160,180 240,300 310,480 C360,600 450,750 520,900 L250,900 C180,720 110,540 80,360 C50,180 40,90 20,0 Z"
                    fill="#0566d9"
                    fillOpacity={0.22 + (scenario.waterLevelSurge - 0.8) * 0.05}
                  />
                )}

                {/* Inundation Prediction Polygon */}
                {showWaterDepth && (
                  <polygon
                    points="180,240 380,260 480,420 540,620 340,780 210,640 140,430"
                    fill="#ffb95f"
                    fillOpacity={0.16 + (scenario.waterRiseRate - 2.4) * 0.03}
                    stroke="#ffb95f"
                    strokeDasharray="6,4"
                    strokeWidth="2"
                  />
                )}
              </svg>

              {/* MAP LAYER: Blocked Highway Overlay */}
              {showObstructions && scenario.hwy101Blocked && (
                <div className="absolute top-[32%] left-[28%] w-[240px] -rotate-12 bg-[#080e1b]/95 p-2 rounded-lg shadow-xl border-l-4 border-[#ff5451] z-10 animate-pulse">
                  <div className="flex items-center gap-2 text-[#ffb4ab]">
                    <span className="material-symbols-outlined text-[18px]">no_crash</span>
                    <span className="font-mono text-[11px] font-bold tracking-wider uppercase">
                      HWY 101 NORTH CLOSED
                    </span>
                  </div>
                  <div
                    className="h-2 w-full my-1 rounded"
                    style={{
                      background: 'repeating-linear-gradient(45deg, #93000a, #93000a 8px, #161b29 8px, #161b29 16px)',
                    }}
                  ></div>
                  <span className="font-mono text-[10px] text-[#ab8986]">
                    DEBRIS • WATER DEPTH: {(3.4 + scenario.waterLevelSurge - 0.8).toFixed(1)} FT
                  </span>
                </div>
              )}

              {/* MAP MARKER: TARGET INCIDENT INC-4092 (P1 Trapped) */}
              <div
                onClick={() => setSelectedIncidentId('INC-4092')}
                className="absolute top-[48%] left-[45%] flex flex-col items-center -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
              >
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute h-12 w-12 rounded-full bg-[#ff5451] opacity-60"></span>
                  <span className="animate-pulse absolute h-8 w-8 rounded-full bg-[#ffb3ad] opacity-40"></span>
                  <div className="h-9 w-9 rounded-full bg-[#ff5451] flex items-center justify-center shadow-lg text-white">
                    <span className="material-symbols-outlined text-[20px]">flood</span>
                  </div>
                </div>
                <div className="bg-[#080e1b]/95 p-2 rounded-lg shadow-xl mt-1 text-center border-b-2 border-[#ff5451]">
                  <div className="flex items-center gap-1 justify-center">
                    <span className="h-2 w-2 rounded-full bg-[#ff5451]"></span>
                    <span className="font-mono text-[11px] font-bold text-[#dde2f5]">INC-4092 (CRITICAL)</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#ffb4ab] font-semibold">2 VICTIMS • ATTIC TRAPPED</span>
                </div>
              </div>

              {/* MAP MARKER: AMBULANCE MEDIC-4 */}
              <div className="absolute top-[62%] left-[24%] flex items-center gap-2 bg-[#080e1b]/90 px-2.5 py-1 rounded-full shadow-lg z-10 border border-[#2f3543]/50">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center ${
                    scenario.medic4Operational ? 'bg-[#0566d9] text-white' : 'bg-[#93000a] text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">ambulance</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] font-bold text-[#dde2f5]">MEDIC-4</span>
                  <span className="font-mono text-[10px] text-[#adc6ff]">
                    {scenario.medic4Operational ? 'En Route (ETA 4m)' : 'STUCK IN WATER'}
                  </span>
                </div>
              </div>

              {/* MAP MARKER: RESCUE-BOAT-2 */}
              <div className="absolute top-[38%] left-[58%] flex items-center gap-2 bg-[#080e1b]/90 px-2.5 py-1 rounded-full shadow-lg z-10 border border-[#2f3543]/50">
                <div className="h-6 w-6 rounded-full bg-[#0566d9] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">sailing</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] font-bold text-[#dde2f5]">RESCUE-BOAT-2</span>
                  <span className="font-mono text-[10px] text-[#ffb95f]">Sector 4 Launch (ETA 6m)</span>
                </div>
              </div>

              {/* MAP MARKER: HELO-1 */}
              <div className="absolute top-[16%] left-[68%] flex items-center gap-2 bg-[#080e1b]/90 px-2.5 py-1 rounded-full shadow-lg z-10 border border-[#2f3543]/50">
                <div className="h-6 w-6 rounded-full bg-[#242a38] text-[#ab8986] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">helicopter</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] font-bold text-[#dde2f5]">HELO-1</span>
                  <span className="font-mono text-[10px] text-[#ab8986]">Awaiting Flight Window</span>
                </div>
              </div>

              {/* MAP MARKER: HOSPITAL - Mercy General */}
              <div className="absolute top-[22%] left-[12%] flex flex-col items-center z-10">
                <div
                  className={`bg-[#080e1b]/95 p-2 rounded-lg shadow-lg flex items-center gap-2 border-l-2 ${
                    scenario.mercyGeneralDiverted ? 'border-[#ff5451]' : 'border-[#ffb95f]'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      scenario.mercyGeneralDiverted ? 'text-[#ff5451]' : 'text-[#ffb95f]'
                    }`}
                  >
                    local_hospital
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-mono text-[11px] font-bold text-[#dde2f5]">Mercy General</span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        scenario.mercyGeneralDiverted ? 'text-[#ffb4ab]' : 'text-[#ffb95f]'
                      }`}
                    >
                      {scenario.mercyGeneralDiverted ? 'ER 94% FULL • DIVERTING' : 'ER 82% • OPEN'}
                    </span>
                  </div>
                </div>
              </div>

              {/* MAP MARKER: HOSPITAL - St. Jude Trauma */}
              <div className="absolute top-[78%] left-[64%] flex flex-col items-center z-10">
                <div className="bg-[#080e1b]/95 p-2 rounded-lg shadow-lg flex items-center gap-2 border-l-2 border-[#adc6ff]">
                  <span className="material-symbols-outlined text-[#adc6ff] text-[18px]">local_hospital</span>
                  <div className="flex flex-col text-left">
                    <span className="font-mono text-[11px] font-bold text-[#dde2f5]">St. Jude Trauma Center</span>
                    <span className="font-mono text-[10px] text-[#adc6ff] font-bold">ER 62% • 8 BEDS RESERVED</span>
                  </div>
                </div>
              </div>

              {/* Predicted Flood Polygon Legend Pill */}
              <div className="absolute bottom-4 left-4 bg-[#080e1b]/90 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 z-10 border border-[#2f3543]/40">
                <span className="h-3 w-3 rounded bg-[#ffb95f] opacity-70"></span>
                <span className="font-mono text-[11px] text-[#dde2f5]">PREDICTED 60-MIN FLOOD INUNDATION POLYGON</span>
                <span className="font-mono text-[11px] text-[#ffb95f] font-bold">
                  +{(1.8 + scenario.waterLevelSurge - 0.8).toFixed(1)}ft EXTENSION
                </span>
              </div>

              {/* Floating Map Layer Controls (HUD) */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <div className="bg-[#080e1b]/90 p-1 rounded-lg flex flex-col gap-1 shadow-lg border border-[#2f3543]/40">
                  <button
                    onClick={() => setShowWaterDepth(!showWaterDepth)}
                    className={`p-2 rounded transition-colors ${
                      showWaterDepth ? 'bg-[#242a38] text-[#ffb3ad]' : 'text-[#ab8986] hover:bg-[#242a38]'
                    }`}
                    title="Toggle Flood Depth"
                  >
                    <span className="material-symbols-outlined text-[18px]">water</span>
                  </button>
                  <button
                    onClick={() => setShowObstructions(!showObstructions)}
                    className={`p-2 rounded transition-colors ${
                      showObstructions ? 'bg-[#242a38] text-[#ffb95f]' : 'text-[#ab8986] hover:bg-[#242a38]'
                    }`}
                    title="Toggle Road Obstructions"
                  >
                    <span className="material-symbols-outlined text-[18px]">traffic</span>
                  </button>
                  <button
                    onClick={() => setShowMeshNodes(!showMeshNodes)}
                    className={`p-2 rounded transition-colors ${
                      showMeshNodes ? 'bg-[#242a38] text-[#adc6ff]' : 'text-[#ab8986] hover:bg-[#242a38]'
                    }`}
                    title="Toggle LoRa Mesh Nodes"
                  >
                    <span className="material-symbols-outlined text-[18px]">hub</span>
                  </button>
                  <button
                    onClick={() => setShowContours(!showContours)}
                    className={`p-2 rounded transition-colors ${
                      showContours ? 'bg-[#242a38] text-white' : 'text-[#ab8986] hover:bg-[#242a38]'
                    }`}
                    title="Toggle Topo Contours"
                  >
                    <span className="material-symbols-outlined text-[18px]">layers</span>
                  </button>
                </div>

                <div className="bg-[#080e1b]/90 p-1 rounded-lg flex flex-col gap-1 shadow-lg items-center border border-[#2f3543]/40">
                  <button className="p-1.5 rounded text-[#dde2f5] hover:bg-[#242a38]">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                  <span className="font-mono text-[10px] text-[#ab8986]">1:25k</span>
                  <button className="p-1.5 rounded text-[#dde2f5] hover:bg-[#242a38]">
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <div className="w-full h-px bg-[#2f3543] my-0.5"></div>
                  <button className="p-1.5 rounded text-[#adc6ff]" title="North Align">
                    <span className="material-symbols-outlined text-[18px]">navigation</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Status Bar: Map Legend / Coordinates */}
            <div className="flex items-center justify-between px-2 py-1 bg-[#161b29] rounded-lg font-mono text-[11px] text-[#ab8986] border border-[#2f3543]/30">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ff5451]"></span> Critical Distress
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ffb95f]"></span> Moderate Risk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#adc6ff]"></span> Active Dispatch
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>COORDS: 37.7749° N, 122.4194° W</span>
                <span>ELEV: 14m</span>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------- */}
          {/* RIGHT PANEL: AI RESPONSE PLAN & RESOURCE STATUS (col-span-3)*/}
          {/* ---------------------------------------------------------- */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {/* TOP SECTION: ACTIVE AI RESPONSE PLAN */}
            <div className="bg-[#080e1b] p-3.5 rounded-lg shadow-md flex flex-col gap-3 border border-[#2f3543]/40">
              {/* Header & Re-plan Badge */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#ffb3ad]">
                    <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    <span className="font-sans text-[16px] font-bold text-[#dde2f5]">RESPONSE PLAN #8824</span>
                  </div>
                  <span className="bg-[#242a38] font-mono text-[11px] text-[#adc6ff] px-1.5 py-0.5 rounded">
                    AUTO-GEN
                  </span>
                </div>

                {/* Highlight Re-Planned Amber Alert Strip */}
                <div className="bg-[#ca8100]/20 p-2 rounded-lg flex items-start gap-2 text-[#ffb95f] mt-1 border border-[#ffb95f]/30">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">bolt</span>
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px] font-bold text-[#ffb95f]">
                      RE-PLANNED {scenario.replanTimestamp}
                    </span>
                    <span className="font-sans text-[12px] text-[#dde2f5]">
                      {scenario.hwy101Blocked
                        ? 'HWY 101 Blocked → Rerouted via Hill Road Overpass (+2m delta)'
                        : 'Direct corridor via Hwy 101 restored.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary AI Recommendation Headline */}
              <div className="bg-[#161b29] p-2.5 rounded-lg border border-[#2f3543]/30">
                <span className="font-mono text-[11px] text-[#ab8986] uppercase block mb-1">
                  Primary Tactical Recommendation
                </span>
                <p className="font-sans text-[16px] text-[#dde2f5] font-semibold leading-snug">
                  Dispatch <span className="text-[#adc6ff] font-bold">RESCUE-BOAT-2</span> &amp; Route Medical Intake
                  to <span className="text-[#adc6ff] font-bold">St. Jude Trauma</span>
                </p>
                {scenario.mercyGeneralDiverted && (
                  <span className="font-mono text-[11px] text-[#ffb4ab] block mt-1">
                    • Mercy General ER over 90% divert threshold
                  </span>
                )}
              </div>

              {/* Plan Detail Cards Stack */}
              <div className="flex flex-col gap-2">
                {/* Card 1: Assigned Unit */}
                <div className="bg-[#161b29] p-2.5 rounded-lg flex items-center justify-between border border-[#2f3543]/30">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-[#0566d9] text-white">
                      <span className="material-symbols-outlined text-[18px]">directions_boat</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-[#ab8986]">PRIMARY UNIT</span>
                      <span className="font-sans text-[15px] font-bold text-[#dde2f5]">Rescue-Boat-2</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-sans text-[16px] font-bold text-[#adc6ff]">6 mins</span>
                    <span className="font-mono text-[10px] text-[#ab8986] block">ETA TO SECTOR 4</span>
                  </div>
                </div>

                {/* Card 2: Routing Vector */}
                <div className="bg-[#161b29] p-2.5 rounded-lg flex items-center justify-between border border-[#2f3543]/30">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-[#242a38] text-[#ffb95f]">
                      <span className="material-symbols-outlined text-[18px]">alt_route</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-[#ab8986]">BYPASS VECTOR</span>
                      <span className="font-sans text-[14px] font-semibold text-[#dde2f5]">Crestview Overpass</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-[#ffb95f] bg-[#242a38] px-2 py-1 rounded">
                    AVOIDS HWY 101
                  </span>
                </div>

                {/* Card 3: Target Facility */}
                <div className="bg-[#161b29] p-2.5 rounded-lg flex items-center justify-between border border-[#2f3543]/30">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-[#242a38] text-[#adc6ff]">
                      <span className="material-symbols-outlined text-[18px]">local_hospital</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-[#ab8986]">TARGET FACILITY</span>
                      <span className="font-sans text-[14px] font-semibold text-[#dde2f5]">St. Jude Trauma Center</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-[#adc6ff] bg-[#242a38] px-2 py-1 rounded">8 ICU BEDS</span>
                </div>
              </div>

              {/* AI Reasoning Factors ("WHY?") */}
              <div className="bg-[#161b29] p-3 rounded-lg flex flex-col gap-2 border border-[#2f3543]/30">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[13px] text-[#ffb3ad] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    WHY? — AI REASONING FACTORS
                  </span>
                  <span className="font-mono text-[11px] text-[#ab8986]">CONFIDENCE: 98.6%</span>
                </div>
                <ul className="flex flex-col gap-2 pl-1">
                  <li className="flex items-start gap-2 text-[12px] font-sans text-[#dde2f5]">
                    <span className="material-symbols-outlined text-[#ff5451] text-[16px] shrink-0 mt-0.5">
                      priority_high
                    </span>
                    <span>
                      <strong>Elderly victims (78, 81)</strong> have limited physical mobility trapped above rising
                      floodline (<strong className="text-[#ffb4ab]">+{scenario.waterRiseRate}ft in 20m</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-[12px] font-sans text-[#dde2f5]">
                    <span className="material-symbols-outlined text-[#ffb95f] text-[16px] shrink-0 mt-0.5">
                      local_hospital
                    </span>
                    <span>
                      <strong>Mercy General</strong> reached 94% ER diversion threshold 6 mins ago; divert prevents
                      ambulance holding queue.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-[12px] font-sans text-[#dde2f5]">
                    <span className="material-symbols-outlined text-[#ab8986] text-[16px] shrink-0 mt-0.5">block</span>
                    <span>
                      Ground ambulance Medic-4 impassable due to <strong>3.2ft standing water on River Rd</strong>; boat
                      unit designated.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Operator Action Triggers */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  id="btn-approve"
                  onClick={handleApproveDispatch}
                  className="w-full bg-[#0566d9] hover:bg-[#0566d9]/90 active:scale-[0.99] text-[#e6ecff] py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer font-bold tracking-wide uppercase text-[13px]"
                >
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  <span>APPROVE &amp; DISPATCH (Spacebar)</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playChirpSound();
                      setDispatchToast({
                        visible: true,
                        message: 'TACTICAL EDITOR OPEN: Edit dispatch waypoints & vessel loadouts.',
                      });
                      setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3000);
                    }}
                    className="bg-[#242a38] hover:bg-[#2f3543] text-[#ffb95f] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[12px] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    MODIFY PLAN
                  </button>
                  <button
                    onClick={() => {
                      playChirpSound();
                      setDispatchToast({
                        visible: true,
                        message: 'OVERRIDE LOGGED: Autonomous response halted. Manual command assigned.',
                      });
                      setTimeout(() => setDispatchToast({ visible: false, message: '' }), 3000);
                    }}
                    className="bg-[#242a38] hover:bg-[#93000a]/40 text-[#ffb4ab] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[12px] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    OVERRIDE / REJECT
                  </button>
                </div>
              </div>
            </div>

            {/* LOWER SECTION: HOSPITALS & FLEET CAPACITIES */}
            <div className="bg-[#080e1b] p-3.5 rounded-lg shadow-md flex flex-col gap-3 border border-[#2f3543]/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">domain</span>
                  <span className="font-sans text-[16px] font-bold text-[#dde2f5]">Hospitals &amp; Fleets</span>
                </div>
                <span className="font-mono text-[11px] text-[#ab8986]">TRIAGE ZONE 4</span>
              </div>

              {/* Hospital Capacity Meters */}
              <div className="flex flex-col gap-2.5">
                {hospitals.map((hosp) => (
                  <div
                    key={hosp.name}
                    className="bg-[#161b29] p-2 rounded-lg flex flex-col gap-1 border border-[#2f3543]/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-[13px] font-bold text-[#dde2f5]">{hosp.name}</span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          hosp.statusType === 'critical'
                            ? 'text-[#ffb4ab]'
                            : hosp.statusType === 'normal'
                            ? 'text-[#adc6ff]'
                            : 'text-[#ffb95f]'
                        }`}
                      >
                        {hosp.statusLabel}
                      </span>
                    </div>
                    <div className="w-full bg-[#2f3543] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          hosp.statusType === 'critical'
                            ? 'bg-[#ff5451]'
                            : hosp.statusType === 'normal'
                            ? 'bg-[#0566d9]'
                            : 'bg-[#ca8100]'
                        }`}
                        style={{ width: `${hosp.occupancyPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between font-mono text-[11px] text-[#ab8986]">
                      <span>ER Influx: {hosp.erInflux}</span>
                      <span
                        className={`font-bold ${
                          hosp.statusType === 'critical' ? 'text-[#ffb4ab]' : 'text-[#adc6ff]'
                        }`}
                      >
                        {hosp.highlightNote}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Field Units Inventory Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-[#161b29] p-2 rounded text-center border border-[#2f3543]/30">
                  <span className="text-[#ab8986] block text-[10px]">AMBULANCES</span>
                  <span className="font-sans text-[18px] font-bold text-[#dde2f5]">12</span>
                  <span className="text-[#adc6ff] text-[10px] block">9 Active</span>
                </div>
                <div className="bg-[#161b29] p-2 rounded text-center border border-[#2f3543]/30">
                  <span className="text-[#ab8986] block text-[10px]">RESCUE BOATS</span>
                  <span className="font-sans text-[18px] font-bold text-[#dde2f5]">4</span>
                  <span className="text-[#ffb95f] text-[10px] block">3 Dispatched</span>
                </div>
                <div className="bg-[#161b29] p-2 rounded text-center border border-[#2f3543]/30">
                  <span className="text-[#ab8986] block text-[10px]">HELICOPTERS</span>
                  <span className="font-sans text-[18px] font-bold text-[#dde2f5]">2</span>
                  <span className="text-[#ab8986] text-[10px] block">1 Launching</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLLAPSIBLE SIMULATION / DEMO TEST SUITE OVERLAY             */}
        {/* ============================================================ */}
        <div className="w-full px-3 lg:px-6 pb-6 mt-2">
          <div className="w-full bg-[#080e1b]/95 p-3.5 rounded-lg shadow-xl border-2 border-dashed border-[#ffb95f]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ffb95f] text-[22px]">bug_report</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-[16px] text-[#ffb95f] font-bold tracking-wider uppercase">
                    DEMO &amp; SCENARIO INJECTION SUITE
                  </span>
                  <span className="bg-[#ca8100] text-[#3e2400] font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                    ADMIN TEST BENCH
                  </span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#ab8986]">
                Simulate real-time field disruptions &amp; observe autonomous re-planning logic
              </span>
            </div>

            {/* Actionable Injection Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <button
                onClick={handleSimulateNewSos}
                className="bg-[#242a38] hover:bg-[#2f3543] active:bg-[#ff5451] text-[#dde2f5] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border border-[#2f3543]"
              >
                <span className="material-symbols-outlined text-[16px] text-[#ff5451]">add_alert</span>
                + Simulate Citizen SOS
              </button>

              <button
                onClick={handleToggleHwy101}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border ${
                  scenario.hwy101Blocked
                    ? 'bg-[#93000a]/40 text-[#ffb4ab] border-[#ff5451]'
                    : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] border-[#2f3543]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#ff5451]">dangerous</span>
                {scenario.hwy101Blocked ? '🚨 Hwy 101 North: BLOCKED' : 'Open Hwy 101 North'}
              </button>

              <button
                onClick={handleToggleMercyGeneral}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border ${
                  scenario.mercyGeneralDiverted
                    ? 'bg-[#93000a]/40 text-[#ffb4ab] border-[#ff5451]'
                    : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] border-[#2f3543]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#ffb95f]">domain_disabled</span>
                {scenario.mercyGeneralDiverted ? '🏥 Mercy General: DIVERTING' : 'Restore Mercy General'}
              </button>

              <button
                onClick={handleIncreaseRain}
                className="bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border border-[#2f3543]"
              >
                <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">cloud</span>
                🌧️ Increase Rain +50mm/h ({scenario.rainIntensity}mm/h)
              </button>

              <button
                onClick={handleSurgeWater}
                className="bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border border-[#2f3543]"
              >
                <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">tsunami</span>
                🌊 Surge Water Level +2ft (+{scenario.waterLevelSurge}m)
              </button>

              <button
                onClick={handleUnitBreakdown}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer border ${
                  !scenario.medic4Operational
                    ? 'bg-[#93000a]/40 text-[#ffb4ab] border-[#ff5451]'
                    : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] border-[#2f3543]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#ab8986]">car_crash</span>
                {scenario.medic4Operational ? '🚑 Breakdown Medic-4' : 'Restore Medic-4'}
              </button>

              <button
                onClick={handleResetScenario}
                className="ml-auto bg-[#161b29] hover:bg-[#242a38] text-[#ab8986] hover:text-[#dde2f5] px-2.5 py-1.5 rounded flex items-center gap-1 transition-colors cursor-pointer border border-[#2f3543]/40"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span> Reset Scenario
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
