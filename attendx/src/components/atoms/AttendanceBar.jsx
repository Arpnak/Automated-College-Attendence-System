/**
 * AttendanceBar — horizontal progress bar with colour logic
 * Props: pct (0-100), color ('green'|'yellow'|'red'), showLabel
 */
const COLOR_MAP = {
  green:  { bar: 'bg-status-present',      text: 'text-status-present' },
  yellow: { bar: 'bg-yellow-400',           text: 'text-yellow-400' },
  red:    { bar: 'bg-status-absent',        text: 'text-status-absent' },
};

export default function AttendanceBar({ pct = 0, color = 'green', showLabel = true, className = '' }) {
  const { bar, text } = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className={`text-xs font-semibold tabular-nums w-9 shrink-0 ${text}`}>
          {pct}%
        </span>
      )}
      <div className="flex-1 h-1.5 rounded-full bg-ink-700/20 dark:bg-ink-700/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
