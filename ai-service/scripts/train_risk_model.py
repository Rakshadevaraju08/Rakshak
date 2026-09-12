import os
import random
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

from app.ml.base import ModelManager
from app.ml.metadata import ModelMetadata
from app.ml.features import extract_risk_features, RISK_FEATURE_NAMES

def generate_synthetic_risk_data(n_samples=5000):
    """
    Generates synthetic risk features and assigns labels based on basic heuristics 
    to create a prototype dataset since real priority-labeled incidents are missing.
    """
    data = []
    
    for _ in range(n_samples):
        # Generate random inputs
        victim_count = random.choices([0, 1, 2, 5, 10, 20], weights=[0.4, 0.3, 0.15, 0.05, 0.05, 0.05])[0]
        elderly = random.randint(0, victim_count) if victim_count > 0 else 0
        children = random.randint(0, victim_count - elderly) if victim_count > 0 else 0
        disabled = random.randint(0, victim_count - elderly - children) if victim_count > 0 else 0
        
        rainfall = random.uniform(0, 150)
        water_level = random.uniform(0, 3.0)
        
        road_blocked = random.choice([0.0, 1.0])
        
        incident_type = random.choice(['FLOOD', 'FIRE', 'EARTHQUAKE', 'MEDICAL', 'OTHER'])
        is_flood = 1.0 if incident_type == 'FLOOD' else 0.0
        is_fire = 1.0 if incident_type == 'FIRE' else 0.0
        is_earthquake = 1.0 if incident_type == 'EARTHQUAKE' else 0.0
        
        # Calculate heuristic priority (Ground truth for this demo)
        score = 0
        score += min(victim_count * 5, 40)
        score += min((elderly + children + disabled) * 10, 30)
        
        if is_flood and water_level > 2.0: score += 30
        elif is_flood and water_level > 1.0: score += 15
        
        if rainfall > 100: score += 20
        elif rainfall > 50: score += 10
        
        if is_fire: score += 20
        if is_earthquake: score += 25
        if road_blocked: score += 15
        
        # Priority mapping (1=CRITICAL, 2=HIGH, 3=MEDIUM, 4=LOW, 5=MONITOR)
        if score >= 80: priority = 1
        elif score >= 50: priority = 2
        elif score >= 25: priority = 3
        elif score >= 10: priority = 4
        else: priority = 5
        
        data.append([
            victim_count, elderly, children, disabled,
            rainfall, water_level, road_blocked,
            is_flood, is_fire, is_earthquake,
            priority
        ])
        
    df = pd.DataFrame(data, columns=RISK_FEATURE_NAMES + ['priority'])
    return df

def train_and_save():
    print("=== Training Risk Model (Incident Severity) ===")
    
    # 1. Generate Dummy Data
    df = generate_synthetic_risk_data(6000)
    train_df = df.iloc[:5000]
    test_df = df.iloc[5000:]
    
    X_train = train_df[RISK_FEATURE_NAMES]
    y_train = train_df['priority']
    
    X_test = test_df[RISK_FEATURE_NAMES]
    y_test = test_df['priority']
    
    print(f" - Train Samples: {len(X_train)}")
    print(f" - Test Samples: {len(X_test)}")
    
    # 2. Train Model
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)
    
    # 3. Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f" - Accuracy: {acc:.4f}")
    
    # 4. Save Metadata & Model
    metrics = {
        "accuracy": float(acc)
    }
    
    metadata = ModelMetadata(
        model_type="RandomForestClassifier",
        training_date=datetime.utcnow().isoformat(),
        feature_names=RISK_FEATURE_NAMES,
        dataset_type="SYNTHETIC",
        evaluation_metrics=metrics,
        limitations="DEMO / PROTOTYPE MODEL. Trained entirely on synthetically generated rule-based labels because real labeled emergency priority datasets were unavailable.",
        is_demo_model=True
    )
    
    model_path = "app/models/risk_model.joblib"
    meta_path = "app/models/risk_model_meta.json"
    
    ModelManager.save_model(model, metadata, model_path, meta_path)
    print("Completed!")

if __name__ == "__main__":
    train_and_save()
