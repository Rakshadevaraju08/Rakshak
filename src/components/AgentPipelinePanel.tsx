import React from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  AlertTriangle,
  Truck,
  Compass,
  TrendingUp,
  Cpu,
  RefreshCw,
  Info
} from 'lucide-react';
import type { AgentState } from '../types';

export interface AgentPipelinePanelProps {
  /**
   * Array of 6 agent states representing the sequential autonomous pipeline
   */
  agentStates: AgentState[];
  /**
   * Optional collapsed state for responsive sidebars/drawers
   */
  isCollapsed?: boolean;
  /**
   * Callback to toggle collapse/expand
   */
  onToggleCollapse?: () => void;
  /**
   * Optional current incident code for header telemetry display
   */
  incidentId?: string | null;
  /**
   * Optional extra container classes
   */
  className?: string;
}

// Fallback canonical definitions if needed
const CANONICAL_PIPELINE = [
  { name: 'Situation Agent', question: 'What is happening?', icon: Layers },
  { name: 'Risk Agent', question: 'How urgent is it?', icon: AlertTriangle },
  { name: 'Resource Agent', question: 'Who should respond?', icon: Truck },
  { name: 'Route Agent', question: 'How do we reach them?', icon: Compass },
  { name: 'Predictive Agent', question: 'What happens next?', icon: TrendingUp },
  { name: 'Master Coordinator', question: 'What should we do?', icon: Cpu },
];

