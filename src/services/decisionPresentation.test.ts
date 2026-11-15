import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { presentDecisionStatus } from './decisionPresentation';

describe('decision status presentation', () => {
  it('labels known backend plan states without implying an unrecorded approval', () => {
    assert.deepEqual(presentDecisionStatus('PENDING'), {
      label: 'Pending operator review',
      tone: 'pending',
    });
    assert.deepEqual(presentDecisionStatus('APPROVED'), {
      label: 'Approved',
      tone: 'approved',
    });
    assert.deepEqual(presentDecisionStatus('EXECUTED'), {
      label: 'Execution recorded',
      tone: 'executed',
    });
    assert.deepEqual(presentDecisionStatus('CANCELLED'), {
      label: 'Cancelled',
      tone: 'cancelled',
    });
  });

  it('handles missing and future backend states safely', () => {
    assert.deepEqual(presentDecisionStatus(null), {
      label: 'Status unavailable',
      tone: 'unknown',
    });
    assert.deepEqual(presentDecisionStatus('FUTURE_STATE'), {
      label: 'FUTURE_STATE',
      tone: 'unknown',
    });
    assert.deepEqual(presentDecisionStatus(' pending '), {
      label: 'Pending operator review',
      tone: 'pending',
    });
  });
});
