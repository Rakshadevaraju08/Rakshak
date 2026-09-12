import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def build_prediction_dataset():
    print("Building Flood Risk Training Dataset...")
    rainfall_file = "data/processed/rainfall/rainfall_assam.csv"
    elevation_file = "data/processed/elevation/elevation_assam.csv"
    output_dir = "data/training/prediction"
    os.makedirs(output_dir, exist_ok=True)
    
    if not os.path.exists(rainfall_file) or not os.path.exists(elevation_file):
        print(" - Required processed files missing. Cannot build training dataset.")
        return
        
    df_rain = pd.read_csv(rainfall_file)
    df_elev = pd.read_csv(elevation_file)
    
    # We will cross join rainfall with elevation since we have a single point for now
    df_rain['dummy'] = 1
    df_elev['dummy'] = 1
    
    df_elev_agg = df_elev.groupby('dummy')['elevation_m'].mean().reset_index()
    
    df = pd.merge(df_rain, df_elev_agg, on='dummy', how='left')
    df.drop('dummy', axis=1, inplace=True)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(by=['station_id', 'timestamp'])
    
    # Create temporal features
    print(" - Generating temporal features (1h, 3h, 6h, 24h)...")
    df.set_index('timestamp', inplace=True)
    
    # Group by station to calculate rolling sums
    features = []
    for station, group in df.groupby('station_id'):
        group = group.sort_index()
        group['rainfall_current'] = group['rainfall_mm']
        group['rainfall_1h'] = group['rainfall_mm'].rolling('1h').sum()
        group['rainfall_3h'] = group['rainfall_mm'].rolling('3h').sum()
        group['rainfall_6h'] = group['rainfall_mm'].rolling('6h').sum()
        group['rainfall_24h'] = group['rainfall_mm'].rolling('24h').sum()
        
        group['rainfall_trend'] = group['rainfall_1h'] - group['rainfall_1h'].shift(1)
        
        # Target: simulate target based on conditions for hackathon purposes
        # Note: In real life this must be historical flood occurrence.
        # We simulate flood if 24h rainfall > 100mm and elevation < 50m
        group['flood_next_30min'] = np.where(
            (group['rainfall_24h'] > 100) & (group['elevation_m'] < 50), 
            1, 0
        )
        
        features.append(group)
    
    df_features = pd.concat(features).reset_index()
    df_features = df_features.dropna()
    
    # Keep final features
    final_cols = [
        'timestamp', 'station_id', 'latitude', 'longitude', 'elevation_m',
        'rainfall_current', 'rainfall_1h', 'rainfall_3h', 'rainfall_6h', 'rainfall_24h',
        'rainfall_trend', 'flood_next_30min'
    ]
    df_final = df_features[final_cols]
    
    full_output = os.path.join(output_dir, "flood_prediction_dataset.csv")
    df_final.to_csv(full_output, index=False)
    
    # Time-based train/validation/test split
    # Let's say: <2023 is train, 2023-01 to 2023-06 is val, >2023-06 is test
    print(" - Splitting dataset chronologically...")
    train = df_final[df_final['timestamp'] < '2023-01-01']
    val = df_final[(df_final['timestamp'] >= '2023-01-01') & (df_final['timestamp'] < '2023-07-01')]
    test = df_final[df_final['timestamp'] >= '2023-07-01']
    
    train.to_csv(os.path.join(output_dir, "train.csv"), index=False)
    val.to_csv(os.path.join(output_dir, "validation.csv"), index=False)
    test.to_csv(os.path.join(output_dir, "test.csv"), index=False)
    
    print(f" - Generated Total Samples: {len(df_final)}")
    print(f" - Train Size: {len(train)}")
    print(f" - Validation Size: {len(val)}")
    print(f" - Test Size: {len(test)}")

def main():
    print("=== Training Dataset Construction Phase ===")
    build_prediction_dataset()
    print("=== Construction Complete ===")

if __name__ == "__main__":
    main()
