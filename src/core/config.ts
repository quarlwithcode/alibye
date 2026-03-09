/**
 * ⏱️ alibye — Config Resolution
 */

import { AlibyeConfig, DEFAULT_CONFIG } from './types.js';
import path from 'path';

export function resolveConfig(overrides: Partial<AlibyeConfig> = {}): AlibyeConfig {
  const envDir = process.env.ALIBYE_DIR;
  return {
    ...DEFAULT_CONFIG,
    ...(envDir ? { data_dir: envDir } : {}),
    ...overrides,
  };
}

export function resolveDataDir(config: AlibyeConfig): string {
  return path.resolve(config.data_dir);
}
