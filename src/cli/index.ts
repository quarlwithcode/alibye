#!/usr/bin/env node

/**
 * ⏱️ alibye — Human Time Tracking CLI
 * All I Bill You Ever.
 */

import { Command } from 'commander';
import { Alibye } from '../core/alibye.js';
import { APP_VERSION, BudgetStatus } from '../core/types.js';
import { formatDuration, formatElapsed, formatDecimalHours } from '../core/rounding.js';
import { saveConfigFile, loadConfigFile } from '../core/config.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('alibye')
  .description('⏱️ Human time tracking for AI-managed workflows')
  .version(APP_VERSION)
  .option('--json', 'JSON output')
  .option('-d, --dir <path>', 'Data directory', process.env.ALIBYE_DIR || '.alibye');

function getAlibye(): Alibye { return new Alibye({ data_dir: program.opts().dir }); }
function json(): boolean { return !!program.opts().json; }

// ─── Status (default) ───────────────────────────────────────

program
  .command('status', { isDefault: true })
  .description('Dashboard — active timer, today, this week')
  .action(() => {
    const a = getAlibye();
    const d = a.dashboard();

    if (json()) { console.log(JSON.stringify(d)); a.close(); return; }

    console.log(`\n  ⏱️  alibye — Dashboard`);
    console.log(`  ${'═'.repeat(50)}`);

    if (d.active_timer) {
      const proj = d.active_timer.project_id ? a.project(d.active_timer.project_id) : null;
      const task = d.active_timer.task_id ? a.task(d.active_timer.task_id) : null;
      console.log(`  🔴 TRACKING: ${d.active_timer.description || '(no description)'}`);
      if (proj) console.log(`     📁 ${proj.name}`);
      if (task) console.log(`     📌 ${task.name}`);
      console.log(`     ⏱️  ${formatElapsed(d.elapsed_ms)}`);
      if (d.active_timer.pomodoro) console.log(`     🍅 Pomodoro session #${d.active_timer.pomodoro_session}`);
    } else {
      console.log(`  ⚪ No timer running`);
    }

    console.log('');
    console.log(`  📅 Today: ${formatDuration(d.today_minutes)} (${d.today_entries} entries)`);
    if (d.today_billable > 0) console.log(`     💰 $${d.today_billable.toFixed(2)} billable`);
    if (d.break_minutes_today > 0) console.log(`     ☕ ${formatDuration(d.break_minutes_today)} breaks`);
    console.log(`  📊 This week: ${formatDuration(d.week_minutes)}`);
    if (d.week_billable > 0) console.log(`     💰 $${d.week_billable.toFixed(2)} billable`);

    // Quota progress
    if (d.quota) {
      console.log('');
      if (d.quota.daily_target > 0) {
        const bar = progressBar(d.quota.daily_percent, 20);
        console.log(`  📏 Daily: ${bar} ${formatDuration(d.quota.daily_tracked)} / ${formatDuration(d.quota.daily_target)} (${d.quota.daily_percent.toFixed(0)}%)`);
      }
      if (d.quota.weekly_target > 0) {
        const bar = progressBar(d.quota.weekly_percent, 20);
        console.log(`  📏 Weekly: ${bar} ${formatDuration(d.quota.weekly_tracked)} / ${formatDuration(d.quota.weekly_target)} (${d.quota.weekly_percent.toFixed(0)}%)`);
        console.log(`     ${d.quota.on_pace ? '✅' : '⚠️'} Projected: ${formatDuration(d.quota.projected_week_total)} ${d.quota.on_pace ? '(on pace)' : '(behind)'}`);
      }
    }

    // Budget warnings
    if (d.budget_warnings.length > 0) {
      console.log('');
      console.log(`  ⚠️ Budget Alerts:`);
      for (const w of d.budget_warnings) {
        const icon = w.status === 'over' ? '🔴' : w.status === 'red' ? '🟠' : '🟡';
        const pct = w.percent_hours ?? w.percent_amount ?? 0;
        console.log(`     ${icon} ${w.entity_name}: ${pct.toFixed(0)}% used (${w.status})`);
      }
    }

    console.log('');
    a.close();
  });

// ─── Start ──────────────────────────────────────────────────

program
  .command('start [description...]')
  .description('Start a timer')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-k, --task <name>', 'Task')
  .option('-w, --worktype <name>', 'Work type')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .option('--rate <rate>', 'Override rate')
  .option('--no-billable', 'Not billable')
  .option('--pomodoro', 'Pomodoro mode')
  .action((descWords: string[], opts) => {
    const a = getAlibye();
    const description = descWords.join(' ');

    let projectId: string | undefined;
    if (opts.project) {
      const proj = a.project(opts.project);
      if (!proj) { console.error(`  Project not found: ${opts.project}. Create it: alibye project add "${opts.project}"`); process.exit(1); }
      projectId = proj.id;
    }

    let clientId: string | undefined;
    if (opts.client) {
      const client = a.client(opts.client);
      if (!client) { console.error(`  Client not found: ${opts.client}. Create it: alibye client add "${opts.client}"`); process.exit(1); }
      clientId = client.id;
    }

    let taskId: string | undefined;
    if (opts.task) {
      const task = a.task(opts.task);
      if (!task) { console.error(`  Task not found: ${opts.task}. Create it: alibye task add "${opts.task}"`); process.exit(1); }
      taskId = task.id;
    }

    let workTypeId: string | undefined;
    if (opts.worktype) {
      const wt = a.workType(opts.worktype);
      if (!wt) { console.error(`  Work type not found: ${opts.worktype}. Create it: alibye worktype add "${opts.worktype}"`); process.exit(1); }
      workTypeId = wt.id;
    }

    const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [];

    const timer = a.start({ description, project_id: projectId, client_id: clientId, task_id: taskId, work_type_id: workTypeId, billable: opts.billable, tags, pomodoro: opts.pomodoro });

    if (json()) { console.log(JSON.stringify(timer)); a.close(); return; }

    const proj = timer.project_id ? a.project(timer.project_id) : null;
    const task = timer.task_id ? a.task(timer.task_id) : null;
    console.log(`\n  🔴 Timer started${description ? `: ${description}` : ''}`);
    if (proj) console.log(`     📁 ${proj.name}`);
    if (task) console.log(`     📌 ${task.name}`);
    if (tags.length > 0) console.log(`     🏷️  ${tags.join(', ')}`);
    if (opts.pomodoro) console.log(`     🍅 Pomodoro mode (${a.config.pomodoro_work_minutes}m work / ${a.config.pomodoro_break_minutes}m break)`);
    console.log(`     Started at ${new Date(timer.start).toLocaleTimeString()}`);
    console.log('');
    a.close();
  });

