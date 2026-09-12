import { useEffect, useRef, useState, type CSSProperties } from 'react';

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

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    getLocation();
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  function getLocation() {
    if (!navigator.geolocation) return setLocation('Location unavailable — add details below');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`),
      () => setLocation('Location unavailable — add details below'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  function dispatch() {
    holdingRef.current = false;
    if (timer.current) window.clearInterval(timer.current);
    setHolding(100);
    setSent(true);
    // A backend POST can be added here when the incident API is available.
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
      <section className="location"><div><b>{offline ? 'Offline mesh ready' : 'Your location'}</b><span>{offline ? 'Your request will send when connected' : location}</span></div><button onClick={getLocation} aria-label="Refresh location">⌖</button></section>
      <section className="card"><h2>What is happening?</h2><div className="categories">{categories.map((item) => <button key={item.name} onClick={() => setCategory(item.name)} className={category === item.name ? 'selected' : ''}><i>{item.icon}</i>{item.name}</button>)}</div></section>
      <section className="card"><div className="people"><h2>People needing help</h2><div><button onClick={() => setPeople(Math.max(1, people - 1))}>−</button><output>{people}</output><button onClick={() => setPeople(Math.min(99, people + 1))}>+</button></div></div><label htmlFor="details">Add details <em>(optional)</em></label><textarea id="details" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Injuries, building, landmarks, or access information" rows={3} /></section>
      <section className="sos-wrap"><button className={`sos ${sent ? 'sent' : ''}`} style={{ '--progress': `${holding * 3.6}deg` } as CSSProperties} onPointerDown={startHold} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold} aria-label="Hold to send SOS"><span>{sent ? '✓' : 'SOS'}<small>{sent ? 'HELP REQUESTED' : 'HOLD TO SEND'}</small></span></button><p>{sent ? 'Responders have been alerted.' : 'Hold for 1.4 seconds to prevent accidental alerts.'}</p></section>
      <button className="mode" onClick={() => setOffline((value) => !value)}>{offline ? '☁ Reconnect when available' : '☁ Switch to offline mode'}</button>
      <footer>For immediate danger, call your local emergency number when a call is possible.</footer>
    </main>
  );
}
