import pandas as pd
import os

def preprocess_rainfall():
    print("Preprocessing rainfall data...")
    input_file = "data/processed/rainfall/cleaned_rainfall.csv"
    output_file = "data/processed/rainfall/rainfall_assam.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    
    # Ensure standard types and formats
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True).dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    df['latitude'] = df['latitude'].astype(float).round(4)
    df['longitude'] = df['longitude'].astype(float).round(4)
    df['rainfall_mm'] = df['rainfall_mm'].astype(float).round(2)
    
    # Select columns as per requirement
    df = df[['timestamp', 'station_id', 'latitude', 'longitude', 'rainfall_mm']]
    
    df.to_csv(output_file, index=False)
    print(f" - Saved preprocessed rainfall ({len(df)} rows) to {output_file}")

def preprocess_elevation():
    print("Preprocessing elevation data...")
    input_file = "data/processed/elevation/cleaned_elevation.csv"
    output_file = "data/processed/elevation/elevation_assam.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    df['latitude'] = df['latitude'].astype(float).round(4)
    df['longitude'] = df['longitude'].astype(float).round(4)
    df['elevation_m'] = df['elevation_m'].astype(float).round(1)
    
    df = df[['latitude', 'longitude', 'elevation_m']]
    df.to_csv(output_file, index=False)
    print(f" - Saved preprocessed elevation ({len(df)} rows) to {output_file}")

def preprocess_hospitals():
    print("Preprocessing hospitals data...")
    input_file = "data/processed/hospitals/cleaned_hospitals.csv"
    output_file = "data/processed/hospitals/hospitals_assam.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    df['latitude'] = df['latitude'].astype(float).round(6)
    df['longitude'] = df['longitude'].astype(float).round(6)
    
    # Select standard columns
    df = df[['hospital_id', 'hospital_name', 'latitude', 'longitude', 'district', 'emergency_available']]
    df.to_csv(output_file, index=False)
    print(f" - Saved preprocessed hospitals ({len(df)} rows) to {output_file}")

def preprocess_roads():
    print("Preprocessing roads data...")
    input_file = "data/processed/roads/cleaned_roads.csv"
    output_file = "data/processed/roads/roads_assam.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    df['latitude'] = df['latitude'].astype(float).round(6)
    df['longitude'] = df['longitude'].astype(float).round(6)
    
    df = df[['road_id', 'road_name', 'road_type', 'latitude', 'longitude']]
    df.to_csv(output_file, index=False)
    print(f" - Saved preprocessed roads ({len(df)} rows) to {output_file}")

def main():
    print("=== Data Preprocessing Phase ===")
    preprocess_rainfall()
    preprocess_elevation()
    preprocess_hospitals()
    preprocess_roads()
    print("=== Preprocessing Complete ===")

if __name__ == "__main__":
    main()
