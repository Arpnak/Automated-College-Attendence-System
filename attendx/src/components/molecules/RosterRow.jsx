import { Hash, Mail } from 'lucide-react';
import StatusBadge from '../atoms/StatusBadge';

// Manual override support (workflow step "Manual Override"): clicking the
// row toggles present/absent optimistically via onToggle.
export default function RosterRow({ student, onToggle, interactive = true }) {
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onToggle?.(student)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border border-ink-700/10 dark:border-ink-700/60
        bg-white dark:bg-ink-800/60 px-3 py-2.5 text-left transition-colors
        ${interactive ? 'hover:border-scan-500/50 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700/10 dark:bg-ink-700 text-xs font-semibold text-fog">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-950 dark:text-mist">{student.name}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {student.student_number && (
              <span className="flex items-center gap-0.5 text-[10px] font-mono bg-ink-800/60 text-fog rounded px-1.5 py-0.5">
                <Hash size={9} />{student.student_number}
              </span>
            )}
            {student.email && (
              <p className="flex items-center gap-1 text-[10px] text-fog">
                <Mail size={9} />{student.email}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {student.confidence !== undefined && (
          <span className="hidden sm:inline font-mono text-[11px] text-fog">{student.confidence}%</span>
        )}
        <StatusBadge status={student.status} size="sm" />
      </div>
    </button>
  );
}
