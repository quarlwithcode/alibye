/**
 * ⏱️ alibye — Config Persistence Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Alibye } from '../src/core/alibye.js';
import { saveConfigFile, loadConfigFile } from '../src/core/config.js';
import { makeTmpAlibye } from './helpers.js';
import fs from 'fs';
import path from 'path';

let dir: string;
let cleanup: () => void;

beforeEach(() => { const t = makeTmpAlibye(); dir = t.dir; cleanup = t.cleanup; });
afterEach(() => cleanup());

describe('Config Persistence', () => {
  it('saves and loads config.json', () => {
    saveConfigFile(dir, { default_rate: 150 });
    const loaded = loadConfigFile(dir);
    expect(loaded.default_rate).toBe(150);
  });

  it('merges with existing config.json', () => {
    saveConfigFile(dir, { default_rate: 100 });
    saveConfigFile(dir, { rounding_mode: 'up' as any });
    const loaded = loadConfigFile(dir);
    expect(loaded.default_rate).toBe(100);
    expect(loaded.rounding_mode).toBe('up');
  });

  it('never persists data_dir', () => {
    saveConfigFile(dir, { data_dir: '/should/not/persist' } as any);
    const loaded = loadConfigFile(dir);
    expect(loaded.data_dir).toBeUndefined();
  });

  it('returns empty object for missing config.json', () => {
    const loaded = loadConfigFile(dir + '/nonexistent');
    expect(loaded).toEqual({});
  });

  it('config.json values are used in resolveConfig', () => {
    saveConfigFile(dir, { default_rate: 200, weekly_quota_hours: 40 });
    const a = new Alibye({ data_dir: dir });
    expect(a.config.default_rate).toBe(200);
    expect(a.config.weekly_quota_hours).toBe(40);
    a.close();
  });

  it('overrides win over config.json', () => {
    saveConfigFile(dir, { default_rate: 200 });
    const a = new Alibye({ data_dir: dir, default_rate: 300 });
    expect(a.config.default_rate).toBe(300);
    a.close();
  });

  it('config reset deletes config.json', () => {
    saveConfigFile(dir, { default_rate: 200 });
    const configPath = path.join(dir, 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    fs.unlinkSync(configPath);
    expect(fs.existsSync(configPath)).toBe(false);
    expect(loadConfigFile(dir)).toEqual({});
  });
});
