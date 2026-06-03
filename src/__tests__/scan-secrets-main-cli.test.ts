const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../..');
const TS_NODE_REGISTER = require.resolve('ts-node/register');

const commandPath = path.join(REPO_ROOT, 'src', 'index.ts');

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ['-r', TS_NODE_REGISTER, commandPath, 'scan-secrets', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
  });

  return {
    status: result.status || 0,
    stdout: result.stdout ? String(result.stdout) : '',
    stderr: result.stderr ? String(result.stderr) : '',
  };
}

describe('ai-hub scan-secrets CLI', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-hub-scan-main-cli-'));
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  it('writes default cache file to parent directory for single-file scan', async () => {
    const targetDir = path.join(rootDir, 'target');
    const targetFile = path.join(targetDir, 'scan.txt');
    await fs.mkdirp(targetDir);
    await fs.writeFile(targetFile, 'api_key = main-cli-safe-token-987654321', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: main-cli-ignore-rule',
        '    name: Main CLI Ignore Rule',
        '    severity: medium',
        '    type: regex',
        "    pattern: 'do_not_match_secret_pattern'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    const invalidCachePath = path.join(targetFile, '.ai-hub-secret-scan-cache.json');
    const expectedCachePath = path.join(targetDir, '.ai-hub-secret-scan-cache.json');

    const result = runCli([
      '--path',
      targetFile,
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--cache',
    ]);

    expect(result.status).toBe(0);
    expect(await fs.pathExists(expectedCachePath)).toBe(true);
    expect(await fs.pathExists(invalidCachePath)).toBe(false);
  });
});
