import math
from typing import List, Dict, Any, Tuple
from ortools.linear_solver import pywraplp
from app.schemas.domain import Incident, Resource, ResourceStatus, IncidentType, ResourceType, Priority

class OptimizationService:
    def __init__(self):
        # Define base compatibility for incidents and resources
        self.compatibility = {
            IncidentType.FIRE: [ResourceType.FIRE_TRUCK, ResourceType.RESCUE_TEAM],
            IncidentType.FLOOD: [ResourceType.RESCUE_BOAT, ResourceType.RESCUE_TEAM],
            IncidentType.MEDICAL: [ResourceType.AMBULANCE, ResourceType.MEDICAL_TEAM],
            IncidentType.EARTHQUAKE: [ResourceType.RESCUE_TEAM, ResourceType.MEDICAL_TEAM],
            IncidentType.OTHER: [r for r in ResourceType]
        }

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        # Simple Euclidean distance for the prototype
        if None in (lat1, lon1, lat2, lon2):
            return 999.0
        return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111.0  # Approx km

    def optimize_dispatch(self, incidents: List[Tuple[Incident, int]], resources: List[Resource]) -> Dict[str, Any]:
        """
        Solves the assignment problem to dispatch resources to incidents.
        incidents: List of tuples (Incident, priority_value_1_to_5)
        """
        solver = pywraplp.Solver.CreateSolver('SCIP')
        if not solver:
            raise RuntimeError("OR-Tools SCIP solver not available.")

        # Filter available resources
        available_resources = [r for r in resources if r.status == ResourceStatus.AVAILABLE]

        # x[i][j] = 1 if resource i is assigned to incident j
        x = {}
        for r_idx, res in enumerate(available_resources):
            for i_idx, (inc, _) in enumerate(incidents):
                x[r_idx, i_idx] = solver.IntVar(0, 1, f'x_{r_idx}_{i_idx}')

        # Constraint 1: Each available resource assigned to at most 1 incident
        for r_idx in range(len(available_resources)):
            solver.Add(sum(x[r_idx, i_idx] for i_idx in range(len(incidents))) <= 1)

        # Constraint 2: Each incident gets at most 1 resource (for this simple model)
        # Note: Future versions can expand this to required resource counts.
        for i_idx in range(len(incidents)):
            solver.Add(sum(x[r_idx, i_idx] for r_idx in range(len(available_resources))) <= 1)

        # Objective Function
        objective = solver.Objective()
        for r_idx, res in enumerate(available_resources):
            for i_idx, (inc, priority) in enumerate(incidents):
                # 1. Travel Distance Penalty
                distance = self._calculate_distance(res.latitude, res.longitude, inc.latitude, inc.longitude)
                
                # 2. Priority Reward (higher priority = lower cost)
                # Priority 1 (highest) gives highest reward
                priority_reward = (6 - priority) * 1000.0

                # 3. Compatibility Penalty
                compatible_types = self.compatibility.get(inc.type, [])
                is_compatible = res.type in compatible_types
                compatibility_penalty = 0.0 if is_compatible else 10000.0

                cost = distance + compatibility_penalty - priority_reward
                objective.SetCoefficient(x[r_idx, i_idx], cost)

        objective.SetMinimization()
        
        status = solver.Solve()

        assignments = []
        assigned_incidents = set()

        if status == pywraplp.Solver.OPTIMAL or status == pywraplp.Solver.FEASIBLE:
            for r_idx, res in enumerate(available_resources):
                for i_idx, (inc, _) in enumerate(incidents):
                    if x[r_idx, i_idx].solution_value() > 0.5:
                        distance = self._calculate_distance(res.latitude, res.longitude, inc.latitude, inc.longitude)
                        assignments.append({
                            "resource": res,
                            "incident": inc,
                            "distance_km": distance
                        })
                        assigned_incidents.add(inc.id)

        # Identify unfulfilled incidents
        unfulfilled = [inc for inc, _ in incidents if inc.id not in assigned_incidents]

        return {
            "assignments": assignments,
            "unfulfilled_incidents": unfulfilled
        }
