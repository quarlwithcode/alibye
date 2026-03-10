/**
 * ⏱️ alibye — SQLite Database Layer
 *
 * Tables: time_entries, projects, clients, tags, entry_tags, active_timer
 * Versioned migrations with auto-backup.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  TimeEntry, Project, Client, Tag, Task, WorkType, ActiveTimer,
  AlibyeConfig, SCHEMA_VERSION,
  SummaryRow, WeeklyDay, WeeklyTimesheet, DashboardData,
  BudgetStatus, QuotaStatus,
} from './types.js';
import {
  TimerAlreadyRunningError, NoActiveTimerError,
  ProjectNotFoundError, ClientNotFoundError, EntryNotFoundError,
  TaskNotFoundError, WorkTypeNotFoundError,
} from './errors.js';
import { roundDuration, calcAmount } from './rounding.js';
import { BackupManager } from './backup.js';
import { calcBudgetStatus } from './budget.js';
import { calcQuotaStatus } from './quota.js';

export class AlibyeDB {
  private db: Database.Database;
  private backup: BackupManager;
  private config: AlibyeConfig;

  constructor(config: AlibyeConfig) {
    this.config = config;
    const dataDir = path.resolve(config.data_dir);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    this.backup = new BackupManager(dataDir);
    const dbPath = path.join(dataDir, 'alibye.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  // ─── Migrations ───────────────────────────────────────────

  private migrate(): void {
    const version = this.getSchemaVersion();
    if (version > 0 && version < SCHEMA_VERSION) {
      this.backup.backup(`pre-migration v${version} → v${SCHEMA_VERSION}`);
    }
    if (version < 1) this.migrateV1();
    if (version < 2) this.migrateV2();
    this.setSchemaVersion(SCHEMA_VERSION);
  }

  private getSchemaVersion(): number {
    try {
      const row = this.db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as any;
      return row ? parseInt(row.value) : 0;
    } catch { return 0; }
  }

  private setSchemaVersion(v: number): void {
    this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(v));
  }

  private migrateV1(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, email TEXT,
        rate REAL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, client_id TEXT,
        color TEXT DEFAULT '#3b82f6', billable INTEGER NOT NULL DEFAULT 1,
        rate REAL, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY, description TEXT DEFAULT '',
        project_id TEXT, client_id TEXT,
        start TEXT NOT NULL, end_ TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        rounded_minutes REAL NOT NULL DEFAULT 0,
        billable INTEGER NOT NULL DEFAULT 1,
        rate REAL, amount REAL NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'manual',
        is_break INTEGER NOT NULL DEFAULT 0,
        is_idle INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS entry_tags (
        entry_id TEXT NOT NULL, tag_id TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag_id),
        FOREIGN KEY (entry_id) REFERENCES time_entries(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS active_timer (
        id TEXT PRIMARY KEY, description TEXT DEFAULT '',
        project_id TEXT, client_id TEXT,
        start TEXT NOT NULL, billable INTEGER NOT NULL DEFAULT 1,
        tags TEXT DEFAULT '[]',
        pomodoro INTEGER NOT NULL DEFAULT 0,
        pomodoro_work_ms INTEGER DEFAULT 1500000,
        pomodoro_break_ms INTEGER DEFAULT 300000,
        pomodoro_session INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_entries_start ON time_entries(start);
      CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id);
      CREATE INDEX IF NOT EXISTS idx_entries_client ON time_entries(client_id);
      CREATE INDEX IF NOT EXISTS idx_entries_billable ON time_entries(billable);
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    `);
  }

  private migrateV2(): void {
    // New tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        project_id TEXT, client_id TEXT,
        rate REAL, budget_hours REAL, budget_amount REAL,
        billable INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS work_types (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        rate REAL, created_at TEXT NOT NULL
      );
    `);

    // ALTER TABLE — all nullable, SQLite-safe
    const addCol = (table: string, col: string, type: string) => {
      try { this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch { /* already exists */ }
    };

    addCol('time_entries', 'task_id', 'TEXT');
    addCol('time_entries', 'work_type_id', 'TEXT');
    addCol('time_entries', 'entry_rate_override', 'REAL');
    addCol('active_timer', 'task_id', 'TEXT');
    addCol('active_timer', 'work_type_id', 'TEXT');
    addCol('projects', 'budget_hours', 'REAL');
    addCol('projects', 'budget_amount', 'REAL');
    addCol('clients', 'budget_hours', 'REAL');
    addCol('clients', 'budget_amount', 'REAL');

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entries_task ON time_entries(task_id);
      CREATE INDEX IF NOT EXISTS idx_entries_work_type ON time_entries(work_type_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
    `);
  }

  // ─── Timer ────────────────────────────────────────────────

  startTimer(input: { description?: string; project_id?: string; client_id?: string; task_id?: string; work_type_id?: string; billable?: boolean; tags?: string[]; pomodoro?: boolean }): ActiveTimer {
    const existing = this.getActiveTimer();
    if (existing) throw new TimerAlreadyRunningError(existing.description || '(no description)');

    // Auto-resolve project/client from task
    let projectId = input.project_id || null;
    let clientId = input.client_id || null;
    if (input.task_id) {
      const task = this.getTask(input.task_id);
      if (task) {
        if (!projectId && task.project_id) projectId = task.project_id;
        if (!clientId && task.client_id) clientId = task.client_id;
      }
    }
    // Resolve client from project if still not set
    if (!clientId && projectId) {
      const proj = this.getProject(projectId);
      if (proj) clientId = proj.client_id;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const pomWork = this.config.pomodoro_work_minutes * 60 * 1000;
    const pomBreak = this.config.pomodoro_break_minutes * 60 * 1000;

    this.db.prepare(
      `INSERT INTO active_timer (id, description, project_id, client_id, task_id, work_type_id, start, billable, tags, pomodoro, pomodoro_work_ms, pomodoro_break_ms, pomodoro_session) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(id, input.description || '', projectId, clientId, input.task_id || null, input.work_type_id || null, now, input.billable !== false ? 1 : 0, JSON.stringify(input.tags || []), input.pomodoro ? 1 : 0, pomWork, pomBreak, 1);

    return this.getActiveTimer()!;
  }

  stopTimer(): TimeEntry {
    const timer = this.getActiveTimer();
    if (!timer) throw new NoActiveTimerError();

    const now = new Date();
    const startTime = new Date(timer.start);
    const durationMs = now.getTime() - startTime.getTime();

    const rate = this.resolveRate({ task_id: timer.task_id, work_type_id: timer.work_type_id, project_id: timer.project_id, client_id: timer.client_id });
    const roundedMinutes = roundDuration(durationMs, this.config.rounding_mode, this.config.rounding_interval);
    const amount = timer.billable ? calcAmount(roundedMinutes, rate) : 0;

    const entryId = randomUUID();
    const nowStr = now.toISOString();

    this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO time_entries (id, description, project_id, client_id, task_id, work_type_id, start, end_, duration_ms, rounded_minutes, billable, rate, entry_rate_override, amount, source, is_break, is_idle, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(entryId, timer.description, timer.project_id, timer.client_id, timer.task_id, timer.work_type_id, timer.start, nowStr, durationMs, roundedMinutes, timer.billable ? 1 : 0, rate, null, amount, timer.pomodoro ? 'pomodoro' : 'timer', 0, 0, nowStr, nowStr);

      const tags: string[] = timer.tags || [];
      for (const tagName of tags) {
        const tag = this.getOrCreateTag(tagName);
        this.db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?,?)').run(entryId, tag.id);
      }

      this.db.prepare('DELETE FROM active_timer').run();
    })();

    return this.getEntry(entryId)!;
  }

  getActiveTimer(): ActiveTimer | null {
    const row = this.db.prepare('SELECT * FROM active_timer LIMIT 1').get() as any;
    if (!row) return null;
    return { id: row.id, description: row.description, project_id: row.project_id, client_id: row.client_id, task_id: row.task_id || null, work_type_id: row.work_type_id || null, start: row.start, billable: !!row.billable, tags: JSON.parse(row.tags || '[]'), pomodoro: !!row.pomodoro, pomodoro_work_ms: row.pomodoro_work_ms, pomodoro_break_ms: row.pomodoro_break_ms, pomodoro_session: row.pomodoro_session };
  }

  discardTimer(): void {
    if (!this.getActiveTimer()) throw new NoActiveTimerError();
    this.db.prepare('DELETE FROM active_timer').run();
  }

  // ─── Time Entries ─────────────────────────────────────────

  createEntry(input: { description?: string; project_id?: string; client_id?: string; task_id?: string; work_type_id?: string; entry_rate_override?: number; start: string; end: string; billable?: boolean; is_break?: boolean; tags?: string[] }): TimeEntry {
    const startTime = new Date(input.start);
    const endTime = new Date(input.end);
    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs < 0) throw new Error('End time must be after start time');

    // Auto-resolve project/client from task
    let projectId = input.project_id || null;
    let clientId = input.client_id || null;
    if (input.task_id) {
      const task = this.getTask(input.task_id);
      if (task) {
        if (!projectId && task.project_id) projectId = task.project_id;
        if (!clientId && task.client_id) clientId = task.client_id;
      }
    }
    if (!clientId && projectId) {
      const proj = this.getProject(projectId);
      if (proj) clientId = proj.client_id;
    }

    const rate = this.resolveRate({ entry_rate_override: input.entry_rate_override, task_id: input.task_id, work_type_id: input.work_type_id, project_id: projectId, client_id: clientId });
    const roundedMinutes = roundDuration(durationMs, this.config.rounding_mode, this.config.rounding_interval);
    const billable = input.billable !== false && !input.is_break;
    const amount = billable ? calcAmount(roundedMinutes, rate) : 0;

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO time_entries (id, description, project_id, client_id, task_id, work_type_id, start, end_, duration_ms, rounded_minutes, billable, rate, entry_rate_override, amount, source, is_break, is_idle, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, input.description || '', projectId, clientId, input.task_id || null, input.work_type_id || null, input.start, input.end, durationMs, roundedMinutes, billable ? 1 : 0, rate, input.entry_rate_override ?? null, amount, 'manual', input.is_break ? 1 : 0, 0, now, now);

      for (const tagName of input.tags || []) {
        const tag = this.getOrCreateTag(tagName);
        this.db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?,?)').run(id, tag.id);
      }
    })();

    return this.getEntry(id)!;
  }

  getEntry(id: string): TimeEntry | null {
    const row = this.db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  queryEntries(filters: { from?: string; to?: string; project_id?: string; client_id?: string; task_id?: string; work_type_id?: string; billable?: boolean; is_break?: boolean; limit?: number } = {}): TimeEntry[] {
    let sql = 'SELECT * FROM time_entries WHERE 1=1';
    const params: any[] = [];
    if (filters.from) { sql += ' AND start >= ?'; params.push(filters.from); }
    if (filters.to) { sql += ' AND start <= ?'; params.push(filters.to); }
    if (filters.project_id) { sql += ' AND project_id = ?'; params.push(filters.project_id); }
    if (filters.client_id) { sql += ' AND client_id = ?'; params.push(filters.client_id); }
    if (filters.task_id) { sql += ' AND task_id = ?'; params.push(filters.task_id); }
    if (filters.work_type_id) { sql += ' AND work_type_id = ?'; params.push(filters.work_type_id); }
    if (filters.billable !== undefined) { sql += ' AND billable = ?'; params.push(filters.billable ? 1 : 0); }
    if (filters.is_break !== undefined) { sql += ' AND is_break = ?'; params.push(filters.is_break ? 1 : 0); }
    sql += ' ORDER BY start DESC';
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit); }
    return (this.db.prepare(sql).all(...params) as any[]).map(r => this.rowToEntry(r));
  }

  updateEntry(id: string, updates: Partial<Pick<TimeEntry, 'description' | 'project_id' | 'client_id' | 'task_id' | 'work_type_id' | 'entry_rate_override' | 'rate' | 'billable' | 'start' | 'end'>> & { tags?: string[] }): TimeEntry {
    const entry = this.getEntry(id);
    if (!entry) throw new EntryNotFoundError(id);

    const fields: string[] = [];
    const values: any[] = [];
    const boolKeys = new Set(['billable']);

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined && key !== 'tags') {
        const col = key === 'end' ? 'end_' : key;
        fields.push(`${col} = ?`);
        values.push(boolKeys.has(key) ? (val ? 1 : 0) : val);
      }
    }

    // Handle tags
    if (updates.tags !== undefined) {
      // Remove old tags, add new ones
      this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(id);
      for (const tagName of updates.tags) {
        const tag = this.getOrCreateTag(tagName);
        this.db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?,?)').run(id, tag.id);
      }
    }

    if (fields.length > 0) {
      // Recalculate duration if start/end changed
      const newStart = (updates.start || entry.start);
      const newEnd = (updates.end || entry.end);
      if (newStart && newEnd) {
        const durationMs = new Date(newEnd).getTime() - new Date(newStart).getTime();
        const roundedMinutes = roundDuration(durationMs, this.config.rounding_mode, this.config.rounding_interval);
        fields.push('duration_ms = ?', 'rounded_minutes = ?');
        values.push(durationMs, roundedMinutes);
      }

      // Re-resolve rate if relevant fields changed and no explicit rate set
      if ((updates.project_id !== undefined || updates.client_id !== undefined || updates.task_id !== undefined || updates.work_type_id !== undefined || updates.entry_rate_override !== undefined) && updates.rate === undefined) {
        const newEntry = { ...entry, ...updates };
        const resolvedRate = this.resolveRate({ entry_rate_override: newEntry.entry_rate_override, task_id: newEntry.task_id, work_type_id: newEntry.work_type_id, project_id: newEntry.project_id, client_id: newEntry.client_id });
        fields.push('rate = ?');
        values.push(resolvedRate);
        // Recalculate amount
        const isBillable = updates.billable !== undefined ? updates.billable : entry.billable;
        const rm = updates.start || updates.end ? roundDuration(new Date((updates.end || entry.end)!).getTime() - new Date(updates.start || entry.start).getTime(), this.config.rounding_mode, this.config.rounding_interval) : entry.rounded_minutes;
        const amt = isBillable ? calcAmount(rm, resolvedRate) : 0;
        fields.push('amount = ?');
        values.push(amt);
      }

      fields.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getEntry(id)!;
  }

  deleteEntry(id: string): void {
    const entry = this.getEntry(id);
    if (!entry) throw new EntryNotFoundError(id);
    this.db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  }

  getEntryTags(entryId: string): Tag[] {
    return (this.db.prepare('SELECT t.* FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?').all(entryId) as any[]).map(r => ({ id: r.id, name: r.name, created_at: r.created_at }));
  }

  private rowToEntry(row: any): TimeEntry {
    return { id: row.id, description: row.description, project_id: row.project_id, client_id: row.client_id, task_id: row.task_id || null, work_type_id: row.work_type_id || null, start: row.start, end: row.end_, duration_ms: row.duration_ms, rounded_minutes: row.rounded_minutes, billable: !!row.billable, rate: row.rate, entry_rate_override: row.entry_rate_override ?? null, amount: row.amount, source: row.source, is_break: !!row.is_break, is_idle: !!row.is_idle, created_at: row.created_at, updated_at: row.updated_at };
  }

  // ─── Projects ─────────────────────────────────────────────

  createProject(input: { name: string; client_id?: string; color?: string; billable?: boolean; rate?: number }): Project {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO projects (id, name, client_id, color, billable, rate, created_at) VALUES (?,?,?,?,?,?,?)'
    ).run(id, input.name, input.client_id || null, input.color || '#3b82f6', input.billable !== false ? 1 : 0, input.rate ?? null, now);
    return this.getProject(id)!;
  }

  getProject(idOrName: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ? OR name = ?').get(idOrName, idOrName) as any;
    return row ? this.rowToProject(row) : null;
  }

  private rowToProject(row: any): Project {
    return { id: row.id, name: row.name, client_id: row.client_id, color: row.color, billable: !!row.billable, rate: row.rate, budget_hours: row.budget_hours ?? null, budget_amount: row.budget_amount ?? null, archived: !!row.archived, created_at: row.created_at };
  }

  listProjects(includeArchived = false): Project[] {
    const sql = includeArchived ? 'SELECT * FROM projects ORDER BY name' : 'SELECT * FROM projects WHERE archived = 0 ORDER BY name';
    return (this.db.prepare(sql).all() as any[]).map(r => this.rowToProject(r));
  }

  archiveProject(idOrName: string): void {
    const p = this.getProject(idOrName);
    if (!p) throw new ProjectNotFoundError(idOrName);
    this.db.prepare('UPDATE projects SET archived = 1 WHERE id = ?').run(p.id);
  }

  updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'client_id' | 'color' | 'billable' | 'rate' | 'budget_hours' | 'budget_amount'>>): Project {
    const p = this.getProject(id);
    if (!p) throw new ProjectNotFoundError(id);
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'billable' ? (val ? 1 : 0) : val);
      }
    }
    if (fields.length > 0) {
      values.push(p.id);
      this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getProject(p.id)!;
  }

  // ─── Clients ──────────────────────────────────────────────

  createClient(input: { name: string; email?: string; rate?: number }): Client {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO clients (id, name, email, rate, created_at) VALUES (?,?,?,?,?)').run(id, input.name, input.email || null, input.rate ?? null, now);
    return this.getClient(id)!;
  }

  getClient(idOrName: string): Client | null {
    const row = this.db.prepare('SELECT * FROM clients WHERE id = ? OR name = ?').get(idOrName, idOrName) as any;
    return row ? this.rowToClient(row) : null;
  }

  private rowToClient(row: any): Client {
    return { id: row.id, name: row.name, email: row.email, rate: row.rate, budget_hours: row.budget_hours ?? null, budget_amount: row.budget_amount ?? null, archived: !!row.archived, created_at: row.created_at };
  }

  listClients(includeArchived = false): Client[] {
    const sql = includeArchived ? 'SELECT * FROM clients ORDER BY name' : 'SELECT * FROM clients WHERE archived = 0 ORDER BY name';
    return (this.db.prepare(sql).all() as any[]).map(r => this.rowToClient(r));
  }

  archiveClient(idOrName: string): void {
    const c = this.getClient(idOrName);
    if (!c) throw new ClientNotFoundError(idOrName);
    this.db.prepare('UPDATE clients SET archived = 1 WHERE id = ?').run(c.id);
  }

  updateClient(id: string, updates: Partial<Pick<Client, 'name' | 'email' | 'rate' | 'budget_hours' | 'budget_amount'>>): Client {
    const c = this.getClient(id);
    if (!c) throw new ClientNotFoundError(id);
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
    }
    if (fields.length > 0) {
      values.push(c.id);
      this.db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getClient(c.id)!;
  }

  // ─── Tasks ──────────────────────────────────────────────────

  createTask(input: { name: string; project_id?: string; client_id?: string; rate?: number; budget_hours?: number; budget_amount?: number; billable?: boolean }): Task {
    const id = randomUUID();
    const now = new Date().toISOString();
    // Resolve client from project if not specified
    let clientId = input.client_id || null;
    if (!clientId && input.project_id) {
      const proj = this.getProject(input.project_id);
      if (proj) clientId = proj.client_id;
    }
    this.db.prepare(
      'INSERT INTO tasks (id, name, project_id, client_id, rate, budget_hours, budget_amount, billable, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(id, input.name, input.project_id || null, clientId, input.rate ?? null, input.budget_hours ?? null, input.budget_amount ?? null, input.billable !== false ? 1 : 0, now);
    return this.getTask(id)!;
  }

  getTask(idOrName: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ? OR name = ?').get(idOrName, idOrName) as any;
    return row ? this.rowToTask(row) : null;
  }

  private rowToTask(row: any): Task {
    return { id: row.id, name: row.name, project_id: row.project_id, client_id: row.client_id, rate: row.rate, budget_hours: row.budget_hours ?? null, budget_amount: row.budget_amount ?? null, billable: !!row.billable, archived: !!row.archived, created_at: row.created_at };
  }

  listTasks(filters?: { project_id?: string; client_id?: string; includeArchived?: boolean }): Task[] {
    let sql = 'SELECT * FROM tasks';
    const params: any[] = [];
    const conditions: string[] = [];
    if (!filters?.includeArchived) conditions.push('archived = 0');
    if (filters?.project_id) { conditions.push('project_id = ?'); params.push(filters.project_id); }
    if (filters?.client_id) { conditions.push('client_id = ?'); params.push(filters.client_id); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY name';
    return (this.db.prepare(sql).all(...params) as any[]).map(r => this.rowToTask(r));
  }

  updateTask(id: string, updates: Partial<Pick<Task, 'name' | 'project_id' | 'client_id' | 'rate' | 'budget_hours' | 'budget_amount' | 'billable'>>): Task {
    const task = this.getTask(id);
    if (!task) throw new TaskNotFoundError(id);
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'billable' ? (val ? 1 : 0) : val);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getTask(id)!;
  }

  archiveTask(idOrName: string): void {
    const t = this.getTask(idOrName);
    if (!t) throw new TaskNotFoundError(idOrName);
    this.db.prepare('UPDATE tasks SET archived = 1 WHERE id = ?').run(t.id);
  }

  // ─── Work Types ────────────────────────────────────────────

  createWorkType(input: { name: string; rate?: number }): WorkType {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO work_types (id, name, rate, created_at) VALUES (?,?,?,?)').run(id, input.name, input.rate ?? null, now);
    return this.getWorkType(id)!;
  }

  getWorkType(idOrName: string): WorkType | null {
    const row = this.db.prepare('SELECT * FROM work_types WHERE id = ? OR name = ?').get(idOrName, idOrName) as any;
    return row ? { id: row.id, name: row.name, rate: row.rate, created_at: row.created_at } : null;
  }

  listWorkTypes(): WorkType[] {
    return (this.db.prepare('SELECT * FROM work_types ORDER BY name').all() as any[]).map(r => ({ id: r.id, name: r.name, rate: r.rate, created_at: r.created_at }));
  }

  updateWorkType(id: string, updates: Partial<Pick<WorkType, 'name' | 'rate'>>): WorkType {
    const wt = this.getWorkType(id);
    if (!wt) throw new WorkTypeNotFoundError(id);
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
    }
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE work_types SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return this.getWorkType(id)!;
  }

  deleteWorkType(idOrName: string): void {
    const wt = this.getWorkType(idOrName);
    if (!wt) throw new WorkTypeNotFoundError(idOrName);
    this.db.prepare('DELETE FROM work_types WHERE id = ?').run(wt.id);
  }

  // ─── Rate Cascade ──────────────────────────────────────────

  private resolveRate(opts: { entry_rate_override?: number | null; task_id?: string | null; work_type_id?: string | null; project_id?: string | null; client_id?: string | null }): number | null {
    // 1. Explicit override
    if (opts.entry_rate_override && opts.entry_rate_override > 0) return opts.entry_rate_override;
    // 2. Task rate
    if (opts.task_id) { const t = this.getTask(opts.task_id); if (t?.rate && t.rate > 0) return t.rate; }
    // 3. Work type rate
    if (opts.work_type_id) { const wt = this.getWorkType(opts.work_type_id); if (wt?.rate && wt.rate > 0) return wt.rate; }
    // 4. Project rate
    if (opts.project_id) { const p = this.getProject(opts.project_id); if (p?.rate && p.rate > 0) return p.rate; }
    // 5. Client rate
    if (opts.client_id) { const c = this.getClient(opts.client_id); if (c?.rate && c.rate > 0) return c.rate; }
    // 6. Default rate
    if (this.config.default_rate > 0) return this.config.default_rate;
    return null;
  }

  // ─── Tags ─────────────────────────────────────────────────

  getOrCreateTag(name: string): Tag {
    const existing = this.db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as any;
    if (existing) return { id: existing.id, name: existing.name, created_at: existing.created_at };
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO tags (id, name, created_at) VALUES (?,?,?)').run(id, name, now);
    return { id, name, created_at: now };
  }

  listTags(): Tag[] {
    return (this.db.prepare('SELECT * FROM tags ORDER BY name').all() as any[]).map(r => ({ id: r.id, name: r.name, created_at: r.created_at }));
  }

  deleteTag(name: string): void {
    this.db.prepare('DELETE FROM tags WHERE name = ?').run(name);
  }

  // ─── Budget & Quota ─────────────────────────────────────────

  getBudgetStatus(entityType: 'project' | 'client' | 'task', idOrName: string): BudgetStatus {
    let entity: { id: string; name: string; budget_hours?: number | null; budget_amount?: number | null } | null = null;
    let entries: TimeEntry[] = [];

    if (entityType === 'project') {
      const p = this.getProject(idOrName);
      if (!p) throw new ProjectNotFoundError(idOrName);
      entity = p;
      entries = this.queryEntries({ project_id: p.id });
    } else if (entityType === 'client') {
      const c = this.getClient(idOrName);
      if (!c) throw new ClientNotFoundError(idOrName);
      entity = c;
      entries = this.queryEntries({ client_id: c.id });
    } else {
      const t = this.getTask(idOrName);
      if (!t) throw new TaskNotFoundError(idOrName);
      entity = t;
      entries = this.queryEntries({ task_id: t.id });
    }

    return calcBudgetStatus(entity, entityType, entries);
  }

  getActiveBudgetWarnings(): BudgetStatus[] {
    const warnings: BudgetStatus[] = [];
    const projects = this.listProjects().filter(p => p.budget_hours || p.budget_amount);
    for (const p of projects) {
      const status = this.getBudgetStatus('project', p.id);
      if (status.status !== 'green') warnings.push(status);
    }
    const clients = this.listClients().filter(c => c.budget_hours || c.budget_amount);
    for (const c of clients) {
      const status = this.getBudgetStatus('client', c.id);
      if (status.status !== 'green') warnings.push(status);
    }
    const tasks = this.listTasks().filter(t => t.budget_hours || t.budget_amount);
    for (const t of tasks) {
      const status = this.getBudgetStatus('task', t.id);
      if (status.status !== 'green') warnings.push(status);
    }
    return warnings;
  }

  getBurnReport(opts: { project_id?: string; client_id?: string; task_id?: string }): { budget: BudgetStatus; entries: TimeEntry[] } {
    if (opts.task_id) {
      const budget = this.getBudgetStatus('task', opts.task_id);
      const entries = this.queryEntries({ task_id: opts.task_id });
      return { budget, entries };
    }
    if (opts.project_id) {
      const budget = this.getBudgetStatus('project', opts.project_id);
      const entries = this.queryEntries({ project_id: opts.project_id });
      return { budget, entries };
    }
    if (opts.client_id) {
      const budget = this.getBudgetStatus('client', opts.client_id);
      const entries = this.queryEntries({ client_id: opts.client_id });
      return { budget, entries };
    }
    throw new Error('Burn report requires --project, --client, or --task');
  }

  // ─── Reports ──────────────────────────────────────────────

  summaryReport(from: string, to: string, groupBy: 'project' | 'client' | 'day' | 'tag' = 'project'): SummaryRow[] {
    const entries = this.queryEntries({ from, to });
    const map = new Map<string, SummaryRow>();

    for (const e of entries) {
      let key: string;
      switch (groupBy) {
        case 'project': key = e.project_id ? (this.getProject(e.project_id)?.name || 'Unknown') : '(no project)'; break;
        case 'client': key = e.client_id ? (this.getClient(e.client_id)?.name || 'Unknown') : '(no client)'; break;
        case 'day': key = e.start.split('T')[0]; break;
        case 'tag': {
          const tags = this.getEntryTags(e.id);
          key = tags.length > 0 ? tags.map(t => t.name).join(', ') : '(no tags)';
          break;
        }
      }
      const row = map.get(key) || { key, entries: 0, total_minutes: 0, rounded_minutes: 0, billable_minutes: 0, billable_amount: 0 };
      row.entries++;
      row.total_minutes += e.duration_ms / 60000;
      row.rounded_minutes += e.rounded_minutes;
      if (e.billable) { row.billable_minutes += e.rounded_minutes; row.billable_amount += e.amount; }
      map.set(key, row);
    }

    return [...map.values()].sort((a, b) => b.rounded_minutes - a.rounded_minutes);
  }

  weeklyTimesheet(weekStart: string): WeeklyTimesheet {
    const start = new Date(weekStart + 'T00:00:00');
    const days: WeeklyDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let totalMin = 0, billableMin = 0, billableAmt = 0, totalEntries = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const entries = this.queryEntries({ from: dateStr + 'T00:00:00', to: dateStr + 'T23:59:59', is_break: false });

      const dayMin = entries.reduce((s, e) => s + e.rounded_minutes, 0);
      const dayBillable = entries.filter(e => e.billable).reduce((s, e) => s + e.rounded_minutes, 0);
      const dayAmt = entries.filter(e => e.billable).reduce((s, e) => s + e.amount, 0);

      days.push({ date: dateStr, day: dayNames[d.getDay()], total_minutes: dayMin, billable_minutes: dayBillable, entries: entries.length });
      totalMin += dayMin;
      billableMin += dayBillable;
      billableAmt += dayAmt;
      totalEntries += entries.length;
    }

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { week_start: weekStart, week_end: end.toISOString().split('T')[0], days, total_minutes: totalMin, billable_minutes: billableMin, billable_amount: Math.round(billableAmt * 100) / 100, total_entries: totalEntries };
  }

  getDashboard(): DashboardData {
    const timer = this.getActiveTimer();
    const elapsed = timer ? Date.now() - new Date(timer.start).getTime() : 0;
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = this.queryEntries({ from: today + 'T00:00:00', to: today + 'T23:59:59' });
    const todayWork = todayEntries.filter(e => !e.is_break);
    const todayBreaks = todayEntries.filter(e => e.is_break);

    // Week (Monday start)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEntries = this.queryEntries({ from: weekStart + 'T00:00:00', to: today + 'T23:59:59', is_break: false });

    return {
      active_timer: timer,
      elapsed_ms: elapsed,
      today_minutes: todayWork.reduce((s, e) => s + e.rounded_minutes, 0),
      today_entries: todayWork.length,
      today_billable: todayWork.filter(e => e.billable).reduce((s, e) => s + e.amount, 0),
      week_minutes: weekEntries.reduce((s, e) => s + e.rounded_minutes, 0),
      week_billable: weekEntries.filter(e => e.billable).reduce((s, e) => s + e.amount, 0),
      break_minutes_today: todayBreaks.reduce((s, e) => s + e.rounded_minutes, 0),
      quota: calcQuotaStatus(this.config, todayWork.reduce((s, e) => s + e.rounded_minutes, 0), weekEntries.reduce((s, e) => s + e.rounded_minutes, 0), now.getDay()),
      budget_warnings: this.getActiveBudgetWarnings(),
    };
  }

  // ─── Stats ────────────────────────────────────────────────

  getStats() {
    const count = (sql: string): number => ((this.db.prepare(sql).get() as any)?.c || 0);
    return {
      total_entries: count('SELECT COUNT(*) as c FROM time_entries'),
      projects: count('SELECT COUNT(*) as c FROM projects WHERE archived = 0'),
      clients: count('SELECT COUNT(*) as c FROM clients WHERE archived = 0'),
      tasks: count('SELECT COUNT(*) as c FROM tasks WHERE archived = 0'),
      work_types: count('SELECT COUNT(*) as c FROM work_types'),
      tags: count('SELECT COUNT(*) as c FROM tags'),
      timer_running: !!this.getActiveTimer(),
    };
  }

  // ─── Idle Detection ───────────────────────────────────────

  flagIdleEntries(): number {
    const thresholdMs = this.config.idle_threshold_minutes * 60 * 1000;
    const result = this.db.prepare(
      `UPDATE time_entries SET is_idle = 1, updated_at = ? WHERE duration_ms > ? AND is_idle = 0 AND source = 'timer'`
    ).run(new Date().toISOString(), thresholdMs);
    return result.changes;
  }

  // ─── Backup ───────────────────────────────────────────────

  createBackup(reason: string) { return this.backup.backup(reason); }
  listBackups() { return this.backup.list(); }
  restoreBackup(p: string) { this.backup.restore(p); }

  // ─── Export ───────────────────────────────────────────────

  exportCSV(from: string, to: string): string {
    const entries = this.queryEntries({ from, to });
    const header = 'Date,Start,End,Description,Project,Client,Task,WorkType,Duration (min),Rounded (min),Billable,Rate,Amount,Tags';
    const rows = entries.map(e => {
      const proj = e.project_id ? this.getProject(e.project_id)?.name || '' : '';
      const client = e.client_id ? this.getClient(e.client_id)?.name || '' : '';
      const task = e.task_id ? this.getTask(e.task_id)?.name || '' : '';
      const workType = e.work_type_id ? this.getWorkType(e.work_type_id)?.name || '' : '';
      const tags = this.getEntryTags(e.id).map(t => t.name).join(';');
      return `${e.start.split('T')[0]},${e.start},${e.end || ''},${csvEscape(e.description)},${csvEscape(proj)},${csvEscape(client)},${csvEscape(task)},${csvEscape(workType)},${(e.duration_ms / 60000).toFixed(2)},${e.rounded_minutes},${e.billable},${e.rate || 0},${e.amount},${csvEscape(tags)}`;
    });
    return [header, ...rows].join('\n');
  }

  close(): void { this.db.close(); }
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
