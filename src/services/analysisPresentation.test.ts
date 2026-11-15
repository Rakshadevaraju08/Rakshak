import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPriority, isPredictionAvailable } from './analysisPresentation';

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
});
