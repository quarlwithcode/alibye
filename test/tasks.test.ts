/**
 * ⏱️ alibye — Task CRUD Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { makeTmpAlibye, isoNow, isoAgo } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye(); a = t.alibye; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('Task CRUD', () => {
  it('creates a task with name only', () => {
    const task = a.createTask({ name: 'Design mockups' });
    expect(task.name).toBe('Design mockups');
    expect(task.id).toBeDefined();
    expect(task.project_id).toBeNull();
    expect(task.client_id).toBeNull();
    expect(task.rate).toBeNull();
    expect(task.billable).toBe(true);
    expect(task.archived).toBe(false);
  });

  it('creates a task with project and auto-resolves client', () => {
    const client = a.createClient({ name: 'Acme' });
    const project = a.createProject({ name: 'Website', client_id: client.id });
    const task = a.createTask({ name: 'Build homepage', project_id: project.id });
    expect(task.project_id).toBe(project.id);
    expect(task.client_id).toBe(client.id);
  });

  it('creates a task with explicit client (overrides project client)', () => {
    const client1 = a.createClient({ name: 'Acme' });
    const client2 = a.createClient({ name: 'Globex' });
    const project = a.createProject({ name: 'Website', client_id: client1.id });
    const task = a.createTask({ name: 'Audit', project_id: project.id, client_id: client2.id });
    expect(task.client_id).toBe(client2.id);
  });

  it('creates a task with rate and budget', () => {
    const task = a.createTask({ name: 'Dev work', rate: 150, budget_hours: 40, budget_amount: 6000 });
    expect(task.rate).toBe(150);
    expect(task.budget_hours).toBe(40);
    expect(task.budget_amount).toBe(6000);
  });

  it('gets task by id', () => {
    const task = a.createTask({ name: 'Task A' });
    expect(a.task(task.id)?.name).toBe('Task A');
  });

  it('gets task by name', () => {
    a.createTask({ name: 'Task B' });
    expect(a.task('Task B')?.name).toBe('Task B');
  });

  it('returns null for non-existent task', () => {
    expect(a.task('nonexistent')).toBeNull();
  });

  it('lists tasks (excludes archived by default)', () => {
    a.createTask({ name: 'Active' });
    const archived = a.createTask({ name: 'Old' });
    a.archiveTask(archived.id);
    const tasks = a.tasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe('Active');
  });

  it('lists tasks including archived', () => {
    a.createTask({ name: 'Active' });
    const archived = a.createTask({ name: 'Old' });
    a.archiveTask(archived.id);
    expect(a.tasks({ includeArchived: true }).length).toBe(2);
  });

  it('filters tasks by project', () => {
    const proj = a.createProject({ name: 'P1' });
    a.createTask({ name: 'T1', project_id: proj.id });
    a.createTask({ name: 'T2' });
    const filtered = a.tasks({ project_id: proj.id });
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('T1');
  });

  it('updates task fields', () => {
    const task = a.createTask({ name: 'Original', rate: 100 });
    const updated = a.updateTask(task.id, { name: 'Renamed', rate: 200 });
    expect(updated.name).toBe('Renamed');
    expect(updated.rate).toBe(200);
  });

  it('archives a task by name', () => {
    a.createTask({ name: 'To Archive' });
    a.archiveTask('To Archive');
    const task = a.task('To Archive');
    expect(task?.archived).toBe(true);
  });

  it('throws on archive non-existent task', () => {
    expect(() => a.archiveTask('nope')).toThrow('Task not found');
  });

  it('task name is unique', () => {
    a.createTask({ name: 'Unique' });
    expect(() => a.createTask({ name: 'Unique' })).toThrow();
  });
});

describe('Tasks on Entries', () => {
  it('entry inherits task project/client via log', () => {
    const client = a.createClient({ name: 'Acme' });
    const project = a.createProject({ name: 'Website', client_id: client.id });
    const task = a.createTask({ name: 'Build', project_id: project.id });
    const entry = a.log({ start: isoAgo(60), end: isoNow(), task_id: task.id });
    expect(entry.task_id).toBe(task.id);
    expect(entry.project_id).toBe(project.id);
    expect(entry.client_id).toBe(client.id);
  });

  it('entry task_id preserved via timer start/stop', () => {
    const task = a.createTask({ name: 'Timer task' });
    a.start({ description: 'Working', task_id: task.id });
    const timer = a.timer();
    expect(timer?.task_id).toBe(task.id);
    const entry = a.stop();
    expect(entry.task_id).toBe(task.id);
  });

  it('query entries by task_id', () => {
    const task = a.createTask({ name: 'Filter task' });
    a.log({ start: isoAgo(60), end: isoAgo(30), task_id: task.id });
    a.log({ start: isoAgo(30), end: isoNow() });
    const filtered = a.entries({ task_id: task.id });
    expect(filtered.length).toBe(1);
    expect(filtered[0].task_id).toBe(task.id);
  });

  it('continueLast carries task_id', () => {
    const task = a.createTask({ name: 'Carry task' });
    a.log({ start: isoAgo(60), end: isoAgo(30), task_id: task.id, description: 'first' });
    const timer = a.continueLast();
    expect(timer.task_id).toBe(task.id);
    a.discard();
  });
});
