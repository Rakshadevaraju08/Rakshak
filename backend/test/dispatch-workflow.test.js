const assert = require('node:assert/strict');
const test = require('node:test');
const {
  approveDispatchPlan,
  executeDispatchPlan,
  getAssignedResourceIds,
  updatePlanHospital,
} = require('../src/services/dispatchWorkflow');

function createStore(overrides = {}) {
  const state = {
    plan: {
      id: 'plan-1',
      incidentId: 'incident-1',
      status: 'PENDING',
      details: {
        recommended_action: 'DISPATCH',
        assignments: [{ resource_id: 'resource-1' }],
        safety_check: { status: 'REVIEW_REQUIRED', blocking_issues: [] },
        human_review_required: true,
      },
    },
    hospital: {
      id: 'hospital-1',
      capacities: [{ totalBeds: 20, available: 2 }],
    },
    resources: [{ id: 'resource-1', name: 'Unit 1', status: 'AVAILABLE' }],
    ...overrides,
  };

  const prisma = {
    dispatchPlan: {
      async findUnique() { return state.plan; },
      async update({ data }) {
        state.plan = { ...state.plan, ...data };
        return state.plan;
      },
    },
    hospital: {
      async findUnique({ where }) {
        return state.hospital?.id === where.id ? state.hospital : null;
      },
    },
    resource: {
      async findMany({ where }) {
        return state.resources.filter(resource => where.id.in.includes(resource.id));
      },
      async updateMany({ where, data }) {
        const matching = state.resources.filter(resource =>
          where.id.in.includes(resource.id) && resource.status === where.status);
        matching.forEach(resource => Object.assign(resource, data));
        return { count: matching.length };
      },
    },
    async $transaction(callback) { return callback(prisma); },
  };

  return { prisma, state };
}

test('reads resource IDs from the active AI assignment shape and legacy plan shape', () => {
  assert.deepEqual(getAssignedResourceIds({
    assignments: [{ resource_id: 'resource-1' }, { resourceId: 'resource-2' }],
  }), ['resource-1', 'resource-2']);
  assert.deepEqual(getAssignedResourceIds({ recommendedResources: ['resource-3'] }), ['resource-3']);
  assert.deepEqual(getAssignedResourceIds({
    assignments: [],
    recommendedResources: ['stale-resource'],
  }), []);
});

test('approval records an explicit review without treating human-review-required as a safety failure', async () => {
  const { prisma, state } = createStore();

  const approved = await approveDispatchPlan(prisma, 'plan-1', 'operator-1');

  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.details.operator_review.status, 'APPROVED');
  assert.equal(approved.details.operator_review.approvedBy, 'operator-1');
  assert.ok(approved.details.operator_review.approvedAt);
  assert.equal(state.plan.status, 'APPROVED');
});

test('approval blocks missing or blocked safety results and unavailable selected hospitals', async () => {
  const missingSafety = createStore({
    plan: { id: 'plan-1', status: 'PENDING', details: {} },
  });
  await assert.rejects(
    approveDispatchPlan(missingSafety.prisma, 'plan-1'),
    /no safety-check result/i,
  );
  assert.equal(missingSafety.state.plan.status, 'PENDING');

  const blocked = createStore({
    plan: {
      id: 'plan-1',
      status: 'PENDING',
      details: { safety_check: { status: 'BLOCKED', blocking_issues: ['Route is blocked.'] } },
    },
  });
  await assert.rejects(approveDispatchPlan(blocked.prisma, 'plan-1'), /Route is blocked/);

  const noCapacity = createStore({
    plan: {
      id: 'plan-1',
      status: 'PENDING',
      details: {
        target_hospital_id: 'hospital-1',
        safety_check: { status: 'SAFE', blocking_issues: [] },
      },
    },
    hospital: { id: 'hospital-1', capacities: [{ totalBeds: 20, available: 0 }] },
  });
  await assert.rejects(
    approveDispatchPlan(noCapacity.prisma, 'plan-1'),
    /no reported available bed capacity/i,
  );
});

test('hospital assignment is optional, persisted in plan details, and capacity-checked when selected', async () => {
  const { prisma, state } = createStore();
  state.plan.details.recommendedHospitalId = 'legacy-hospital';
  const selected = await updatePlanHospital(prisma, 'plan-1', 'hospital-1');
  assert.equal(selected.details.target_hospital_id, 'hospital-1');

  const cleared = await updatePlanHospital(prisma, 'plan-1', null);
  assert.equal(cleared.details.target_hospital_id, null);
  assert.equal(state.plan.status, 'PENDING');

  state.hospital.capacities[0].available = 0;
  await assert.rejects(
    updatePlanHospital(prisma, 'plan-1', 'hospital-1'),
    /no reported available bed capacity/i,
  );
});

test('execution requires approval and atomically dispatches only currently available assigned resources', async () => {
  const { prisma, state } = createStore();

  await assert.rejects(executeDispatchPlan(prisma, 'plan-1'), /must be approved/i);
  assert.equal(state.resources[0].status, 'AVAILABLE');

  await approveDispatchPlan(prisma, 'plan-1', 'operator-1');
  const executed = await executeDispatchPlan(prisma, 'plan-1');

  assert.equal(executed.status, 'EXECUTED');
  assert.equal(executed.details.execution.executedAt.length > 0, true);
  assert.equal(state.resources[0].status, 'DISPATCHED');
});

test('execution rejects stale resource availability and non-dispatch recommendations', async () => {
  const unavailable = createStore({
    resources: [{ id: 'resource-1', name: 'Unit 1', status: 'MAINTENANCE' }],
  });
  await assert.rejects(
    approveDispatchPlan(unavailable.prisma, 'plan-1'),
    /not currently available/i,
  );
  assert.equal(unavailable.state.plan.status, 'PENDING');

  const stale = createStore();
  await approveDispatchPlan(stale.prisma, 'plan-1');
  stale.state.resources[0].status = 'MAINTENANCE';
  await assert.rejects(
    executeDispatchPlan(stale.prisma, 'plan-1'),
    /not currently available/i,
  );
  assert.equal(stale.state.plan.status, 'APPROVED');

  const monitor = createStore({
    plan: {
      id: 'plan-1',
      status: 'APPROVED',
      details: {
        recommended_action: 'MONITOR',
        assignments: [{ resource_id: 'resource-1' }],
        safety_check: { status: 'SAFE', blocking_issues: [] },
      },
    },
  });
  await assert.rejects(
    executeDispatchPlan(monitor.prisma, 'plan-1'),
    /does not authorize dispatch execution/i,
  );
});