// ─── Stop ───────────────────────────────────────────────────

program
  .command('stop')
  .description('Stop the current timer')
  .action(() => {
    const a = getAlibye();
    const entry = a.stop();
    const proj = entry.project_id ? a.project(entry.project_id) : null;

    if (json()) { console.log(JSON.stringify(entry)); a.close(); return; }

    console.log(`\n  ⏹️  Timer stopped: ${entry.description || '(no description)'}`);
    if (proj) console.log(`     📁 ${proj.name}`);
    console.log(`     ⏱️  ${formatDuration(entry.rounded_minutes)} (${formatDecimalHours(entry.rounded_minutes)} hrs)`);
    if (entry.billable && entry.amount > 0) console.log(`     💰 $${entry.amount.toFixed(2)}`);
    console.log('');
    a.close();
  });

// ─── Continue ───────────────────────────────────────────────

program
  .command('continue')
  .description('Restart the last timer')
  .action(() => {
    const a = getAlibye();
    const timer = a.continueLast();
    const proj = timer.project_id ? a.project(timer.project_id) : null;

    if (json()) { console.log(JSON.stringify(timer)); a.close(); return; }

    console.log(`\n  🔄 Continuing: ${timer.description || '(no description)'}`);
    if (proj) console.log(`     📁 ${proj.name}`);
    console.log('');
    a.close();
  });

// ─── Discard ────────────────────────────────────────────────

program
  .command('discard')
  .description('Discard the current timer without saving')
  .action(() => {
    const a = getAlibye();
    a.discard();
    if (json()) { console.log(JSON.stringify({ discarded: true })); } else { console.log('  🗑️  Timer discarded'); }
    a.close();
  });

// ─── Log (manual entry) ────────────────────────────────────

program
  .command('log')
  .description('Add a manual time entry')
  .requiredOption('--start <datetime>', 'Start time (ISO or HH:MM)')
  .requiredOption('--end <datetime>', 'End time (ISO or HH:MM)')
  .option('--desc <text>', 'Description')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-k, --task <name>', 'Task')
  .option('-w, --worktype <name>', 'Work type')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .option('--rate <rate>', 'Override rate')
  .option('--no-billable', 'Not billable')
  .option('--break', 'Mark as break time')
  .option('--date <date>', 'Date context (YYYY-MM-DD)')
  .option('--yesterday', 'Use yesterday as date context')
  .action((opts) => {
    const a = getAlibye();
    const dateCtx = opts.yesterday ? yesterdayStr() : opts.date || undefined;
    const start = resolveTime(opts.start, dateCtx);
    const end = resolveTime(opts.end, dateCtx);

    let projectId: string | undefined;
    if (opts.project) { const p = a.project(opts.project); if (p) projectId = p.id; }
    let clientId: string | undefined;
    if (opts.client) { const c = a.client(opts.client); if (c) clientId = c.id; }
    let taskId: string | undefined;
    if (opts.task) { const t = a.task(opts.task); if (t) taskId = t.id; }
    let workTypeId: string | undefined;
    if (opts.worktype) { const wt = a.workType(opts.worktype); if (wt) workTypeId = wt.id; }

    const entry = a.log({
      description: opts.desc,
      project_id: projectId,
      client_id: clientId,
      task_id: taskId,
      work_type_id: workTypeId,
      entry_rate_override: opts.rate ? parseFloat(opts.rate) : undefined,
      start,
      end,
      billable: opts.billable,
      is_break: opts.break,
      tags: opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [],
    });

    if (json()) { console.log(JSON.stringify(entry)); a.close(); return; }

    console.log(`\n  ✅ Entry logged: ${entry.description || '(no description)'}`);
    console.log(`     ⏱️  ${formatDuration(entry.rounded_minutes)}`);
    if (entry.billable && entry.amount > 0) console.log(`     💰 $${entry.amount.toFixed(2)}`);
    console.log('');
    a.close();
  });

// ─── List ───────────────────────────────────────────────────

