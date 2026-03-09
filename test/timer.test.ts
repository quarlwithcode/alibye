/**
 * ⏱️ alibye — Timer + Entry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoAgo, isoNow } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const tmp = makeTmpAlibye(); a = tmp.alibye; cleanup = tmp.cleanup; });
afterEach(() => cleanup());

describe('Timer Lifecycle', () => {
  it('starts a timer', () => {
    const timer = a.start({ description: 'Working on docs' });
    expect(timer.id).toBeTruthy();
    expect(timer.description).toBe('Working on docs');
    expect(timer.start).toBeTruthy();
  });

  it('shows active timer', () => {
    a.start({ description: 'Test' });
    const timer = a.timer();
    expect(timer).toBeTruthy();
    expect(timer!.description).toBe('Test');
  });

  it('stops timer and creates entry', () => {
    a.start({ description: 'Building feature' });
    // Wait a tiny bit for non-zero duration
    const entry = a.stop();
    expect(entry.id).toBeTruthy();
    expect(entry.description).toBe('Building feature');
    expect(entry.source).toBe('timer');
    expect(entry.duration_ms).toBeGreaterThanOrEqual(0);
    expect(a.timer()).toBeNull();
  });

  it('prevents double start', () => {
    a.start({ description: 'First' });
    expect(() => a.start({ description: 'Second' })).toThrow('Timer already running');
  });

  it('throws on stop with no timer', () => {
    expect(() => a.stop()).toThrow('No timer running');
  });

  it('discards timer without entry', () => {
    a.start({ description: 'Discard me' });
    a.discard();
    expect(a.timer()).toBeNull();
    expect(a.entries()).toHaveLength(0);
  });

  it('starts with project', () => {
    const proj = a.createProject({ name: 'TestProj', rate: 100 });
    const timer = a.start({ description: 'Work', project_id: proj.id });
    expect(timer.project_id).toBe(proj.id);
  });

  it('starts with tags', () => {
    const timer = a.start({ description: 'Tagged', tags: ['urgent', 'frontend'] });
    expect(timer.tags).toEqual(['urgent', 'frontend']);
  });

  it('pomodoro mode sets flag', () => {
    const timer = a.start({ description: 'Focus', pomodoro: true });
    expect(timer.pomodoro).toBe(true);
  });
});

describe('Continue Last', () => {
  it('continues the last entry', () => {
    a.start({ description: 'Original task' });
    a.stop();
    const timer = a.continueLast();
    expect(timer.description).toBe('Original task');
  });

  it('throws with no previous entries', () => {
    expect(() => a.continueLast()).toThrow('No previous entries');
  });
});

describe('Manual Entry', () => {
  it('creates a manual entry', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow(), description: 'Meeting' });
    expect(entry.source).toBe('manual');
    expect(entry.duration_ms).toBeGreaterThan(0);
  });

  it('rejects end before start', () => {
    expect(() => a.log({ start: isoNow(), end: isoAgo(60) })).toThrow('End time must be after start time');
  });

  it('marks break entries', () => {
    const entry = a.log({ start: isoAgo(30), end: isoNow(), is_break: true });
    expect(entry.is_break).toBe(true);
    expect(entry.billable).toBe(false);
  });

  it('assigns tags', () => {
    const entry = a.log({ start: isoAgo(30), end: isoNow(), tags: ['meeting', 'client'] });
    const tags = a.entryTags(entry.id);
    expect(tags).toHaveLength(2);
    expect(tags.map(t => t.name).sort()).toEqual(['client', 'meeting']);
  });
});

describe('Entry CRUD', () => {
  it('queries by date range', () => {
    a.log({ start: isoAgo(120), end: isoAgo(60), description: 'Old' });
    a.log({ start: isoAgo(30), end: isoNow(), description: 'New' });
    const all = a.entries();
    expect(all).toHaveLength(2);
  });

  it('updates an entry', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow(), description: 'Draft' });
    const updated = a.updateEntry(entry.id, { description: 'Final' });
    expect(updated.description).toBe('Final');
  });

  it('deletes an entry', () => {
    const entry = a.log({ start: isoAgo(60), end: isoNow() });
    a.deleteEntry(entry.id);
    expect(a.entry(entry.id)).toBeNull();
  });
});
