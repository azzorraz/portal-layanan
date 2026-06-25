import { STATUS_STYLES, SLA_STYLES, PRIORITY_STYLES } from "@/lib/format";

export function StatusBadge({ status, testId }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  return (
    <span
      data-testid={testId || "status-badge"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

export function SlaBadge({ state, testId }) {
  const s = SLA_STYLES[state] || SLA_STYLES.tidak_diatur;
  return (
    <span
      data-testid={testId || "sla-badge"}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const cls = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Normal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {priority}
    </span>
  );
}
