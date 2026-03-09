#!/usr/bin/env node

/**
 * ⏱️ alibye — Human Time Tracking CLI
 * All I Bill You Ever.
 */

import { Command } from 'commander';
import { Alibye } from '../core/alibye.js';
import { APP_VERSION } from '../core/types.js';
import { formatDuration, formatElapsed, formatDecimalHours } from '../core/rounding.js';
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

// ─── Status (default) ───────────────────────────────────────

program
  .command('status', { isDefault: true })
  .description('Dashboard — active timer, today, this week')
  .action(() => {
    const a = getAlibye();
    const d = a.dashboard();

    if (program.opts().json) { console.log(JSON.stringify(d)); a.close(); return; }

    console.log(`\n  ⏱️  alibye — Dashboard`);
    console.log(`  ${'═'.repeat(50)}`);

    if (d.active_timer) {
      const proj = d.active_timer.project_id ? a.project(d.active_timer.project_id) : null;
      console.log(`  🔴 TRACKING: ${d.active_timer.description || '(no description)'}`);
      if (proj) console.log(`     📁 ${proj.name}`);
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
    console.log('');
    a.close();
  });

// ─── Start ──────────────────────────────────────────────────

program
  .command('start [description...]')
  .description('Start a timer')
  .option('-p, --project <name>', 'Project')
  .option('-c, --client <name>', 'Client')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
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

    const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [];

    const timer = a.start({ description, project_id: projectId, client_id: clientId, billable: opts.billable, tags, pomodoro: opts.pomodoro });

    if (program.opts().json) { console.log(JSON.stringify(timer)); a.close(); return; }

    const proj = projectId ? a.project(projectId) : null;
    console.log(`\n  🔴 Timer started${description ? `: ${description}` : ''}`);
    if (proj) console.log(`     📁 ${proj.name}`);
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

    if (program.opts().json) { console.log(JSON.stringify(entry)); a.close(); return; }

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

    if (program.opts().json) { console.log(JSON.stringify(timer)); a.close(); return; }

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
    if (program.opts().json) { console.log(JSON.stringify({ discarded: true })); } else { console.log('  🗑️  Timer discarded'); }
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
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .option('--no-billable', 'Not billable')
  .option('--break', 'Mark as break time')
  .action((opts) => {
    const a = getAlibye();
    const start = resolveTime(opts.start);
    const end = resolveTime(opts.end);

    let projectId: string | undefined;
    if (opts.project) { const p = a.project(opts.project); if (p) projectId = p.id; }
    let clientId: string | undefined;
    if (opts.client) { const c = a.client(opts.client); if (c) clientId = c.id; }

    const entry = a.log({
      description: opts.desc,
      project_id: projectId,
      client_id: clientId,
      start,
      end,
      billable: opts.billable,
      is_break: opts.break,
      tags: opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [],
    });

    if (program.opts().json) { console.log(JSON.stringify(entry)); a.close(); return; }

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
  .option('--from <date>', 'From date')
  .option('--to <date>', 'To date')
  .option('-p, --project <name>', 'Filter by project')
  .option('-c, --client <name>', 'Filter by client')
  .option('-n, --limit <n>', 'Max entries', '20')
  .action((opts) => {
    const a = getAlibye();
    const filters: any = { limit: parseInt(opts.limit) };

    if (opts.today) {
      const today = new Date().toISOString().split('T')[0];
      filters.from = today + 'T00:00:00';
      filters.to = today + 'T23:59:59';
    } else if (opts.week) {
      const now = new Date();
      const d = now.getDay();
      const mondayOffset = d === 0 ? -6 : 1 - d;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      filters.from = monday.toISOString().split('T')[0] + 'T00:00:00';
      filters.to = now.toISOString().split('T')[0] + 'T23:59:59';
    } else {
      if (opts.from) filters.from = opts.from + 'T00:00:00';
      if (opts.to) filters.to = opts.to + 'T23:59:59';
    }

    if (opts.project) { const p = a.project(opts.project); if (p) filters.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) filters.client_id = c.id; }

    const entries = a.entries(filters);

    if (program.opts().json) { console.log(JSON.stringify(entries)); a.close(); return; }

    if (entries.length === 0) { console.log('\n  No entries found.\n'); a.close(); return; }

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
  .option('--start <datetime>', 'Start time')
  .option('--end <datetime>', 'End time')
  .action((id: string, opts) => {
    const a = getAlibye();
    const updates: any = {};
    if (opts.desc !== undefined) updates.description = opts.desc;
    if (opts.project) { const p = a.project(opts.project); if (p) updates.project_id = p.id; }
    if (opts.client) { const c = a.client(opts.client); if (c) updates.client_id = c.id; }
    if (opts.start) updates.start = resolveTime(opts.start);
    if (opts.end) updates.end = resolveTime(opts.end);

    const entry = a.updateEntry(id, updates);
    if (program.opts().json) { console.log(JSON.stringify(entry)); } else { console.log(`  ✅ Entry updated: ${entry.description}`); }
    a.close();
  });

// ─── Delete ─────────────────────────────────────────────────

program
  .command('delete <id>')
  .description('Delete a time entry')
  .action((id: string) => {
    const a = getAlibye();
    a.deleteEntry(id);
    if (program.opts().json) { console.log(JSON.stringify({ deleted: id })); } else { console.log(`  🗑️  Entry deleted`); }
    a.close();
  });

// ─── Report ─────────────────────────────────────────────────

program
  .command('report')
  .description('Time reports (summary, detailed, weekly)')
  .option('--today', 'Today only')
  .option('--week', 'This week')
  .option('--from <date>', 'From date')
  .option('--to <date>', 'To date')
  .option('--group <by>', 'Group by: project, client, day, tag', 'project')
  .option('--format <type>', 'Output: terminal, csv, json', 'terminal')
  .option('--weekly', 'Weekly timesheet view')
  .option('-o, --output <path>', 'Output file')
  .action((opts) => {
    const a = getAlibye();
    const { from, to } = resolveRange(opts);

    if (opts.weekly) {
      // Find Monday of the week
      const d = new Date(from);
      const day = d.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + mondayOffset);
      const weekStart = d.toISOString().split('T')[0];
      const ws = a.weekly(weekStart);

      if (program.opts().json || opts.format === 'json') {
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

    const summary = a.summary(from, to, opts.group);

    if (program.opts().json || opts.format === 'json') {
      const output = JSON.stringify(summary);
      if (opts.output) { fs.writeFileSync(opts.output, output); console.log(`  Saved: ${opts.output}`); } else console.log(output);
      a.close(); return;
    }

    if (summary.length === 0) { console.log('\n  No entries in range.\n'); a.close(); return; }

    const totalMin = summary.reduce((s, r) => s + r.rounded_minutes, 0);
    const totalBillable = summary.reduce((s, r) => s + r.billable_amount, 0);

    console.log(`\n  📊 Time Report (by ${opts.group})`);
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

// ─── Project ────────────────────────────────────────────────

const projectCmd = program.command('project').description('Manage projects');

projectCmd.command('add <name>')
  .description('Add a project')
  .option('-c, --client <name>', 'Client')
  .option('-r, --rate <rate>', 'Hourly rate')
  .option('--no-billable', 'Not billable')
  .option('--color <hex>', 'Color hex', '#3b82f6')
  .action((name: string, opts) => {
    const a = getAlibye();
    let clientId: string | undefined;
    if (opts.client) { const c = a.client(opts.client); if (c) clientId = c.id; }
    const proj = a.createProject({ name, client_id: clientId, rate: opts.rate ? parseFloat(opts.rate) : undefined, billable: opts.billable, color: opts.color });
    if (program.opts().json) { console.log(JSON.stringify(proj)); } else { console.log(`  ✅ Project: ${proj.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

projectCmd.command('list').description('List projects')
  .option('--all', 'Include archived')
  .action((opts) => {
    const a = getAlibye();
    const projects = a.projects(opts.all);
    if (program.opts().json) { console.log(JSON.stringify(projects)); a.close(); return; }
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

projectCmd.command('archive <name>').description('Archive a project')
  .action((name: string) => { const a = getAlibye(); a.archiveProject(name); console.log(`  📦 Archived: ${name}`); a.close(); });

// ─── Client ─────────────────────────────────────────────────

const clientCmd = program.command('client').description('Manage clients');

clientCmd.command('add <name>')
  .description('Add a client')
  .option('-e, --email <email>', 'Email')
  .option('-r, --rate <rate>', 'Default hourly rate')
  .action((name: string, opts) => {
    const a = getAlibye();
    const client = a.createClient({ name, email: opts.email, rate: opts.rate ? parseFloat(opts.rate) : undefined });
    if (program.opts().json) { console.log(JSON.stringify(client)); } else { console.log(`  ✅ Client: ${client.name}${opts.rate ? ` ($${opts.rate}/hr)` : ''}`); }
    a.close();
  });

clientCmd.command('list').description('List clients')
  .option('--all', 'Include archived')
  .action((opts) => {
    const a = getAlibye();
    const clients = a.clients(opts.all);
    if (program.opts().json) { console.log(JSON.stringify(clients)); a.close(); return; }
    if (clients.length === 0) { console.log('\n  No clients. Add one: alibye client add "Name"\n'); a.close(); return; }
    console.log(`\n  👥 Clients (${clients.length})`);
    for (const c of clients) { console.log(`  ${c.archived ? '📦' : '👤'} ${c.name}${c.rate ? ` — $${c.rate}/hr` : ''}`); }
    console.log('');
    a.close();
  });

clientCmd.command('archive <name>').description('Archive a client')
  .action((name: string) => { const a = getAlibye(); a.archiveClient(name); console.log(`  📦 Archived: ${name}`); a.close(); });

// ─── Tag ────────────────────────────────────────────────────

const tagCmd = program.command('tag').description('Manage tags');

tagCmd.command('list').description('List tags')
  .action(() => {
    const a = getAlibye();
    const tags = a.tags();
    if (program.opts().json) { console.log(JSON.stringify(tags)); a.close(); return; }
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
    if (program.opts().json) { console.log(JSON.stringify(info)); }
    else if (info) { console.log(`  💾 Backup: ${path.basename(info.path)} (${(info.size_bytes / 1024).toFixed(1)} KB)`); }
    else { console.log('  No database to backup.'); }
    a.close();
  });

backupCmd.command('list').description('List backups')
  .action(() => {
    const a = getAlibye();
    const backups = a.backups();
    if (program.opts().json) { console.log(JSON.stringify(backups)); a.close(); return; }
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
    if (program.opts().json) { console.log(JSON.stringify({ restored: backupPath })); }
    else { console.log(`  ✅ Restored from: ${backupPath}`); }
    a.close();
  });

// ─── Helpers ────────────────────────────────────────────────

function resolveTime(input: string): string {
  // If it's already ISO-ish, return as-is
  if (input.includes('T') || input.includes('-')) return input;
  // HH:MM → today's date + time
  const today = new Date().toISOString().split('T')[0];
  return `${today}T${input}:00`;
}

function resolveRange(opts: any): { from: string; to: string } {
  if (opts.today) {
    const today = new Date().toISOString().split('T')[0];
    return { from: today + 'T00:00:00', to: today + 'T23:59:59' };
  }
  if (opts.week || (!opts.from && !opts.to)) {
    const now = new Date();
    const d = now.getDay();
    const mondayOffset = d === 0 ? -6 : 1 - d;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    return { from: monday.toISOString().split('T')[0] + 'T00:00:00', to: now.toISOString().split('T')[0] + 'T23:59:59' };
  }
  const from = opts.from ? opts.from + 'T00:00:00' : new Date(0).toISOString();
  const to = opts.to ? opts.to + 'T23:59:59' : new Date().toISOString();
  return { from, to };
}

program.parse();
