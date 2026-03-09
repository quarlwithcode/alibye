/**
 * ⏱️ alibye — Time Rounding Engine
 *
 * Supports: none, up, down, nearest
 * Intervals: 1, 5, 6, 10, 15, 30 minutes
 */

import { RoundingMode, RoundingInterval } from './types.js';

/**
 * Round duration in milliseconds to minutes using configured mode + interval.
 */
export function roundDuration(durationMs: number, mode: RoundingMode, interval: RoundingInterval): number {
  const rawMinutes = durationMs / 60000;

  if (mode === 'none' || interval <= 1) {
    return Math.round(rawMinutes * 100) / 100;
  }

  switch (mode) {
    case 'up':
      return Math.ceil(rawMinutes / interval) * interval;
    case 'down':
      return Math.floor(rawMinutes / interval) * interval;
    case 'nearest':
      return Math.round(rawMinutes / interval) * interval;
    default:
      return Math.round(rawMinutes * 100) / 100;
  }
}

/**
 * Format minutes into human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format minutes as decimal hours (e.g., 2.25).
 */
export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/**
 * Format milliseconds as elapsed timer display (HH:MM:SS).
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calculate billable amount from rounded minutes and rate.
 */
export function calcAmount(roundedMinutes: number, rate: number | null): number {
  if (!rate || rate <= 0) return 0;
  return Math.round((roundedMinutes / 60) * rate * 100) / 100;
}
