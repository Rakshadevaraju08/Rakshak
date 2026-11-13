# Database schema

The backend uses Prisma with a MySQL database. The schema focuses on disaster incidents, operational resources, hospitals, dispatch plans, and live environmental observations.

## Core entities

### User

Stores user identity, role, and account metadata.

- `id`
- `email`
- `name`
- `passwordHash`
- `role`
- `createdAt`
- `updatedAt`

### Incident

Represents a disaster or emergency event reported by a citizen or operator.

- `id`
- `title`
- `description`
- `status`
- `locationLat`
- `locationLng`
- `type`
- `victimCount`
- `elderlyCount`
- `childrenCount`
- `disabledCount`
- `waterLevel`
- `rainfall`
- `roadAccess`
- `reporterId`
- `createdAt`
- `updatedAt`

### IncidentReport

Stores narrative updates tied to an incident.

### Resource

Represents a responder unit such as an ambulance or rescue team.

- `id`
- `type`
- `status`
- `name`
- `locationLat`
- `locationLng`

### Ambulance and RescueTeam

Subtype records for specific resource capabilities.

### Hospital

Stores facility metadata and where residents or casualties may be transferred.

### HospitalCapacity

Tracks total and available bed capacity over time.

### Road

Represents a road segment with a status such as `OPEN`, `BLOCKED`, or `HAZARDOUS`.

### WeatherObservation

Collects rainfall observations for a location and timestamp.

### WaterLevel

Tracks environmental water elevation readings.

### Prediction

Stores risk predictions and worsening intelligence generated during analysis.

### DispatchPlan

Stores the AI-generated response plan in JSON form and tracks status transitions.

### IncidentOutcome

Records resolution details after an incident is closed.

### MeshMessage

Stores queued offline messages submitted by devices that are temporarily disconnected.

## Relationship highlights

- One `User` may own many `Incident` records.
- One `Incident` may have many `IncidentReport`, `Prediction`, `DispatchPlan`, and `IncidentOutcome` records.
- One `Resource` can have one or more specialized sub-records such as `Ambulance` or `RescueTeam`.
- One `Hospital` may have many historical `HospitalCapacity` entries.
- `Road` and `Prediction` entries are connected to incidents for route and risk analysis.

## Migration and maintenance

The schema is defined in `backend/prisma/schema.prisma`. Use Prisma commands to push schema updates locally:

```bash
cd backend
npx prisma db push
npx prisma generate
```

This gives the application a predictable data model for the API and the AI integration.
