/**
 * ⏱️ alibye — Core Class (Facade)
 * Human time tracking for AI-managed workflows.
 */

import { AlibyeDB } from './database.js';
import { AlibyeConfig, DEFAULT_CONFIG } from './types.js';
import { resolveConfig } from './config.js';

export class Alibye {
  private _db: AlibyeDB;
  private _config: AlibyeConfig;

  constructor(config: Partial<AlibyeConfig> = {}) {
    this._config = resolveConfig(config);
    this._db = new AlibyeDB(this._config);
  }

  get config(): AlibyeConfig { return this._config; }

  // Timer
  start(input: Parameters<AlibyeDB['startTimer']>[0]) { return this._db.startTimer(input); }
  stop() { return this._db.stopTimer(); }
  timer() { return this._db.getActiveTimer(); }
  discard() { return this._db.discardTimer(); }

  // Entries
  log(input: Parameters<AlibyeDB['createEntry']>[0]) { return this._db.createEntry(input); }
  entry(id: string) { return this._db.getEntry(id); }
  entries(filters?: Parameters<AlibyeDB['queryEntries']>[0]) { return this._db.queryEntries(filters); }
  updateEntry(id: string, updates: Parameters<AlibyeDB['updateEntry']>[1]) { return this._db.updateEntry(id, updates); }
  deleteEntry(id: string) { return this._db.deleteEntry(id); }
  entryTags(entryId: string) { return this._db.getEntryTags(entryId); }

  // Tasks
  createTask(input: Parameters<AlibyeDB['createTask']>[0]) { return this._db.createTask(input); }
  task(idOrName: string) { return this._db.getTask(idOrName); }
  tasks(filters?: Parameters<AlibyeDB['listTasks']>[0]) { return this._db.listTasks(filters); }
  updateTask(id: string, updates: Parameters<AlibyeDB['updateTask']>[1]) { return this._db.updateTask(id, updates); }
  archiveTask(idOrName: string) { return this._db.archiveTask(idOrName); }

  // Work Types
  createWorkType(input: Parameters<AlibyeDB['createWorkType']>[0]) { return this._db.createWorkType(input); }
  workType(idOrName: string) { return this._db.getWorkType(idOrName); }
  workTypes() { return this._db.listWorkTypes(); }
  updateWorkType(id: string, updates: Parameters<AlibyeDB['updateWorkType']>[1]) { return this._db.updateWorkType(id, updates); }
  deleteWorkType(idOrName: string) { return this._db.deleteWorkType(idOrName); }

  // Projects
  createProject(input: Parameters<AlibyeDB['createProject']>[0]) { return this._db.createProject(input); }
  project(idOrName: string) { return this._db.getProject(idOrName); }
  projects(includeArchived = false) { return this._db.listProjects(includeArchived); }
  archiveProject(idOrName: string) { return this._db.archiveProject(idOrName); }

  // Clients
  createClient(input: Parameters<AlibyeDB['createClient']>[0]) { return this._db.createClient(input); }
  client(idOrName: string) { return this._db.getClient(idOrName); }
  clients(includeArchived = false) { return this._db.listClients(includeArchived); }
  archiveClient(idOrName: string) { return this._db.archiveClient(idOrName); }

  // Tags
  tags() { return this._db.listTags(); }
  deleteTag(name: string) { return this._db.deleteTag(name); }

  // Reports
  summary(from: string, to: string, groupBy?: Parameters<AlibyeDB['summaryReport']>[2]) { return this._db.summaryReport(from, to, groupBy); }
  weekly(weekStart: string) { return this._db.weeklyTimesheet(weekStart); }
  dashboard() { return this._db.getDashboard(); }
  stats() { return this._db.getStats(); }
  flagIdle() { return this._db.flagIdleEntries(); }

  // Export
  exportCSV(from: string, to: string) { return this._db.exportCSV(from, to); }

  // Backup
  backup(reason = 'manual backup') { return this._db.createBackup(reason); }
  backups() { return this._db.listBackups(); }
  restore(path: string) { return this._db.restoreBackup(path); }

  // Continue last
  continueLast(): ReturnType<AlibyeDB['startTimer']> {
    const last = this._db.queryEntries({ limit: 1 });
    if (last.length === 0) throw new Error('No previous entries to continue');
    const entry = last[0];
    const tags = this._db.getEntryTags(entry.id).map(t => t.name);
    return this._db.startTimer({
      description: entry.description,
      project_id: entry.project_id || undefined,
      client_id: entry.client_id || undefined,
      task_id: entry.task_id || undefined,
      work_type_id: entry.work_type_id || undefined,
      billable: entry.billable,
      tags,
    });
  }

  close(): void { this._db.close(); }
}
