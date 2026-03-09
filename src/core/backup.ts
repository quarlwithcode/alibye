/**
 * ⏱️ alibye — Database Backup System
 * VACUUM INTO for WAL-safe copies. Auto-prune to 10.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BackupInfo } from './types.js';

export class BackupManager {
  private backupDir: string;
  private dbPath: string;
  private maxBackups: number;

  constructor(dataDir: string, maxBackups = 10) {
    this.backupDir = path.join(dataDir, 'backups');
    this.dbPath = path.join(dataDir, 'alibye.db');
    this.maxBackups = maxBackups;
  }

  backup(reason: string): BackupInfo | null {
    if (!fs.existsSync(this.dbPath)) return null;
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alibye-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, filename);

    const src = new Database(this.dbPath, { readonly: true });
    try { src.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`); } finally { src.close(); }

    const stats = fs.statSync(backupPath);
    const info: BackupInfo = { path: backupPath, created_at: new Date().toISOString(), size_bytes: stats.size, reason };
    this.appendManifest(info);
    this.prune();
    return info;
  }

  list(): BackupInfo[] {
    return this.readManifest().sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  restore(backupPath: string): void {
    if (!fs.existsSync(backupPath)) throw new Error(`Backup not found: ${backupPath}`);
    if (fs.existsSync(this.dbPath)) this.backup('pre-restore safety backup');
    fs.copyFileSync(backupPath, this.dbPath);
  }

  private prune(): void {
    if (!fs.existsSync(this.backupDir)) return;
    const files = fs.readdirSync(this.backupDir).filter(f => f.startsWith('alibye-') && f.endsWith('.db')).sort().reverse();
    for (const file of files.slice(this.maxBackups)) fs.unlinkSync(path.join(this.backupDir, file));
    if (files.length > this.maxBackups) {
      const manifest = this.readManifest().filter(b => fs.existsSync(b.path));
      this.writeManifest(manifest);
    }
  }

  private manifestPath(): string { return path.join(this.backupDir, 'manifest.json'); }

  private readManifest(): BackupInfo[] {
    const p = this.manifestPath();
    if (!fs.existsSync(p)) return [];
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
  }

  private writeManifest(entries: BackupInfo[]): void {
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
    fs.writeFileSync(this.manifestPath(), JSON.stringify(entries, null, 2));
  }

  private appendManifest(info: BackupInfo): void {
    const m = this.readManifest(); m.push(info); this.writeManifest(m);
  }
}
