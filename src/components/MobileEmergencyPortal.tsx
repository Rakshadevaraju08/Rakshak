import { useEffect, useRef, useState } from 'react';
import { EmergencyCategory } from '../types';
import { playChirpSound, playSirenPulseLoop } from '../utils/audio';

interface MobileEmergencyPortalProps {
  isOffline: boolean;
  onToggleOffline: (value: boolean) => void;
  onDistressDispatched: (details: { category: string; people: number; note: string }) => void;
}

const categories: { name: EmergencyCategory; icon: string }[] = [
  { name: 'Medical', icon: 'medical_services' },
  { name: 'Flood', icon: 'flood' },
  { name: 'Fire', icon: 'local_fire_department' },
  { name: 'Trapped', icon: 'warning' },
  { name: 'Collapse', icon: 'domain_disabled' },
  { name: 'Other', icon: 'more_horiz' },
];

export function MobileEmergencyPortal({
  isOffline,
  onToggleOffline,
  onDistressDispatched,
}: MobileEmergencyPortalProps) {
  const [category, setCategory] = useState<EmergencyCategory>('Medical');
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('Finding your location…');
  const [isLocating, setIsLocating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sent, setSent] = useState(false);
  const [sirenOn, setSirenOn] = useState(false);
  const isHolding = useRef(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const sirenStop = useRef<(() => void) | null>(null);

  useEffect(() => {
    locate();
    return () => {
      if (holdTimer.current) window.clearInterval(holdTimer.current);
      sirenStop.current?.();
    };
  }, []);

  const locate = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      setLocation('Location unavailable — describe where you are');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        setIsLocating(false);
      },
      () => {
        setLocation('Location unavailable — describe where you are');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  };

  const dispatch = () => {
    if (sent) return;
    isHolding.current = false;
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    setProgress(100);
    playChirpSound();
    onDistressDispatched({ category, people, note });
    setSent(true);
    window.setTimeout(() => {
      setSent(false);
      setProgress(0);
    }, 5000);
  };

  const startHold = () => {
    if (sent) return;
    isHolding.current = true;
    const startedAt = Date.now();
    playChirpSound();
    holdTimer.current = window.setInterval(() => {
      if (!isHolding.current) return;
      const next = Math.min(100, ((Date.now() - startedAt) / 1400) * 100);
      setProgress(next);
      if (next === 100) dispatch();
    }, 30);
  };

  const endHold = () => {
    isHolding.current = false;
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    if (!sent) setProgress(0);
  };

  const toggleSiren = () => {
    if (sirenOn) {
      sirenStop.current?.();
      sirenStop.current = null;
    } else {
      sirenStop.current = playSirenPulseLoop();
    }
    setSirenOn((current) => !current);
  };

  return (
    <main className="min-h-screen bg-[#0d1320] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5.5rem+env(safe-area-inset-top))] text-[#dde2f5] sm:px-6">
      <div className="mx-auto max-w-md">
        <section className="mb-5 rounded-3xl border border-[#ff5451]/30 bg-gradient-to-br from-[#42151d] to-[#161b29] p-5 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 text-[#ffb3ad]">
            <span className="material-symbols-outlined">emergency</span>
            <span className="font-mono text-xs font-bold tracking-[0.16em]">EMERGENCY ASSISTANCE</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Help is one hold away.</h1>
          <p className="mt-2 text-sm leading-6 text-[#e4beba]">Press and hold SOS to send your location and emergency details to responders.</p>
        </section>

        <section className="mb-4 flex items-center justify-between rounded-2xl border border-[#2f3543] bg-[#161b29] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`material-symbols-outlined ${isOffline ? 'text-[#ffb95f]' : 'text-[#adc6ff]'}`}>{isOffline ? 'cloud_off' : 'location_on'}</span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#ab8986]">{isOffline ? 'Offline mesh ready' : 'Your location'}</p>
              <p className="truncate text-sm font-semibold">{isOffline ? 'Will send when connected' : location}</p>
            </div>
          </div>
          <button onClick={locate} disabled={isLocating || isOffline} aria-label="Refresh location" className="min-h-11 min-w-11 rounded-xl bg-[#242a38] text-[#adc6ff] disabled:opacity-40">
            <span className={`material-symbols-outlined ${isLocating ? 'animate-spin' : ''}`}>my_location</span>
          </button>
        </section>

        <section className="mb-5 rounded-3xl border border-[#2f3543] bg-[#161b29] p-4">
          <h2 className="mb-3 text-base font-bold">What is happening?</h2>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(({ name, icon }) => (
              <button key={name} onClick={() => setCategory(name)} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold transition ${category === name ? 'border-[#ff5451] bg-[#ff5451] text-white' : 'border-[#2f3543] bg-[#1a1f2d] text-[#e4beba]'}`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
                {name}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-3xl border border-[#2f3543] bg-[#161b29] p-4">
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="people" className="font-bold">People needing help</label>
            <div className="flex items-center gap-3 rounded-xl bg-[#242a38] p-1">
              <button aria-label="Decrease people" onClick={() => setPeople(Math.max(1, people - 1))} className="min-h-10 min-w-10 rounded-lg text-xl">−</button>
              <output id="people" className="w-5 text-center font-bold">{people}</output>
              <button aria-label="Increase people" onClick={() => setPeople(Math.min(99, people + 1))} className="min-h-10 min-w-10 rounded-lg text-xl">+</button>
            </div>
          </div>
          <label htmlFor="details" className="mb-2 block text-sm font-bold">Add details <span className="font-normal text-[#ab8986]">(optional)</span></label>
          <textarea id="details" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Injuries, building, landmarks, or access information" className="w-full resize-none rounded-2xl border border-[#2f3543] bg-[#0d1320] p-3 text-sm outline-none placeholder:text-[#ab8986] focus:border-[#adc6ff]" />
        </section>

        <section className="mb-5 text-center">
          <button
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onPointerLeave={endHold}
            aria-label="Press and hold to send SOS"
            className={`relative mx-auto flex h-48 w-48 touch-none select-none items-center justify-center rounded-full border-8 transition-transform active:scale-95 ${sent ? 'border-[#adc6ff] bg-[#0566d9]' : 'border-[#ffb3ad] bg-gradient-to-b from-[#ff5451] to-[#93000a] shadow-[0_0_36px_rgba(255,84,81,.45)]'}`}
          >
            <span className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#fff ${progress * 3.6}deg, transparent 0)` }} />
            <span className="relative flex h-[calc(100%-12px)] w-[calc(100%-12px)] flex-col items-center justify-center rounded-full bg-[#93000a] text-white">
              <span className="material-symbols-outlined text-4xl">{sent ? 'check_circle' : 'sos'}</span>
              <span className="mt-1 text-xl font-black">{sent ? 'SENT' : 'SOS'}</span>
              <span className="text-[10px] font-bold tracking-widest">{sent ? 'HELP REQUESTED' : 'HOLD TO SEND'}</span>
            </span>
          </button>
          <p className="mt-3 text-xs text-[#ab8986]">{sent ? 'Responders have been alerted.' : 'Hold for 1.4 seconds to prevent accidental alerts.'}</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onToggleOffline(!isOffline)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#2f3543] bg-[#161b29] text-sm font-bold">
            <span className="material-symbols-outlined text-[#ffb95f]">{isOffline ? 'cloud_off' : 'cloud'}</span>{isOffline ? 'Offline mode' : 'Online mode'}
          </button>
          <button onClick={toggleSiren} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-bold ${sirenOn ? 'border-[#ff5451] bg-[#93000a] text-white' : 'border-[#2f3543] bg-[#161b29]'}`}>
            <span className="material-symbols-outlined">campaign</span>{sirenOn ? 'Stop alarm' : 'Sound alarm'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-[#ab8986]">For immediate danger, call your local emergency number when a call is possible.</p>
      </div>
    </main>
  );
}
