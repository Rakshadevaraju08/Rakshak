# AI Demo Test Matrix

This document outlines the 25 standalone scenarios built into the AI Demo Runner (`python -m demo.demo_runner`).

| ID | Name | Core Test | Expected Behavior |
|---|---|---|---|
| 01 | Single-person flood emergency | Basic pipeline function | Risk P5. Dispatches boat. |
| 02 | Multiple victims | Vulnerability scaling | Risk P3. Priority elevated due to vulnerable populations. |
| 03 | Critical medical emergency | Severity handling | Risk P3. Rapid ambulance dispatch. |
| 04 | Accident at single location | Non-flood routing | Valid routing and resource selection. |
| 05 | Fire emergency | Resource compatibility | Selects Fire Truck, rejects Ambulance for fire suppression. |
| 06 | Structural collapse | Uncategorized incidents | Maps to OTHER. Escalates priority. |
| 07 | Evacuation scenario | Mass victims | Escalates risk, flags multiple resource needs. |
| 08 | High rainfall + rising water | Environmental weighting | Predictive agent highlights future risk. |
| 09 | Future risk without current SOS | Prediction without victims | System flags environment warning even with 0 victims. |
| 10 | Road blocked | Dynamic replanning | Route agent uses fallback/fails when road marked blocked. |
| 11 | Hospital full | Resource constraints | Hospital rejected due to 0 capacity. |
| 12 | Ambulance unavailable | Resource limits | Escalates to dispatch (NO_SUITABLE_RESOURCE). |
| 13 | No suitable resource | Resource mismatch | Refuses to send ambulance to fire. |
| 14 | Conflicting reports | Data Quality | Human required due to low confidence. |
| 15 | Stale environmental data | Data Quality | Data quality flags stale timestamp. |
| 16 | Fake ambulance | Hallucination Guard | Safety blocks unknown resource ID. |
| 17 | Fake hospital | Hallucination Guard | Safety blocks unknown hospital ID. |
| 18 | Impossible route | Grounding Guard | Route agent/safety blocks invalid lat/lon. |
| 19 | Fake ETA | Hallucination Guard | Validates ETA against distance. |
| 20 | Fake rainfall | Hallucination Guard | Grounding check rejects impossible 9000mm rainfall. |
| 21 | Offline mesh SOS | Connectivity loss | Pipeline processes gracefully without live net. |
| 22 | Duplicate SOS | Idempotency | Processes successfully. |
| 23 | Low-risk incident | Safe operations | Successfully assigns low risk. |
| 24 | Multiple simultaneous incidents | Concurrency | Demonstrates resource exhaustion handling. |
| 25 | Critical incident + conflicting data | Complex failure | Prioritizes safety block over dispatch. |
