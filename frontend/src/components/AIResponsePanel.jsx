import React from 'react';
import { Panel } from './ui/Card';
import { PriorityBadge, StatusBadge } from './ui/Badge';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { BrainCircuit, AlertTriangle, Clock, Target, Info, Truck } from 'lucide-react';

export default function AIResponsePanel({ plan, onApprove, isExecuting = false }) {
  if (!plan) return null;

  // Convert the integer priority back to P1-P5 string format for the badge
  const mapPriorityToBadge = (p) => {
    switch(p) {
      case 1: return 'P5'; // P1_CRITICAL maps to P5 in UI
      case 2: return 'P4';
      case 3: return 'P3';
      case 4: return 'P2';
      case 5: return 'P1';
      default: return 'P2';
    }
  };

  const priorityStr = plan.risk ? mapPriorityToBadge(plan.risk.priority) : 'P2';
  
  return (
    <div className="flex flex-col h-full bg-surface-container-low border border-secondary/30 rounded-xl overflow-hidden shadow-lg">
      
      {/* HEADER */}
      <header className="bg-secondary-container/10 border-b border-secondary/30 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <BrainCircuit className="text-secondary" size={24} />
          <h2 className="text-xl font-bold font-mono tracking-wide text-secondary">AI RESPONSE PLAN</h2>
          {plan.degraded && (
            <span className="ml-auto rounded bg-warning-container px-2 py-1 text-xs font-bold text-on-warning-container">
              DEGRADED MODE
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <PriorityBadge level={priorityStr} />
          <span className="text-sm font-bold uppercase tracking-wider text-outline">— {plan.risk?.risk_level || 'UNKNOWN'}</span>
        </div>
        
        {plan.recommended_action && (
          <div className="mt-4 p-3 bg-surface rounded-lg border border-outline-variant/40">
            <p className="text-xs font-mono text-outline mb-1">RECOMMENDED ACTION</p>
            <p className="text-lg font-bold">{plan.recommended_action.replace(/_/g, ' ')}</p>
          </div>
        )}
      </header>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        
        {/* WARNINGS */}
        {plan.warnings?.length > 0 && (
          <div className="space-y-2">
            {plan.warnings.map((warn, idx) => (
              <Alert key={idx} variant="warning" title={`Warning: ${warn.source}`}>
                {warn.message}
              </Alert>
            ))}
          </div>
        )}

        {/* SITUATION & RISK (WHY?) */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-outline flex items-center gap-2">
            <Info size={16} /> Why?
          </h3>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {plan.risk?.reasons?.map((reason, i) => <li key={`r-${i}`}>{reason}</li>)}
            {plan.situation?.vulnerable_population_impact && (
              <li>{plan.situation.vulnerable_population_impact}</li>
            )}
            {plan.explanation?.map((exp, i) => <li key={`e-${i}`}>{exp}</li>)}
          </ul>
        </section>

        {/* PREDICTION TIMELINE */}
        {plan.prediction?.forecast?.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-outline flex items-center gap-2">
              <Clock size={16} /> Prediction
            </h3>
            <div className="flex flex-wrap gap-3">
              {plan.prediction.forecast.map((f, i) => (
                <div key={i} className="flex-1 min-w-[100px] border border-outline-variant/40 rounded-lg p-3 bg-surface text-center">
                  <p className="text-xs font-mono text-outline mb-1">+{f.horizon_minutes} min</p>
                  <p className={`text-sm font-bold ${f.risk_level === 'CRITICAL' ? 'text-[var(--color-priority-p5)]' : 'text-[var(--color-priority-p3)]'}`}>
                    {f.risk_level}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* RESOURCES & ROUTE */}
        {plan.assignments?.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-outline flex items-center gap-2">
              <Truck size={16} /> Assignments & Routing
            </h3>
            <div className="space-y-3">
              {plan.assignments.map((assignment, i) => (
                <div key={i} className="border border-outline-variant/40 rounded-lg p-4 bg-surface">
                  <div className="flex justify-between items-start mb-2">
                    <strong className="text-secondary">{assignment.resource_id}</strong>
                    <StatusBadge status={assignment.action} />
                  </div>
                  
                  {assignment.route && (
                    <div className="mt-3 pl-3 border-l-2 border-secondary/30 space-y-1">
                      <p className="text-xs font-mono text-outline uppercase">Route Analysis</p>
                      <p className="text-sm">ETA: <strong className="text-on-surface">{assignment.route.estimated_time_mins} min</strong></p>
                      {assignment.route.explanation && (
                        <p className="text-sm text-on-surface-variant italic">{assignment.route.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* FOOTER ACTION */}
      {plan.human_approval_required && onApprove && (
        <div className="p-4 sm:p-6 bg-surface-container-lowest border-t border-outline-variant/40">
          <Button 
            variant="primary" 
            className="w-full py-3 text-base"
            onClick={onApprove}
            disabled={isExecuting}
          >
            {isExecuting ? 'Executing...' : 'Approve & Execute Plan'}
          </Button>
        </div>
      )}
    </div>
  );
}