program
  .command('list')
  .description('List time entries')
  .option('--today', 'Today only')
  .option('--week', 'This week')
  .option('--month [month]', 'This month or specific YYYY-MM')
  .option('--last-month', 'Last month')
  .option('--from <date>', 'From date')
  .option('--to <date>', 'To date')
  .option('-p, --project <name>', 'Filter by project')
  .option('-c, --client <name>', 'Filter by client')
  .option('-k, --task <name>', 'Filter by task')
  .option('--group <by>', 'Group by: project, client, task, day')
  .option('-n, --limit <n>', 'Max entries', '20')
  .action((opts) => {
    const a = getAlibye();
    const filters: any = { limit: parseInt(opts.limit) };

    if (opts.today) {
      const today = new Date().toISOString().split('T')[0];
      filters.from = today + 'T00:00:00';
      filters.to = today + 'T23:59:59';
    } else if (opts.week) {
      const { from, to } = weekRange();
      filters.from = from;
      filters.to = to;
    } else if (opts.month !== undefined || opts.lastMonth) {
      const { from, to } = monthRange(opts.lastMonth ? 'last' : opts.month === true ? undefined : opts.month);
      filters.from = from;
      filters.to = to;
    } else {
      if (opts.from) filters.from = opts.from + 'T00:00:00';
      if (opts.to) filters.to = opts.to + 'T23:59:59';
    }

    if (opts.project) { const p = a.project(opts.project); if (p) filters.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) filters.client_id = c.id; }
    if (opts.task) { const t = a.task(opts.task); if (t) filters.task_id = t.id; }

    // Remove limit for grouped output
    if (opts.group) delete filters.limit;

    const entries = a.entries(filters);

    if (json()) { console.log(JSON.stringify(entries)); a.close(); return; }

    if (entries.length === 0) { console.log('\n  No entries found.\n'); a.close(); return; }

    if (opts.group) {
      // Grouped list
      const groups = new Map<string, typeof entries>();
      for (const e of entries) {
        let key: string;
        switch (opts.group) {
          case 'project': key = e.project_id ? (a.project(e.project_id)?.name || 'Unknown') : '(no project)'; break;
          case 'client': key = e.client_id ? (a.client(e.client_id)?.name || 'Unknown') : '(no client)'; break;
          case 'task': key = e.task_id ? (a.task(e.task_id)?.name || 'Unknown') : '(no task)'; break;
          case 'day': key = e.start.split('T')[0]; break;
          default: key = '(all)';
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }

      console.log(`\n  📋 Time Entries by ${opts.group} (${entries.length})`);
      for (const [groupKey, groupEntries] of groups) {
        const subtotalMin = groupEntries.reduce((s, e) => s + e.rounded_minutes, 0);
        console.log(`\n  ── ${groupKey} (${formatDuration(subtotalMin)}) ──`);
        for (const e of groupEntries) {
          const time = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const date = e.start.split('T')[0];
          console.log(`     ${date} ${time}  ${formatDuration(e.rounded_minutes).padEnd(8)} ${e.description || ''}`);
        }
      }
    } else {
      console.log(`\n  📋 Time Entries (${entries.length})`);
      console.log(`  ${'─'.repeat(70)}`);
      for (const e of entries) {
        const proj = e.project_id ? a.project(e.project_id) : null;
        const time = new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = e.start.split('T')[0];
        const billIcon = e.billable ? '💰' : '  ';
        const breakIcon = e.is_break ? '☕' : '  ';
        console.log(`  ${date} ${time}  ${formatDuration(e.rounded_minutes).padEnd(8)} ${billIcon}${breakIcon} ${(proj?.name || '').padEnd(15)} ${e.description || ''}`);
      }
    }

    const totalMin = entries.reduce((s, e) => s + e.rounded_minutes, 0);
    const totalBillable = entries.filter(e => e.billable).reduce((s, e) => s + e.amount, 0);
    console.log(`  ${'─'.repeat(70)}`);
    console.log(`  Total: ${formatDuration(totalMin)}${totalBillable > 0 ? ` · $${totalBillable.toFixed(2)} billable` : ''}`);
    console.log('');
    a.close();
  });

// ─── Edit ───────────────────────────────────────────────────

program
  .command('edit <id>')
  .description('Edit a time entry')
  .option('--desc <text>', 'Description')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-k, --task <name>', 'Task')
  .option('-w, --worktype <name>', 'Work type')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .option('--rate <rate>', 'Override rate')
  .option('--billable', 'Mark as billable')
  .option('--no-billable', 'Mark as not billable')
  .option('--start <datetime>', 'Start time')
  .option('--end <datetime>', 'End time')
  .option('--date <date>', 'Date context for HH:MM times')
  .action((id: string, opts) => {
    const a = getAlibye();
    const updates: any = {};
    if (opts.desc !== undefined) updates.description = opts.desc;
    if (opts.project) { const p = a.project(opts.project); if (p) updates.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) updates.client_id = c.id; }
    if (opts.task) { const t = a.task(opts.task); if (t) updates.task_id = t.id; }
    if (opts.worktype) { const wt = a.workType(opts.worktype); if (wt) updates.work_type_id = wt.id; }
    if (opts.tags !== undefined) updates.tags = opts.tags.split(',').map((t: string) => t.trim());
    if (opts.rate) updates.entry_rate_override = parseFloat(opts.rate);
    if (opts.billable !== undefined) updates.billable = opts.billable;
    if (opts.start) updates.start = resolveTime(opts.start, opts.date);
    if (opts.end) updates.end = resolveTime(opts.end, opts.date);

    const entry = a.updateEntry(id, updates);
    if (json()) { console.log(JSON.stringify(entry)); } else { console.log(`  ✅ Entry updated: ${entry.description}`); }
    a.close();
  });

// ─── Delete ─────────────────────────────────────────────────

program
  .command('delete <id>')
  .description('Delete a time entry')
  .action((id: string) => {
    const a = getAlibye();
    a.deleteEntry(id);
    if (json()) { console.log(JSON.stringify({ deleted: id })); } else { console.log(`  🗑️  Entry deleted`); }
    a.close();
  });

// ─── Report ─────────────────────────────────────────────────

