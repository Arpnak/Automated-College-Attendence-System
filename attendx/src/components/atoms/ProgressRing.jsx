export default function ProgressRing({ percentage = 0, size = 84, strokeWidth = 8, label, showValue = true }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clamped / 100) * circumference;
  const ringColor = clamped >= 75 ? '#34D399' : clamped >= 50 ? '#F2B705' : '#FB7185';

  return (
    <div className="inline-flex flex-col items-center gap-2" role="img" aria-label={`${label || 'Attendance'}: ${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-ink-700/20 dark:stroke-ink-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
        />
        {showValue && (
          <text
            x="50%"
            y="50%"
            dy="0.35em"
            textAnchor="middle"
            className="fill-current text-ink-950 dark:text-mist font-mono font-medium"
            style={{ fontSize: size * 0.22 }}
            transform={`rotate(90 ${size / 2} ${size / 2})`}
          >
            {Math.round(clamped)}%
          </text>
        )}
      </svg>
      {label && <span className="text-xs text-fog">{label}</span>}
    </div>
  );
}
