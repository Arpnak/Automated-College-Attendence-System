/**
 * ClassRoll Attendance Calculation Engine
 *
 * Variables:
 *   E = elapsed valid course days (up to and including today, with smart today-handling)
 *   A = attended days (status === 'present')
 *   P = (A / E) × 100
 *
 * Edge cases handled:
 *  - Course hasn't started (today < start_date) → { pct: 0, color: 'green', notStarted: true }
 *  - E === 0 (no elapsed days yet)              → { pct: 0, color: 'green' }
 *  - Today's attendance not yet marked           → today NOT counted in E (prevents premature penalty)
 */

/**
 * Parse a date string 'YYYY-MM-DD' into a local-midnight Date object,
 * avoiding UTC-offset surprises.
 */
function parseDate(str) {
  if (!str) return null;
  // Safely extract just the YYYY-MM-DD part before splitting, incase it's an ISO string (e.g. "2026-07-18T00:00:00.000Z")
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Returns 'YYYY-MM-DD' for a Date object in local time */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date string in local time */
export function todayStr() {
  return toDateStr(new Date());
}

/**
 * Determines attendance colour based on percentage.
 * @param {number} pct   0–100
 * @param {boolean} notStarted  true when course hasn't started
 */
export function attendanceColor(pct, notStarted = false) {
  if (notStarted || pct === 0) return 'green';
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

/**
 * Core attendance calculation.
 *
 * @param {Object} params
 * @param {Array}       params.workingDays 'YYYY-MM-DD'[]
 * @param {Object}      params.attendance  { 'YYYY-MM-DD': 'present'|'absent', ... }
 *
 * @returns {{ pct: number, color: string, attended: number, elapsed: number, notStarted: boolean }}
 */
export function calcAttendance({ workingDays = [], attendance = {} }) {
  // Defensive filter: don't fully trust the caller/backend to have already
  // truncated workingDays to "elapsed so far". If a future working day (or
  // today, before it's been marked) slips into this list, it would silently
  // dilute the denominator and understate every student's real percentage
  // with no error anywhere to catch it.
  const todayISO = todayStr();
  const elapsedDays = workingDays.filter((date) => {
    if (date > todayISO) return false;              // future day — never counted
    if (date === todayISO) return date in attendance; // today only counts once marked
    return true;
  });

  if (elapsedDays.length === 0) {
    return { pct: 0, color: 'green', attended: 0, elapsed: 0, notStarted: true };
  }

  let attended = 0;
  for (const date of elapsedDays) {
    if (attendance[date] === 'present') {
      attended++;
    }
  }

  const elapsed = elapsedDays.length;
  const ratio = (attended / elapsed) * 100;
  // Color is decided off the true ratio, not the rounded display value, so a
  // borderline case like 74.6% shows red/yellow instead of rounding up to a
  // reassuring 75% green.
  const color = attendanceColor(ratio);
  const pct = Math.round(ratio);
  return { pct, color, attended, elapsed, notStarted: false };
}

/**
 * Generates the full calendar grid for a LeetCode-style heatmap.
 * Returns an array of { date: 'YYYY-MM-DD', status: 'present'|'absent'|null, isToday, isFuture }
 * spanning from startDate to endDate (or 30 days prior to today if not set).
 */
export function buildCalendarGrid({ startDate, endDate, workingDays = [], attendance = {} }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toDateStr(today);

  const start = startDate ? parseDate(startDate) : (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return d;
  })();

  const end = endDate ? parseDate(endDate) : today;

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = toDateStr(cursor);
    let status = attendance[iso] ?? null;
    
    // Mark working days without records as absent, rather than leaving them blank
    if (!status && workingDays.includes(iso)) {
      status = 'absent';
    }

    days.push({
      date: iso,
      status: status,
      isToday: iso === todayISO,
      isFuture: cursor > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
