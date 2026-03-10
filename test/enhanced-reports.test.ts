/**
 * ⏱️ alibye — Enhanced Reports Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoNow, isoAgo } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye({ default_rate: 100 }); a = t.alibye; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('Summary grouping by task', () => {
  it('groups entries by task via query', () => {
    const t1 = a.createTask({ name: 'Design' });
    const t2 = a.createTask({ name: 'Dev' });
    a.log({ start: isoAgo(120), end: isoAgo(60), task_id: t1.id });
    a.log({ start: isoAgo(60), end: isoNow(), task_id: t2.id });
    a.log({ start: isoAgo(180), end: isoAgo(120) }); // no task

    const all = a.entries();
    expect(all.length).toBe(3);

    const withTask = a.entries({ task_id: t1.id });
    expect(withTask.length).toBe(1);
  });
});

describe('Summary grouping by worktype', () => {
  it('groups entries by work type via query', () => {
    const wt = a.createWorkType({ name: 'Consulting' });
    a.log({ start: isoAgo(60), end: isoNow(), work_type_id: wt.id });
    a.log({ start: isoAgo(120), end: isoAgo(60) });

    const filtered = a.entries({ work_type_id: wt.id });
    expect(filtered.length).toBe(1);
  });
});

describe('Entity summaries', () => {
  it('project summary with entries', () => {
    const proj = a.createProject({ name: 'Summary Proj', rate: 100 });
    a.log({ start: isoAgo(60), end: isoNow(), project_id: proj.id });
    a.log({ start: isoAgo(120), end: isoAgo(60), project_id: proj.id });
    const entries = a.entries({ project_id: proj.id });
    expect(entries.length).toBe(2);
    const budget = a.projectBudget(proj.id);
    expect(budget.used_hours).toBeGreaterThan(0);
  });

  it('client summary with entries', () => {
    const client = a.createClient({ name: 'Summary Client', rate: 150 });
    a.log({ start: isoAgo(60), end: isoNow(), client_id: client.id });
    const budget = a.clientBudget(client.id);
    expect(budget.used_hours).toBeGreaterThan(0);
  });

  it('task summary with entries and budget', () => {
    const task = a.createTask({ name: 'Summary Task', rate: 200, budget_hours: 10 });
    a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id });
    const budget = a.taskBudget(task.id);
    expect(budget.used_hours).toBeGreaterThan(0);
    expect(budget.budget_hours).toBe(10);
  });
});

describe('Monthly ranges', () => {
  it('entries filtered within a month range', () => {
    // Create entries with known dates
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const firstDay = `${thisMonth}-01T09:00:00`;
    const firstDayEnd = `${thisMonth}-01T10:00:00`;

    a.log({ start: firstDay, end: firstDayEnd, description: 'This month entry' });
    const entries = a.entries({ from: `${thisMonth}-01T00:00:00`, to: `${thisMonth}-31T23:59:59` });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some(e => e.description === 'This month entry')).toBe(true);
  });
});

describe('CSV export with new fields', () => {
  it('CSV includes Task and WorkType columns', () => {
    const task = a.createTask({ name: 'CSV Task' });
    const wt = a.createWorkType({ name: 'CSV WorkType' });
    a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id, work_type_id: wt.id });
    const csv = a.exportCSV(isoAgo(120), isoNow());
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Task');
    expect(lines[0]).toContain('WorkType');
    expect(lines[1]).toContain('CSV Task');
    expect(lines[1]).toContain('CSV WorkType');
  });
});

describe('Entry update with tags', () => {
  it('updates tags on an entry', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow(), tags: ['old'] });
    expect(a.entryTags(entry.id).map(t => t.name)).toEqual(['old']);

    a.updateEntry(entry.id, { tags: ['new1', 'new2'] });
    const tags = a.entryTags(entry.id).map(t => t.name).sort();
    expect(tags).toEqual(['new1', 'new2']);
  });
});
