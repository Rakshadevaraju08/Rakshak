const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log("Creating incident...");
  const incident = await prisma.incident.create({
    data: {
      title: "Test Flood",
      description: "Severe flooding in downtown",
      type: "FLOOD",
      locationLat: 12.9716,
      locationLng: 77.5946,
      victimCount: 5,
      waterLevel: 2.5,
      rainfall: 120.5
    }
  });
  
  console.log("Created Incident:", incident.id);
  
  const token = "mock-token"; // Not actually authenticated in the script if we just test the route, but wait, the route has `ops` middleware which checks authentication.

  // It's easier to just call the API using fetch if the backend is running, but we need to authenticate.
  // Instead of dealing with tokens, let's just test `ai.js` directly!
  const { requestAIAnalysis } = require('./src/services/ai');
  
  // Set the env var for the test
  process.env.AI_SERVICE_URL = "http://localhost:8000";

  const context = {
    incident: {
      id: incident.id,
      type: incident.type,
      latitude: incident.locationLat,
      longitude: incident.locationLng,
      victim_count: incident.victimCount,
      elderly_count: 0,
      children_count: 0,
      disabled_count: 0,
      water_level: incident.waterLevel,
      rainfall: incident.rainfall,
      road_access: "OPEN"
    },
    resources: [],
    hospitals: [],
    roads: [],
    environment: {}
  };

  console.log("Calling AI Service...");
  try {
    const result = await requestAIAnalysis(context);
    console.log("AI Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("AI call failed:", err);
  }
}

runTest().finally(() => prisma.$disconnect());
