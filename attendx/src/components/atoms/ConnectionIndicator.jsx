const CONFIG = {
  open: { label: 'Live', dot: 'bg-status-present', pulse: true },
  connecting: { label: 'Connecting…', dot: 'bg-scan-500', pulse: true },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-scan-500', pulse: true },
  closed: { label: 'Offline', dot: 'bg-status-absent', pulse: false },
};

export default function ConnectionIndicator({ status = 'closed', attempt = 0 }) {
  const cfg = CONFIG[status] || CONFIG.closed;
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium text-fog">
      <span className="relative flex h-2.5 w-2.5">
        {cfg.pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dot} animate-pulse-ring`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
      </span>
      <span>
        {cfg.label}
        {status === 'reconnecting' && attempt > 0 ? ` (attempt ${attempt})` : ''}
      </span>
    </div>
  );
}