export const AgentPipelinePanel: React.FC<AgentPipelinePanelProps> = ({
  agentStates,
  isCollapsed = false,
  onToggleCollapse,
  incidentId,
  className = '',
}) => {
  // Ensure we display 6 agents aligned to canonical pipeline order
  const normalizedStates: (AgentState & { Icon: typeof Layers })[] = CANONICAL_PIPELINE.map(
    (canonical, index) => {
      const incoming = agentStates && agentStates[index];
      return {
        name: incoming?.name || canonical.name,
        question: incoming?.question || canonical.question,
        status: incoming?.status || 'idle',
        summary: incoming?.summary,
        Icon: canonical.icon,
      };
    }
  );

  const completedCount = normalizedStates.filter((a) => a.status === 'complete').length;
  const isProcessingAny = normalizedStates.some((a) => a.status === 'processing');
  const allIdle = normalizedStates.every((a) => a.status === 'idle');

  // Collapsed Rail View (ultra-compact vertical badge bar for responsive layouts)
  if (isCollapsed) {
    return (
      <aside
        id="agent-pipeline-rail"
        className={`w-14 bg-surface-container-lowest border-l border-outline-variant/40 flex flex-col justify-between py-3 px-1.5 transition-all select-none ${className}`}
        aria-label="Collapsed 6-Agent Pipeline"
      >
        <div className="flex flex-col items-center gap-3">
          <button
            id="agent-pipeline-expand-btn"
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded bg-surface-container hover:bg-surface-container-high text-secondary flex items-center justify-center transition-colors shadow-sm"
            title="Expand 6-Agent Pipeline"
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="w-full h-px bg-outline-variant/30" />

          {/* Micro pipeline dots */}
          <div className="flex flex-col items-center gap-2 py-1">
            {normalizedStates.map((agent, idx) => {
              const isDone = agent.status === 'complete';
              const isProc = agent.status === 'processing';
              return (
                <div
                  key={agent.name}
                  className="relative group flex items-center justify-center"
                  title={`${idx + 1}. ${agent.name}: ${agent.status.toUpperCase()}${
                    agent.summary ? ` — ${agent.summary}` : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono transition-colors ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/60'
                        : isProc
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500 animate-pulse'
                        : 'bg-surface-container text-outline border border-outline-variant/40'
                    }`}
                  >
                    {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : idx + 1}
                  </div>
                  {/* Tooltip on hover */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-surface-container-highest border border-outline-variant text-on-surface text-xs rounded whitespace-nowrap hidden group-hover:block z-50 shadow-xl pointer-events-none">
                    <p className="font-bold text-[11px] text-secondary font-mono">{agent.name}</p>
                    <p className="text-[10px] text-outline">{agent.question}</p>
                    {agent.summary && (
                      <p className="text-[10px] text-emerald-300 mt-0.5">{agent.summary}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom vertical label */}
        <div className="flex flex-col items-center gap-2">
          <div className="rotate-180 [writing-mode:vertical-rl] text-[10px] tracking-widest font-mono text-outline uppercase font-semibold">
            6-Agent Pipeline
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              isProcessingAny
                ? 'bg-amber-400 animate-ping'
                : completedCount === 6
                ? 'bg-emerald-400'
                : 'bg-outline'
            }`}
          />
        </div>
      </aside>
    );
  }

  // Expanded View
  return (
    <aside
      id="agent-pipeline-panel"
      className={`w-full max-w-[340px] xl:w-[320px] 2xl:w-[340px] bg-surface-container-lowest border-l border-outline-variant/40 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all select-none ${className}`}
      aria-label="Six-Agent Autonomous Pipeline Panel"
    >
      {/* Top Header Banner */}
      <div className="p-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-secondary-container/20 border border-secondary/40 flex items-center justify-center text-secondary shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-label-action uppercase tracking-wider text-xs font-bold text-on-surface truncate">
                6-Agent Pipeline
              </span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-[10px] font-mono font-bold text-secondary">
                LIVE
              </span>
            </div>
            <span className="font-mono-data-sm text-outline text-[10px] truncate">
              {incidentId ? (
                <>
                  TARGET: <strong className="text-secondary">{incidentId}</strong>
                </>
              ) : (
                'STANDBY // NO INCIDENT'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Progress metric pill */}
          <span
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1 ${
              allIdle
                ? 'bg-surface-container text-outline'
                : completedCount === 6
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
            }`}
          >
            {isProcessingAny && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
            {completedCount}/6 DONE
          </span>

          {onToggleCollapse && (
            <button
              id="agent-pipeline-collapse-btn"
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors ml-0.5"
              title="Collapse Pipeline Panel"
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Standby Advisory Callout if no incident is selected */}
      {allIdle && !incidentId && (
        <div className="mx-3 mt-3 p-2.5 rounded bg-surface-container-low/90 border border-outline-variant/40 flex items-start gap-2 text-xs">
          <Info className="w-4 h-4 text-outline shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] font-bold text-outline uppercase tracking-wider">
              PIPELINE IDLE
            </span>
            <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">
              Select an incident from the Triage Stream to activate autonomous multi-agent reasoning.
            </p>
          </div>
        </div>
      )}

      {/* The Sequential Pipeline Body with Connected Spine */}
      <div className="p-3 flex-1 overflow-y-auto space-y-0 relative">
        {normalizedStates.map((agent, index) => {
          const isLast = index === normalizedStates.length - 1;
          const isComplete = agent.status === 'complete';
          const isProcessing = agent.status === 'processing';
          const isIdle = agent.status === 'idle';

          // Semantic Accent border & badge based on agent role
          const roleColorClass =
            index === 0
              ? 'text-cyan-400 border-cyan-500/30'
              : index === 1
              ? 'text-red-400 border-red-500/30'
              : index === 2
              ? 'text-blue-400 border-blue-500/30'
              : index === 3
              ? 'text-amber-400 border-amber-500/30'
              : index === 4
              ? 'text-purple-400 border-purple-500/30'
              : 'text-emerald-400 border-emerald-500/30';

          return (
            <div key={agent.name} className="relative flex items-start gap-3 group">
              {/* Left Sequential Pipeline Connector Spine */}
              <div className="flex flex-col items-center shrink-0 w-6 self-stretch">
                {/* Node Status Indicator Ring / Checkmark */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all z-10 text-xs font-mono font-bold shadow-md ${
                    isComplete
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/40 shadow-emerald-900/40'
                      : isProcessing
                      ? 'bg-surface-container-high border-2 border-amber-400 text-amber-300 ring-4 ring-amber-500/20'
                      : 'bg-surface-container-low border border-outline-variant/60 text-outline'
                  }`}
                  aria-label={`${agent.name} status: ${agent.status}`}
                >
                  {isComplete ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : isProcessing ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    <span className="text-[10px] text-outline font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Vertical Connector Line */}
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[36px] my-0.5 transition-colors duration-300 ${
                      isComplete
                        ? 'bg-gradient-to-b from-emerald-500 to-emerald-500/40'
                        : isProcessing
                        ? 'bg-gradient-to-b from-amber-400/80 to-outline-variant/30'
                        : 'bg-outline-variant/30'
                    }`}
                  />
                )}
              </div>

              {/* Agent Card Container */}
              <div
                className={`flex-1 mb-2.5 p-2.5 rounded border transition-all duration-200 ${
                  isProcessing
                    ? 'bg-surface-container-high/90 border-amber-500/70 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                    : isComplete
                    ? 'bg-surface-container-low/95 border-outline-variant/40 hover:border-outline-variant/70 shadow-sm'
                    : 'bg-surface-container-lowest/60 border-outline-variant/20 opacity-75'
                }`}
              >
                {/* Card Top Row: Agent Name + Status Pill */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <agent.Icon className={`w-3.5 h-3.5 shrink-0 ${roleColorClass}`} />
                    <span
                      className={`font-label-action text-xs font-bold truncate ${
                        isProcessing
                          ? 'text-amber-300'
                          : isComplete
                          ? 'text-on-surface'
                          : 'text-outline'
                      }`}
                    >
                      {agent.name}
                    </span>
                  </div>

                  {/* Status Indicator Tag */}
                  {isComplete ? (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1 border border-emerald-800/50">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      COMPLETE
                    </span>
                  ) : isProcessing ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 border border-amber-700/60 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-1 py-0.2 rounded bg-surface-container text-outline font-mono text-[9px]">
                      IDLE
                    </span>
                  )}
                </div>

                {/* Guiding Question */}
                <div className="text-[11px] text-outline font-medium italic mt-0.5 leading-snug">
                  “{agent.question}”
                </div>

                {/* Summary Output Box when Complete */}
                {isComplete && agent.summary && (
                  <div className="mt-1.5 pt-1.5 border-t border-outline-variant/30 flex items-start gap-1.5 text-xs">
                    <span className="font-mono text-[10px] text-secondary font-semibold shrink-0 uppercase tracking-tight">
                      OUT:
                    </span>
                    <span className="font-mono text-[11px] text-on-surface leading-tight font-medium break-words">
                      {agent.summary}
                    </span>
                  </div>
                )}

                {/* Processing Placeholder */}
                {isProcessing && (
                  <div className="mt-1.5 pt-1.5 border-t border-amber-500/20 flex items-center gap-1.5 text-[10px] font-mono text-amber-300/90">
                    <RefreshCw className="w-3 h-3 animate-spin shrink-0 text-amber-400" />
                    <span>Analyzing sensor telemetry & telemetry delta...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Status Bar */}
      <div className="p-2.5 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between text-[10px] font-mono text-outline">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span>MESH REASONING ENGINE</span>
        </div>
        <span className="text-secondary font-bold">LAT: 12ms</span>
      </div>
    </aside>
  );
};

export default AgentPipelinePanel;
