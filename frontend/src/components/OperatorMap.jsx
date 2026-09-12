import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function RecenterMap({ region }) {
  const map = useMap();

  useEffect(() => {
    map.setView(region.center, region.zoom, { animate: true });
  }, [map, region]);

  return null;
}

export default function OperatorMap({ region }) {
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 p-4">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-widest text-secondary">ASSIGNED JURISDICTION</p>
          <h2 className="mt-1 text-lg font-bold">{region.label}</h2>
        </div>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300">LIVE MAP</span>
      </div>
      <div className="h-[430px] w-full bg-surface-container-high">
        <MapContainer center={region.center} zoom={region.zoom} scrollWheelZoom className="h-full w-full" aria-label={`Map for ${region.label}`}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap region={region} />
          <Circle center={region.center} radius={region.radius} pathOptions={{ color: '#0566d9', fillColor: '#0566d9', fillOpacity: 0.09, weight: 2 }} />
          {region.incidents.map((incident) => (
            <CircleMarker key={incident.id} center={incident.position} radius={10} pathOptions={{ color: '#fff', weight: 2, fillColor: incident.priority === 'P1' ? '#e53935' : '#f59e0b', fillOpacity: 1 }}>
              <Popup><strong>{incident.id}: {incident.title}</strong><br />{incident.priority} · {incident.status}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 p-3 font-mono text-[10px] text-outline">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> P1 critical incident</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Active incident</span>
        <span>Viewport: {region.center[0].toFixed(4)}, {region.center[1].toFixed(4)}</span>
      </div>
    </section>
  );
}
