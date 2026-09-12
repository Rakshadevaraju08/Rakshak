/**
 * JSDoc Type Definitions for the Rakshak AI Service
 * These mirror the Python Pydantic schemas defined in ai-service/app/schemas/domain.py
 */

/**
 * @typedef {'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} RiskLevel
 */

/**
 * @typedef {'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW' | 'P5_MONITOR'} Priority
 */

/**
 * @typedef {'OPEN' | 'PARTIAL' | 'BLOCKED' | 'ROUTE_UNAVAILABLE'} RoadAccessStatus
 */

/**
 * @typedef {'MONITOR' | 'PREPARE' | 'PRE_POSITION' | 'DISPATCH' | 'IMMEDIATE_DISPATCH'} RecommendedAction
 */

/**
 * @typedef {Object} SituationResult
 * @property {boolean} is_valid
 * @property {string} summary
 * @property {string} severity_assessment
 * @property {string} vulnerable_population_impact
 * @property {string[]} missing_information
 * @property {number} confidence_score
 * @property {string[]} explanations
 * @property {string} normalized_incident_type
 */

/**
 * @typedef {Object} RiskResult
 * @property {Priority} priority
 * @property {RiskLevel} risk_level
 * @property {string} severity
 * @property {number} score
 * @property {string[]} reasons
 * @property {number} confidence
 */

/**
 * @typedef {Object} ForecastItem
 * @property {number} horizon_minutes
 * @property {RiskLevel} risk_level
 */

/**
 * @typedef {Object} PredictiveAgentResult
 * @property {RiskLevel} current_risk
 * @property {ForecastItem[]} forecast
 * @property {boolean} escalation_detected
 * @property {string[]} explanation
 * @property {number} confidence
 */

/**
 * @typedef {Object} RouteResult
 * @property {string} resource_id
 * @property {string} destination_id
 * @property {number} estimated_time_mins
 * @property {number} distance_km
 * @property {number[][]} waypoints
 * @property {RoadAccessStatus} route_status
 * @property {string} explanation
 */

/**
 * @typedef {Object} ResourceAssignment
 * @property {string} resource_id
 * @property {string} action
 * @property {RouteResult} route
 * @property {number} estimated_arrival_time_mins
 */

/**
 * @typedef {Object} PipelineWarningResponse
 * @property {string} code
 * @property {string} source
 * @property {string} message
 */

/**
 * @typedef {Object} FullResponsePlan
 * @property {string} incident_id
 * @property {SituationResult} [situation]
 * @property {RiskResult} [risk]
 * @property {PredictiveAgentResult} [prediction]
 * @property {ResourceAssignment[]} assignments
 * @property {RecommendedAction} recommended_action
 * @property {string[]} explanation
 * @property {PipelineWarningResponse[]} warnings
 * @property {boolean} degraded
 * @property {boolean} human_approval_required
 */
