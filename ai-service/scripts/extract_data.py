import json
import csv
import os
import random
from faker import Faker
import uuid
import yaml

def extract_rainfall():
    print("Extracting rainfall data...")
    raw_file = "data/raw/rainfall/open_meteo_rainfall.json"
    if not os.path.exists(raw_file):
        print(f"Skipping: {raw_file} not found.")
        return
        
    with open(raw_file, "r") as f:
        data = json.load(f)
        
    lat = data.get("latitude")
    lng = data.get("longitude")
    
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    rain = hourly.get("rain", [])
    
    extracted_file = "data/raw/rainfall/extracted_rainfall.csv"
    with open(extracted_file, "w", newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "station_id", "latitude", "longitude", "rainfall_mm"])
        for t, r in zip(times, rain):
            writer.writerow([t, "open_meteo_guwahati", lat, lng, r])
    print(f" - Extracted to {extracted_file}")

def extract_elevation():
    print("Extracting elevation data...")
    raw_file = "data/raw/elevation/open_meteo_elevation.json"
    if not os.path.exists(raw_file):
        print("Skipping elevation extraction.")
        return
        
    with open(raw_file, "r") as f:
        data = json.load(f)
        
    elevation = data.get("elevation", [0])[0]
    
    extracted_file = "data/raw/elevation/extracted_elevation.csv"
    with open(extracted_file, "w", newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["latitude", "longitude", "elevation_m"])
        # Reading lat/lng from config as Open-Meteo might slightly adjust them
        with open("config/data_sources.yaml", "r") as cf:
            config = yaml.safe_load(cf)
        lat = config['region']['center']['lat']
        lng = config['region']['center']['lng']
        writer.writerow([lat, lng, elevation])
    print(f" - Extracted to {extracted_file}")

def extract_osm():
    print("Extracting OSM infrastructure...")
    # Hospitals
    hosp_file = "data/raw/hospitals/osm_hospitals.json"
    if os.path.exists(hosp_file):
        with open(hosp_file, "r") as f:
            data = json.load(f)
        
        with open("data/raw/hospitals/extracted_hospitals.csv", "w", newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["hospital_id", "hospital_name", "latitude", "longitude", "district", "emergency_available"])
            for element in data.get("elements", []):
                tags = element.get("tags", {})
                lat = element.get("lat") or element.get("center", {}).get("lat")
                lng = element.get("lon") or element.get("center", {}).get("lon")
                name = tags.get("name", "Unknown Hospital")
                emergency = "YES" if tags.get("emergency") == "yes" else "NO"
                writer.writerow([element.get("id"), name, lat, lng, "Kamrup Metropolitan", emergency])
        print(" - Extracted hospitals.")

    # Roads
    roads_file = "data/raw/roads/osm_roads.json"
    if os.path.exists(roads_file):
        with open(roads_file, "r") as f:
            data = json.load(f)
            
        with open("data/raw/roads/extracted_roads.csv", "w", newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["road_id", "road_name", "road_type", "latitude", "longitude"])
            for element in data.get("elements", []):
                tags = element.get("tags", {})
                geom = element.get("geometry", [])
                if geom:
                    # just take a representative point (e.g. first point) for the CSV summary
                    lat = geom[0].get("lat")
                    lng = geom[0].get("lon")
                    writer.writerow([element.get("id"), tags.get("name", "Unnamed Road"), tags.get("highway", "unknown"), lat, lng])
        print(" - Extracted roads.")

def generate_synthetic_sos():
    print("Generating synthetic SOS reports...")
    fake = Faker('en_IN')
    
    incidents = []
    templates = [
        ("FLOOD", "{num} people trapped inside a flooded house. One person is {vuln}."),
        ("FLOOD", "Water has entered the ground floor. {num_words} children are trapped."),
        ("MEDICAL", "Person injured after falling during flooding. Requires immediate medical attention."),
        ("INFRASTRUCTURE", "Road is completely submerged and vehicle cannot move."),
        ("FLOOD", "Family of {num_words} stranded on rooftop."),
        ("FIRE", "Fire broke out due to short circuit in the flooded basement."),
        ("MEDICAL", "Elderly patient trapped without access to regular medication.")
    ]
    
    num_map = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five"}
    
    output_file = "data/raw/historical_incidents/synthetic_sos_reports.csv"
    with open(output_file, "w", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["report_id", "raw_text", "incident_type", "victim_count", "vulnerable_victim", "medical_emergency", "location_description", "severity_hint"])
        
        for _ in range(500):
            template_type, template_text = random.choice(templates)
            
            num = random.randint(1, 5)
            vuln = random.choice(["elderly", "disabled", "pregnant", "infant"])
            
            raw_text = template_text.format(num=num, num_words=num_map[num].lower(), vuln=vuln)
            
            victim_count = num if "{num" in template_text else (1 if "Person" in template_text else 0)
            vulnerable = True if vuln in raw_text or "children" in raw_text or "Elderly" in raw_text else False
            medical = True if template_type == "MEDICAL" else False
            
            severity = "HIGH" if medical or vulnerable or victim_count > 2 else "MEDIUM"
            location = fake.address().replace('\n', ', ')
            
            writer.writerow([
                str(uuid.uuid4()),
                raw_text,
                template_type,
                victim_count,
                vulnerable,
                medical,
                location,
                severity
            ])
            
    print(f" - Generated 500 synthetic SOS reports (SYNTHETIC — FOR MODEL/SYSTEM TESTING ONLY) at {output_file}")

def main():
    print("=== Data Extraction Phase ===")
    extract_rainfall()
    extract_elevation()
    extract_osm()
    generate_synthetic_sos()
    print("=== Extraction Complete ===")

if __name__ == "__main__":
    main()
