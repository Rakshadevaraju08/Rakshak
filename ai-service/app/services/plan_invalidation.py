"""
Plan Invalidation Service

Compares a previous FullResponsePlan against an updated DisasterAnalysisRequest
to explicitly identify reasons why the previous plan is no longer valid or optimal.

All field accesses are aligned with the actual Pydantic schema in domain.py.
"""
from typing import List, Set

from app.schemas.domain import (
    FullResponsePlan,
    DisasterAnalysisRequest,
    ResourceStatus,
    RoadAccessStatus,
)


def _previously_routed_hospital_ids(previous_plan: FullResponsePlan) -> Set[str]:
    """
    Extract hospital IDs that were routed to in the previous plan.
    We infer this from ResourceAssignment.route.destination_id, which is
    set to the hospital ID when the route target is a hospital.
    """
    hospital_ids: Set[str] = set()
    for assignment in previous_plan.assignments:
        dest = assignment.route.destination_id
        # Heuristic: destination IDs that start with "HOSP" or are recognised
        # as hospital IDs are considered hospital destinations. In the real
        # pipeline, destination_id is set to hospital.id by route_agent.
        if dest and ("HOSP" in dest.upper() or dest.startswith("H_")):
            hospital_ids.add(dest)
    return hospital_ids


def check_plan_invalidation(
    previous_plan: FullResponsePlan,
    updated_state: DisasterAnalysisRequest,
) -> List[str]:
    """
    Returns a list of human-readable invalidation reasons.
    Each string begins with "Previous plan invalidated because …".

    Checks (in order):
      1. Road access became BLOCKED when previous routes were open.
      2. A previously assigned resource is now DISPATCHED or MAINTENANCE.
      3. Water level rose significantly (>= 0.3 m) compared to the previous plan observation.
      4. Rainfall increased significantly (>= 10 mm) compared to the previous plan observation.
      5. A hospital that was routed to in the previous plan now has zero available beds.
      6. Stale data warnings were already present in the previous plan.
    """
    invalidations: List[str] = []

    # ------------------------------------------------------------------ #
    # 1. Road access became BLOCKED                                        #
    #    Previous plan had routed assignments; now road_access is BLOCKED. #
    # ------------------------------------------------------------------ #
    new_road_access = updated_state.incident.road_access
    prev_had_routes = bool(previous_plan.assignments)

    if new_road_access == RoadAccessStatus.BLOCKED and prev_had_routes:
        invalidations.append(
            "Previous plan invalidated because road access became BLOCKED."
        )

    # ------------------------------------------------------------------ #
    # 2. An assigned resource is now unavailable (DISPATCHED/MAINTENANCE) #
    # ------------------------------------------------------------------ #
    assigned_ids = {a.resource_id for a in previous_plan.assignments}
    for res in updated_state.resources:
        if res.id in assigned_ids and res.status in (
            ResourceStatus.DISPATCHED,
            ResourceStatus.MAINTENANCE,
        ):
            invalidations.append(
                f"Previous plan invalidated because assigned resource {res.id} "
                f"is now {res.status.value}."
            )

    # ------------------------------------------------------------------ #
    # 3. Water level rose significantly                                    #
    #    New state incident water_level vs. provenance from previous plan  #
    # ------------------------------------------------------------------ #
    if updated_state.incident.water_level is not None:
        new_wl = updated_state.incident.water_level.value
        old_wl: float | None = None

        # Try to parse previous water level from provenance strings
        if previous_plan.data_quality and previous_plan.data_quality.provenance:
            for prov in previous_plan.data_quality.provenance:
                if prov.startswith("water_level:"):
                    try:
                        old_wl = float(prov.split(":")[1].strip().split("m")[0])
                    except (ValueError, IndexError):
                        pass

        if old_wl is not None and new_wl >= old_wl + 0.3:
            invalidations.append(
                f"Previous plan invalidated because water level rose from "
                f"{old_wl}m to {new_wl}m."
            )
        elif old_wl is None and new_wl >= 2.0:
            # No provenance recorded; flag a dangerous absolute level
            invalidations.append(
                f"Previous plan invalidated because water level is now at "
                f"dangerous level ({new_wl}m)."
            )

    # ------------------------------------------------------------------ #
    # 4. Rainfall increased significantly                                  #
    # ------------------------------------------------------------------ #
    if updated_state.incident.rainfall is not None:
        new_rain = updated_state.incident.rainfall.value
        old_rain: float | None = None

        if previous_plan.data_quality and previous_plan.data_quality.provenance:
            for prov in previous_plan.data_quality.provenance:
                if prov.startswith("rainfall:"):
                    try:
                        old_rain = float(prov.split(":")[1].strip().split("mm")[0])
                    except (ValueError, IndexError):
                        pass

        if old_rain is not None and new_rain >= old_rain + 10.0:
            invalidations.append(
                f"Previous plan invalidated because rainfall significantly "
                f"increased from {old_rain}mm to {new_rain}mm."
            )

    # ------------------------------------------------------------------ #
    # 5. Hospital routed to in previous plan is now full                  #
    # ------------------------------------------------------------------ #
    prev_hospital_ids = _previously_routed_hospital_ids(previous_plan)
    if prev_hospital_ids:
        for hospital in updated_state.hospitals:
            if hospital.id in prev_hospital_ids and hospital.available_beds == 0:
                invalidations.append(
                    f"Previous plan invalidated because Hospital {hospital.name} "
                    f"({hospital.id}) now has no available beds."
                )

    # ------------------------------------------------------------------ #
    # 6. Previous plan already had stale / conflicting data warnings      #
    # ------------------------------------------------------------------ #
    stale_codes = {"STALE_DATA", "DATA_CONFLICT", "MISSING_FIELD"}
    if previous_plan.warnings:
        for w in previous_plan.warnings:
            if hasattr(w, "code") and str(w.code) in stale_codes:
                invalidations.append(
                    f"Previous plan invalidated because of stale/conflicting data: {w.message}"
                )
                break  # one stale flag is enough

    return invalidations
