import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

// Gap #3: Rekognition confidence isn't binary. "needs-review" surfaces
// ambiguous matches in a queue instead of silently defaulting to
// present or absent.
const CONFIG = {
  present: { label: 'Present', icon: CheckCircle2, classes: 'bg-status-present/15 text-status-present' },
  absent: { label: 'Absent', icon: XCircle, classes: 'bg-status-absent/15 text-status-absent' },
  pending: { label: 'Pending', icon: Clock, classes: 'bg-status-pending/15 text-fog' },
  'needs-review': { label: 'Needs Review', icon: AlertTriangle, classes: 'bg-status-review/15 text-status-review' },
};

export default function StatusBadge({ status = 'pending', size = 'md' }) {
  const cfg = CONFIG[status] || CONFIG.pending;
  const Icon = cfg.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${padding} ${cfg.classes}`}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {cfg.label}
    </span>
  );
}
