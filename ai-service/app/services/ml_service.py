import os
import logging
from typing import List, Optional

from app.errors import PipelineWarning, WarningCode

logger = logging.getLogger("disaster.ml")


class MLService:
    """
    Loads and serves predictions from a scikit-learn model.

    Emits structured warnings when the model file is missing or prediction fails,
    instead of silently swallowing errors.
    """

    EXPECTED_FEATURE_COUNT = 10  # Must match train_risk.py feature ordering

    def __init__(self, model_path: str = "app/models/risk_model.joblib"):
        self.model_path = model_path
        self.model = None
        self._load_warnings: List[PipelineWarning] = []
        self._load_model()

    # --- Public API -----------------------------------------------------------

    @property
    def is_available(self) -> bool:
        """True if the model loaded successfully and is ready for predictions."""
        return self.model is not None

    @property
    def load_warnings(self) -> List[PipelineWarning]:
        """Warnings generated during model loading (file missing, deserialization error)."""
        return list(self._load_warnings)

    def predict(self, features: list) -> int:
        """
        Run prediction. Raises ValueError with structured context on failure.
        """
        if self.model is None:
            raise ValueError("Model is not loaded.")

        # Validate feature vector length
        if len(features) != self.EXPECTED_FEATURE_COUNT:
            raise ValueError(
                f"Feature vector length mismatch: expected {self.EXPECTED_FEATURE_COUNT}, got {len(features)}."
            )

        try:
            # model.predict expects a 2D array
            prediction = self.model.predict([features])
            return int(prediction[0])
        except Exception as exc:
            logger.error(f"Model prediction failed: {type(exc).__name__}")
            raise ValueError(f"Model prediction failed: {type(exc).__name__}") from exc

    # --- Internal -------------------------------------------------------------

    def _load_model(self) -> None:
        """Attempt to load the model file; record structured warnings on failure."""
        if not os.path.exists(self.model_path):
            w = PipelineWarning(
                code=WarningCode.MODEL_FILE_MISSING,
                source="MLService",
                message=f"ML model file not found. Risk assessment will use rule-based fallback.",
                detail=f"Path checked: {self.model_path}",
            )
            w.log()
            self._load_warnings.append(w)
            return

        try:
            import joblib
            self.model = joblib.load(self.model_path)
            logger.info("Successfully loaded ML model.")
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
