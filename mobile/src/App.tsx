import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { enqueueSOS, getQueueCount, syncQueue } from './services/queue';

type Category = 'Medical' | 'Flood' | 'Fire' | 'Trapped' | 'Other';

const categories: Array<{ name: Category; icon: string }> = [
  { name: 'Medical', icon: '✚' },
  { name: 'Flood', icon: '≈' },
  { name: 'Fire', icon: '♨' },
  { name: 'Trapped', icon: '!' },
  { name: 'Other', icon: '•••' },
];

export default function App() {
  const [category, setCategory] = useState<Category>('Medical');
  const [people, setPeople] = useState(1);
  const [details, setDetails] = useState('');
  const [location, setLocation] = useState('Finding your location…');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [holding, setHolding] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  const holdingRef = useRef(false);
  const submissionInProgress = useRef(false);
  const isSyncing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const latestQueuedSOSId = useRef<string | null>(null);

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

    const syncInterval = window.setInterval(() => {
      if (navigator.onLine) void syncPendingSOS();
    }, 10000);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (timer.current !== undefined) window.clearInterval(timer.current);
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
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
    if (!navigator.onLine || isSyncing.current) {
      const queueError = await updateQueueCount();
      if (queueError) setSyncError(queueError);
      return;
    }

    isSyncing.current = true;
    setSyncing(true);
    let result: Awaited<ReturnType<typeof syncQueue>>;
    try {
      result = await syncQueue();
    } catch (error) {
      console.error('Unable to sync the SOS queue:', error);
      const reason = error instanceof Error ? ` ${error.message}` : '';
      result = { acceptedIds: [], error: `Unable to sync saved SOS requests; they remain on this device.${reason}` };
    } finally {
      isSyncing.current = false;
      setSyncing(false);
    }

    if (latestQueuedSOSId.current && result.acceptedIds.includes(latestQueuedSOSId.current)) {
      setDeliveryStatus('SOS accepted by the backend.');
      latestQueuedSOSId.current = null;
    }

    const queueError = await updateQueueCount();
    setSyncError(result.error ?? queueError);
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setLocation('Location unavailable — add an address or landmark in details');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`),
      () => setLocation('Location unavailable — add an address or landmark in details'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  async function dispatch() {
    if (submissionInProgress.current || sent) return;

    submissionInProgress.current = true;
    holdingRef.current = false;
    if (timer.current !== undefined) {
      window.clearInterval(timer.current);
      timer.current = undefined;
    }
    setHolding(100);
    setSubmitting(true);

    let queuedSOS: Awaited<ReturnType<typeof enqueueSOS>>;
    try {
      queuedSOS = await enqueueSOS({ category, people, details, location });
    } catch (error) {
      console.error('Unable to save SOS to the local queue:', error);
      const reason = error instanceof Error ? ` ${error.message}` : '';
      setSyncError(`Unable to save SOS on this device.${reason}`);
      setHolding(0);
      setSubmitting(false);
      submissionInProgress.current = false;
      timer.current = undefined;
      return;
    }

    latestQueuedSOSId.current = queuedSOS.id;
    setDeliveryStatus('SOS saved on this device and waiting for delivery.');
    setSyncError(null);
    setSubmitting(false);
    setSent(true);

    feedbackTimer.current = window.setTimeout(() => {
      setSent(false);
      setHolding(0);
      submissionInProgress.current = false;
    }, 5000);

    const queueError = await updateQueueCount();
    if (queueError) setSyncError(queueError);
    if (navigator.onLine) await syncPendingSOS();
  }

  function startHold() {
    if (submissionInProgress.current || sent || timer.current !== undefined) return;

    holdingRef.current = true;
    const start = Date.now();
    timer.current = window.setInterval(() => {
      if (!holdingRef.current) return;
      const progress = Math.min(100, ((Date.now() - start) / 1400) * 100);
      setHolding(progress);
      if (progress >= 100) void dispatch();
    }, 30);
  }

  function endHold() {
    holdingRef.current = false;
    if (timer.current !== undefined) {
      window.clearInterval(timer.current);
      timer.current = undefined;
    }
    if (!submissionInProgress.current && !sent) setHolding(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) startHold();
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    endHold();
  }

  return (
    <main>
      <header className="app-header">
        <span className="logo" aria-hidden="true">✦</span>
        <div className="brand">
          <strong>DisasterLink</strong>
          <small>EMERGENCY SUPPORT</small>
        </div>
        <span className={`status ${offline ? 'offline' : ''}`} role="status">
          {offline ? 'OFFLINE' : 'ONLINE'}
        </span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p>EMERGENCY ASSISTANCE</p>
        <h1 id="page-title">Help is one hold away.</h1>
        <span>Hold SOS to securely share your location and emergency details with responders.</span>
      </section>

      <section className="location" aria-label="Location status">
        <div>
          <b>{offline ? 'Connection unavailable' : 'Your location'}</b>
          <span>{offline ? 'SOS requests are saved here and sent when you reconnect.' : location}</span>
        </div>
        <button className="icon-button" onClick={getLocation} aria-label="Refresh location">⌖</button>
      </section>

      {queueCount > 0 && (
        <div className="queue-note" role="status" aria-live="polite">
          {queueCount} SOS {queueCount === 1 ? 'request is' : 'requests are'} waiting on this device.
        </div>
      )}
      {(deliveryStatus || syncError) && (
        <p
          className={`feedback ${syncError ? 'feedback-error' : ''}`}
          role={syncError ? 'alert' : 'status'}
          aria-live={syncError ? 'assertive' : 'polite'}
        >
          {syncError ?? deliveryStatus}
        </p>
      )}

      <section className="card" aria-labelledby="category-title">
        <h2 id="category-title">What is happening?</h2>
        <div className="categories" role="group" aria-label="Emergency category">
          {categories.map((item) => (
            <button
              key={item.name}
              onClick={() => setCategory(item.name)}
              className={category === item.name ? 'selected' : ''}
              aria-pressed={category === item.name}
            >
              <i aria-hidden="true">{item.icon}</i>{item.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="people-title">
        <div className="people">
          <h2 id="people-title">People needing help</h2>
          <div className="stepper" aria-label="Number of people needing help">
            <button
              onClick={() => setPeople((count) => Math.max(1, count - 1))}
              aria-label="Decrease number of people"
              disabled={people <= 1}
            >−</button>
            <output aria-live="polite">{people}</output>
            <button
              onClick={() => setPeople((count) => Math.min(99, count + 1))}
              aria-label="Increase number of people"
              disabled={people >= 99}
            >+</button>
          </div>
        </div>
        <label htmlFor="details">Add details <em>(optional)</em></label>
        <textarea
          id="details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Injuries, building, landmarks, or your location if GPS is unavailable"
          rows={3}
        />
      </section>

      <section className="sos-wrap" aria-label="Send emergency request">
        <button
          className={`sos ${sent ? 'sent' : ''}`}
          style={{ '--progress': `${holding * 3.6}deg` } as CSSProperties}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={endHold}
          disabled={submitting || sent}
          aria-label={sent ? 'SOS request saved' : 'Hold to send SOS for 1.4 seconds'}
        >
          <span>
            {sent ? '✓' : submitting ? '…' : 'SOS'}
            <small>{sent ? 'SAVED' : submitting ? 'SAVING' : 'HOLD TO SEND'}</small>
          </span>
        </button>
        <p aria-live="polite">
          {sent ? deliveryStatus : submitting ? 'Saving your SOS on this device…' : 'Hold for 1.4 seconds to prevent accidental alerts.'}
        </p>
      </section>

      <button
        className="sync-button"
        onClick={() => void syncPendingSOS()}
        disabled={offline || syncing || queueCount === 0}
      >
        {syncing ? 'Sending saved SOS requests…' : 'Retry saved SOS requests'}
      </button>
      <footer>For immediate danger, call your local emergency number when a call is possible.</footer>
    </main>
  );
}
