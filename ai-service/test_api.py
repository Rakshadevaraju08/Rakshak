import requests
import json

def test_health():
    try:
        response = requests.get("http://127.0.0.1:8001/health")
        print("GET /health ->", response.status_code)
        print(json.dumps(response.json(), indent=2))
        print()
    except Exception as e:
        print("Failed to connect to health endpoint:", e)

def test_analyze():
    url = "http://127.0.0.1:8001/api/ai/analyze"
    
    # Sample Disaster Analysis Request
    payload = {
        "incident": {
            "id": "INC_TEST_API_01",
            "type": "FLOOD",
            "latitude": 28.5355,
            "longitude": 77.3910,
            "victim_count": 8,
            "elderly_count": 2,
            "children_count": 1,
            "water_level": 2.5,
            "rainfall": 150.0
        },
        "resources": [
            {
                "id": "BOAT_1",
                "type": "RESCUE_BOAT",
                "status": "AVAILABLE",
                "latitude": 28.5300,
                "longitude": 77.3900
            }
        ],
        "environment": {
            "rainfall_trend_mm_per_hour": 5.0,
            "water_level_trend_m_per_hour": 0.5
        }
    }
    
    print(f"POST {url} ...")
    try:
        response = requests.post(url, json=payload)
        print("Status Code:", response.status_code)
        
        if response.status_code == 200:
            print(json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
            
    except Exception as e:
        print("Failed to connect to analyze endpoint:", e)

if __name__ == "__main__":
    test_health()
    test_analyze()
