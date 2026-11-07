/**
 * TradeVault — Weekly Calendar & Indian Market IST Date Utilities
 *
 * Implements Indian Stock Market calendar calculations (Asia/Kolkata, UTC+05:30).
 * Handles Monday–Friday trading weeks, weekend adjustments, and UTC/IST boundaries.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface WeekPreset {
  id: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isCurrent?: boolean;
}

/**
 * Converts a Date or ISO string into YYYY-MM-DD format in IST.
 */
export function toISTDateString(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Get start of day in IST as ISO string with +05:30 offset.
 * Example: '2026-11-02' -> '2026-11-02T00:00:00.000+05:30'
 */
export function getISTStartOfDayISO(dateStr: string): string {
  return `${dateStr}T00:00:00.000+05:30`;
}

/**
 * Get end of day in IST as ISO string with +05:30 offset.
 * Example: '2026-11-06' -> '2026-11-06T23:59:59.999+05:30'
 */
export function getISTEndOfDayISO(dateStr: string): string {
  return `${dateStr}T23:59:59.999+05:30`;
}

/**
 * Parses an IST date string (YYYY-MM-DD) to a Date object representing
 * 00:00:00 IST on that day.
 */
export function parseISTDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/**
 * Returns day of week in IST (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 */
export function getISTDayOfWeek(date: Date = new Date()): number {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
  }).format(date);

  const days: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return days[dayStr] ?? date.getDay();
}

/**
 * Computes the most recently completed trading week in IST (Monday to Friday/Sunday).
 *
 * If today is Saturday or Sunday: returns the week that concluded on Friday.
 * If today is Monday to Friday: returns the previous week's Monday to Friday.
 */
export function getCompletedTradingWeekIST(referenceDate: Date = new Date()): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const todayISTStr = toISTDateString(referenceDate);
  const dayOfWeek = getISTDayOfWeek(referenceDate);

  // We want to find the Monday of the most recently completed trading week.
  // If Saturday (6) or Sunday (0): the week ended this past Friday.
  // If Monday (1) through Friday (5): the week ended the previous Friday.
  let daysToSubtractToLastFriday = 0;

  if (dayOfWeek === 6) {
    // Saturday -> Friday was yesterday (-1)
    daysToSubtractToLastFriday = 1;
  } else if (dayOfWeek === 0) {
    // Sunday -> Friday was 2 days ago (-2)
    daysToSubtractToLastFriday = 2;
  } else {
    // Mon(1)..Fri(5) -> Last completed week ended on previous Friday
    // For Mon(1), prev Friday was 3 days ago (-3)
    // For Tue(2), prev Friday was 4 days ago (-4)
    // For Wed(3), prev Friday was 5 days ago (-5)
    // For Thu(4), prev Friday was 6 days ago (-6)
    // For Fri(5), prev Friday was 7 days ago (-7)
    daysToSubtractToLastFriday = dayOfWeek + 2;
  }

  const lastFridayMs = referenceDate.getTime() - daysToSubtractToLastFriday * 86400000;
  const lastFridayDate = new Date(lastFridayMs);
  const lastFridayStr = toISTDateString(lastFridayDate);

  // Monday was 4 days before Friday
  const lastMondayMs = lastFridayMs - 4 * 86400000;
  const lastMondayDate = new Date(lastMondayMs);
  const lastMondayStr = toISTDateString(lastMondayDate);

  // In Indian trading reviews, we include through Sunday so any weekend settlement / weekend journal entries are captured.
  const lastSundayMs = lastFridayMs + 2 * 86400000;
  const lastSundayDate = new Date(lastSundayMs);
  const lastSundayStr = toISTDateString(lastSundayDate);

  return {
    startDate: lastMondayStr,
    endDate: lastSundayStr,
    label: `Last Completed Week (${formatPresetDateRange(lastMondayStr, lastFridayStr)})`,
  };
}

/**
 * Returns a list of standard weekly presets for the week selector.
 */
export function getWeeklyPresetsIST(referenceDate: Date = new Date()): WeekPreset[] {
  const completed = getCompletedTradingWeekIST(referenceDate);
  const presets: WeekPreset[] = [];

  // 1. Last Completed Week (Default)
  presets.push({
    id: 'last_completed',
    label: `Last Completed Week (${completed.startDate} to ${completed.endDate})`,
    startDate: completed.startDate,
    endDate: completed.endDate,
  });

  // 2. Current Week (In Progress)
  const dayOfWeek = getISTDayOfWeek(referenceDate);
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1 ... Sun=6
  const currentMondayMs = referenceDate.getTime() - daysSinceMonday * 86400000;
  const currentSundayMs = currentMondayMs + 6 * 86400000;
  const currentMondayStr = toISTDateString(new Date(currentMondayMs));
  const currentSundayStr = toISTDateString(new Date(currentSundayMs));

  presets.push({
    id: 'current_week',
    label: `Current Week (${currentMondayStr} to ${currentSundayStr})`,
    startDate: currentMondayStr,
    endDate: currentSundayStr,
    isCurrent: true,
  });

  // 3. 2 Weeks Ago
  const twoWeeksAgoMondayMs = parseISTDate(completed.startDate).getTime() - 7 * 86400000;
  const twoWeeksAgoSundayMs = parseISTDate(completed.endDate).getTime() - 7 * 86400000;
  const twoWeeksAgoStart = toISTDateString(new Date(twoWeeksAgoMondayMs));
  const twoWeeksAgoEnd = toISTDateString(new Date(twoWeeksAgoSundayMs));

  presets.push({
    id: 'two_weeks_ago',
    label: `2 Weeks Ago (${twoWeeksAgoStart} to ${twoWeeksAgoEnd})`,
    startDate: twoWeeksAgoStart,
    endDate: twoWeeksAgoEnd,
  });

  // 4. 3 Weeks Ago
  const threeWeeksAgoMondayMs = parseISTDate(completed.startDate).getTime() - 14 * 86400000;
  const threeWeeksAgoSundayMs = parseISTDate(completed.endDate).getTime() - 14 * 86400000;
  const threeWeeksAgoStart = toISTDateString(new Date(threeWeeksAgoMondayMs));
  const threeWeeksAgoEnd = toISTDateString(new Date(threeWeeksAgoSundayMs));

  presets.push({
    id: 'three_weeks_ago',
    label: `3 Weeks Ago (${threeWeeksAgoStart} to ${threeWeeksAgoEnd})`,
    startDate: threeWeeksAgoStart,
    endDate: threeWeeksAgoEnd,
  });

  // 5. 4 Weeks Ago
  const fourWeeksAgoMondayMs = parseISTDate(completed.startDate).getTime() - 21 * 86400000;
  const fourWeeksAgoSundayMs = parseISTDate(completed.endDate).getTime() - 21 * 86400000;
  const fourWeeksAgoStart = toISTDateString(new Date(fourWeeksAgoMondayMs));
  const fourWeeksAgoEnd = toISTDateString(new Date(fourWeeksAgoSundayMs));

  presets.push({
    id: 'four_weeks_ago',
    label: `4 Weeks Ago (${fourWeeksAgoStart} to ${fourWeeksAgoEnd})`,
    startDate: fourWeeksAgoStart,
    endDate: fourWeeksAgoEnd,
  });

  return presets;
}

/**
 * Format date range nicely (e.g. "02 Nov - 06 Nov 2026")
 */
function formatPresetDateRange(startStr: string, endStr: string): string {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const sFormatted = s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const eFormatted = e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${sFormatted} - ${eFormatted}`;
}
