/**
 * ⏱️ alibye — Quota Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { calcQuotaStatus } from '../src/core/quota.js';
import { makeTmpAlibye } from './helpers.js';

describe('calcQuotaStatus (pure)', () => {
  it('returns null when both quotas are 0', () => {
    const result = calcQuotaStatus({ weekly_quota_hours: 0, daily_quota_hours: 0 }, 0, 0, 1);
    expect(result).toBeNull();
  });

  it('daily quota tracking', () => {
    const result = calcQuotaStatus({ weekly_quota_hours: 0, daily_quota_hours: 8 }, 240, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.daily_target).toBe(480); // 8 hours in minutes
    expect(result!.daily_tracked).toBe(240);
    expect(result!.daily_remaining).toBe(240);
    expect(result!.daily_percent).toBe(50);
  });

  it('weekly quota tracking', () => {
    // Wednesday (day 3), 12 hours tracked so far, target 40 hours/week
    const result = calcQuotaStatus({ weekly_quota_hours: 40, daily_quota_hours: 0 }, 0, 720, 3);
    expect(result).not.toBeNull();
    expect(result!.weekly_target).toBe(2400); // 40 hours in minutes
    expect(result!.weekly_tracked).toBe(720);
    expect(result!.weekly_percent).toBe(30);
    // Projected: (720/3 days) * 5 = 1200 minutes
    expect(result!.projected_week_total).toBe(1200);
    expect(result!.on_pace).toBe(false); // 1200 < 2400 * 0.9
  });

  it('on pace when projected meets 90% of target', () => {
    // Wednesday (day 3), 24 hours tracked, target 40 hours/week
    const result = calcQuotaStatus({ weekly_quota_hours: 40, daily_quota_hours: 0 }, 0, 1440, 3);
    // Projected: (1440/3)*5 = 2400 ≥ 2400*0.9=2160
    expect(result!.on_pace).toBe(true);
  });

  it('handles Sunday (treats as 5 workdays elapsed)', () => {
    const result = calcQuotaStatus({ weekly_quota_hours: 40, daily_quota_hours: 0 }, 0, 2000, 0);
    // Sunday: workdaysElapsed = 5, projected = (2000/5)*5 = 2000
    expect(result!.projected_week_total).toBe(2000);
  });

  it('handles Saturday (treats as 5 workdays elapsed)', () => {
    const result = calcQuotaStatus({ weekly_quota_hours: 40, daily_quota_hours: 0 }, 0, 2000, 6);
    expect(result!.projected_week_total).toBe(2000);
  });

  it('daily remaining never goes negative', () => {
    const result = calcQuotaStatus({ weekly_quota_hours: 0, daily_quota_hours: 8 }, 600, 0, 1);
    expect(result!.daily_remaining).toBe(0);
  });
});

describe('Quota in dashboard', () => {
  it('dashboard includes quota when configured', () => {
    const t = makeTmpAlibye({ weekly_quota_hours: 40, daily_quota_hours: 8 });
    const dash = t.alibye.dashboard();
    expect(dash.quota).not.toBeNull();
    expect(dash.quota!.weekly_target).toBe(2400);
    expect(dash.quota!.daily_target).toBe(480);
    t.cleanup();
  });

  it('dashboard quota is null when not configured', () => {
    const t = makeTmpAlibye();
    const dash = t.alibye.dashboard();
    expect(dash.quota).toBeNull();
    t.cleanup();
  });
});