program
  .command('report')
  .description('Time reports (summary, detailed, weekly)')
  .option('--today', 'Today only')
  .option('--week', 'This week')
  .option('--month [month]', 'This month or specific YYYY-MM')
  .option('--last-month', 'Last month')
  .option('--from <date>', 'From date')
  .option('--to <date>', 'To date')
  .option('--group <by>', 'Group by: project, client, day, tag, task, worktype', 'project')
  .option('--format <type>', 'Output: terminal, csv, json', 'terminal')
  .option('--weekly', 'Weekly timesheet view')
  .option('-o, --output <path>', 'Output file')
  .action((opts) => {
    const a = getAlibye();
    const { from, to } = resolveRange(opts);

    if (opts.weekly) {
      const d = new Date(from);
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + mondayOffset);
      const weekStart = d.toISOString().split('T')[0];
      const ws = a.weekly(weekStart);

      if (json() || opts.format === 'json') {
        const output = JSON.stringify(ws);
        if (opts.output) { fs.writeFileSync(opts.output, output); console.log(`  Saved: ${opts.output}`); } else console.log(output);
        a.close(); return;
      }

      console.log(`\n  📅 Weekly Timesheet: ${ws.week_start} to ${ws.week_end}`);
      console.log(`  ${'─'.repeat(55)}`);
      console.log(`  ${'Day'.padEnd(5)} ${'Date'.padEnd(12)} ${'Total'.padStart(8)} ${'Billable'.padStart(10)} Entries`);
      console.log(`  ${'─'.repeat(55)}`);
      for (const day of ws.days) {
        console.log(`  ${day.day.padEnd(5)} ${day.date.padEnd(12)} ${formatDuration(day.total_minutes).padStart(8)} ${formatDuration(day.billable_minutes).padStart(10)} ${String(day.entries).padStart(4)}`);
      }
      console.log(`  ${'─'.repeat(55)}`);
      console.log(`  ${'Total'.padEnd(18)} ${formatDuration(ws.total_minutes).padStart(8)} ${formatDuration(ws.billable_minutes).padStart(10)} ${String(ws.total_entries).padStart(4)}`);
      if (ws.billable_amount > 0) console.log(`  💰 Billable: $${ws.billable_amount.toFixed(2)}`);
      console.log('');
      a.close(); return;
    }

    if (opts.format === 'csv') {
      const csv = a.exportCSV(from, to);
      if (opts.output) { fs.writeFileSync(opts.output, csv); console.log(`  Saved: ${opts.output}`); } else console.log(csv);
      a.close(); return;
    }

    // Support task and worktype grouping via entries
    const groupBy = opts.group;
    let summary;
    if (groupBy === 'task' || groupBy === 'worktype') {
      const entries = a.entries({ from, to });
      const map = new Map<string, { key: string; entries: number; total_minutes: number; rounded_minutes: number; billable_minutes: number; billable_amount: number }>();
      for (const e of entries) {
        let key: string;
        if (groupBy === 'task') {
          key = e.task_id ? (a.task(e.task_id)?.name || 'Unknown') : '(no task)';
        } else {
          key = e.work_type_id ? (a.workType(e.work_type_id)?.name || 'Unknown') : '(no work type)';
        }
        const row = map.get(key) || { key, entries: 0, total_minutes: 0, rounded_minutes: 0, billable_minutes: 0, billable_amount: 0 };
        row.entries++;
        row.total_minutes += e.duration_ms / 60000;
        row.rounded_minutes += e.rounded_minutes;
        if (e.billable) { row.billable_minutes += e.rounded_minutes; row.billable_amount += e.amount; }
        map.set(key, row);
      }
      summary = [...map.values()].sort((a, b) => b.rounded_minutes - a.rounded_minutes);
    } else {
      summary = a.summary(from, to, groupBy as any);
    }

    if (json() || opts.format === 'json') {
      const output = JSON.stringify(summary);
      if (opts.output) { fs.writeFileSync(opts.output, output); console.log(`  Saved: ${opts.output}`); } else console.log(output);
      a.close(); return;
    }

    if (summary.length === 0) { console.log('\n  No entries in range.\n'); a.close(); return; }

    const totalMin = summary.reduce((s, r) => s + r.rounded_minutes, 0);
    const totalBillable = summary.reduce((s, r) => s + r.billable_amount, 0);

    console.log(`\n  📊 Time Report (by ${groupBy})`);
    console.log(`  ${'─'.repeat(65)}`);
    console.log(`  ${''.padEnd(20)} ${'Hours'.padStart(8)} ${'Entries'.padStart(8)} ${'Billable'.padStart(10)}`);
    console.log(`  ${'─'.repeat(65)}`);
    for (const row of summary) {
      console.log(`  ${row.key.padEnd(20)} ${formatDecimalHours(row.rounded_minutes).padStart(8)} ${String(row.entries).padStart(8)} ${row.billable_amount > 0 ? ('$' + row.billable_amount.toFixed(2)).padStart(10) : '—'.padStart(10)}`);
    }
    console.log(`  ${'─'.repeat(65)}`);
    console.log(`  ${'Total'.padEnd(20)} ${formatDecimalHours(totalMin).padStart(8)} ${String(summary.reduce((s, r) => s + r.entries, 0)).padStart(8)} ${totalBillable > 0 ? ('$' + totalBillable.toFixed(2)).padStart(10) : '—'.padStart(10)}`);
    console.log('');
    a.close();
  });

// ─── Task ────────────────────────────────────────────────────

const taskCmd = program.command('task').description('Manage tasks');

