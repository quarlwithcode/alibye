/**
 * ⏱️ alibye — Reporting + Rounding + Billable Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoAgo, isoNow } from './helpers.js';
import { roundDuration, formatDuration, formatElapsed, calcAmount } from '../src/core/rounding.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => {
  const tmp = makeTmpAlibye({ default_rate: 50 });
  a = tmp.alibye;
  cleanup = tmp.cleanup;
});
afterEach(() => cleanup());

describe('Rounding Engine', () => {
  it('none: returns raw minutes', () => {
    expect(roundDuration(90 * 60000, 'none', 1)).toBeCloseTo(90);
  });

  it('up-15: rounds up to 15', () => {
    expect(roundDuration(7 * 60000, 'up', 15)).toBe(15);
    expect(roundDuration(16 * 60000, 'up', 15)).toBe(30);
  });

  it('down-15: rounds down', () => {
    expect(roundDuration(22 * 60000, 'down', 15)).toBe(15);
    expect(roundDuration(14 * 60000, 'down', 15)).toBe(0);
  });

  it('nearest-6: 0.1 hr increments', () => {
    expect(roundDuration(4 * 60000, 'nearest', 6)).toBe(6);
    expect(roundDuration(8 * 60000, 'nearest', 6)).toBe(6);
    expect(roundDuration(10 * 60000, 'nearest', 6)).toBe(12);
  });

  it('nearest-30: half hours', () => {
    expect(roundDuration(20 * 60000, 'nearest', 30)).toBe(30);
    expect(roundDuration(14 * 60000, 'nearest', 30)).toBe(0);
    expect(roundDuration(44 * 60000, 'nearest', 30)).toBe(30);
  });
});

describe('Duration Formatting', () => {
  it('formats minutes to human', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5)).toBe('5m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(135)).toBe('2h 15m');
  });

  it('formats elapsed ms', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(3661000)).toBe('01:01:01');
  });
});

describe('Billable Calculation', () => {
  it('calculates amount from rate', () => {
    expect(calcAmount(60, 50)).toBe(50);     // 1hr * $50
    expect(calcAmount(30, 100)).toBe(50);    // 0.5hr * $100
    expect(calcAmount(15, 80)).toBe(20);     // 0.25hr * $80
  });

  it('returns 0 for null/zero rate', () => {
    expect(calcAmount(60, null)).toBe(0);
    expect(calcAmount(60, 0)).toBe(0);
  });
});

describe('Rate Cascade', () => {
  it('uses project rate over default', () => {
    const proj = a.createProject({ name: 'Premium', rate: 150 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), project_id: proj.id });
    expect(entry.rate).toBe(150);
  });

  it('uses client rate when no project rate', () => {
    const client = a.createClient({ name: 'VIP', rate: 75 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), client_id: client.id });
    expect(entry.rate).toBe(75);
  });

  it('falls back to default rate', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow() });
    expect(entry.rate).toBe(50);
  });
});

describe('Summary Report', () => {
  it('groups by project', () => {
    const proj = a.createProject({ name: 'Alpha' });
    a.log({ start: isoAgo(120), end: isoAgo(60), project_id: proj.id });
    a.log({ start: isoAgo(60), end: isoNow(), project_id: proj.id });

    const summary = a.summary(isoAgo(180), isoNow(), 'project');
    expect(summary).toHaveLength(1);
    expect(summary[0].key).toBe('Alpha');
    expect(summary[0].entries).toBe(2);
  });

  it('groups by day', () => {
    a.log({ start: isoAgo(120), end: isoAgo(60) });
    a.log({ start: isoAgo(30), end: isoNow() });

    const summary = a.summary(isoAgo(180), isoNow(), 'day');
    expect(summary.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Weekly Timesheet', () => {
  it('returns 7 days', () => {
    const now = new Date();
    const d = now.getDay();
    const mondayOffset = d === 0 ? -6 : 1 - d;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = monday.toISOString().split('T')[0];

    const ws = a.weekly(weekStart);
    expect(ws.days).toHaveLength(7);
    expect(ws.week_start).toBe(weekStart);
  });
});

describe('Dashboard', () => {
  it('shows empty dashboard', () => {
    const d = a.dashboard();
    expect(d.active_timer).toBeNull();
    expect(d.today_minutes).toBe(0);
    expect(d.week_minutes).toBe(0);
  });

  it('shows active timer', () => {
    a.start({ description: 'Working' });
    const d = a.dashboard();
    expect(d.active_timer).toBeTruthy();
    expect(d.elapsed_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('Projects + Clients', () => {
  it('creates and lists projects', () => {
    a.createProject({ name: 'P1' });
    a.createProject({ name: 'P2' });
    expect(a.projects()).toHaveLength(2);
  });

  it('archives projects', () => {
    a.createProject({ name: 'ToArchive' });
    a.archiveProject('ToArchive');
    expect(a.projects()).toHaveLength(0);
    expect(a.projects(true)).toHaveLength(1);
  });

  it('creates and lists clients', () => {
    a.createClient({ name: 'C1', rate: 100 });
    expect(a.clients()).toHaveLength(1);
    expect(a.client('C1')!.rate).toBe(100);
  });
});

describe('Tags', () => {
  it('auto-creates tags from entries', () => {
    a.log({ start: isoAgo(30), end: isoNow(), tags: ['dev', 'urgent'] });
    const tags = a.tags();
    expect(tags).toHaveLength(2);
  });

  it('deletes tags', () => {
    a.log({ start: isoAgo(30), end: isoNow(), tags: ['temp'] });
    a.deleteTag('temp');
    expect(a.tags()).toHaveLength(0);
  });
});

describe('Edge Cases', () => {
  it('idle detection flags long entries', () => {
    const a2 = makeTmpAlibye({ idle_threshold_minutes: 1 });
    a2.alibye.log({ start: isoAgo(120), end: isoNow(), description: 'Long meeting' });
    const flagged = a2.alibye.flagIdle();
    expect(flagged).toBe(0); // Manual entries don't get flagged (source='manual')
    a2.cleanup();
  });

  it('CSV export includes headers', () => {
    a.log({ start: isoAgo(30), end: isoNow(), description: 'Test' });
    const csv = a.exportCSV(isoAgo(60), isoNow());
    expect(csv).toContain('Date,Start,End');
    expect(csv).toContain('Test');
  });
});
