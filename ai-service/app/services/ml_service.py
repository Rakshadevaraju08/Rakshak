import os
import joblib
import logging

class MLService:
    def __init__(self, model_path: str = 'app/models/risk_model.joblib'):
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            logging.warning(f"ML model not found at {self.model_path}. Falling back to rule-based.")
            return

        try:
            self.model = joblib.load(self.model_path)
            logging.info(f"Successfully loaded ML model from {self.model_path}")
        except Exception as e:
            logging.error(f"Failed to load ML model: {e}. Falling back to rule-based.")
            self.model = None

    def predict(self, features: list) -> int:
        if self.model is None:
            raise ValueError("Model is not loaded.")
        
        # model.predict expects a 2D array
        prediction = self.model.predict([features])
        return int(prediction[0])
