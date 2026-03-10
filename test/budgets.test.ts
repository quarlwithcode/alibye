/**
 * ⏱️ alibye — Budget Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { calcBudgetStatus } from '../src/core/budget.js';
import { makeTmpAlibye, isoNow, isoAgo } from './helpers.js';

let a: Alibye;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye({ default_rate: 100 }); a = t.alibye; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('calcBudgetStatus (pure)', () => {
  it('green status when under 70%', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_hours: 100 },
      'project',
      [{ rounded_minutes: 60 * 50, amount: 5000 } as any], // 50 hours = 50%
    );
    expect(result.status).toBe('green');
    expect(result.percent_hours).toBe(50);
    expect(result.used_hours).toBe(50);
    expect(result.remaining_hours).toBe(50);
  });

  it('yellow status at 70-90%', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_hours: 100 },
      'project',
      [{ rounded_minutes: 60 * 75, amount: 7500 } as any], // 75%
    );
    expect(result.status).toBe('yellow');
  });

  it('red status at 90-100%', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_hours: 100 },
      'project',
      [{ rounded_minutes: 60 * 95, amount: 9500 } as any], // 95%
    );
    expect(result.status).toBe('red');
  });

  it('over status above 100%', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_hours: 100 },
      'project',
      [{ rounded_minutes: 60 * 110, amount: 11000 } as any], // 110%
    );
    expect(result.status).toBe('over');
    expect(result.remaining_hours).toBeLessThan(0);
  });

  it('amount budget works independently', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_amount: 10000 },
      'project',
      [{ rounded_minutes: 60, amount: 8000 } as any], // 80% of amount
    );
    expect(result.status).toBe('yellow');
    expect(result.percent_amount).toBe(80);
    expect(result.percent_hours).toBeNull();
  });

  it('zero budget returns green with null percents', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P' },
      'project',
      [{ rounded_minutes: 60, amount: 100 } as any],
    );
    expect(result.status).toBe('green');
    expect(result.percent_hours).toBeNull();
    expect(result.percent_amount).toBeNull();
  });

  it('empty entries returns 0 usage', () => {
    const result = calcBudgetStatus(
      { id: '1', name: 'P', budget_hours: 40 },
      'project',
      [],
    );
    expect(result.used_hours).toBe(0);
    expect(result.percent_hours).toBe(0);
    expect(result.status).toBe('green');
  });
});

describe('Budget integration', () => {
  it('project budget status via API', () => {
    const proj = a.createProject({ name: 'Budgeted' });
    a.updateProject(proj.id, { budget_hours: 10 });
    // Log 6 hours (360 minutes) → 60%
    a.log({ start: isoAgo(360), end: isoNow(), project_id: proj.id });
    const status = a.projectBudget(proj.id);
    expect(status.entity_name).toBe('Budgeted');
    expect(status.status).toBe('green');
  });

  it('client budget status via API', () => {
    const client = a.createClient({ name: 'Budgeted Client' });
    a.updateClient(client.id, { budget_amount: 1000 });
    const status = a.clientBudget(client.id);
    expect(status.entity_name).toBe('Budgeted Client');
    expect(status.budget_amount).toBe(1000);
  });

  it('task budget status via API', () => {
    const task = a.createTask({ name: 'Budgeted Task', budget_hours: 20 });
    const status = a.taskBudget(task.id);
    expect(status.budget_hours).toBe(20);
    expect(status.used_hours).toBe(0);
  });

  it('burn report returns budget + entries', () => {
    const proj = a.createProject({ name: 'Burn Proj' });
    a.updateProject(proj.id, { budget_hours: 100 });
    a.log({ start: isoAgo(120), end: isoNow(), project_id: proj.id });
    const report = a.burnReport({ project_id: proj.id });
    expect(report.budget.entity_name).toBe('Burn Proj');
    expect(report.entries.length).toBe(1);
  });

  it('burn report throws without any filter', () => {
    expect(() => a.burnReport({})).toThrow('requires');
  });

  it('dashboard includes budget warnings', () => {
    const proj = a.createProject({ name: 'Hot Proj' });
    a.updateProject(proj.id, { budget_hours: 1 });
    // Log 55 minutes → 91.7% of 1 hour budget → red
    a.log({ start: isoAgo(55), end: isoNow(), project_id: proj.id });
    const dash = a.dashboard();
    expect(dash.budget_warnings.length).toBeGreaterThan(0);
    expect(dash.budget_warnings[0].entity_name).toBe('Hot Proj');
  });

  it('updateProject sets budget fields', () => {
    const proj = a.createProject({ name: 'P' });
    const updated = a.updateProject(proj.id, { budget_hours: 40, budget_amount: 5000 });
    expect(updated.budget_hours).toBe(40);
    expect(updated.budget_amount).toBe(5000);
  });

  it('updateClient sets budget fields', () => {
    const client = a.createClient({ name: 'C' });
    const updated = a.updateClient(client.id, { budget_hours: 100 });
    expect(updated.budget_hours).toBe(100);
  });
});
