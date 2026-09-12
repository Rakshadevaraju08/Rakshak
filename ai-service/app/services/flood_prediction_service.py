import os
import json
import logging
import joblib

logger = logging.getLogger("disaster.predictive.ml")

class FloodPredictionService:
    def __init__(self, model_path: str = "app/models/flood_risk_model.joblib", meta_path: str = "app/models/model_metadata.json"):
        self.model_path = model_path
        self.meta_path = meta_path
        self.model = None
        self.metadata = {}
        self.feature_names = []
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.meta_path):
            logger.warning(f"Model or metadata missing. Paths: {self.model_path}, {self.meta_path}")
            return
            
        try:
            self.model = joblib.load(self.model_path)
            with open(self.meta_path, "r") as f:
                self.metadata = json.load(f)
            self.feature_names = self.metadata.get("features", [])
            logger.info("Successfully loaded flood risk ML model.")
        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            self.model = None

    def is_available(self) -> bool:
        return self.model is not None

    def predict_flood_risk(self, features: dict) -> dict:
        if not self.is_available():
            raise RuntimeError("Flood Prediction Model is not available.")
            
        # Extract features in correct order
        try:
            feature_vector = [features[f] for f in self.feature_names]
        except KeyError as e:
            raise ValueError(f"Missing required feature: {e}")

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

        # Determine important factors dynamically based on feature importance and current inputs
        factors = []
        if prob > 0.25:
            # Look at what is high
            if features.get('rainfall_24h', 0) > 50:
                factors.append("High recent rainfall over the last 24 hours")
            if features.get('rainfall_trend', 0) > 0:
                factors.append("Rainfall is trending upwards")
            if features.get('elevation_m', 100) < 60:
                factors.append("Location is in a low-lying vulnerable area")
        else:
            factors.append("Low recent rainfall and safe elevation")

        return {
            "riskLevel": risk_level,
            "probability": round(prob, 2),
            "predictionHorizonMinutes": self.metadata.get("prediction_horizon_minutes", 30),
            "factors": factors
        }
