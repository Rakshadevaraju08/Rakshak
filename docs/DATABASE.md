# DATABASE STRUCTURE

## Purpose
MySQL stores the core structured data of the Disaster Response Agent. It is managed using Prisma ORM.

## Major Entities

### Users
- **User:** Citizens, operators, and admins interacting with the system.

### Incidents
- **Incident:** The core entity representing a disaster event.
- **IncidentReport:** Subsequent updates or SOS reports related to an Incident.

### Resources & Hospitals
- **Resource, Ambulance, RescueTeam:** Assets that can be deployed.
- **Hospital, HospitalCapacity:** Medical facilities and their real-time availability.

### Infrastructure & Environment
- **Road:** Stores road status (OPEN, BLOCKED) which impacts routing.
- **WeatherObservation, WaterLevel:** Sensor/API data used for predictions.

### AI & Operational Outcomes
- **Prediction:** Output from the Predictive Agent (e.g., risk levels).
- **DispatchPlan:** The proposed response plan from the Master Coordinator.
- **IncidentOutcome:** Historical data on how the incident was resolved for future learning.
- **MeshMessage:** Batched offline messages received via BLE sync.

## Relationships
- A `User` can report many `Incidents`.
- An `Incident` has many `IncidentReports`, `Predictions`, `DispatchPlans`, and `IncidentOutcomes`.
- An `Incident` can be linked to `Road` blockages.
- A `Resource` specializes into `Ambulance` or `RescueTeam`.
- A `Hospital` has multiple `HospitalCapacity` updates over time.
- A `MeshMessage` eventually resolves to an `Incident`.

## Tables Usage
- **Operational:** Incidents, Resources, Hospitals, Roads.
- **Historical/Outcome:** IncidentOutcome, Predictions (used for logging and self-learning).

*Note: Database schema is flexible. Document assumptions here if structural changes are made.*
