function workflowError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function planDetails(plan) {
  return isRecord(plan.details) ? plan.details : {};
}

function getTargetHospitalId(details) {
  if (Object.prototype.hasOwnProperty.call(details, 'target_hospital_id')) {
    const assignedId = details.target_hospital_id;
    return typeof assignedId === 'string' && assignedId.trim() ? assignedId.trim() : null;
  }
  const target = details.target_hospital ?? details.targetHospital;
  const targetId = isRecord(target) ? target.id ?? target.hospital_id : target;
  const value = targetId
    ?? details.target_hospital_id
    ?? details.targetHospitalId
    ?? details.recommended_hospital_id
    ?? details.recommendedHospitalId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getAssignedResourceIds(details) {
  let assignments;
  if (Array.isArray(details.operator_resource_ids)) {
    assignments = details.operator_resource_ids;
  } else if (Array.isArray(details.assignments)) {
    assignments = details.assignments;
  } else if (isRecord(details.resource_agent_result) && Array.isArray(details.resource_agent_result.assignments)) {
    assignments = details.resource_agent_result.assignments;
  } else {
    assignments = details.recommendedResources ?? details.recommended_resources ?? [];
  }

  if (!Array.isArray(assignments)) return [];
  return assignments.flatMap((assignment) => {
    const id = typeof assignment === 'string'
      ? assignment
      : isRecord(assignment)
        ? assignment.resource_id ?? assignment.resourceId ?? assignment.id
        : null;
    return typeof id === 'string' && id.trim() ? [id.trim()] : [];
  });
}

function assertPlanSafety(details) {
  const safety = details.safety_check;
  if (!isRecord(safety)) {
    throw workflowError(409, 'This plan has no safety-check result and cannot be approved.');
  }

  const status = typeof safety.status === 'string' ? safety.status.toUpperCase() : '';
  const blockingIssues = Array.isArray(safety.blocking_issues)
    ? safety.blocking_issues.filter((issue) => typeof issue === 'string' && issue.trim())
    : [];
  if (status === 'BLOCKED' || blockingIssues.length > 0) {
    throw workflowError(409, blockingIssues[0] || 'The safety check blocked this plan.');
  }
  if (status !== 'SAFE' && status !== 'REVIEW_REQUIRED') {
    throw workflowError(409, 'The plan safety status is missing or not recognized.');
  }
}

async function validateHospitalCapacity(prisma, details) {
  const hospitalId = getTargetHospitalId(details);
  if (!hospitalId) return null;

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { capacities: { orderBy: { updatedAt: 'desc' }, take: 1 } },
  });
  if (!hospital) {
    throw workflowError(409, 'The receiving hospital no longer exists.');
  }

  const latestCapacity = hospital.capacities?.[0];
  if (!latestCapacity || !Number.isInteger(latestCapacity.available) || latestCapacity.available <= 0) {
    throw workflowError(409, 'The selected hospital has no reported available bed capacity.');
  }

  return hospital;
}

async function validateDispatchResources(prisma, details) {
  const action = typeof details.recommended_action === 'string'
    ? details.recommended_action.toUpperCase()
    : typeof details.recommendedAction === 'string'
      ? details.recommendedAction.toUpperCase()
      : '';
  if (action !== 'DISPATCH' && action !== 'IMMEDIATE_DISPATCH') return [];

  const resourceIds = getAssignedResourceIds(details);
  if (resourceIds.length === 0) {
    throw workflowError(409, 'A dispatch recommendation must have at least one assigned resource.');
  }
  if (new Set(resourceIds).size !== resourceIds.length) {
    throw workflowError(409, 'A response resource is assigned more than once.');
  }

  const resources = await prisma.resource.findMany({ where: { id: { in: resourceIds } } });
  if (resources.length !== resourceIds.length) {
    throw workflowError(409, 'One or more assigned response resources no longer exist.');
  }
  const unavailable = resources.find((resource) => resource.status !== 'AVAILABLE');
  if (unavailable) {
    throw workflowError(409, `Resource ${unavailable.name || unavailable.id} is not currently available.`);
  }
  return resourceIds;
}

async function getPendingPlan(prisma, planId) {
  const plan = await prisma.dispatchPlan.findUnique({ where: { id: planId } });
  if (!plan) throw workflowError(404, 'Dispatch plan not found.');
  if (plan.status !== 'PENDING') {
    throw workflowError(409, 'Only a pending plan can be updated or approved.');
  }
  return plan;
}

async function updatePlanHospital(prisma, planId, hospitalId) {
  return prisma.$transaction(async (transaction) => {
    const plan = await getPendingPlan(transaction, planId);
    const details = planDetails(plan);
    if (hospitalId !== null) {
      if (typeof hospitalId !== 'string' || !hospitalId.trim()) {
        throw workflowError(400, 'hospitalId must be a non-empty string or null.');
      }
      await validateHospitalCapacity(transaction, { ...details, target_hospital_id: hospitalId.trim() });
    }

    const updatedDetails = { ...details, target_hospital_id: hospitalId?.trim() ?? null };
    return transaction.dispatchPlan.update({
      where: { id: planId, status: 'PENDING' },
      data: { details: updatedDetails },
    });
  });
}

async function approveDispatchPlan(prisma, planId, approvedBy = null) {
  return prisma.$transaction(async (transaction) => {
    const plan = await getPendingPlan(transaction, planId);
    const details = planDetails(plan);
    assertPlanSafety(details);
    await validateHospitalCapacity(transaction, details);
    await validateDispatchResources(transaction, details);

    const approvedAt = new Date().toISOString();
    return transaction.dispatchPlan.update({
      where: { id: planId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        details: {
          ...details,
          operator_review: { status: 'APPROVED', approvedAt, approvedBy },
        },
      },
    });
  });
}

async function executeDispatchPlan(prisma, planId) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.dispatchPlan.findUnique({ where: { id: planId } });
    if (!plan) throw workflowError(404, 'Dispatch plan not found.');
    if (plan.status !== 'APPROVED') {
      throw workflowError(409, 'A dispatch plan must be approved before it can be executed.');
    }

    const details = planDetails(plan);
    assertPlanSafety(details);
    await validateHospitalCapacity(transaction, details);

    const action = typeof details.recommended_action === 'string'
      ? details.recommended_action.toUpperCase()
      : typeof details.recommendedAction === 'string'
        ? details.recommendedAction.toUpperCase()
        : '';
    if (action !== 'DISPATCH' && action !== 'IMMEDIATE_DISPATCH') {
      throw workflowError(409, 'The recommendation does not authorize dispatch execution.');
    }

    const resourceIds = await validateDispatchResources(transaction, details);

    const result = await transaction.resource.updateMany({
      where: { id: { in: resourceIds }, status: 'AVAILABLE' },
      data: { status: 'DISPATCHED' },
    });
    if (result.count !== resourceIds.length) {
      throw workflowError(409, 'Resource availability changed. Refresh the plan and review assignments.');
    }

    const executedAt = new Date().toISOString();
    return transaction.dispatchPlan.update({
      where: { id: planId },
      data: {
        status: 'EXECUTED',
        details: { ...details, execution: { executedAt } },
      },
    });
  });
}

module.exports = {
  approveDispatchPlan,
  executeDispatchPlan,
  getAssignedResourceIds,
  updatePlanHospital,
  workflowError,
};
