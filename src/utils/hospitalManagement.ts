import type { Hospital, Resource } from '../services/api';

export const NO_STATUS_FILTER = '__NO_STATUS__';

export interface HospitalBedMetrics {
  occupiedBeds: number;
  occupancyPercent: number;
}

export interface HospitalCapacitySummary extends HospitalBedMetrics {
  totalBeds: number;
  availableBeds: number;
  hospitalCount: number;
}

function getUsableCapacity(hospital: Hospital): { totalBeds: number; availableBeds: number } | null {
  const capacity = hospital.capacity;
  if (
    !capacity ||
    capacity.totalBeds === null ||
    capacity.available === null ||
    capacity.totalBeds < 0 ||
    capacity.available < 0 ||
    capacity.available > capacity.totalBeds
  ) {
    return null;
  }

  return {
    totalBeds: capacity.totalBeds,
    availableBeds: capacity.available,
  };
}

export function getHospitalBedMetrics(hospital: Hospital): HospitalBedMetrics | null {
  const capacity = getUsableCapacity(hospital);
  if (!capacity) return null;

  const occupiedBeds = capacity.totalBeds - capacity.availableBeds;
  return {
    occupiedBeds,
    occupancyPercent: capacity.totalBeds === 0
      ? 0
      : Math.round((occupiedBeds / capacity.totalBeds) * 100),
  };
}

export function getHospitalCapacitySummary(hospitals: Hospital[]): HospitalCapacitySummary | null {
  const capacities = hospitals.flatMap(hospital => {
    const capacity = getUsableCapacity(hospital);
    return capacity ? [capacity] : [];
  });
  if (capacities.length === 0) return null;

  const totalBeds = capacities.reduce((total, capacity) => total + capacity.totalBeds, 0);
  const availableBeds = capacities.reduce((total, capacity) => total + capacity.availableBeds, 0);
  const occupiedBeds = totalBeds - availableBeds;

  return {
    hospitalCount: capacities.length,
    totalBeds,
    availableBeds,
    occupiedBeds,
    occupancyPercent: totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100),
  };
}

export function filterHospitals(hospitals: Hospital[], query: string): Hospital[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return hospitals;

  return hospitals.filter(hospital => {
    const location = hospital.locationLat !== null && hospital.locationLng !== null
      ? `lat ${hospital.locationLat}, long ${hospital.locationLng}`
      : '';
    return `${hospital.name} ${location}`.toLocaleLowerCase().includes(normalizedQuery);
  });
}

export function filterResourcesByStatus(resources: Resource[], status: string): Resource[] {
  if (!status) return resources;
  return resources.filter(resource => (resource.status ?? NO_STATUS_FILTER) === status);
}
