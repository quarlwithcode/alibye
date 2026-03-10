/**
 * ⏱️ alibye — Quota Calculation
 * Pure function: config + tracked minutes → QuotaStatus.
 */

import { QuotaStatus } from './types.js';

export function calcQuotaStatus(
  config: { weekly_quota_hours: number; daily_quota_hours: number },
  todayMinutes: number,
  weekMinutes: number,
  dayOfWeek: number, // 0=Sun, 1=Mon, ..., 6=Sat
): QuotaStatus | null {
  if (config.weekly_quota_hours <= 0 && config.daily_quota_hours <= 0) return null;

  const dailyTarget = config.daily_quota_hours * 60; // in minutes
  const weeklyTarget = config.weekly_quota_hours * 60;

  const dailyTracked = todayMinutes;
  const dailyRemaining = Math.max(0, dailyTarget - dailyTracked);
  const dailyPercent = dailyTarget > 0 ? (dailyTracked / dailyTarget) * 100 : 0;

  const weeklyTracked = weekMinutes;
  const weeklyRemaining = Math.max(0, weeklyTarget - weeklyTracked);
  const weeklyPercent = weeklyTarget > 0 ? (weeklyTracked / weeklyTarget) * 100 : 0;

  // Workdays elapsed (Mon=1..Fri=5 are workdays)
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  const workdaysElapsed = dayOfWeek === 0 ? 5 : dayOfWeek === 6 ? 5 : dayOfWeek;
  const projectedWeekTotal = workdaysElapsed > 0 ? (weeklyTracked / workdaysElapsed) * 5 : 0;
  const onPace = weeklyTarget > 0 ? projectedWeekTotal >= weeklyTarget * 0.9 : dailyTracked >= dailyTarget * 0.9;

  return {
    daily_target: Math.round(dailyTarget * 100) / 100,
    daily_tracked: Math.round(dailyTracked * 100) / 100,
    daily_remaining: Math.round(dailyRemaining * 100) / 100,
    daily_percent: Math.round(dailyPercent * 10) / 10,
    weekly_target: Math.round(weeklyTarget * 100) / 100,
    weekly_tracked: Math.round(weeklyTracked * 100) / 100,
    weekly_remaining: Math.round(weeklyRemaining * 100) / 100,
    weekly_percent: Math.round(weeklyPercent * 10) / 10,
    projected_week_total: Math.round(projectedWeekTotal * 100) / 100,
    on_pace: onPace,
  };
}
