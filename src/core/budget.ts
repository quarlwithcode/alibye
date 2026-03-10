/**
 * ⏱️ alibye — Budget Calculation
 * Pure function: takes entity + entries, returns BudgetStatus.
 */

import { BudgetStatus, TimeEntry } from './types.js';

export function calcBudgetStatus(
  entity: { id: string; name: string; budget_hours?: number | null; budget_amount?: number | null },
  entityType: 'project' | 'client' | 'task',
  entries: TimeEntry[],
): BudgetStatus {
  const usedHours = entries.reduce((s, e) => s + e.rounded_minutes / 60, 0);
  const usedAmount = entries.reduce((s, e) => s + e.amount, 0);

  const budgetHours = entity.budget_hours ?? null;
  const budgetAmount = entity.budget_amount ?? null;

  const remainingHours = budgetHours !== null ? budgetHours - usedHours : null;
  const remainingAmount = budgetAmount !== null ? budgetAmount - usedAmount : null;

  const percentHours = budgetHours !== null && budgetHours > 0 ? (usedHours / budgetHours) * 100 : null;
  const percentAmount = budgetAmount !== null && budgetAmount > 0 ? (usedAmount / budgetAmount) * 100 : null;

  // Use whichever percentage is higher for status color
  const maxPercent = Math.max(percentHours ?? 0, percentAmount ?? 0);
  let status: BudgetStatus['status'] = 'green';
  if (maxPercent > 100) status = 'over';
  else if (maxPercent >= 90) status = 'red';
  else if (maxPercent >= 70) status = 'yellow';

  return {
    entity_type: entityType,
    entity_id: entity.id,
    entity_name: entity.name,
    budget_hours: budgetHours,
    budget_amount: budgetAmount,
    used_hours: Math.round(usedHours * 100) / 100,
    used_amount: Math.round(usedAmount * 100) / 100,
    remaining_hours: remainingHours !== null ? Math.round(remainingHours * 100) / 100 : null,
    remaining_amount: remainingAmount !== null ? Math.round(remainingAmount * 100) / 100 : null,
    percent_hours: percentHours !== null ? Math.round(percentHours * 10) / 10 : null,
    percent_amount: percentAmount !== null ? Math.round(percentAmount * 10) / 10 : null,
    status,
  };
}
