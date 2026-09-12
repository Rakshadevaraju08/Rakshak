import os
import logging
from typing import List, Optional

from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.ml")


class MLService:
    """
    Loads and serves predictions from a scikit-learn model using the ModelManager.
    Emits structured warnings when the model file is missing or prediction fails.
    """

    def __init__(self, model_path: str = "app/models/risk_model.joblib", meta_path: str = "app/models/risk_model_meta.json"):
        self.model_path = model_path
        self.meta_path = meta_path
        self.model = None
        self.metadata = None
        self._load_warnings: List[PipelineWarning] = []
        self._load_model()

    # --- Public API -----------------------------------------------------------

    @property
    def is_available(self) -> bool:
        return self.model is not None

    @property
    def load_warnings(self) -> List[PipelineWarning]:
        return list(self._load_warnings)

    def predict(self, features: list) -> int:
        if self.model is None:
            raise ValueError("Model is not loaded.")
            
        expected_len = len(self.metadata.feature_names)
        if len(features) != expected_len:
            raise ValueError(f"Feature vector length mismatch: expected {expected_len}, got {len(features)}.")

        try:
            prediction = self.model.predict([features])
            return int(prediction[0])
        except Exception as exc:
            logger.error(f"Model prediction failed: {type(exc).__name__}")
            raise ValueError(f"Model prediction failed: {type(exc).__name__}") from exc

    # --- Internal -------------------------------------------------------------

    def _load_model(self) -> None:
        from app.ml.base import ModelManager
        
        if not os.path.exists(self.model_path) or not os.path.exists(self.meta_path):
            w = PipelineWarning(
                code=WarningCode.MODEL_FILE_MISSING,
                source="MLService",
                message=f"ML model or metadata file not found. Risk assessment will use rule-based fallback.",
                detail=f"Paths checked: {self.model_path}, {self.meta_path}",
            )
            w.log()
            self._load_warnings.append(w)
            return

        try:
            self.model, self.metadata = ModelManager.load_model(self.model_path, self.meta_path)
            if self.model is not None:
                logger.info(f"Successfully loaded ML model of type {self.metadata.model_type}.")
            else:
                raise ValueError("ModelManager returned None")
        except Exception as exc:
            w = PipelineWarning(
                code=WarningCode.MODEL_PREDICTION_FAILED,
                source="MLService",
                message="Failed to deserialize ML model. Risk assessment will use rule-based fallback.",
                detail=str(exc),
            )
            w.log()
            self._load_warnings.append(w)
            self.model = None
            self.metadata = None
