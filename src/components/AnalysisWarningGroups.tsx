import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { groupAnalysisWarnings, type AnalysisNoticeSeverity } from '../services/analysisPresentation';

const severityLabels: Record<AnalysisNoticeSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Information',
};

function AnalysisWarningGroups({ warnings }: { warnings: unknown[] }) {
  const groups = groupAnalysisWarnings(warnings);
  if (groups.length === 0) return <p className="analysis-notices-empty">No analysis notices were returned.</p>;

  return (
    <ul className="analysis-notice-groups">
      {groups.map(group => {
        const Icon = group.severity === 'critical'
          ? ShieldAlert
          : group.severity === 'info'
            ? Info
            : AlertTriangle;
        return (
          <li className={`analysis-notice analysis-notice-${group.severity}`} key={group.key}>
            <Icon size={18} aria-hidden="true" />
            <div className="analysis-notice-content">
              <div className="analysis-notice-heading">
                <strong>{group.title}</strong>
                <span>{severityLabels[group.severity]}</span>
              </div>
              <p>{group.description}</p>
              <details>
                <summary>Technical details ({group.details.length})</summary>
                <ul>
                  {group.details.map((detail, index) => (
                    <li key={`${detail.code}-${detail.source}-${index}`}>
                      <code>{detail.code}</code>
                      <span>{detail.source}: {detail.message}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default AnalysisWarningGroups;
