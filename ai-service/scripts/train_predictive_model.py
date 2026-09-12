import os
from datetime import datetime
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support

from app.ml.base import ModelManager
from app.ml.metadata import ModelMetadata
from app.ml.features import extract_predictive_features, PREDICTIVE_FEATURE_NAMES

def load_data():
    base_dir = "data/training/prediction"
    
    print("Loading datasets...")
    train = pd.read_csv(os.path.join(base_dir, "train.csv"))
    val = pd.read_csv(os.path.join(base_dir, "validation.csv"))
    test = pd.read_csv(os.path.join(base_dir, "test.csv"))
    
    train_full = pd.concat([train, val]).reset_index(drop=True)
    return train_full, test

def prepare_features(df):
    target = 'flood_next_30min'
    
    # We apply the shared feature extraction by converting each row to a dict
    features_list = df.apply(lambda row: extract_predictive_features(row.to_dict()), axis=1).tolist()
    
    X = pd.DataFrame(features_list, columns=PREDICTIVE_FEATURE_NAMES)
    y = df[target]
    
    return X, y

def train_and_save():
    print("=== Training Predictive Model (Flood Risk) ===")
    
    train_df, test_df = load_data()
    X_train, y_train = prepare_features(train_df)
    X_test, y_test = prepare_features(test_df)
    
    print(f" - Train Samples: {len(X_train)}")
    print(f" - Test Samples: {len(X_test)}")
    
    # Check if there is only 1 class in train
    if len(y_train.unique()) < 2:
        print("WARNING: Only 1 class present in training data! Model cannot learn.")
        return

    model = RandomForestClassifier(n_estimators=100, class_weight="balanced", max_depth=10, random_state=42)
    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    
    if 1 in y_test.values:
        precision, recall, f1, support = precision_recall_fscore_support(y_test, y_pred, labels=[1], zero_division=0)
        high_recall = recall[0]
        high_f1 = f1[0]
    else:
        high_recall, high_f1 = 0, 0
        
    acc = accuracy_score(y_test, y_pred)
    
    print(f" - Accuracy: {acc:.4f}")
    print(f" - High Risk Recall: {high_recall:.4f}")
    print(f" - High Risk F1: {high_f1:.4f}")

    # Build Metadata
    metrics = {
        "accuracy": float(acc),
        "high_risk_recall": float(high_recall),
        "high_risk_f1": float(high_f1)
    }
    
    metadata = ModelMetadata(
        model_type="RandomForestClassifier",
        training_date=datetime.utcnow().isoformat(),
        feature_names=PREDICTIVE_FEATURE_NAMES,
        dataset_type="SYNTHETIC",
        evaluation_metrics=metrics,
        limitations="DEMO / PROTOTYPE MODEL. Target labels are heuristically generated based on extreme rainfall and low elevation due to lack of high-frequency historical flood labels.",
        is_demo_model=True,
        extra={"prediction_horizon_minutes": 30}
    )
    
    model_path = "app/models/flood_risk_model.joblib"
    meta_path = "app/models/flood_risk_model_meta.json"
    
    ModelManager.save_model(model, metadata, model_path, meta_path)
    print("Completed!")

if __name__ == "__main__":
    train_and_save()
