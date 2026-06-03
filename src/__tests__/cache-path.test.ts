const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { resolveCachePath } from '../secret-scan/cache-path';

describe('cache path resolver', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-hub-cache-path-'));
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  it('returns undefined when cache is not enabled', async () => {
    const targetDir = path.join(rootDir, 'project');
    await fs.mkdirp(targetDir);

    const resolved = resolveCachePath(targetDir, { cache: false });

    expect(resolved).toBeUndefined();
  });

  it('supports explicit cache path override', async () => {
    const explicit = path.join(rootDir, 'explicit', 'scan-cache.json');

    const resolved = resolveCachePath(path.join(rootDir, 'project'), {
      cache: true,
      cachePath: explicit,
    });

    expect(resolved).toBe(explicit);
  });

  it('uses target directory when target is directory', async () => {
    const targetDir = path.join(rootDir, 'repo');
    await fs.mkdirp(targetDir);

    const resolved = resolveCachePath(targetDir, { cache: true });

    expect(resolved).toBe(path.join(targetDir, '.ai-hub-secret-scan-cache.json'));
  });

  it('uses parent directory when target is a single file', async () => {
    const targetDir = path.join(rootDir, 'repo');
    const targetFile = path.join(targetDir, 'scan.txt');
    await fs.mkdirp(targetDir);
    await fs.writeFile(targetFile, 'dummy', 'utf8');

    const resolved = resolveCachePath(targetFile, { cache: true });

    expect(resolved).toBe(path.join(targetDir, '.ai-hub-secret-scan-cache.json'));
  });
});
