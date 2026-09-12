import pandas as pd
import os

def clean_rainfall():
    print("Cleaning rainfall data...")
    input_file = "data/raw/rainfall/extracted_rainfall.csv"
    output_file = "data/processed/rainfall/cleaned_rainfall.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    initial_rows = len(df)
    
    # Drop duplicates
    df = df.drop_duplicates()
    duplicates_removed = initial_rows - len(df)
    
    # Drop missing values in critical columns
    before_dropna = len(df)
    df = df.dropna(subset=['timestamp', 'rainfall_mm'])
    missing_removed = before_dropna - len(df)
    
    # Ensure valid coordinates
    before_coord = len(df)
    df = df[(df['latitude'] >= -90) & (df['latitude'] <= 90)]
    df = df[(df['longitude'] >= -180) & (df['longitude'] <= 180)]
    coord_removed = before_coord - len(df)
    
    # Ensure non-negative rainfall
    before_neg = len(df)
    df = df[df['rainfall_mm'] >= 0]
    neg_removed = before_neg - len(df)
    
    df.to_csv(output_file, index=False)
    print(f" - Rows before: {initial_rows}")
    print(f" - Rows after: {len(df)}")
    print(f" - Duplicates removed: {duplicates_removed}")
    print(f" - Missing values removed: {missing_removed}")
    print(f" - Invalid coordinates removed: {coord_removed}")
    print(f" - Negative values removed: {neg_removed}")
    print(f" - Saved to {output_file}")

def clean_elevation():
    print("Cleaning elevation data...")
    input_file = "data/raw/elevation/extracted_elevation.csv"
    output_file = "data/processed/elevation/cleaned_elevation.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    initial_rows = len(df)
    
    df = df.drop_duplicates()
    df = df.dropna(subset=['latitude', 'longitude', 'elevation_m'])
    df = df[(df['latitude'] >= -90) & (df['latitude'] <= 90)]
    df = df[(df['longitude'] >= -180) & (df['longitude'] <= 180)]
    
    df.to_csv(output_file, index=False)
    print(f" - Saved cleaned elevation ({len(df)} rows) to {output_file}")

def clean_hospitals():
    print("Cleaning hospitals data...")
    input_file = "data/raw/hospitals/extracted_hospitals.csv"
    output_file = "data/processed/hospitals/cleaned_hospitals.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    df = df.drop_duplicates(subset=['hospital_id'])
    df = df.dropna(subset=['latitude', 'longitude'])
    df.to_csv(output_file, index=False)
    print(f" - Saved cleaned hospitals ({len(df)} rows) to {output_file}")

def clean_roads():
    print("Cleaning roads data...")
    input_file = "data/raw/roads/extracted_roads.csv"
    output_file = "data/processed/roads/cleaned_roads.csv"
    
    if not os.path.exists(input_file):
        print(f" - {input_file} not found. Skipping.")
        return
        
    df = pd.read_csv(input_file)
    df = df.drop_duplicates(subset=['road_id'])
    df = df.dropna(subset=['latitude', 'longitude'])
    df.to_csv(output_file, index=False)
    print(f" - Saved cleaned roads ({len(df)} rows) to {output_file}")

def main():
    print("=== Data Cleaning Phase ===")
    clean_rainfall()
    clean_elevation()
    clean_hospitals()
    clean_roads()
    print("=== Cleaning Complete ===")

if __name__ == "__main__":
    main()
