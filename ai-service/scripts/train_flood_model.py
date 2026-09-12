import os
import json
import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support

def load_data():
    base_dir = "data/training/prediction"
    
    print("Loading datasets...")
    train = pd.read_csv(os.path.join(base_dir, "train.csv"))
    val = pd.read_csv(os.path.join(base_dir, "validation.csv"))
    test = pd.read_csv(os.path.join(base_dir, "test.csv"))
    
    # We combine train and val for final cross-validated/heuristic training if we want, 
    # but since it's a simple script, we'll train on train, use val for early stopping or tuning if needed,
    # and test strictly on test. For sklearn baselines, we'll train on train + val combined to maximize data.
    train_full = pd.concat([train, val]).reset_index(drop=True)
    
    return train_full, test

def prepare_features(df):
    features = [
        'rainfall_current', 'rainfall_1h', 'rainfall_3h', 
        'rainfall_6h', 'rainfall_24h', 'rainfall_trend', 'elevation_m'
    ]
    target = 'flood_next_30min'
    
    X = df[features].fillna(0)  # Defensive fill
    y = df[target]
    
    return X, y, features

def train_and_evaluate():
    print("=== Training Flood Risk Baseline Models ===")
    
    train_df, test_df = load_data()
    
    X_train, y_train, feature_cols = prepare_features(train_df)
    X_test, y_test, _ = prepare_features(test_df)
    
    print(f" - Train Samples: {len(X_train)}")
    print(f" - Test Samples: {len(X_test)}")
    print(f" - Class Distribution (Train): {y_train.value_counts().to_dict()}")
    print(f" - Class Distribution (Test): {y_test.value_counts().to_dict()}")
    
    # Check if there is only 1 class in train or test
    if len(y_train.unique()) < 2:
        print("WARNING: Only 1 class present in training data! Model cannot learn.")
        return
        
    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, class_weight="balanced", max_depth=10, random_state=42),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, random_state=42)
    }
    
    results = []
    trained_models = {}
    
    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        
        # We look for precision, recall, f1 for class 1 (High Risk)
        if 1 in y_test.values:
            precision, recall, f1, support = precision_recall_fscore_support(y_test, y_pred, labels=[1], zero_division=0)
            high_recall = recall[0]
            high_f1 = f1[0]
        else:
            high_recall, high_f1 = 0, 0
            
        acc = accuracy_score(y_test, y_pred)
        
        results.append({
            "model": name,
            "accuracy": acc,
            "high_risk_recall": high_recall,
            "high_risk_f1": high_f1
        })
        trained_models[name] = model
        
        print(f" - Accuracy: {acc:.4f}")
        print(f" - High Risk Recall: {high_recall:.4f}")
        print(f" - High Risk F1: {high_f1:.4f}")

    print("\n=== Model Comparison ===")
    print(f"{'Model':<20} | {'Accuracy':<10} | {'High Recall':<15} | {'High F1':<10}")
    print("-" * 65)
    for res in results:
        print(f"{res['model']:<20} | {res['accuracy']:<10.4f} | {res['high_risk_recall']:<15.4f} | {res['high_risk_f1']:<10.4f}")
        
    # Selection criteria: Best F1 and High Recall balance
    # Prioritizing Random Forest if performance is similar because of built-in feature importances
    best_res = max(results, key=lambda x: (x['high_risk_f1'], x['high_risk_recall']))
    best_model_name = best_res['model']
    best_model = trained_models[best_model_name]
    
    print(f"\nSelected Model: {best_model_name}")
    
    # Save model and metadata
    os.makedirs("app/models", exist_ok=True)
    model_path = "app/models/flood_risk_model.joblib"
    joblib.dump(best_model, model_path)
    
    # Check for feature importances
    importances = {}
    if hasattr(best_model, "feature_importances_"):
        imps = best_model.feature_importances_
        importances = {feat: float(imp) for feat, imp in zip(feature_cols, imps)}
    
    metadata = {
        "model_type": type(best_model).__name__,
        "prediction_horizon_minutes": 30,
        "features": feature_cols,
        "training_period": f"{train_df['timestamp'].min()} to {train_df['timestamp'].max()}",
        "test_period": f"{test_df['timestamp'].min()} to {test_df['timestamp'].max()}",
        "metrics": {
            "accuracy": best_res['accuracy'],
            "high_risk_recall": best_res['high_risk_recall'],
            "high_risk_f1": best_res['high_risk_f1']
        },
        "feature_importances": importances
    }
    
    with open("app/models/model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Model saved to {model_path}")
    print("Metadata saved to app/models/model_metadata.json")

if __name__ == "__main__":
    train_and_evaluate()
