# Model Card: Prototype Flood Risk Prediction

## Model Purpose
A prototype decision-support model to predict near-future flood risk based on environmental factors (rainfall intensity and elevation). It acts as a predictive signaling mechanism for the AI Disaster Response Agent.

## Geographical Scope
Currently calibrated and limited to the prototype region: **Guwahati / Kamrup Metropolitan, Assam, India**.

## Training Data
*   **Sources**: Open-Meteo Historical API (ERA5 Reanalysis) & Open-Meteo Elevation API
*   **Training period**: 2021-01-01 to 2022-12-31
*   **Validation period**: 2023-01-01 to 2023-06-30
*   **Test period**: 2023-07-01 to 2023-12-31
*   **Number of samples**: 26,279 total (17,519 train)

## Features & Target
*   **Features**: `rainfall_current`, `rainfall_1h`, `rainfall_3h`, `rainfall_6h`, `rainfall_24h`, `rainfall_trend`, `elevation_m`
*   **Target**: `flood_next_30min` (Binary)
*   **Prediction horizon**: 30 minutes

## Evaluation Metrics (Random Forest)
*   **Accuracy**: 1.0000
*   **High-Risk Recall**: 1.0000
*   **High-Risk F1 Score**: 1.0000

## Known Limitations
*   **Synthetic Target**: Due to the lack of high-frequency labeled local flood occurrence data, the model target was heuristically synthesized based on extreme rainfall (>50mm in 24h) and low elevation (<60m). The perfect test metrics are an artifact of the model easily learning this deterministic rule.
*   **Temporal Leakage Avoided, but Simple Rules Applied**: The split is strictly chronological, preventing leakage, but the lack of real spatial complexity means it hasn't learned hydrology—just thresholding.
*   **No River Gauges**: The model does not currently ingest CWC river levels.
*   **Not a Certified System**: This is a prototype decision-support model. It is NOT a certified emergency prediction system.

## Intended Use
To provide the Predictive Agent with an ML-backed forecasting signal for proactive resource pre-positioning during the hackathon demonstration.

## Non-Intended Use
*   Real-world life-critical dispatch without human-in-the-loop validation.
*   High-resolution street-level hydraulic flood modeling.
