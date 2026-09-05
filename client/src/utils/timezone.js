/**
 * IST (Asia/Kolkata, UTC+5:30) date/time utilities for the FinanceManager frontend.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds

/**
 * Get today's date as YYYY-MM-DD in IST.
 * Uses the browser's Date object but offsets to IST.
 */
export function todayISO() {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get current month as YYYY-MM in IST.
 */
export function currentMonthISO() {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Build month selector options (12 months) using IST.
 * Returns [{ value: "YYYY-MM", label: "September 2026" }, ...]
 */
export function buildMonthOptions(count = 12) {
  const options = [];
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();

  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, month - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    options.push({ value, label });
  }
  return options;
}

/**
 * Format an ISO datetime string for display in IST.
 */
export function formatDateTime(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Relative time ("5m ago", "2h ago") from an ISO datetime string.
 * Compares against now — both parsed as UTC (since ISO strings from the
 * backend will include +05:30 offset).
 */
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}