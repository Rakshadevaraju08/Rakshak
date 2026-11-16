import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPriority,
  getMissingIncidentDetails,
  groupAnalysisWarnings,
  isPredictionAvailable,
} from './analysisPresentation';

describe('AI analysis presentation helpers', () => {
  it('only treats an explicitly available prediction as a forecast', () => {
    const forecast = [{ horizon_minutes: 20, risk_level: 'HIGH' }];
    assert.equal(isPredictionAvailable({ prediction_available: true, forecast }), true);
    assert.equal(isPredictionAvailable({ prediction_available: false }), false);
    assert.equal(isPredictionAvailable({ escalation_detected: false }), false);
    assert.equal(isPredictionAvailable({ prediction_available: true, forecast: [] }), false);
    assert.equal(isPredictionAvailable({
      prediction_available: true,
      forecast: [{ horizon_minutes: 20 }],
    }), false);
    assert.equal(isPredictionAvailable({
      prediction_available: true,
      forecast: [{ horizon_minutes: Number.NaN, risk_level: 'HIGH' }],
    }), false);
    assert.equal(isPredictionAvailable({
      forecast: [{ horizon_minutes: 20, risk_level: 'HIGH' }],
    }), false);
    assert.equal(isPredictionAvailable(null), false);
  });

  it('formats the integer priority enum returned by the AI service', () => {
    assert.equal(formatPriority(1), 'P1 · Critical');
    assert.equal(formatPriority(2), 'P2 · High');
    assert.equal(formatPriority(3), 'P3 · Medium');
    assert.equal(formatPriority(4), 'P4 · Low');
    assert.equal(formatPriority(5), 'P5 · Monitor');
  });

  it('preserves string priorities and safely handles unknown or absent values', () => {
    assert.equal(formatPriority('P1_CRITICAL'), 'P1 · Critical');
    assert.equal(formatPriority('P2_HIGH'), 'P2 · High');
    assert.equal(formatPriority('CUSTOM_PRIORITY'), 'CUSTOM_PRIORITY');
    assert.equal(formatPriority(0), '0');
    assert.equal(formatPriority(null), 'Not returned');
    assert.equal(formatPriority(Number.NaN), 'Not returned');
  });

  it('groups warning codes with human-readable copy while retaining technical details', () => {
    const groups = groupAnalysisWarnings([
      { code: 'INCOMPLETE_INCIDENT', source: 'DataQualityAgent', message: 'victim_count was not reported.' },
      { code: 'INCOMPLETE_INCIDENT', source: 'SituationAgent', message: 'children_count was not reported.' },
      { code: 'STALE_DATA', source: 'DataQualityAgent', message: 'Rainfall data is stale.' },
      { code: 'MODEL_NOT_VALIDATED', source: 'RiskAgent', message: 'Synthetic model disabled.' },
      { code: 'PREDICTION_FAILURE', source: 'PredictiveAgent', message: 'No usable flood trend was available.' },
    ]);

    assert.equal(groups.length, 4);
    assert.equal(groups[0].title, 'Incident details need confirmation');
    assert.equal(groups[0].severity, 'warning');
    assert.equal(groups[0].details.length, 2);
    assert.equal(groups[0].details[0].code, 'INCOMPLETE_INCIDENT');
    assert.equal(groups[1].title, 'Some information may be out of date');
    assert.equal(groups[2].title, 'Risk model not validated for operations');
    assert.equal(groups[3].severity, 'info');
    assert.match(groups[3].description, /does not invalidate the other results/i);
  });

  it('turns missing incident fields into safe, actionable prompts without duplicating overlaps', () => {
    const details = getMissingIncidentDetails([
      'victim_count',
      'critical_victim_count',
      'Vulnerable subgroup counts were not reported: elderly_count, children_count.',
    ]);

    assert.deepEqual(details.map(detail => detail.key), [
      'victim_count',
      'critical_victim_count',
      'elderly_count',
      'children_count',
    ]);
    assert.match(details[0].guidance, /confirm the number of people affected/i);
    assert.match(details[1].guidance, /confirm whether anyone has critical injuries/i);
  });
});
