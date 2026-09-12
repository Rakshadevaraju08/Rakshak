import os
import json
import yaml
import requests
from datetime import datetime
import time

def load_config():
    with open("config/data_sources.yaml", "r") as f:
        return yaml.safe_load(f)

def download_rainfall(config):
    print("Downloading rainfall data...")
    url = config['sources']['rainfall']['url']
    lat = config['region']['center']['lat']
    lng = config['region']['center']['lng']
    start_date = config['dates']['start_date']
    end_date = config['dates']['end_date']
    
    # Open-Meteo historical API
    params = {
        "latitude": lat,
        "longitude": lng,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "rain",
        "timezone": "auto"
    }
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        with open("data/raw/rainfall/open_meteo_rainfall.json", "w") as f:
            json.dump(response.json(), f)
        print("Rainfall data downloaded successfully.")
    else:
        print(f"Failed to download rainfall: {response.status_code} - {response.text}")

def download_elevation(config):
    print("Downloading elevation data...")
    url = config['sources']['elevation']['url']
    lat = config['region']['center']['lat']
    lng = config['region']['center']['lng']
    
    params = {
        "latitude": lat,
        "longitude": lng
    }
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        with open("data/raw/elevation/open_meteo_elevation.json", "w") as f:
            json.dump(response.json(), f)
        print("Elevation data downloaded successfully.")
    else:
        print(f"Failed to download elevation: {response.status_code}")

def download_osm_data(config):
    print("Downloading OpenStreetMap infrastructure data...")
    url = config['sources']['roads_and_hospitals']['url']
    bbox = config['region']['bbox']
    bbox_str = f"{bbox['min_lat']},{bbox['min_lng']},{bbox['max_lat']},{bbox['max_lng']}"
    
    # Overpass QL for hospitals
    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="hospital"]({bbox_str});
      way["amenity"="hospital"]({bbox_str});
    );
    out center;
    """
    
    print(" - Fetching hospitals...")
    response = requests.post(url, data={'data': overpass_query})
    if response.status_code == 200:
        with open("data/raw/hospitals/osm_hospitals.json", "w") as f:
            json.dump(response.json(), f)
        print(" - Hospitals downloaded successfully.")
    else:
        print(f" - Failed to download hospitals: {response.status_code}")
        
    time.sleep(2) # Be polite to Overpass API
    
    print(" - Fetching major roads...")
    road_query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"motorway|trunk|primary|secondary"]({bbox_str});
    );
    out geom;
    """
    response = requests.post(url, data={'data': road_query})
    if response.status_code == 200:
        with open("data/raw/roads/osm_roads.json", "w") as f:
            json.dump(response.json(), f)
        print(" - Roads downloaded successfully.")
    else:
        print(f" - Failed to download roads: {response.status_code}")

def create_manual_placeholders(config):
    print("Creating manual download placeholders...")
    for source_key, source_info in config['sources'].items():
        if source_info.get('type') == 'manual':
            file_path = f"data/raw/{source_key}/MANUAL_DOWNLOAD_REQUIRED.txt"
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w") as f:
                f.write(f"MANUAL DOWNLOAD REQUIRED for {source_info['name']}\n")
                f.write(f"URL: {source_info['url']}\n")
                f.write(f"Notes: {source_info.get('notes', 'N/A')}\n")
            print(f" - Marked manual requirement for: {source_key}")

def main():
    print("=== Disaster Data Acquisition Pipeline ===")
    config = load_config()
    
    download_rainfall(config)
    download_elevation(config)
    download_osm_data(config)
    create_manual_placeholders(config)
    
    print("=== Data Acquisition Complete ===")

if __name__ == "__main__":
    main()
