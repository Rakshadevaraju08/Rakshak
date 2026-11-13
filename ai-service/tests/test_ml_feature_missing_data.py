import pytest

from app.ml.features import extract_predictive_features, extract_risk_features


def complete_risk_features():
    return {
        "type": "OTHER",
        "victim_count": 0,
        "critical_victim_count": 0,
        "elderly_count": 0,
        "children_count": 0,
        "disabled_count": 0,
        "rainfall": {"value": 0.0, "quality": "VALID"},
        "water_level": {"value": 0.0, "quality": "VALID"},
        "road_access": "OPEN",
    }


def test_risk_feature_extraction_preserves_measured_zeroes():
    assert extract_risk_features(complete_risk_features()) == [0.0] * 10


@pytest.mark.parametrize("field", [
    "victim_count",
    "elderly_count",
    "children_count",
    "disabled_count",
    "rainfall",
    "water_level",
    "road_access",
])
def test_risk_feature_extraction_rejects_missing_values(field):
    features = complete_risk_features()
    features[field] = None

    with pytest.raises(ValueError, match="missing"):
        extract_risk_features(features)


def test_risk_feature_extraction_rejects_invalid_sensor_reading():
    features = complete_risk_features()
    features["rainfall"] = {"value": 12.0, "quality": "INVALID"}

    with pytest.raises(ValueError, match="invalid"):
        extract_risk_features(features)


def test_predictive_features_require_all_measurements_and_preserve_zero_elevation():
    features = {
        "rainfall_current": 0.0,
        "rainfall_1h": 0.0,
        "rainfall_3h": 0.0,
        "rainfall_6h": 0.0,
        "rainfall_24h": 0.0,
        "rainfall_trend": 0.0,
        "elevation_m": 0.0,
    }
    assert extract_predictive_features(features) == [0.0] * 7

    features.pop("rainfall_24h")
    with pytest.raises(ValueError, match="missing"):
        extract_predictive_features(features)
