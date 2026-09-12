"""
WARNING: This script generates a completely SYNTHETIC and DEMO dataset 
for the sole purpose of developing the ML pipeline architecture. 
DO NOT present its accuracy as real-world performance. 
Real historical labelled disaster data is required for meaningful validation.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

def generate_synthetic_data(num_samples=1000):
    np.random.seed(42)
    
    # Generate synthetic features
    victim_count = np.random.randint(0, 50, num_samples)
    elderly_count = (victim_count * np.random.uniform(0.1, 0.4, num_samples)).astype(int)
    children_count = (victim_count * np.random.uniform(0.1, 0.4, num_samples)).astype(int)
    disabled_count = (victim_count * np.random.uniform(0, 0.2, num_samples)).astype(int)
    
    rainfall = np.random.uniform(0, 200, num_samples)
    water_level = np.random.uniform(0, 5, num_samples)
    road_access_blocked = np.random.randint(0, 2, num_samples)
    
    # One-hot encoding simplifications for incident types
    is_flood = np.random.randint(0, 2, num_samples)
    is_fire = np.where(is_flood == 0, np.random.randint(0, 2, num_samples), 0)
    is_earthquake = np.where((is_flood == 0) & (is_fire == 0), np.random.randint(0, 2, num_samples), 0)
    
    # Generate synthetic target labels (Priority 1-5, where 1 is highest)
    # Using a deterministic baseline logic to give the ML model something to learn
    priorities = []
    for i in range(num_samples):
        score = victim_count[i]*5 + (elderly_count[i]+children_count[i]+disabled_count[i])*10
        if water_level[i] > 2.0 and is_flood[i]: score += 30
        if rainfall[i] > 100: score += 20
        if road_access_blocked[i]: score += 15
        if is_fire[i]: score += 20
        
        if score >= 80: priorities.append(1)
        elif score >= 50: priorities.append(2)
        elif score >= 25: priorities.append(3)
        elif score >= 10: priorities.append(4)
        else: priorities.append(5)

    df = pd.DataFrame({
        'victim_count': victim_count,
        'elderly_count': elderly_count,
        'children_count': children_count,
        'disabled_count': disabled_count,
        'rainfall': rainfall,
        'water_level': water_level,
        'road_access_blocked': road_access_blocked,
        'is_flood': is_flood,
        'is_fire': is_fire,
        'is_earthquake': is_earthquake,
        'priority': priorities
    })
    
    return df

def train_and_evaluate():
    print("Generating SYNTHETIC DEMO data...")
    df = generate_synthetic_data(2000)
    
    X = df.drop('priority', axis=1)
    y = df['priority']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training RandomForestClassifier...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X_train, y_train)
    
    y_pred = clf.predict(X_test)
    
    print("\n--- SYNTHETIC DATA EVALUATION ---")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.2f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    print("WARNING: This accuracy reflects synthetic heuristic generation, NOT real-world capability.")
    
    # Save the model
    os.makedirs('app/models', exist_ok=True)
    model_path = 'app/models/risk_model.joblib'
    joblib.dump(clf, model_path)
    print(f"\nModel saved successfully to {model_path}")

if __name__ == "__main__":
    train_and_evaluate()
