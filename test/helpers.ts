/**
 * ⏱️ alibye — Test Helpers
 */

import { Alibye } from '../src/core/alibye.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function makeTmpAlibye(config: Partial<import('../src/core/types.js').AlibyeConfig> = {}): { alibye: Alibye; dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alibye-test-'));
  const alibye = new Alibye({ data_dir: dir, ...config });
  return { alibye, dir, cleanup: () => { alibye.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

export function isoNow(): string { return new Date().toISOString(); }

export function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}
