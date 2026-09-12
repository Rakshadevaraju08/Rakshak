import os
import json
import joblib
import logging
from typing import Optional, Tuple, Any

from app.ml.metadata import ModelMetadata

logger = logging.getLogger("disaster.ml.base")

class ModelManager:
    """
    Manages atomic loading and saving of models along with their rigorous metadata schemas.
    """

    @staticmethod
    def save_model(model: Any, metadata: ModelMetadata, model_path: str, meta_path: str) -> None:
        """Saves a model and its associated metadata JSON."""
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        os.makedirs(os.path.dirname(meta_path), exist_ok=True)
        
        joblib.dump(model, model_path)
        with open(meta_path, 'w') as f:
            f.write(metadata.model_dump_json(indent=2))
            
        logger.info(f"Model saved to {model_path} with metadata to {meta_path}")

    @staticmethod
    def load_model(model_path: str, meta_path: str) -> Tuple[Optional[Any], Optional[ModelMetadata]]:
        """Loads a model and validates its metadata against the schema."""
        if not os.path.exists(model_path) or not os.path.exists(meta_path):
            return None, None
            
        try:
            model = joblib.load(model_path)
            with open(meta_path, 'r') as f:
                raw_meta = json.load(f)
            metadata = ModelMetadata(**raw_meta)
            
            if metadata.is_demo_model:
                logger.warning(f"Loaded DEMO model from {model_path}. Limitations: {metadata.limitations}")
                
            return model, metadata
        except Exception as e:
            logger.error(f"Failed to load model or metadata from {model_path}: {e}")
            return None, None
