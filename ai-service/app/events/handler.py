import logging
from typing import Optional
from app.events.schemas import EventMessage, EventType
from app.agents.master_coordinator import MasterCoordinator

logger = logging.getLogger("disaster.events")

class EventHandler:
    """
    Base abstraction for processing incoming events from a message broker (Redis).
    """
    def handle_event(self, event: EventMessage) -> None:
        raise NotImplementedError("Subclasses must implement handle_event")

class MasterEventHandler(EventHandler):
    """
    The main router for events. Decides whether to trigger a full re-analysis, 
    update a specific agent's state, or ignore the event.
    """
    def __init__(self, coordinator: MasterCoordinator):
        self.coordinator = coordinator

    def handle_event(self, event: EventMessage) -> None:
        logger.info(f"Received event: {event.type} [{event.event_id}]")
        
        try:
            if event.type == EventType.NEW_INCIDENT:
                self._handle_new_incident(event.payload)
            elif event.type in (EventType.ROAD_BLOCKED, EventType.HOSPITAL_FULL, EventType.RESOURCE_UNAVAILABLE):
                self._handle_infrastructure_change(event.type, event.payload)
            elif event.type in (EventType.WATER_LEVEL_CHANGED, EventType.RAINFALL_CHANGED):
                self._handle_environmental_change(event.type, event.payload)
            else:
                logger.warning(f"Unknown event type: {event.type}")
        except Exception as e:
            logger.error(f"Failed to process event {event.event_id}: {e}", exc_info=True)

    def _handle_new_incident(self, payload: dict) -> None:
        # TODO: Construct DisasterAnalysisRequest from payload and pass to self.coordinator.analyze()
        logger.debug("NEW_INCIDENT handling logic not yet implemented.")

    def _handle_infrastructure_change(self, event_type: EventType, payload: dict) -> None:
        # TODO: Construct ReplanRequest containing updated roads/resources and pass to self.coordinator.reanalyze()
        logger.debug(f"{event_type.value} handling logic not yet implemented.")

    def _handle_environmental_change(self, event_type: EventType, payload: dict) -> None:
        # TODO: Route environmental updates to PredictiveAgent to check for sudden escalation, then optionally replan.
        logger.debug(f"{event_type.value} handling logic not yet implemented.")
