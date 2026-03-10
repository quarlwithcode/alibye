/**
 * ⏱️ alibye — Work Type CRUD Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoNow, isoAgo } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye(); a = t.alibye; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('Work Type CRUD', () => {
  it('creates a work type', () => {
    const wt = a.createWorkType({ name: 'Development' });
    expect(wt.name).toBe('Development');
    expect(wt.id).toBeDefined();
    expect(wt.rate).toBeNull();
  });

  it('creates a work type with rate', () => {
    const wt = a.createWorkType({ name: 'Consulting', rate: 200 });
    expect(wt.rate).toBe(200);
  });

  it('gets work type by id', () => {
    const wt = a.createWorkType({ name: 'Design' });
    expect(a.workType(wt.id)?.name).toBe('Design');
  });

  it('gets work type by name', () => {
    a.createWorkType({ name: 'QA' });
    expect(a.workType('QA')?.name).toBe('QA');
  });

  it('returns null for non-existent work type', () => {
    expect(a.workType('nonexistent')).toBeNull();
  });

  it('lists work types', () => {
    a.createWorkType({ name: 'B-type' });
    a.createWorkType({ name: 'A-type' });
    const wts = a.workTypes();
    expect(wts.length).toBe(2);
    expect(wts[0].name).toBe('A-type');  // sorted by name
  });

  it('updates work type', () => {
    const wt = a.createWorkType({ name: 'Old Name', rate: 100 });
    const updated = a.updateWorkType(wt.id, { name: 'New Name', rate: 150 });
    expect(updated.name).toBe('New Name');
    expect(updated.rate).toBe(150);
  });

  it('deletes work type', () => {
    a.createWorkType({ name: 'Temp' });
    a.deleteWorkType('Temp');
    expect(a.workType('Temp')).toBeNull();
  });

  it('throws on delete non-existent', () => {
    expect(() => a.deleteWorkType('nope')).toThrow('Work type not found');
  });

  it('unique name constraint', () => {
    a.createWorkType({ name: 'Unique' });
    expect(() => a.createWorkType({ name: 'Unique' })).toThrow();
  });
});

describe('Work Types on Entries', () => {
  it('entry includes work_type_id via log', () => {
    const wt = a.createWorkType({ name: 'Dev' });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), work_type_id: wt.id });
    expect(entry.work_type_id).toBe(wt.id);
  });

  it('timer carries work_type_id', () => {
    const wt = a.createWorkType({ name: 'Research' });
    a.start({ description: 'Researching', work_type_id: wt.id });
    const timer = a.timer();
    expect(timer?.work_type_id).toBe(wt.id);
    const entry = a.stop();
    expect(entry.work_type_id).toBe(wt.id);
  });

  it('query entries by work_type_id', () => {
    const wt = a.createWorkType({ name: 'Testing' });
    a.log({ start: isoAgo(60), end: isoAgo(30), work_type_id: wt.id });
    a.log({ start: isoAgo(30), end: isoNow() });
    const filtered = a.entries({ work_type_id: wt.id });
    expect(filtered.length).toBe(1);
  });

  it('stats include tasks and work_types counts', () => {
    a.createTask({ name: 'T1' });
    a.createWorkType({ name: 'WT1' });
    const stats = a.stats();
    expect(stats.tasks).toBe(1);
    expect(stats.work_types).toBe(1);
  });
});
