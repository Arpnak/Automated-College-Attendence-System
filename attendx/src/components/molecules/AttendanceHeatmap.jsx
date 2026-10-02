/**
 * AttendanceHeatmap — LeetCode-style streak calendar
 *
 * Props:
 *   days        — array from buildCalendarGrid(): [{ date, status, isToday, isFuture }]
 *   onToggle    — optional (professor only): fn(date, currentStatus) called on cell click
 *   readOnly    — if true, cells are display-only (student view)
 */
export default function AttendanceHeatmap({ days, onToggle, readOnly = false }) {
  if (!days.length) {
    return <p className="text-xs text-fog text-center py-4">No data to display.</p>;
  }

  // Group days into weeks (columns) for the grid
  // Pad start to Sunday
  const firstDay = new Date(days[0].date + 'T00:00:00');
  const startPad = firstDay.getDay(); // 0=Sun
  const paddedDays = [
    ...Array.from({ length: startPad }, (_, i) => ({ date: null, pad: true, i })),
    ...days,
  ];

  // Chunk into groups of 7 (weeks)
  const weeks = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  const cellClass = (day) => {
    if (day.pad) return 'invisible';
    if (day.isFuture) return 'bg-ink-800/30 dark:bg-ink-700/20 rounded cursor-not-allowed opacity-30';
    if (day.status === 'present') return 'bg-status-present rounded cursor-pointer hover:brightness-110 transition-all';
    if (day.status === 'absent')  return 'bg-status-absent/60 rounded cursor-pointer hover:brightness-110 transition-all';
    // null = no data yet
    return `bg-ink-700/20 dark:bg-ink-700/40 rounded ${!readOnly && !day.isFuture ? 'cursor-pointer hover:bg-ink-600/30' : ''} transition-all`;
  };

  const handleClick = (day) => {
    if (readOnly || day.pad || day.isFuture || !onToggle) return;
    const nextStatus = day.status === 'present' ? 'absent' : 'present';
    onToggle(day.date, nextStatus);
  };

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Extract months for the x-axis label
  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const firstReal = week.find((d) => !d.pad);
    if (!firstReal) return;
    const d = new Date(firstReal.date + 'T00:00:00');
    const mon = d.toLocaleString('default', { month: 'short' });
    if (!monthLabels.length || monthLabels[monthLabels.length - 1].label !== mon) {
      monthLabels.push({ label: mon, col: wi });
    }
  });

  return (
    <div className="overflow-x-auto pb-2">
      {/* Month labels */}
      <div className="flex gap-1 mb-1 pl-7">
        {weeks.map((_, wi) => {
          const ml = monthLabels.find((m) => m.col === wi);
          return (
            <div key={wi} className="w-4 shrink-0 text-[9px] text-fog">
              {ml ? ml.label : ''}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="h-4 w-4 text-[9px] text-fog flex items-center justify-center">
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, di) => {
              const day = week[di] || { pad: true, i: di };
              return (
                <div
                  key={di}
                  title={day.date ? `${day.date}: ${day.status ?? 'no data'}` : undefined}
                  className={`h-4 w-4 shrink-0 ${cellClass(day)}`}
                  onClick={() => handleClick(day)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-end text-[10px] text-fog">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-status-present inline-block" /> Present</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-status-absent/60 inline-block" /> Absent</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-700/20 inline-block" /> No data</span>
      </div>
    </div>
  );
}
