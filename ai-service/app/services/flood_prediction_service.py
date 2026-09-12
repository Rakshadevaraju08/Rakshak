import os
import json
import logging
import joblib

logger = logging.getLogger("disaster.predictive.ml")

class FloodPredictionService:
    def __init__(self, model_path: str = "app/models/flood_risk_model.joblib", meta_path: str = "app/models/flood_risk_model_meta.json"):
        self.model_path = model_path
        self.meta_path = meta_path
        self.model = None
        self.metadata = None
        self._load_model()

    def _load_model(self):
        from app.ml.base import ModelManager
        
        try:
            self.model, self.metadata = ModelManager.load_model(self.model_path, self.meta_path)
            if self.model is not None:
                logger.info(f"Successfully loaded ML model of type {self.metadata.model_type}.")
            else:
                logger.warning(f"Model or metadata missing. Paths: {self.model_path}, {self.meta_path}")
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            self.model = None
            self.metadata = None

    def is_available(self) -> bool:
        return self.model is not None

    def predict_flood_risk(self, features: dict) -> dict:
        if not self.is_available():
            raise RuntimeError("Flood Prediction Model is not available.")
            
        from app.ml.features import extract_predictive_features
        # Extract features using the shared extractor
        feature_vector = extract_predictive_features(features)

        # Predict
        try:
            prob = self.model.predict_proba([feature_vector])[0][1]
        except Exception as e:
            raise ValueError(f"Model prediction failed: {e}")

        # Determine Risk Level and threshold based logic
        if prob > 0.75:
            risk_level = "CRITICAL"
        elif prob > 0.5:
            risk_level = "HIGH"
        elif prob > 0.25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Determine important factors dynamically
        factors = []
        if prob > 0.25:
            if features.get('rainfall_24h', 0) > 50:
                factors.append("High recent rainfall over the last 24 hours")
            if features.get('rainfall_trend', 0) > 0:
                factors.append("Rainfall is trending upwards")
            if features.get('elevation_m', 100) < 60:
                factors.append("Location is in a low-lying vulnerable area")
        else:
            factors.append("Low recent rainfall and safe elevation")

        horizon = self.metadata.extra.get("prediction_horizon_minutes", 30) if self.metadata.extra else 30

        return {
            "riskLevel": risk_level,
            "probability": round(prob, 2),
            "predictionHorizonMinutes": horizon,
            "factors": factors
        }