taskCmd.command('add <name>')
  .description('Add a task')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('--no-billable', 'Not billable')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    let projectId: string | undefined;
    if (opts.project) { const p = a.project(opts.project); if (p) projectId = p.id; }
    let clientId: string | undefined;
    if (opts.client) { const c = a.client(opts.client); if (c) clientId = c.id; }
    const task = a.createTask({ name, project_id: projectId, client_id: clientId, rate: opts.rate ? parseFloat(opts.rate) : undefined, billable: opts.billable, budget_hours: opts.budgetHours ? parseFloat(opts.budgetHours) : undefined, budget_amount: opts.budgetAmount ? parseFloat(opts.budgetAmount) : undefined });
    if (json()) { console.log(JSON.stringify(task)); } else { console.log(`  ✅ Task: ${task.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

taskCmd.command('list')
  .description('List tasks')
  .option('-p, --project <name>', 'Filter by project')
  .option('-c, --client <name>', 'Filter by client')
  .option('--all', 'Include archived')
  .action((opts) => {
    const a = getAlibye();
    const filters: any = { includeArchived: opts.all };
    if (opts.project) { const p = a.project(opts.project); if (p) filters.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) filters.client_id = c.id; }
    const tasks = a.tasks(filters);
    if (json()) { console.log(JSON.stringify(tasks)); a.close(); return; }
    if (tasks.length === 0) { console.log('\n  No tasks. Create one: alibye task add "Name"\n'); a.close(); return; }
    console.log(`\n  📌 Tasks (${tasks.length})`);
    for (const t of tasks) {
      const proj = t.project_id ? a.project(t.project_id) : null;
      const rate = t.rate ? `$${t.rate}/hr` : '';
      console.log(`  ${t.archived ? '📦' : '📌'} ${t.name}${proj ? ` (${proj.name})` : ''}${rate ? ` — ${rate}` : ''}`);
    }
    console.log('');
    a.close();
  });

taskCmd.command('edit <name>')
  .description('Edit a task')
  .option('--name <newName>', 'New name')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('--billable', 'Billable')
  .option('--no-billable', 'Not billable')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    const task = a.task(name);
    if (!task) { console.error(`  Task not found: ${name}`); process.exit(1); }
    const updates: any = {};
    if (opts.name) updates.name = opts.name;
    if (opts.rate) updates.rate = parseFloat(opts.rate);
    if (opts.project) { const p = a.project(opts.project); if (p) updates.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) updates.client_id = c.id; }
    if (opts.billable !== undefined) updates.billable = opts.billable;
    if (opts.budgetHours) updates.budget_hours = parseFloat(opts.budgetHours);
    if (opts.budgetAmount) updates.budget_amount = parseFloat(opts.budgetAmount);
    const updated = a.updateTask(task.id, updates);
    if (json()) { console.log(JSON.stringify(updated)); } else { console.log(`  ✅ Task updated: ${updated.name}`); }
    a.close();
  });

taskCmd.command('archive <name>')
  .description('Archive a task')
  .action((name: string) => {
    const a = getAlibye();
    a.archiveTask(name);
    if (json()) { console.log(JSON.stringify({ archived: name })); } else { console.log(`  📦 Archived: ${name}`); }
    a.close();
  });

taskCmd.command('summary <name>')
  .description('Task summary with budget status')
  .action((name: string) => {
    const a = getAlibye();
    const task = a.task(name);
    if (!task) { console.error(`  Task not found: ${name}`); process.exit(1); }
    const budget = a.taskBudget(task.id);
    const entries = a.entries({ task_id: task.id });
    if (json()) { console.log(JSON.stringify({ task, budget, entry_count: entries.length })); a.close(); return; }
    console.log(`\n  📌 Task: ${task.name}`);
    if (task.rate) console.log(`     💲 Rate: $${task.rate}/hr`);
    console.log(`     📊 Entries: ${entries.length}`);
    console.log(`     ⏱️  Hours: ${budget.used_hours}`);
    if (budget.budget_hours) console.log(`     📏 Budget: ${budget.used_hours}/${budget.budget_hours} hrs (${budget.percent_hours?.toFixed(0)}%)`);
    if (budget.budget_amount) console.log(`     💰 Budget: $${budget.used_amount}/$${budget.budget_amount} (${budget.percent_amount?.toFixed(0)}%)`);
    console.log('');
    a.close();
  });

// ─── Work Type ──────────────────────────────────────────────

const worktypeCmd = program.command('worktype').description('Manage work types');

worktypeCmd.command('add <name>')
  .description('Add a work type')
  .option('-r, --rate <rate>', 'Hourly rate')
  .action((name: string, opts) => {
    const a = getAlibye();
    const wt = a.createWorkType({ name, rate: opts.rate ? parseFloat(opts.rate) : undefined });
    if (json()) { console.log(JSON.stringify(wt)); } else { console.log(`  ✅ Work type: ${wt.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

worktypeCmd.command('list')
  .description('List work types')
  .action(() => {
    const a = getAlibye();
    const wts = a.workTypes();
    if (json()) { console.log(JSON.stringify(wts)); a.close(); return; }
    if (wts.length === 0) { console.log('\n  No work types. Create one: alibye worktype add "Name"\n'); a.close(); return; }
    console.log(`\n  🔧 Work Types (${wts.length})`);
    for (const wt of wts) { console.log(`  🔧 ${wt.name}${wt.rate ? ` — $${wt.rate}/hr` : ''}`); }
    console.log('');
    a.close();
  });

worktypeCmd.command('edit <name>')
  .description('Edit a work type')
  .option('--name <newName>', 'New name')
  .option('-r, --rate <rate>', 'Hourly rate')
  .action((name: string, opts) => {
    const a = getAlibye();
    const wt = a.workType(name);
    if (!wt) { console.error(`  Work type not found: ${name}`); process.exit(1); }
    const updates: any = {};
    if (opts.name) updates.name = opts.name;
    if (opts.rate) updates.rate = parseFloat(opts.rate);
    const updated = a.updateWorkType(wt.id, updates);
    if (json()) { console.log(JSON.stringify(updated)); } else { console.log(`  ✅ Work type updated: ${updated.name}`); }
    a.close();
  });

worktypeCmd.command('delete <name>')
  .description('Delete a work type')
  .action((name: string) => {
    const a = getAlibye();
    a.deleteWorkType(name);
    if (json()) { console.log(JSON.stringify({ deleted: name })); } else { console.log(`  🗑️  Work type deleted: ${name}`); }
    a.close();
  });

// ─── Config ─────────────────────────────────────────────────

const configCmd = program.command('config').description('Manage configuration');

configCmd.command('set <key> <value>')
  .description('Set a config value')
  .action((key: string, value: string) => {
    const a = getAlibye();
    const dataDir = path.resolve(program.opts().dir);
    const numKeys = new Set(['default_rate', 'rounding_interval', 'idle_threshold_minutes', 'pomodoro_work_minutes', 'pomodoro_break_minutes', 'pomodoro_long_break_minutes', 'pomodoro_sessions_before_long', 'weekly_quota_hours', 'daily_quota_hours']);
    const parsed = numKeys.has(key) ? parseFloat(value) : value;
    saveConfigFile(dataDir, { [key]: parsed } as any);
    if (json()) { console.log(JSON.stringify({ [key]: parsed })); } else { console.log(`  ✅ ${key} = ${parsed}`); }
    a.close();
  });

configCmd.command('get <key>')
  .description('Get a config value')
  .action((key: string) => {
    const a = getAlibye();
    const val = (a.config as any)[key];
    if (json()) { console.log(JSON.stringify({ [key]: val })); } else { console.log(`  ${key} = ${val}`); }
    a.close();
  });

configCmd.command('view')
  .description('View full config')
  .action(() => {
    const a = getAlibye();
    if (json()) {
      const dataDir = path.resolve(program.opts().dir);
      const fileConfig = loadConfigFile(dataDir);
      console.log(JSON.stringify({ resolved: a.config, file: fileConfig }));
    } else {
      console.log('\n  ⚙️  Configuration');
      for (const [k, v] of Object.entries(a.config)) {
        console.log(`  ${k}: ${v}`);
      }
      console.log('');
    }
    a.close();
  });

configCmd.command('reset')
  .description('Reset config to defaults')
  .action(() => {
    const dataDir = path.resolve(program.opts().dir);
    const configPath = path.join(dataDir, 'config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    if (json()) { console.log(JSON.stringify({ reset: true })); } else { console.log('  ✅ Config reset to defaults'); }
  });

// ─── Burn Report ────────────────────────────────────────────

program
  .command('burn')
  .description('Budget burn report')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-k, --task <name>', 'Task')
  .action((opts) => {
    const a = getAlibye();
    let burnOpts: any = {};
    if (opts.project) { const p = a.project(opts.project); if (!p) { console.error(`  Project not found: ${opts.project}`); process.exit(1); } burnOpts.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (!c) { console.error(`  Client not found: ${opts.client}`); process.exit(1); } burnOpts.client_id = c.id; }
    if (opts.task) { const t = a.task(opts.task); if (!t) { console.error(`  Task not found: ${opts.task}`); process.exit(1); } burnOpts.task_id = t.id; }

    const report = a.burnReport(burnOpts);

    if (json()) { console.log(JSON.stringify(report)); a.close(); return; }

    const b = report.budget;
    console.log(`\n  🔥 Burn Report: ${b.entity_name}`);
    console.log(`  ${'─'.repeat(50)}`);

    if (b.budget_hours) {
      const bar = progressBar(b.percent_hours ?? 0, 30);
      console.log(`  Hours:  ${bar} ${b.used_hours}/${b.budget_hours} (${b.percent_hours?.toFixed(1)}%)`);
    }
    if (b.budget_amount) {
      const bar = progressBar(b.percent_amount ?? 0, 30);
      console.log(`  Amount: ${bar} $${b.used_amount}/$${b.budget_amount} (${b.percent_amount?.toFixed(1)}%)`);
    }
    if (!b.budget_hours && !b.budget_amount) {
      console.log(`  No budget set. Used: ${b.used_hours} hrs, $${b.used_amount}`);
    }

    const statusIcon = b.status === 'green' ? '🟢' : b.status === 'yellow' ? '🟡' : b.status === 'red' ? '🟠' : '🔴';
    console.log(`\n  Status: ${statusIcon} ${b.status.toUpperCase()}`);
    console.log(`  Entries: ${report.entries.length}`);
    console.log('');
    a.close();
  });

// ─── Project ────────────────────────────────────────────────

const projectCmd = program.command('project').description('Manage projects');

projectCmd.command('add <name>')
  .description('Add a project')
  .option('-c, --client <name>', 'Client')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('--no-billable', 'Not billable')
  .option('--color <hex>', 'Color hex', '#3b82f6')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    let clientId: string | undefined;
    if (opts.client) { const c = a.client(opts.client); if (c) clientId = c.id; }
    const proj = a.createProject({ name, client_id: clientId, rate: opts.rate ? parseFloat(opts.rate) : undefined, billable: opts.billable, color: opts.color });
    if (opts.budgetHours || opts.budgetAmount) {
      a.updateProject(proj.id, { budget_hours: opts.budgetHours ? parseFloat(opts.budgetHours) : undefined, budget_amount: opts.budgetAmount ? parseFloat(opts.budgetAmount) : undefined });
    }
    const result = a.project(proj.id)!;
    if (json()) { console.log(JSON.stringify(result)); } else { console.log(`  ✅ Project: ${result.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

projectCmd.command('list').description('List projects')
  .option('--all', 'Include archived')
  .action((opts) => {
    const a = getAlibye();
    const projects = a.projects(opts.all);
    if (json()) { console.log(JSON.stringify(projects)); a.close(); return; }
    if (projects.length === 0) { console.log('\n  No projects. Create one: alibye project add "Name"\n'); a.close(); return; }
    console.log(`\n  📁 Projects (${projects.length})`);
    for (const p of projects) {
      const client = p.client_id ? a.client(p.client_id) : null;
      const rate = p.rate ? `$${p.rate}/hr` : '';
      console.log(`  ${p.archived ? '📦' : '📁'} ${p.name}${client ? ` (${client.name})` : ''}${rate ? ` — ${rate}` : ''}`);
    }
    console.log('');
    a.close();
  });

projectCmd.command('edit <name>')
  .description('Edit a project')
  .option('--name <newName>', 'New name')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('-c, --client <name>', 'Client')
  .option('--billable', 'Billable')
  .option('--no-billable', 'Not billable')
  .option('--color <hex>', 'Color hex')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    const proj = a.project(name);
    if (!proj) { console.error(`  Project not found: ${name}`); process.exit(1); }
    const updates: any = {};
    if (opts.name) updates.name = opts.name;
    if (opts.rate) updates.rate = parseFloat(opts.rate);
    if (opts.client) { const c = a.client(opts.client); if (c) updates.client_id = c.id; }
    if (opts.billable !== undefined) updates.billable = opts.billable;
    if (opts.color) updates.color = opts.color;
    if (opts.budgetHours) updates.budget_hours = parseFloat(opts.budgetHours);
    if (opts.budgetAmount) updates.budget_amount = parseFloat(opts.budgetAmount);
    const updated = a.updateProject(proj.id, updates);
    if (json()) { console.log(JSON.stringify(updated)); } else { console.log(`  ✅ Project updated: ${updated.name}`); }
    a.close();
  });

projectCmd.command('archive <name>').description('Archive a project')
  .action((name: string) => { const a = getAlibye(); a.archiveProject(name); console.log(`  📦 Archived: ${name}`); a.close(); });

projectCmd.command('summary <name>')
  .description('Project summary with budget status')
  .action((name: string) => {
    const a = getAlibye();
    const proj = a.project(name);
    if (!proj) { console.error(`  Project not found: ${name}`); process.exit(1); }
    const budget = a.projectBudget(proj.id);
    const entries = a.entries({ project_id: proj.id });
    if (json()) { console.log(JSON.stringify({ project: proj, budget, entry_count: entries.length })); a.close(); return; }
    console.log(`\n  📁 Project: ${proj.name}`);
    if (proj.rate) console.log(`     💲 Rate: $${proj.rate}/hr`);
    console.log(`     📊 Entries: ${entries.length}`);
    console.log(`     ⏱️  Hours: ${budget.used_hours}`);
    if (budget.budget_hours) console.log(`     📏 Budget: ${budget.used_hours}/${budget.budget_hours} hrs (${budget.percent_hours?.toFixed(0)}%)`);
    if (budget.budget_amount) console.log(`     💰 Budget: $${budget.used_amount}/$${budget.budget_amount} (${budget.percent_amount?.toFixed(0)}%)`);
    console.log('');
    a.close();
  });

// ─── Client ─────────────────────────────────────────────────

const clientCmd = program.command('client').description('Manage clients');

clientCmd.command('add <name>')
  .description('Add a client')
  .option('-e, --email <email>', 'Email')
  .option('-r, --rate <rate>', 'Default hourly rate')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    const client = a.createClient({ name, email: opts.email, rate: opts.rate ? parseFloat(opts.rate) : undefined });
    if (opts.budgetHours || opts.budgetAmount) {
      a.updateClient(client.id, { budget_hours: opts.budgetHours ? parseFloat(opts.budgetHours) : undefined, budget_amount: opts.budgetAmount ? parseFloat(opts.budgetAmount) : undefined });
    }
    const result = a.client(client.id)!;
    if (json()) { console.log(JSON.stringify(result)); } else { console.log(`  ✅ Client: ${result.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

clientCmd.command('list').description('List clients')
  .option('--all', 'Include archived')
  .action((opts) => {
    const a = getAlibye();
    const clients = a.clients(opts.all);
    if (json()) { console.log(JSON.stringify(clients)); a.close(); return; }
    if (clients.length === 0) { console.log('\n  No clients. Add one: alibye client add "Name"\n'); a.close(); return; }
    console.log(`\n  👥 Clients (${clients.length})`);
    for (const c of clients) { console.log(`  ${c.archived ? '📦' : '👤'} ${c.name}${c.rate ? ` — $${c.rate}/hr` : ''}`); }
    console.log('');
    a.close();
  });

clientCmd.command('edit <name>')
  .description('Edit a client')
  .option('--name <newName>', 'New name')
  .option('-e, --email <email>', 'Email')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('--budget-hours <hours>', 'Budget hours')
  .option('--budget-amount <amount>', 'Budget amount')
  .action((name: string, opts) => {
    const a = getAlibye();
    const client = a.client(name);
    if (!client) { console.error(`  Client not found: ${name}`); process.exit(1); }
    const updates: any = {};
    if (opts.name) updates.name = opts.name;
    if (opts.email) updates.email = opts.email;
    if (opts.rate) updates.rate = parseFloat(opts.rate);
    if (opts.budgetHours) updates.budget_hours = parseFloat(opts.budgetHours);
    if (opts.budgetAmount) updates.budget_amount = parseFloat(opts.budgetAmount);
    const updated = a.updateClient(client.id, updates);
    if (json()) { console.log(JSON.stringify(updated)); } else { console.log(`  ✅ Client updated: ${updated.name}`); }
    a.close();
  });

clientCmd.command('archive <name>').description('Archive a client')
  .action((name: string) => { const a = getAlibye(); a.archiveClient(name); console.log(`  📦 Archived: ${name}`); a.close(); });

clientCmd.command('summary <name>')
  .description('Client summary with budget status')
  .action((name: string) => {
    const a = getAlibye();
    const client = a.client(name);
    if (!client) { console.error(`  Client not found: ${name}`); process.exit(1); }
    const budget = a.clientBudget(client.id);
    const entries = a.entries({ client_id: client.id });
    if (json()) { console.log(JSON.stringify({ client, budget, entry_count: entries.length })); a.close(); return; }
    console.log(`\n  👤 Client: ${client.name}`);
    if (client.rate) console.log(`     💲 Rate: $${client.rate}/hr`);
    console.log(`     📊 Entries: ${entries.length}`);
    console.log(`     ⏱️  Hours: ${budget.used_hours}`);
    if (budget.budget_hours) console.log(`     📏 Budget: ${budget.used_hours}/${budget.budget_hours} hrs (${budget.percent_hours?.toFixed(0)}%)`);
    if (budget.budget_amount) console.log(`     💰 Budget: $${budget.used_amount}/$${budget.budget_amount} (${budget.percent_amount?.toFixed(0)}%)`);
    console.log('');
    a.close();
  });

// ─── Tag ────────────────────────────────────────────────────

const tagCmd = program.command('tag').description('Manage tags');

tagCmd.command('list').description('List tags')
  .action(() => {
    const a = getAlibye();
    const tags = a.tags();
    if (json()) { console.log(JSON.stringify(tags)); a.close(); return; }
    if (tags.length === 0) { console.log('\n  No tags yet. They\'re created automatically when you use --tags.\n'); a.close(); return; }
    console.log(`\n  🏷️  Tags (${tags.length})`);
    for (const t of tags) console.log(`  ${t.name}`);
    console.log('');
    a.close();
  });

tagCmd.command('delete <name>').description('Delete a tag')
  .action((name: string) => { const a = getAlibye(); a.deleteTag(name); console.log(`  🗑️  Tag deleted: ${name}`); a.close(); });

// ─── Backup ─────────────────────────────────────────────────

const backupCmd = program.command('backup').description('Database backup');

backupCmd.command('create').description('Create a backup')
  .option('-r, --reason <text>', 'Reason', 'manual backup')
  .action((opts) => {
    const a = getAlibye();
    const info = a.backup(opts.reason);
    if (json()) { console.log(JSON.stringify(info)); }
    else if (info) { console.log(`  💾 Backup: ${path.basename(info.path)} (${(info.size_bytes / 1024).toFixed(1)} KB)`); }
    else { console.log('  No database to backup.'); }
    a.close();
  });

backupCmd.command('list').description('List backups')
  .action(() => {
    const a = getAlibye();
    const backups = a.backups();
    if (json()) { console.log(JSON.stringify(backups)); a.close(); return; }
    if (backups.length === 0) { console.log('\n  No backups.\n'); a.close(); return; }
    console.log(`\n  💾 Backups (${backups.length})`);
    for (const b of backups) console.log(`  ${b.created_at.split('T')[0]} — ${path.basename(b.path)} (${(b.size_bytes / 1024).toFixed(1)} KB) — ${b.reason}`);
    console.log('');
    a.close();
  });

backupCmd.command('restore <path>').description('Restore from backup')
  .action((backupPath: string) => {
    const a = getAlibye();
    a.restore(backupPath);
    if (json()) { console.log(JSON.stringify({ restored: backupPath })); }
    else { console.log(`  ✅ Restored from: ${backupPath}`); }
    a.close();
  });

// ─── Helpers ────────────────────────────────────────────────

function resolveTime(input: string, dateCtx?: string): string {
  // If it's already ISO-ish, return as-is
  if (input.includes('T') || input.includes('-')) return input;
  // HH:MM → date + time
  const date = dateCtx || new Date().toISOString().split('T')[0];
  return `${date}T${input}:00`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const d = now.getDay();
  const mondayOffset = d === 0 ? -6 : 1 - d;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return { from: monday.toISOString().split('T')[0] + 'T00:00:00', to: now.toISOString().split('T')[0] + 'T23:59:59' };
}

function monthRange(monthStr?: string | 'last'): { from: string; to: string } {
  let year: number, month: number;
  if (monthStr === 'last') {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    year = now.getFullYear();
    month = now.getMonth();
  } else if (monthStr && monthStr.includes('-')) {
    const [y, m] = monthStr.split('-');
    year = parseInt(y);
    month = parseInt(m) - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    from: firstDay.toISOString().split('T')[0] + 'T00:00:00',
    to: lastDay.toISOString().split('T')[0] + 'T23:59:59',
  };
}

function resolveRange(opts: any): { from: string; to: string } {
  if (opts.today) {
    const today = new Date().toISOString().split('T')[0];
    return { from: today + 'T00:00:00', to: today + 'T23:59:59' };
  }
  if (opts.month !== undefined) {
    return monthRange(opts.month === true ? undefined : opts.month);
  }
  if (opts.lastMonth) {
    return monthRange('last');
  }
  if (opts.week || (!opts.from && !opts.to)) {
    return weekRange();
  }
  const from = opts.from ? opts.from + 'T00:00:00' : new Date(0).toISOString();
  const to = opts.to ? opts.to + 'T23:59:59' : new Date().toISOString();
  return { from, to };
}

function progressBar(percent: number, width: number): string {
  const filled = Math.min(Math.round((percent / 100) * width), width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

program.parse();
