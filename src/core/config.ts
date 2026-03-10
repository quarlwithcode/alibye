/**
 * ⏱️ alibye — Config Resolution
 */

import { AlibyeConfig, DEFAULT_CONFIG } from './types.js';
import path from 'path';
import fs from 'fs';

export function loadConfigFile(dataDir: string): Partial<AlibyeConfig> {
  const configPath = path.join(dataDir, 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Never allow data_dir from config.json (avoids circular dep)
    delete raw.data_dir;
    return raw;
  } catch { return {}; }
}

export function saveConfigFile(dataDir: string, partial: Partial<AlibyeConfig>): void {
  const resolvedDir = path.resolve(dataDir);
  if (!fs.existsSync(resolvedDir)) fs.mkdirSync(resolvedDir, { recursive: true });
  const configPath = path.join(resolvedDir, 'config.json');
  const existing = loadConfigFile(resolvedDir);
  const merged = { ...existing, ...partial };
  // Never persist data_dir
  delete merged.data_dir;
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

export function resolveConfig(overrides: Partial<AlibyeConfig> = {}): AlibyeConfig {
  const envDir = process.env.ALIBYE_DIR;
  // Resolve data_dir first (env/overrides only, never config.json)
  const dataDir = overrides.data_dir || envDir || DEFAULT_CONFIG.data_dir;
  const resolvedDataDir = path.resolve(dataDir);
  // Load config.json from resolved data dir
  const fileConfig = loadConfigFile(resolvedDataDir);
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...(envDir ? { data_dir: envDir } : {}),
    ...overrides,
  };
}

export function resolveDataDir(config: AlibyeConfig): string {
  return path.resolve(config.data_dir);
}
