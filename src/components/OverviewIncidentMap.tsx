import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident } from '../services/api';

type Coordinates = [number, number];

function isValidLocation(incident: Incident): incident is Incident & {
  locationLat: number;
  locationLng: number;
} {
  return typeof incident.locationLat === 'number'
    && Number.isFinite(incident.locationLat)
    && incident.locationLat >= -90
    && incident.locationLat <= 90
    && typeof incident.locationLng === 'number'
    && Number.isFinite(incident.locationLng)
    && incident.locationLng >= -180
    && incident.locationLng <= 180;
}

function statusColor(status?: string | null): string {
  switch (status?.toUpperCase()) {
    case 'NEW':
      return '#4389b0';
    case 'ACTIVE':
      return '#d58a3d';
    case 'RESOLVED':
      return '#55a184';
    default:
      return '#7b8fa2';
  }
}

function MapBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }, [bounds, map]);

  return null;
}

export default function OverviewIncidentMap({ incidents }: { incidents: Incident[] }) {
  const locatedIncidents = useMemo(() => incidents.filter(isValidLocation), [incidents]);
  const positions = useMemo<Coordinates[]>(
    () => locatedIncidents.map(incident => [incident.locationLat, incident.locationLng]),
    [locatedIncidents],
  );
  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (positions.length === 0) return null;
    return positions.length === 1 ? [positions[0], positions[0]] : positions;
  }, [positions]);

  if (positions.length === 0 || !bounds) {
    return (
      <div className="overview-map-state">
        {incidents.length === 0
          ? 'No incident locations to display.'
          : 'No incidents have valid coordinates to display.'}
      </div>
    );
  }

  return (
    <>
      <div className="overview-map">
        <MapContainer
          center={positions[0]}
          zoom={5}
          scrollWheelZoom={false}
          aria-label="Map of incident locations"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds bounds={bounds} />
          {locatedIncidents.map(incident => (
            <CircleMarker
              key={incident.id}
              center={[incident.locationLat, incident.locationLng]}
              radius={8}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: statusColor(incident.status),
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="overview-map-popup">
                  <strong>{incident.title}</strong>
                  <span>{incident.type || 'Type not provided'}</span>
                  <span>{incident.status || 'Status not provided'}</span>
                  <Link to="/incidents">View in Incident Management</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="overview-map-legend" aria-label="Incident status marker colors">
        <span><i className="status-indicator-new" />New</span>
        <span><i className="status-indicator-active" />Active</span>
        <span><i className="status-indicator-resolved" />Resolved</span>
        <span><i className="status-indicator-unknown" />Other / not provided</span>
      </div>
    </>
  );
}
