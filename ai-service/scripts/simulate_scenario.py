import copy
import json
from fastapi.testclient import TestClient
from app.main import app

def run_simulation():
    client = TestClient(app)
    
    print("=== SCENARIO 1: Heavy Rainfall, Rising Water, SOS ===")
    base_state = {
        "incident": {
            "id": "INC_001",
            "type": "FLOOD",
            "latitude": 26.1500,
            "longitude": 91.7500,
            "victim_count": 15,
            "elderly_count": 3,
            "children_count": 5,
            "disabled_count": 1,
            "water_level": 2.5,  # High
            "rainfall": 120.0,   # Heavy
            "road_access": "OPEN"
        },
        "resources": [
            {
                "id": "AMB_01",
                "type": "AMBULANCE",
                "latitude": 26.1600,
                "longitude": 91.7600,
                "status": "AVAILABLE",
                "capacity": 2
            },
            {
                "id": "FIRE_01",
                "type": "FIRE_TRUCK",
                "latitude": 26.1400,
                "longitude": 91.7400,
                "status": "AVAILABLE",
                "capacity": 4
            }
        ],
        "hospitals": [
            {
                "id": "HOSP_01",
                "name": "Guwahati Medical",
                "latitude": 26.1800,
                "longitude": 91.7800,
                "total_beds": 100,
                "available_beds": 10,
                "has_trauma_center": True
            }
        ],
        "environment": {
            "general_weather": "Heavy Rain",
            "rainfall_current": 50,
            "rainfall_1h": 20,
            "rainfall_3h": 60,
            "rainfall_6h": 80,
            "rainfall_24h": 120,
            "rainfall_trend": 10,
            "elevation_m": 45
        }
    }
    
    resp1 = client.post("/api/ai/analyze", json=base_state)
    if resp1.status_code != 200:
        print(resp1.json())
    assert resp1.status_code == 200
    plan1 = resp1.json()
    print(f"Action: {plan1['recommended_action']}")
    print(f"Assignments: {[a['resource_id'] for a in plan1['assignments']]}")
    print("Explanation:", plan1['explanation'])
    
    print("\n=== SCENARIO 2: Road becomes blocked ===")
    state2 = copy.deepcopy(base_state)
    state2["incident"]["road_access"] = "BLOCKED"
    
    payload2 = {
        "previous_plan": plan1,
        "updated_state": state2
    }
    
    resp2 = client.post("/api/ai/reanalyze", json=payload2)
    assert resp2.status_code == 200
    revision2 = resp2.json()
    print(f"Changes identified: {revision2['changes']}")
    
    print("\n=== SCENARIO 3: Hospital becomes unavailable ===")
    state3 = copy.deepcopy(state2)
    state3["hospitals"][0]["available_beds"] = 0
    
    payload3 = {
        "previous_plan": revision2['new_plan'],
        "updated_state": state3
    }
    resp3 = client.post("/api/ai/reanalyze", json=payload3)
    assert resp3.status_code == 200
    revision3 = resp3.json()
    # The optimization engine doesn't explicitly map to hospitals yet, but we will see if the system processes it gracefully.
    print(f"Changes identified: {revision3['changes']}")
    
    print("\n=== SCENARIO 4: No ambulance available (Degradation) ===")
    state4 = copy.deepcopy(state3)
    state4["resources"] = [] # Removing all resources
    
    payload4 = {
        "previous_plan": revision3['new_plan'],
        "updated_state": state4
    }
    resp4 = client.post("/api/ai/reanalyze", json=payload4)
    assert resp4.status_code == 200
    revision4 = resp4.json()
    print(f"Action: {revision4['new_action']}")
    print(f"Assignments: {[a['resource_id'] for a in revision4['new_plan']['assignments']]}")
    print(f"Warnings: {[w['message'] for w in revision4['new_plan']['warnings']]}")

if __name__ == "__main__":
    run_simulation()
