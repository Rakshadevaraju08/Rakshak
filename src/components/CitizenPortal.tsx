import React, { useState, useRef, useEffect } from 'react';
import { CitizenViewMode, EmergencyCategory } from '../types';
import { playChirpSound, playSirenPulseLoop } from '../utils/audio';

interface CitizenPortalProps {
  isOffline: boolean;
  onToggleOffline: (val: boolean) => void;
  onDistressDispatched?: (details: { category: string; people: number; note: string }) => void;
}

export const CitizenPortal: React.FC<CitizenPortalProps> = ({
  isOffline,
  onToggleOffline,
  onDistressDispatched
}) => {
  const [viewMode, setViewMode] = useState<CitizenViewMode>('all');
  const [language, setLanguage] = useState<'EN' | 'ES' | '中文'>('EN');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory>('Flood');
  const [peopleCount, setPeopleCount] = useState(2);
  const [notes, setNotes] = useState('Water rising rapidly up staircase to 2nd floor. Power is out, elderly couple inside.');
  const [phone3Tab, setPhone3Tab] = useState<'online' | 'offline'>('online');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [sosAlertTriggered, setSosAlertTriggered] = useState(false);

  // SOS Press-and-Hold animation state
  const [pressProgress, setPressProgress] = useState(0); // 0 to 100%
  const isPressingRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  const sirenStopRef = useRef<(() => void) | null>(null);

  // Sync state with parent offline toggle
  useEffect(() => {
    if (isOffline) {
      setPhone3Tab('offline');
    } else {
      setPhone3Tab('online');
    }
  }, [isOffline]);

  // Clean up siren on unmount
  useEffect(() => {
    return () => {
      if (sirenStopRef.current) {
        sirenStopRef.current();
      }
    };
  }, []);

  // Handle SOS Long Press
  const handleSosStart = () => {
    isPressingRef.current = true;
    setPressProgress(0);
    playChirpSound();

    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds hold

    pressTimerRef.current = window.setInterval(() => {
      if (!isPressingRef.current) {
        if (pressTimerRef.current) clearInterval(pressTimerRef.current);
        return;
      }
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setPressProgress(progress);

      if (progress >= 100) {
        if (pressTimerRef.current) clearInterval(pressTimerRef.current);
        triggerSosAction();
      }
    }, 40);
  };

  const handleSosEnd = () => {
    isPressingRef.current = false;
    if (pressTimerRef.current) {
      clearInterval(pressTimerRef.current);
    }
    setPressProgress(0);
  };

  const triggerSosAction = () => {
    playChirpSound();
    setSosAlertTriggered(true);
    if (onDistressDispatched) {
      onDistressDispatched({
        category: selectedCategory,
        people: peopleCount,
        note: notes
      });
    }
    setTimeout(() => {
      setSosAlertTriggered(false);
    }, 3500);
  };

  // Submit Emergency Report button handler
  const handleSendReport = () => {
    setIsSubmittingReport(true);
    playChirpSound();
    setTimeout(() => {
      setIsSubmittingReport(false);
      setReportSubmitted(true);
      setPhone3Tab('online');
      if (onDistressDispatched) {
        onDistressDispatched({
          category: selectedCategory,
          people: peopleCount,
          note: notes
        });
      }
      setTimeout(() => {
        setReportSubmitted(false);
      }, 4000);
    }, 1200);
  };

  // Satellite Relay Force Sync
  const handleForceSync = () => {
    setIsSyncing(true);
    setSyncProgress(25);
    playChirpSound();

    setTimeout(() => {
      setSyncProgress(65);
    }, 400);

    setTimeout(() => {
      setSyncProgress(100);
      setSyncSuccess(true);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
        setSyncSuccess(false);
        setPhone3Tab('online');
        onToggleOffline(false);
      }, 900);
    }, 900);
  };

  // Siren pulse chirp toggle
  const handleToggleSiren = () => {
    if (isSirenActive) {
      if (sirenStopRef.current) {
        sirenStopRef.current();
        sirenStopRef.current = null;
      }
      setIsSirenActive(false);
    } else {
      setIsSirenActive(true);
      sirenStopRef.current = playSirenPulseLoop();
      // auto shut off after 6 seconds
      setTimeout(() => {
        if (sirenStopRef.current) {
          sirenStopRef.current();
          sirenStopRef.current = null;
        }
        setIsSirenActive(false);
      }, 6000);
    }
  };

  // Auto demonstration script
  const triggerAutoDemo = () => {
    setViewMode('all');
    triggerSosAction();
    setTimeout(() => {
      onToggleOffline(true);
      setTimeout(() => {
        handleForceSync();
      }, 1500);
    }, 1200);
  };

  // Dashoffset calculation for SVG circular ring
  const circleCircumference = 2 * Math.PI * 92; // 578
  const strokeDashoffset = circleCircumference - (pressProgress / 100) * circleCircumference;

  return (
    <div className="flex flex-col w-full bg-[#0d1320] text-[#dde2f5] min-h-screen pt-16">
      {/* SECTION 1: HEADER & LIVE TELEMETRY BAR */}
      <section className="w-full bg-[#0d1320] py-6 px-4 lg:px-8 border-b border-[#2f3543]/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#ff5451] text-[#68000a] font-mono text-[11px] uppercase tracking-wider font-bold">
                Live Distress Gateway
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#242a38] text-[#adc6ff] font-mono text-[11px]">
                <span className="h-2 w-2 rounded-full bg-[#adc6ff] animate-pulse"></span>
                Telemetry Synced (Node #DL-8821)
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#dde2f5] tracking-tight mt-1 font-sans">
              Citizen SOS Portal • Tri-Phase Life-Line
            </h1>
            <p className="text-[14px] text-[#ab8986] font-sans">
              Ultra-resilient emergency interface designed for panic situations, shaking hands, and zero-connectivity disasters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View switcher buttons */}
            <div className="p-1 rounded-xl bg-[#161b29] flex items-center gap-1 border border-[#2f3543]/40">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  viewMode === 'all'
                    ? 'bg-[#0566d9] text-[#e6ecff]'
                    : 'text-[#e4beba] hover:text-[#dde2f5]'
                }`}
              >
                Full Journey Triptych
              </button>
              <button
                onClick={() => setViewMode('phase-1')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  viewMode === 'phase-1'
                    ? 'bg-[#0566d9] text-[#e6ecff]'
                    : 'text-[#e4beba] hover:text-[#dde2f5]'
                }`}
              >
                1. Trigger
              </button>
              <button
                onClick={() => setViewMode('phase-2')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  viewMode === 'phase-2'
                    ? 'bg-[#0566d9] text-[#e6ecff]'
                    : 'text-[#e4beba] hover:text-[#dde2f5]'
                }`}
              >
                2. Triage Form
              </button>
              <button
                onClick={() => setViewMode('phase-3')}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  viewMode === 'phase-3'
                    ? 'bg-[#0566d9] text-[#e6ecff]'
                    : 'text-[#e4beba] hover:text-[#dde2f5]'
                }`}
              >
                3. Live Response
              </button>
            </div>

            {/* Satellite status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1f2d] border border-[#2f3543]/50">
              <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">cell_tower</span>
              <span className="font-mono text-[11px] text-[#dde2f5]">Satellite Uplink:</span>
              <span className="font-mono text-[11px] text-[#adc6ff] font-bold">READY (4/4 BARS)</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: HARDWARE PROFILE & DRILL CONTROLLER */}
      <div className="w-full bg-[#080e1b]/70 border-b border-[#2f3543]/30 py-3 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-mono text-[11px]">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#ab8986]">
              Hardware Profile:
            </span>
            <span className="inline-flex items-center gap-1 text-[#dde2f5] font-mono">
              <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">touch_app</span>
              64px Touch Zones
            </span>
            <span className="inline-flex items-center gap-1 text-[#dde2f5] font-mono">
              <span className="material-symbols-outlined text-[16px] text-[#ffb95f]">battery_charging_full</span>
              1% Battery Surv Mode
            </span>
            <span className="inline-flex items-center gap-1 text-[#dde2f5] font-mono">
              <span className="material-symbols-outlined text-[16px] text-[#ffb3ad]">wifi_off</span>
              IndexedDB Local Queue
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#ffb95f] font-mono text-[11px] uppercase font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">warning</span> Drill Sim Controller:
            </span>
            <button
              onClick={() => onToggleOffline(!isOffline)}
              className="px-2.5 py-1 rounded bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] font-mono text-[11px] transition-all flex items-center gap-1.5 border border-[#2f3543]"
            >
              <span className={`h-2 w-2 rounded-full ${isOffline ? 'bg-[#ffb95f]' : 'bg-[#adc6ff]'}`}></span>
              <span>{isOffline ? 'Set System To ONLINE' : 'Toggle System To OFFLINE'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SOS FLASH ALERT BANNER */}
      {sosAlertTriggered && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#b91a24] text-white px-6 py-3 rounded-2xl shadow-2xl border-2 border-white flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-[26px]">crisis_alert</span>
          <div>
            <div className="font-bold text-[14px] uppercase font-mono">Emergency SOS Beacon Broadcast!</div>
            <div className="text-[12px] text-white/90">
              Coordinates 37.7749° N, 122.4194° W queued to 911 gateway and nearby SAR mesh.
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: THREE INTERACTIVE PHONE SCREENS */}
      <div className="w-full py-10 px-4 lg:px-8 flex-grow">
        <div className="max-w-7xl mx-auto">
          <div
            className={`w-full items-start justify-center ${
              viewMode === 'all'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
                : 'flex justify-center'
            }`}
          >
            {/* ============================================================ */}
            {/* PHONE 1: RAPID SOS TRIGGER (PANIC READY)                     */}
            {/* ============================================================ */}
            {(viewMode === 'all' || viewMode === 'phase-1') && (
              <div className="flex flex-col items-center w-full max-w-[390px] mx-auto animate-in fade-in duration-300">
                <div className="flex items-center justify-between w-full mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-[#ffb3ad]">PHASE 01</span>
                    <span className="font-mono text-[11px] text-[#ab8986]">• RAPID SOS TRIGGER</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#e4beba] bg-[#1a1f2d] px-2 py-0.5 rounded">
                    PWA STANDALONE
                  </span>
                </div>

                {/* Phone Chassis */}
                <div
                  className={`relative w-full h-[780px] rounded-[44px] p-3 shadow-2xl border-4 border-[#2f3543]/60 flex flex-col justify-between overflow-hidden transition-colors ${
                    isTorchOn ? 'bg-white/10 ring-4 ring-white/50' : 'bg-[#080e1b]'
                  }`}
                >
                  {/* Dynamic Island / Speaker cutout */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#2f3543] rounded-full z-30 flex items-center justify-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#080e1b]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#161b29]"></div>
                  </div>

                  {/* Inner Phone Screen */}
                  <div
                    className={`relative w-full h-full rounded-[34px] overflow-hidden flex flex-col justify-between p-4 pt-8 text-[#dde2f5] select-none transition-colors ${
                      isTorchOn ? 'bg-[#1a2333]' : 'bg-[#0d1320]'
                    }`}
                  >
                    {/* Device Top Bar & Connectivity */}
                    <div className="w-full flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-[#ab8986] text-[11px] font-mono">
                        <span>09:41</span>
                        <div className="flex items-center gap-1.5 text-[#dde2f5]">
                          <span className="material-symbols-outlined text-[14px]">signal_cellular_alt</span>
                          <span className="material-symbols-outlined text-[14px]">wifi</span>
                          <span className="material-symbols-outlined text-[14px]">battery_saver</span>
                        </div>
                      </div>

                      {/* Live Status Header Pill */}
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-xl bg-[#161b29] border transition-all duration-300 ${
                          isOffline ? 'border-[#ffb95f]/40' : 'border-[#adc6ff]/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            {!isOffline && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#adc6ff] opacity-75"></span>
                            )}
                            <span
                              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                isOffline ? 'bg-[#ffb95f]' : 'bg-[#adc6ff]'
                              }`}
                            ></span>
                          </span>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              isOffline ? 'text-[#ffb95f]' : 'text-[#adc6ff]'
                            }`}
                          >
                            {isOffline ? 'OFFLINE • MESH QUEUE ARMED' : 'ONLINE • GPS LOCK: ±4m'}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#ab8986]">DL-MESH</span>
                      </div>

                      {/* Language & Torch Row */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center bg-[#242a38] rounded-lg p-1 text-[#dde2f5] font-mono text-[11px]">
                          {(['EN', 'ES', '中文'] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => setLanguage(lang)}
                              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                                language === lang
                                  ? 'bg-[#0566d9] text-white'
                                  : 'text-[#ab8986] hover:text-white'
                              }`}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setIsTorchOn(!isTorchOn)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] transition-colors border ${
                            isTorchOn
                              ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.6)] font-bold'
                              : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] border-transparent'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              isTorchOn ? 'text-black' : 'text-[#ffb95f]'
                            }`}
                          >
                            {isTorchOn ? 'flashlight_on' : 'flashlight_off'}
                          </span>
                          <span>{isTorchOn ? 'TORCH ON' : 'TORCH'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Central Target: Emergency SOS Button */}
                    <div className="relative flex flex-col items-center justify-center my-auto py-2">
                      {/* Glowing Ambient Waves */}
                      <div className="absolute w-64 h-64 rounded-full bg-[#ff5451]/20 animate-ping pointer-events-none"></div>
                      <div className="absolute w-52 h-52 rounded-full bg-[#ff5451]/30 blur-xl pointer-events-none"></div>

                      {/* Continuous Ring Progress SVG */}
                      <div className="relative flex flex-col items-center">
                        <svg
                          className="absolute -top-3 -left-3 w-54 h-54 pointer-events-none"
                          style={{ width: '216px', height: '216px' }}
                          viewBox="0 0 200 200"
                        >
                          <circle
                            cx="100"
                            cy="100"
                            fill="none"
                            r="92"
                            stroke="rgba(255, 179, 173, 0.15)"
                            strokeWidth="6"
                          />
                          <circle
                            cx="100"
                            cy="100"
                            fill="none"
                            r="92"
                            stroke="#ff5451"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            strokeWidth="6"
                            className="transition-all duration-75"
                          />
                        </svg>

                        {/* Large Tactile SOS Trigger */}
                        <button
                          onMouseDown={handleSosStart}
                          onMouseUp={handleSosEnd}
                          onMouseLeave={handleSosEnd}
                          onTouchStart={handleSosStart}
                          onTouchEnd={handleSosEnd}
                          onClick={triggerSosAction}
                          className="relative group w-48 h-48 rounded-full bg-gradient-to-b from-[#ff5451] via-[#d32f2f] to-[#8b0000] flex flex-col items-center justify-center text-center p-4 transition-transform active:scale-95 shadow-[0_12px_28px_rgba(239,68,68,0.45)] border-4 border-[#0d1320] focus:outline-none cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[48px] text-white animate-pulse">
                            crisis_alert
                          </span>
                          <span className="font-sans text-[30px] font-black tracking-tight text-white leading-none mt-1">
                            SEND SOS
                          </span>
                          <span className="font-mono text-[11px] text-white/90 uppercase tracking-widest mt-1">
                            {pressProgress > 0 ? `HOLDING ${Math.round(pressProgress)}%` : 'PRESS OR HOLD'}
                          </span>
                        </button>
                      </div>

                      <div className="text-center mt-6 px-4">
                        <p className="font-sans text-[14px] font-semibold text-[#dde2f5] leading-snug">
                          Press to alert Emergency Services, SAR teams &amp; nearby responders instantly.
                        </p>
                        <p className="font-mono text-[11px] text-[#ab8986] mt-1.5">
                          Transmits Live Coordinates • Audio Beacon • Battery State
                        </p>
                      </div>
                    </div>

                    {/* Safety Guidance Footer Pill */}
                    <div className="w-full flex flex-col gap-2">
                      <div className="p-3 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[#ffb95f] text-[20px] shrink-0 mt-0.5">
                          info
                        </span>
                        <div className="text-left">
                          <div className="font-mono text-[11px] font-bold text-[#ffb95f] uppercase">
                            Distress Protocol
                          </div>
                          <div className="font-sans text-[12px] text-[#e4beba] leading-relaxed">
                            Stay calm • Move upward if water is rising • Screen dims automatically to conserve remaining battery.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[#ab8986] font-mono text-[11px] px-2 pt-1 border-t border-[#2f3543]/20">
                        <span>911 BRIDGE: LINKED</span>
                        <span>ID: INC-882-SF</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* PHONE 2: EMERGENCY TRIAGE FORM                               */}
            {/* ============================================================ */}
            {(viewMode === 'all' || viewMode === 'phase-2') && (
              <div className="flex flex-col items-center w-full max-w-[390px] mx-auto animate-in fade-in duration-300">
                <div className="flex items-center justify-between w-full mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-[#ffb95f]">PHASE 02</span>
                    <span className="font-mono text-[11px] text-[#ab8986]">• RAPID TRIAGE REPORT</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#ffddb8] bg-[#ca8100]/30 px-2 py-0.5 rounded">
                    LOW-BANDWIDTH
                  </span>
                </div>

                {/* Phone Chassis */}
                <div className="relative w-full h-[780px] bg-[#080e1b] rounded-[44px] p-3 shadow-2xl border-4 border-[#2f3543]/60 flex flex-col justify-between overflow-hidden">
                  {/* Dynamic Cutout */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#2f3543] rounded-full z-30 flex items-center justify-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#080e1b]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#161b29]"></div>
                  </div>

                  {/* Inner Phone Screen */}
                  <div className="relative w-full h-full bg-[#0d1320] rounded-[34px] overflow-y-auto no-scrollbar flex flex-col p-4 pt-8 text-[#dde2f5]">
                    {/* Form Navigation Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#2f3543]/30">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewMode('phase-1')}
                          className="w-8 h-8 rounded-lg bg-[#242a38] flex items-center justify-center text-[#dde2f5] hover:bg-[#2f3543] transition-colors"
                          title="Back to trigger"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        </button>
                        <span className="font-sans text-[17px] font-bold">Report Emergency</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#ffb3ad] px-2 py-0.5 rounded bg-[#ff5451]/20 font-bold">
                        STEP 2 OF 3
                      </span>
                    </div>

                    {/* GIS Location Pill */}
                    <div className="mt-3 p-2.5 rounded-xl bg-[#161b29] border border-[#2f3543]/40 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative bg-[#1a1f2d] flex items-center justify-center">
                        <div className="absolute inset-0 bg-[#ffb3ad]/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[#ff5451] text-[18px]">location_on</span>
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[11px] text-[#ffb3ad] font-bold">Sector 4 • GPS LOCKED</span>
                        <span className="font-mono text-[11px] text-[#ab8986] truncate">
                          37.7749° N, 122.4194° W (4th &amp; Mission)
                        </span>
                      </div>
                    </div>

                    {/* Category Selector Grid */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-sans text-[13px] font-bold text-[#dde2f5] uppercase tracking-wider">
                          Emergency Type <span className="text-[#ff5451]">*</span>
                        </label>
                        <span className="font-mono text-[11px] text-[#ab8986]">Select Primary</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'Flood', icon: '🌊', label: 'Flood' },
                          { key: 'Fire', icon: '🔥', label: 'Fire' },
                          { key: 'Medical', icon: '🚑', label: 'Medical' },
                          { key: 'Collapse', icon: '🏚️', label: 'Collapse' },
                          { key: 'Trapped', icon: '🆘', label: 'Trapped' },
                          { key: 'Other', icon: '⚠️', label: 'Other' },
                        ].map((cat) => {
                          const isSelected = selectedCategory === cat.key;
                          return (
                            <button
                              key={cat.key}
                              onClick={() => setSelectedCategory(cat.key as EmergencyCategory)}
                              className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#ff5451] text-white border-2 border-white shadow-md'
                                  : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] border border-[#2f3543]/50'
                              }`}
                            >
                              <span className="text-[26px]">{cat.icon}</span>
                              <span className="font-sans text-[13px] font-bold mt-1">{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* People Affected Counter */}
                    <div className="mt-4 p-3 rounded-2xl bg-[#161b29] border border-[#2f3543]/30 flex items-center justify-between">
                      <div>
                        <div className="font-sans text-[13px] font-bold text-[#dde2f5]">People with you</div>
                        <div className="font-mono text-[11px] text-[#ab8986]">Including children &amp; elderly</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                          className="w-10 h-10 rounded-xl bg-[#242a38] hover:bg-[#2f3543] flex items-center justify-center text-[#dde2f5] text-[20px] font-bold transition-all active:scale-90"
                        >
                          -
                        </button>
                        <span className="font-sans text-[22px] font-extrabold w-8 text-center text-[#ffb3ad]">
                          {peopleCount}
                        </span>
                        <button
                          onClick={() => setPeopleCount(Math.min(99, peopleCount + 1))}
                          className="w-10 h-10 rounded-xl bg-[#242a38] hover:bg-[#2f3543] flex items-center justify-center text-[#dde2f5] text-[20px] font-bold transition-all active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Critical Situation Details */}
                    <div className="mt-4">
                      <label className="block font-sans text-[13px] font-bold text-[#dde2f5] uppercase tracking-wider mb-1.5">
                        Critical Details (Or Voice Note)
                      </label>
                      <div className="relative">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-[#161b29] rounded-xl p-3 text-[#dde2f5] font-sans text-[12px] border border-[#2f3543]/50 focus:border-[#0566d9] focus:outline-none resize-none"
                        />
                        <span className="absolute bottom-2 right-2 text-[#ab8986] font-mono text-[11px]">
                          {notes.length} chars
                        </span>
                      </div>
                    </div>

                    {/* Quick Attachments */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#242a38] border border-[#2f3543]/40">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-[#1a1f2d]">
                          <img
                            alt="Muddy flood water swirling up stairs"
                            className="w-full h-full object-cover"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6GJ0a15nhCwB3tsou7i2Qmwhp53QDH5JJfzMyD9MI9KsSOZn1AJp80sxw_ZhSB6oos31aRvSF1U1ymRcQmVHndIgLhgLKWZrKjP8Qjr5GAU8rOqDtkCWr_bCrWadZ2PoN1awu0mTSf6uZvLzR3-GsX2ofta_Etr4WA6Qy7XvKW1Wl9X6U9moO8Qz3VfPt4fLPiB6TkOpaA2lzVGIl4q0cAIavU7Ad5bu8p6cn671juHnTiGuFBUR_1Q"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[11px] text-[#dde2f5] truncate font-bold">
                            stairs_flood.jpg
                          </span>
                          <span className="font-mono text-[10px] text-[#adc6ff]">Attached • 84kb</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#242a38] border border-[#2f3543]/40">
                        <div className="w-8 h-8 rounded-lg bg-[#93000a] text-white flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">mic</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[11px] text-[#dde2f5] truncate font-bold">Voice Note</span>
                          <span className="font-mono text-[10px] text-[#ffb95f]">0:12s Recorded</span>
                        </div>
                      </div>
                    </div>

                    {/* Offline Cache Demo Tool */}
                    <div className="mt-4 p-2.5 rounded-xl bg-[#080e1b] border-2 border-dashed border-[#ffb95f] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#ffb95f] text-[20px]">cloud_off</span>
                        <div>
                          <span className="inline-block font-mono text-[11px] text-[#ffb95f] font-bold leading-none">
                            DEMO TOOL: Offline Cache
                          </span>
                          <p className="font-mono text-[10px] text-[#ab8986]">Simulates loss of carrier network</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isOffline}
                          onChange={(e) => onToggleOffline(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[#2f3543] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ca8100]"></div>
                      </label>
                    </div>

                    {/* Submit Report CTA */}
                    <div className="mt-auto pt-4">
                      <button
                        onClick={handleSendReport}
                        disabled={isSubmittingReport}
                        className={`w-full py-3.5 px-4 rounded-2xl text-white font-sans text-[13px] uppercase tracking-widest font-extrabold shadow-lg active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          reportSubmitted
                            ? 'bg-[#0566d9]'
                            : 'bg-gradient-to-r from-[#ff5451] to-[#b91a24] shadow-[#ff5451]/40'
                        }`}
                      >
                        {isSubmittingReport ? (
                          <>
                            <span className="material-symbols-outlined text-[20px] animate-spin">
                              progress_activity
                            </span>
                            TRANSMITTING REPORT...
                          </>
                        ) : reportSubmitted ? (
                          <>
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            REPORT QUEUED &amp; TRANSMITTED!
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[22px]">send</span>
                            SEND EMERGENCY REPORT NOW
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* PHONE 3: RESPONSE STATUS & CONFIRMATION                       */}
            {/* ============================================================ */}
            {(viewMode === 'all' || viewMode === 'phase-3') && (
              <div className="flex flex-col items-center w-full max-w-[390px] mx-auto animate-in fade-in duration-300">
                <div className="flex items-center justify-between w-full mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-[#adc6ff]">PHASE 03</span>
                    <span className="font-mono text-[11px] text-[#ab8986]">• REAL-TIME REASSURANCE</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#adc6ff] bg-[#0566d9]/20 px-2 py-0.5 rounded font-bold">
                    DISPATCH ACK
                  </span>
                </div>

                {/* Phone Chassis */}
                <div className="relative w-full h-[780px] bg-[#080e1b] rounded-[44px] p-3 shadow-2xl border-4 border-[#2f3543]/60 flex flex-col justify-between overflow-hidden">
                  {/* Dynamic Cutout */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#2f3543] rounded-full z-30 flex items-center justify-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#080e1b]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#161b29]"></div>
                  </div>

                  {/* Inner Phone Screen */}
                  <div className="relative w-full h-full bg-[#0d1320] rounded-[34px] overflow-hidden flex flex-col justify-between p-4 pt-8 text-[#dde2f5]">
                    {/* Top Switcher: State A (Online) vs State B (Offline Mesh Relay) */}
                    <div className="w-full flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[#ab8986] text-[11px] font-mono">
                        <span>TICKET #DL-90412</span>
                        <span className="text-[#adc6ff] font-bold">STATUS: MONITORED</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 bg-[#161b29] p-1 rounded-xl border border-[#2f3543]/40">
                        <button
                          onClick={() => setPhone3Tab('online')}
                          className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                            phone3Tab === 'online'
                              ? 'bg-[#0566d9] text-[#e6ecff]'
                              : 'text-[#ab8986] hover:text-[#dde2f5]'
                          }`}
                        >
                          A: Online Ack
                        </button>
                        <button
                          onClick={() => setPhone3Tab('offline')}
                          className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                            phone3Tab === 'offline'
                              ? 'bg-[#ca8100] text-[#3e2400]'
                              : 'text-[#ab8986] hover:text-[#dde2f5]'
                          }`}
                        >
                          B: Offline Mesh
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC CONTENT CONTAINER */}
                    <div className="my-auto flex flex-col items-center text-center py-2 w-full">
                      {phone3Tab === 'online' ? (
                        /* STATE A: ONLINE ACKNOWLEDGED */
                        <div className="flex flex-col items-center w-full animate-in fade-in duration-200">
                          <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-[#0566d9]/20 border-4 border-[#adc6ff]/30 mb-3 shadow-[0_0_30px_rgba(5,102,217,0.3)]">
                            <span className="material-symbols-outlined text-[52px] text-[#adc6ff]">check_circle</span>
                            <span className="absolute inset-0 rounded-full animate-ping border border-[#adc6ff]/40"></span>
                          </div>

                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0566d9]/30 text-[#adc6ff] font-mono text-[11px] font-bold uppercase">
                            <span className="h-2 w-2 rounded-full bg-[#adc6ff]"></span>
                            Sent • Confirmed By Control Room
                          </span>

                          <h2 className="font-sans text-[22px] font-bold text-[#dde2f5] mt-2">Help is Mobilized</h2>
                          <p className="font-mono text-[11px] text-[#ab8986] mt-0.5">
                            Incident Logged: 14:22:08 PST (42s ago)
                          </p>

                          {/* Assigned Unit Card */}
                          <div className="w-full mt-4 p-3.5 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 text-left">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[11px] font-bold text-[#adc6ff] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">directions_boat</span>
                                Assigned Unit: Rescue Boat Alpha
                              </span>
                              <span className="px-2 py-0.5 rounded bg-[#0566d9] text-[#e6ecff] font-mono text-[11px] font-bold">
                                ETA 6-8 MIN
                              </span>
                            </div>
                            <div className="w-full bg-[#2f3543] h-1.5 rounded-full overflow-hidden mb-2">
                              <div className="bg-[#adc6ff] h-full rounded-full w-2/3 animate-pulse"></div>
                            </div>
                            <p className="font-sans text-[12px] text-[#e4beba]">
                              Unit 2 carrying swiftwater specialists and basic trauma gear. Approach via Howard St corridor.
                            </p>
                          </div>

                          {/* Instructions & Safety Advice */}
                          <div className="w-full mt-3 p-3 rounded-2xl bg-[#1a1f2d] text-left border border-[#2f3543]/30">
                            <div className="flex items-start gap-2.5">
                              <span className="material-symbols-outlined text-[#adc6ff] text-[20px] shrink-0 mt-0.5">
                                verified_user
                              </span>
                              <div>
                                <div className="font-sans text-[13px] font-bold text-[#dde2f5]">Stay where you are</div>
                                <div className="font-sans text-[12px] text-[#ab8986] leading-snug">
                                  We have your precise GPS beacon. Keep phone elevated. If water enters 2nd floor, move to roof hatch.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* STATE B: OFFLINE MESH RELAY */
                        <div className="flex flex-col items-center w-full animate-in fade-in duration-200">
                          <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-[#ca8100]/20 border-4 border-[#ffb95f]/40 mb-3 shadow-[0_0_30px_rgba(202,129,0,0.3)]">
                            <span className="material-symbols-outlined text-[52px] text-[#ffb95f]">cell_tower</span>
                            <span className="absolute inset-0 rounded-full animate-pulse border-2 border-[#ffb95f]/40"></span>
                          </div>

                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ca8100]/30 text-[#ffddb8] font-mono text-[11px] font-bold uppercase">
                            <span className="h-2 w-2 rounded-full bg-[#ffb95f]"></span>
                            Offline • Stored Locally On Device
                          </span>

                          <h2 className="font-sans text-[22px] font-bold text-[#dde2f5] mt-2">Relay Beacon Active</h2>
                          <p className="font-mono text-[11px] text-[#ab8986] mt-0.5">
                            Saved in PWA Vault (AES-256 Cached)
                          </p>

                          <div className="w-full mt-4 p-3.5 rounded-2xl bg-[#161b29] border border-[#ffb95f]/40 text-left">
                            <div className="font-mono text-[11px] font-bold text-[#ffb95f] mb-1">
                              PEER-TO-PEER MESH BROADCAST
                            </div>
                            <p className="font-sans text-[12px] text-[#e4beba] leading-relaxed">
                              Your report is hop-broadcasting via Bluetooth Low Energy &amp; Satellite beacon to emergency units in range.
                            </p>
                            <div className="mt-2.5 flex items-center gap-2 text-[#ab8986] font-mono text-[11px]">
                              <span className="material-symbols-outlined text-[16px] text-[#adc6ff] animate-spin">
                                sync
                              </span>
                              <span>Listening for SAR drone or operator ping...</span>
                            </div>
                          </div>

                          {/* Force Sync Button */}
                          <div className="w-full mt-4">
                            <button
                              onClick={handleForceSync}
                              disabled={isSyncing}
                              className={`w-full py-3 px-4 rounded-xl font-sans text-[13px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer ${
                                syncSuccess
                                  ? 'bg-[#0566d9] text-[#e6ecff]'
                                  : 'bg-[#ffb95f] text-[#472a00]'
                              }`}
                            >
                              <span className={`material-symbols-outlined text-[20px] ${isSyncing ? 'animate-spin' : ''}`}>
                                sync
                              </span>
                              <span>
                                {isSyncing
                                  ? 'COMMENCING DIRECT UPLINK...'
                                  : syncSuccess
                                  ? 'SYNCED • DELIVERED TO CONTROL'
                                  : 'FORCE SATELLITE RELAY SYNC'}
                              </span>
                            </button>

                            {isSyncing && (
                              <div className="w-full bg-[#2f3543] h-1.5 rounded-full overflow-hidden mt-2">
                                <div
                                  className="bg-[#adc6ff] h-full rounded-full transition-all duration-300"
                                  style={{ width: `${syncProgress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Audio Reassurance & Live Node Status */}
                    <div className="w-full pt-3 border-t border-[#2f3543]/30 flex flex-col gap-2">
                      <div className="flex items-center justify-between bg-[#161b29] p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              isSirenActive ? 'text-[#ff5451] animate-bounce' : 'text-[#adc6ff]'
                            }`}
                          >
                            volume_up
                          </span>
                          <span className="font-mono text-[11px] text-[#dde2f5]">Audio Siren Beacon</span>
                        </div>
                        <button
                          onClick={handleToggleSiren}
                          className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                            isSirenActive
                              ? 'bg-[#ff5451] text-white font-bold'
                              : 'bg-[#242a38] text-[#dde2f5] hover:bg-[#2f3543]'
                          }`}
                        >
                          {isSirenActive ? 'STOPPING...' : 'PULSE CHIRP'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[#ab8986] font-mono text-[11px] px-1">
                        <span>DISASTERLINK v4.8</span>
                        <span className="text-[#adc6ff] font-bold">NODE: SAN FRANCISCO-04</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: OPERATIONAL ARCHITECTURE & TECHNICAL STRESS MATRIX */}
      <section className="w-full bg-[#080e1b] py-12 px-4 lg:px-8 border-t border-[#2f3543]/40">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] text-[#ffb3ad] font-bold uppercase tracking-widest">
                Fail-Safe Design Standard
              </span>
              <h2 className="text-[28px] sm:text-[32px] font-bold text-[#dde2f5] mt-1 font-sans">
                Engineered for Extremes
              </h2>
              <p className="text-[14px] text-[#ab8986] mt-1 max-w-2xl font-sans">
                How DisasterLink's Citizen SOS Portal resolves the 4 primary bottlenecks during multi-hazard crises:
                network blackout, hardware degradation, motor impairment, and cognitive freeze.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-[#1a1f2d] text-[#adc6ff] font-mono text-[11px] border border-[#adc6ff]/30">
                Compliant: FEMA • FirstNet Ready • WCAG AAA
              </span>
            </div>
          </div>

          {/* 4 Architectural Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 flex flex-col justify-between hover:border-[#ff5451]/50 transition-colors">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ff5451]/20 text-[#ffb3ad] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[24px]">vibration</span>
                </div>
                <h3 className="font-sans text-[18px] font-bold text-[#dde2f5]">Tremor-Proof Hitbounds</h3>
                <p className="font-sans text-[12px] text-[#ab8986] mt-2 leading-relaxed">
                  Every critical tap target exceeds 64×64px with mechanical press shadows and continuous haptic feedback
                  ticks to counteract panicked, wet, or trembling hands.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#2f3543]/20 font-mono text-[11px] text-[#ffb3ad]">
                SPEC: ISO-9241 ERGONOMICS
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 flex flex-col justify-between hover:border-[#0566d9]/50 transition-colors">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0566d9]/20 text-[#adc6ff] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[24px]">battery_saver</span>
                </div>
                <h3 className="font-sans text-[18px] font-bold text-[#dde2f5]">Sub-1% OLED Survival</h3>
                <p className="font-sans text-[12px] text-[#ab8986] mt-2 leading-relaxed">
                  Deep pure slate grounds (`#080E1B` / `#0D1320`) shut off OLED subpixels across 82% of screen real estate,
                  preserving power for over 18 hours on dying batteries.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#2f3543]/20 font-mono text-[11px] text-[#adc6ff]">
                DRAW: 14.2mW STEADY STATE
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 flex flex-col justify-between hover:border-[#ffb95f]/50 transition-colors">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ca8100]/20 text-[#ffb95f] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[24px]">hub</span>
                </div>
                <h3 className="font-sans text-[18px] font-bold text-[#dde2f5]">Store-and-Forward Mesh</h3>
                <p className="font-sans text-[12px] text-[#ab8986] mt-2 leading-relaxed">
                  Zero carrier connection? The encrypted incident is queued locally in IndexedDB and silently relayed over
                  peer-to-peer WebRTC and low-frequency Bluetooth mesh.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#2f3543]/20 font-mono text-[11px] text-[#ffb95f]">
                STORE: AES-256 / SHA-256
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#161b29] border border-[#2f3543]/40 flex flex-col justify-between hover:border-[#dde2f5]/50 transition-colors">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#2f3543] text-[#dde2f5] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[24px]">psychology</span>
                </div>
                <h3 className="font-sans text-[18px] font-bold text-[#dde2f5]">Zero Cognitive Friction</h3>
                <p className="font-sans text-[12px] text-[#ab8986] mt-2 leading-relaxed">
                  Replaces dense government forms with clear emoji-backed hazard categories and automated geofenced
                  coordinates, dispatching aid in under 4 seconds.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#2f3543]/20 font-mono text-[11px] text-[#e4beba]">
                TRIAGE TIME: &lt; 4.2s AVG
              </div>
            </div>
          </div>

          {/* SIMULATION BENCH BANNER */}
          <div className="p-4 rounded-2xl bg-[#1a1f2d] border-2 border-dashed border-[#ffb95f] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#ca8100]/30 text-[#ffb95f] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">biotech</span>
              </div>
              <div>
                <span className="inline-block font-mono text-[11px] text-[#ffb95f] font-bold uppercase tracking-wider">
                  Simulation Sandbox Mode Active
                </span>
                <p className="font-sans text-[12px] text-[#dde2f5]">
                  Interactive test bench enabled: Click the SOS button above to trigger live pulse feedback, change people
                  counter, or toggle the network state.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={triggerAutoDemo}
                className="px-4 py-2 rounded-xl bg-[#ff5451] text-[#68000a] font-sans text-[13px] uppercase tracking-wider font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Trigger Auto Demonstration Run
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-[#080e1b] border-t border-[#2f3543]/30 py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[#ab8986] font-mono text-[11px]">
          <div>DISASTERLINK RAPID INTERVENTION PLATFORM • OFFLINE CAPABLE PWA</div>
          <div className="flex items-center gap-6">
            <span className="text-[#adc6ff] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#adc6ff] inline-block"></span>
              Direct Satellite Bridge Active
            </span>
            <span>911 / E911 Carrier Interconnect Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
