from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ModelMetadata(BaseModel):
    """
    Standardized metadata attached to every trained machine learning model.
    Ensures traceability and explicit documentation of limitations.
    """
    model_type: str = Field(..., description="e.g. RandomForestClassifier, LogisticRegression")
    training_date: str = Field(..., description="ISO datetime of when the model was trained")
    feature_names: List[str] = Field(..., description="Ordered list of features the model expects")
    dataset_type: str = Field(..., description="e.g. SYNTHETIC, HISTORICAL, HYBRID")
    evaluation_metrics: Dict[str, float] = Field(..., description="Metrics captured during evaluation (accuracy, f1, etc)")
    limitations: str = Field(..., description="Human-readable limitations of the model")
    is_demo_model: bool = Field(default=False, description="Explicit flag indicating if this is a prototype model not meant for real-world dispatch")
    extra: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Any additional model-specific context")
