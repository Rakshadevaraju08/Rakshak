const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const hospitals = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Rakshak Demo Hospital - Guwahati',
    locationLat: 26.1445,
    locationLng: 91.7362,
    capacity: {
      id: '10000000-0000-4000-8000-000000000001',
      totalBeds: 420,
      available: 116,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Rakshak Demo Regional Medical Centre - Jorhat',
    locationLat: 26.7509,
    locationLng: 94.2037,
    capacity: {
      id: '10000000-0000-4000-8000-000000000002',
      totalBeds: 280,
      available: 84,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Rakshak Demo District Hospital - Silchar',
    locationLat: 24.8333,
    locationLng: 92.7789,
    capacity: {
      id: '10000000-0000-4000-8000-000000000003',
      totalBeds: 240,
      available: 0,
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Rakshak Demo Community Hospital - Tezpur',
    locationLat: 26.6528,
    locationLng: 92.7926,
    capacity: {
      id: '10000000-0000-4000-8000-000000000004',
      totalBeds: 180,
      available: 53,
    },
  },
];

const resources = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    type: 'AMBULANCE',
    status: 'AVAILABLE',
    name: 'Demo Ambulance 01 - Guwahati North',
    locationLat: 26.184,
    locationLng: 91.743,
    ambulance: {
      id: '30000000-0000-4000-8000-000000000001',
      plateNumber: 'DEMO-AMB-001',
    },
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    type: 'AMBULANCE',
    status: 'DISPATCHED',
    name: 'Demo Ambulance 02 - Jorhat',
    locationLat: 26.75,
    locationLng: 94.21,
    ambulance: {
      id: '30000000-0000-4000-8000-000000000002',
      plateNumber: 'DEMO-AMB-002',
    },
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    type: 'AMBULANCE',
    status: 'MAINTENANCE',
    name: 'Demo Ambulance 03 - Silchar',
    locationLat: 24.833,
    locationLng: 92.779,
    ambulance: {
      id: '30000000-0000-4000-8000-000000000003',
      plateNumber: 'DEMO-AMB-003',
    },
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    type: 'RESCUE_TEAM',
    status: 'AVAILABLE',
    name: 'Demo Flood Rescue Team - Guwahati',
    locationLat: 26.16,
    locationLng: 91.75,
    rescueTeam: {
      id: '40000000-0000-4000-8000-000000000001',
      personnel: 8,
    },
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    type: 'RESCUE_TEAM',
    status: 'AVAILABLE',
    name: 'Demo Medical Response Team - Jorhat',
    locationLat: 26.748,
    locationLng: 94.202,
    rescueTeam: {
      id: '40000000-0000-4000-8000-000000000002',
      personnel: 6,
    },
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    type: 'RESCUE_TEAM',
    status: 'DISPATCHED',
    name: 'Demo Search and Rescue Team - Silchar',
    locationLat: 24.829,
    locationLng: 92.781,
    rescueTeam: {
      id: '40000000-0000-4000-8000-000000000003',
      personnel: 5,
    },
  },
];

function assertSafeDatabaseTarget() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled when NODE_ENV=production.');
  }
  if (process.env.RAKSHAK_ALLOW_DEMO_SEED !== '1') {
    throw new Error('Set RAKSHAK_ALLOW_DEMO_SEED=1 to explicitly allow local demonstration data.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid MySQL URL.');
  }
  const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (databaseUrl.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Demo seeding only accepts a MySQL database on the local machine.');
  }
}

function hasChanged(record, values) {
  return Object.entries(values).some(([key, value]) => record[key] !== value);
}

async function seedDemoData() {
  assertSafeDatabaseTarget();

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      for (const hospital of hospitals) {
        await transaction.hospital.upsert({
          where: { id: hospital.id },
          create: {
            id: hospital.id,
            name: hospital.name,
            locationLat: hospital.locationLat,
            locationLng: hospital.locationLng,
          },
          update: {
            name: hospital.name,
            locationLat: hospital.locationLat,
            locationLng: hospital.locationLng,
          },
        });

        const capacityValues = {
          hospitalId: hospital.id,
          totalBeds: hospital.capacity.totalBeds,
          available: hospital.capacity.available,
        };
        const currentCapacity = await transaction.hospitalCapacity.findUnique({
          where: { id: hospital.capacity.id },
          select: { hospitalId: true, totalBeds: true, available: true },
        });
        if (!currentCapacity) {
          await transaction.hospitalCapacity.create({
            data: { id: hospital.capacity.id, ...capacityValues },
          });
        } else if (hasChanged(currentCapacity, capacityValues)) {
          await transaction.hospitalCapacity.update({
            where: { id: hospital.capacity.id },
            data: capacityValues,
          });
        }
      }

      for (const resource of resources) {
        const { id, ambulance, rescueTeam, ...resourceFields } = resource;
        const currentResource = await transaction.resource.findUnique({
          where: { id },
          select: {
            type: true,
            status: true,
            name: true,
            locationLat: true,
            locationLng: true,
          },
        });
        if (!currentResource) {
          await transaction.resource.create({ data: { id, ...resourceFields } });
        } else if (hasChanged(currentResource, resourceFields)) {
          await transaction.resource.update({ where: { id }, data: resourceFields });
        }

        if (ambulance) {
          await transaction.ambulance.upsert({
            where: { id: ambulance.id },
            create: { ...ambulance, resourceId: id },
            update: { plateNumber: ambulance.plateNumber, resourceId: id },
          });
        }
        if (rescueTeam) {
          await transaction.rescueTeam.upsert({
            where: { id: rescueTeam.id },
            create: { ...rescueTeam, resourceId: id },
            update: { personnel: rescueTeam.personnel, resourceId: id },
          });
        }
      }
    });

    console.log(`Upserted ${hospitals.length} demonstration hospitals and ${resources.length} demonstration resources.`);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
