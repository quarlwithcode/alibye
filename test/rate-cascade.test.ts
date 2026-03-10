/**
 * ⏱️ alibye — Rate Cascade Tests
 * 6-level cascade: override > task > worktype > project > client > default
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoNow, isoAgo } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye({ default_rate: 50 }); a = t.alibye; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('Rate Cascade', () => {
  it('level 6: uses default_rate when nothing else set', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow() });
    expect(entry.rate).toBe(50);
  });

  it('level 5: client rate overrides default', () => {
    const client = a.createClient({ name: 'C', rate: 75 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), client_id: client.id });
    expect(entry.rate).toBe(75);
  });

  it('level 4: project rate overrides client and default', () => {
    const client = a.createClient({ name: 'C', rate: 75 });
    const project = a.createProject({ name: 'P', client_id: client.id, rate: 100 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), project_id: project.id });
    expect(entry.rate).toBe(100);
  });

  it('level 3: work type rate overrides project', () => {
    const project = a.createProject({ name: 'P', rate: 100 });
    const wt = a.createWorkType({ name: 'Consulting', rate: 200 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), project_id: project.id, work_type_id: wt.id });
    expect(entry.rate).toBe(200);
  });

  it('level 2: task rate overrides work type', () => {
    const wt = a.createWorkType({ name: 'Dev', rate: 150 });
    const task = a.createTask({ name: 'Special task', rate: 175 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id, work_type_id: wt.id });
    expect(entry.rate).toBe(175);
  });

  it('level 1: entry_rate_override wins over everything', () => {
    const client = a.createClient({ name: 'C', rate: 75 });
    const project = a.createProject({ name: 'P', client_id: client.id, rate: 100 });
    const wt = a.createWorkType({ name: 'Dev', rate: 150 });
    const task = a.createTask({ name: 'T', project_id: project.id, rate: 175 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id, work_type_id: wt.id, entry_rate_override: 250 });
    expect(entry.rate).toBe(250);
    expect(entry.entry_rate_override).toBe(250);
  });

  it('falls through null levels', () => {
    // task has no rate, work type has no rate, project has rate
    const project = a.createProject({ name: 'P', rate: 100 });
    const wt = a.createWorkType({ name: 'NoRate' });
    const task = a.createTask({ name: 'NoRate task', project_id: project.id });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id, work_type_id: wt.id });
    expect(entry.rate).toBe(100);
  });

  it('rate=0 falls through (project rate 0 → client rate)', () => {
    const client = a.createClient({ name: 'C', rate: 80 });
    const project = a.createProject({ name: 'P', client_id: client.id, rate: 0 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), project_id: project.id });
    expect(entry.rate).toBe(80);
  });

  it('returns null rate when all levels are null/0 and default is 0', () => {
    const t = makeTmpAlibye({ default_rate: 0 });
    const entry = t.alibye.log({ start: isoAgo(60), end: isoNow() });
    expect(entry.rate).toBeNull();
    expect(entry.amount).toBe(0);
    t.cleanup();
  });

  it('timer stop uses full cascade', () => {
    const task = a.createTask({ name: 'Rated task', rate: 300 });
    a.start({ description: 'Timer cascade', task_id: task.id });
    const entry = a.stop();
    expect(entry.rate).toBe(300);
  });

  it('amount calculated correctly from cascade rate', () => {
    // 60 minutes at $120/hr = $120
    const client = a.createClient({ name: 'C', rate: 120 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), client_id: client.id });
    expect(entry.rate).toBe(120);
    expect(entry.amount).toBeGreaterThan(0);
  });

  it('re-resolves rate on updateEntry when task changes', () => {
    const task1 = a.createTask({ name: 'T1', rate: 100 });
    const task2 = a.createTask({ name: 'T2', rate: 200 });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), task_id: task1.id });
    expect(entry.rate).toBe(100);
    const updated = a.updateEntry(entry.id, { task_id: task2.id });
    expect(updated.rate).toBe(200);
  });
});
