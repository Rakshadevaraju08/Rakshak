import React, { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, Marker, MapContainer, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PriorityBadge, StatusBadge } from './ui/Badge';

// Helper component to recenter the map dynamically
function MapController({ center, zoom, selectedIncident }) {
  const map = useMap();

  useEffect(() => {
    if (selectedIncident && selectedIncident.locationLat != null && selectedIncident.locationLng != null) {
      map.flyTo([selectedIncident.locationLat, selectedIncident.locationLng], 14, { animate: true, duration: 1.5 });
    } else if (center) {
      map.flyTo(center, zoom || 12, { animate: true });
    }
  }, [map, center, zoom, selectedIncident]);

  return null;
}

// Generate simple SVG icons for distinct entity types to avoid external image loading issues
const createHospitalIcon = () => L.divIcon({
  html: `<div style="background-color:#14b8a6; color:white; width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">H</div>`,
  className: 'custom-leaflet-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const createResourceIcon = () => L.divIcon({
  html: `<div style="background-color:#3b82f6; width:16px; height:16px; border-radius:50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  className: 'custom-leaflet-icon',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Priority color mapping
const getPriorityColor = (priority) => {
  const colors = {
    'P5': '#e53935', // Red
    'P4': '#f97316', // Orange
    'P3': '#f59e0b', // Amber
    'P2': '#3b82f6', // Blue
    'P1': '#94a3b8'  // Slate
  };
  return colors[priority] || colors['P2'];
};

export default function OperatorMap({ 
  regionCenter = [12.2958, 76.6394], 
  zoom = 12,
  jurisdictionRadius = 11000,
  incidents = [], 
  resources = [], 
  hospitals = [], 
  routes = [],
  selectedIncidentId = null,
  onIncidentSelect
}) {
  
  const selectedIncident = useMemo(() => 
    incidents.find(i => i.id === selectedIncidentId), 
  [incidents, selectedIncidentId]);

  const hospitalIcon = useMemo(() => createHospitalIcon(), []);
  const resourceIcon = useMemo(() => createResourceIcon(), []);

  return (
    <div className="flex h-full w-full flex-col bg-surface-container-high relative z-0">
      <MapContainer 
        center={regionCenter} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        className="h-full w-full z-0" 
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark" // We can apply CSS filters to make it dark mode later
        />
        
        <MapController center={regionCenter} zoom={zoom} selectedIncident={selectedIncident} />

        {/* Jurisdiction Boundary */}
        <Circle 
          center={regionCenter} 
          radius={jurisdictionRadius} 
          pathOptions={{ color: '#0566d9', fillColor: '#0566d9', fillOpacity: 0.05, weight: 1, dashArray: '5, 10' }} 
        />

        {/* Route Placeholder Layer */}
        {routes.map(route => (
          <Polyline 
            key={route.id}
            positions={route.coordinates}
            pathOptions={{ color: '#a855f7', weight: 4, dashArray: '10, 10', opacity: 0.7 }}
          />
        ))}

        {/* Hospitals Layer */}
        {hospitals.map(hospital => (
          <Marker 
            key={hospital.id} 
            position={[hospital.locationLat, hospital.locationLng]}
            icon={hospitalIcon}
          >
            <Popup className="custom-popup">
              <div className="text-on-surface">
                <strong className="block text-sm">{hospital.name}</strong>
                <span className="text-xs text-on-surface-variant">Capacity: {hospital.availableBeds} / {hospital.totalBeds} beds</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Resources Layer */}
        {resources.map(resource => (
          <Marker 
            key={resource.id} 
            position={[resource.locationLat, resource.locationLng]}
            icon={resourceIcon}
          >
            <Popup className="custom-popup">
              <div className="text-on-surface">
                <strong className="block text-sm">{resource.name}</strong>
                <span className="text-xs text-on-surface-variant">{resource.type} · {resource.status}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incidents Layer */}
        {incidents.filter(inc => inc.locationLat != null && inc.locationLng != null).map(incident => {
          const isSelected = selectedIncidentId === incident.id;
          const color = getPriorityColor(incident.priority);
          
          return (
            <CircleMarker 
              key={incident.id} 
              center={[incident.locationLat, incident.locationLng]} 
              radius={isSelected ? 14 : 10} 
              pathOptions={{ 
                color: isSelected ? '#ffffff' : color, 
                weight: isSelected ? 3 : 2, 
                fillColor: color, 
                fillOpacity: isSelected ? 1 : 0.8 
              }}
              eventHandlers={{
                click: () => onIncidentSelect && onIncidentSelect(incident.id)
              }}
            >
              <Popup className="custom-popup min-w-[200px]">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <PriorityBadge level={incident.priority} />
                    <StatusBadge status={incident.status} />
                  </div>
                  <strong className="block text-sm leading-tight">{incident.title}</strong>
                  <p className="text-xs text-on-surface-variant">{incident.description || 'No description'}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2 rounded-lg border border-outline-variant/30 bg-surface-container/90 p-3 shadow-lg backdrop-blur text-xs font-mono">
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-[var(--color-priority-p5)] border border-white"></div> Critical Incident</div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-[var(--color-priority-p3)] border border-white"></div> Active Incident</div>
        <div className="flex items-center gap-2"><div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#14b8a6] text-[8px] font-bold text-white">H</div> Hospital</div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-[#3b82f6] border border-white"></div> Rescue Resource</div>
        <div className="flex items-center gap-2"><div className="h-1 w-6 border-t-2 border-dashed border-[#a855f7]"></div> Active Route</div>
      </div>
    </div>
  );
}
