import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { enqueueSOS, getQueueCount, syncQueue } from './services/queue';

type Category = 'Medical' | 'Flood' | 'Fire' | 'Trapped' | 'Other';

const categories: Array<{ name: Category; icon: string }> = [
  { name: 'Medical', icon: '✚' }, { name: 'Flood', icon: '≈' }, { name: 'Fire', icon: '♨' },
  { name: 'Trapped', icon: '!' }, { name: 'Other', icon: '•••' },
];

export default function App() {
  const [category, setCategory] = useState<Category>('Medical');
  const [people, setPeople] = useState(1);
  const [details, setDetails] = useState('');
  const [location, setLocation] = useState('Finding your location…');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [holding, setHolding] = useState(0);
  const [sent, setSent] = useState(false);
  const holdingRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const latestQueuedSOSId = useRef<string | null>(null);

  const [queueCount, setQueueCount] = useState(0);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      setOffline(!navigator.onLine);
      void syncPendingSOS();
    };
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    getLocation();
    void updateQueueCount().then((error) => {
      if (error) setSyncError(error);
    });
    
    // Auto-sync interval for mesh gateways (every 10s)
    const syncInterval = window.setInterval(() => {
      if (navigator.onLine) void syncPendingSOS();
    }, 10000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (timer.current) window.clearInterval(timer.current);
      window.clearInterval(syncInterval);
    };
  }, []);
  
  async function updateQueueCount(): Promise<string | null> {
    try {
      setQueueCount(await getQueueCount());
      return null;
    } catch (error) {
      console.error('Unable to read the SOS queue:', error);
      const reason = error instanceof Error ? ` ${error.message}` : '';
      return `Unable to refresh the saved SOS queue.${reason}`;
    }
  }

  async function syncPendingSOS() {
    if (!navigator.onLine) {
      const queueError = await updateQueueCount();
      if (queueError) setSyncError(queueError);
      return;
    }

    let result: Awaited<ReturnType<typeof syncQueue>>;
    try {
      result = await syncQueue();
    } catch (error) {
      console.error('Unable to sync the SOS queue:', error);
      const reason = error instanceof Error ? ` ${error.message}` : '';
      result = { acceptedIds: [], error: `Unable to sync saved SOS requests; they remain on this device.${reason}` };
    }

    if (latestQueuedSOSId.current && result.acceptedIds.includes(latestQueuedSOSId.current)) {
      setDeliveryStatus('SOS accepted by the backend.');
      latestQueuedSOSId.current = null;
    }

    const queueError = await updateQueueCount();
    setSyncError(result.error ?? queueError);
  }

  function getLocation() {
    if (!navigator.geolocation) return setLocation('Location unavailable — add an address or landmark in details');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`),
      () => setLocation('Location unavailable — add an address or landmark in details'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  async function dispatch() {
    holdingRef.current = false;
    if (timer.current) window.clearInterval(timer.current);
    setHolding(100);
    let queuedSOS: Awaited<ReturnType<typeof enqueueSOS>>;
    try {
      queuedSOS = await enqueueSOS({ category, people, details, location });
    } catch (error) {
      console.error('Unable to save SOS to the local queue:', error);
      const reason = error instanceof Error ? ` ${error.message}` : '';
      setSyncError(`Unable to save SOS on this device.${reason}`);
      setHolding(0);
      return;
    }
    
    latestQueuedSOSId.current = queuedSOS.id;
    setDeliveryStatus('SOS saved on this device and waiting for delivery.');
    setSyncError(null);
    setSent(true);

    const queueError = await updateQueueCount();
    if (queueError) setSyncError(queueError);
    if (navigator.onLine) await syncPendingSOS();

    window.setTimeout(() => { setSent(false); setHolding(0); }, 5000);
  }

  function startHold() {
    if (sent) return;
    holdingRef.current = true;
    const start = Date.now();
    timer.current = window.setInterval(() => {
      if (!holdingRef.current) return;
      const progress = Math.min(100, ((Date.now() - start) / 1400) * 100);
      setHolding(progress);
      if (progress >= 100) dispatch();
    }, 30);
  }

  function endHold() {
    holdingRef.current = false;
    if (timer.current) window.clearInterval(timer.current);
    if (!sent) setHolding(0);
  }

  return (
    <main>
      <header><span className="logo">✦</span><div><strong>DisasterLink</strong><small>EMERGENCY SUPPORT</small></div><span className={`status ${offline ? 'offline' : ''}`}>{offline ? 'OFFLINE' : 'ONLINE'}</span></header>
      <section className="hero"><p>EMERGENCY ASSISTANCE</p><h1>Help is one hold away.</h1><span>Hold SOS to securely share your location and emergency details with responders.</span></section>
      <section className="location"><div><b>{offline ? `Offline mesh ready (${queueCount} queued)` : 'Your location'}</b><span>{offline ? (queueCount > 0 ? 'Connecting to mesh gateway...' : 'Your request will send when connected') : location}</span></div><button onClick={getLocation} aria-label="Refresh location">⌖</button></section>
      {(deliveryStatus || syncError) && <p role="status" aria-live="polite" style={{ margin: '-4px 2px 14px', color: syncError ? '#ffcf89' : '#aeb8cf', fontSize: 12, lineHeight: 1.45 }}>{syncError ?? deliveryStatus}</p>}
      <section className="card"><h2>What is happening?</h2><div className="categories">{categories.map((item) => <button key={item.name} onClick={() => setCategory(item.name)} className={category === item.name ? 'selected' : ''}><i>{item.icon}</i>{item.name}</button>)}</div></section>
      <section className="card"><div className="people"><h2>People needing help</h2><div><button onClick={() => setPeople(Math.max(1, people - 1))}>−</button><output>{people}</output><button onClick={() => setPeople(Math.min(99, people + 1))}>+</button></div></div><label htmlFor="details">Add details <em>(optional)</em></label><textarea id="details" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Injuries, building, landmarks, or your location if GPS is unavailable" rows={3} /></section>
      <section className="sos-wrap"><button className={`sos ${sent ? 'sent' : ''}`} style={{ '--progress': `${holding * 3.6}deg` } as CSSProperties} onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold} aria-label="Hold to send SOS"><span>{sent ? '✓' : 'SOS'}<small>{sent ? (deliveryStatus === 'SOS accepted by the backend.' ? 'ACCEPTED' : 'SAVED LOCALLY') : 'HOLD TO SEND'}</small></span></button><p>{sent ? deliveryStatus : 'Hold for 1.4 seconds to prevent accidental alerts.'}</p></section>
      <button className="mode" onClick={() => setOffline((value) => !value)}>{offline ? '☁ Reconnect when available' : '☁ Switch to offline mode'}</button>
      <footer>For immediate danger, call your local emergency number when a call is possible.</footer>
    </main>
  );
}
