const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../..');
const TS_NODE_REGISTER = require.resolve('ts-node/register');

const commandPath = path.join(REPO_ROOT, 'src/scan-secrets.ts');

function runCli(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ['-r', TS_NODE_REGISTER, commandPath, ...args], {
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

describe('scan-secrets CLI', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-hub-scan-cli-'));
    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'api_key = localsecretvalue12345', 'utf8');
    await fs.mkdirp(path.join(rootDir, 'rules'));
    await fs.mkdirp(path.join(rootDir, 'plugins'));
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  it('loads rules and plugins via CLI flags', async () => {
    await fs.writeFile(
      path.join(rootDir, 'rules', 'custom-rules.yaml'),
      [
        'rules:',
        '  - id: cli-custom-rule',
        '    name: CLI Rule',
        '    severity: high',
        '    type: regex',
        "    pattern: 'api_key\\s*=\\s*[A-Za-z0-9_]+'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    await fs.writeFile(
      path.join(rootDir, 'plugins', 'plugin.js'),
      [
        'module.exports = {',
        "  id: 'cli-plugin',",
        "  name: 'CLI Plugin',",
        '  scan: (context) => [',
        "    {",
        "      rule_id: 'cli-plugin-rule',",
        '      line: 1,',
        '      column: 1,',
        "      match: 'api_key',",
        "      severity: 'medium',",
        '      snippet: context.lines[0],',
        '    },',
        '  ],',
        '};',
      ].join('\n'),
      'utf8',
    );

    const result = runCli([
      '--path', path.join(rootDir, 'scan.txt'),
      '--no-default-rules',
      '--rules-dir', path.join(rootDir, 'rules'),
      '--plugin-dir', path.join(rootDir, 'plugins'),
      '--json',
    ], rootDir);

    expect(result.status).toBe(1);
    const body = JSON.parse(result.stdout);
    expect(body.total_files).toBe(1);
    expect(body.findings).toHaveLength(2);
    expect(body.findings.find((item: any) => item.rule_id === 'cli-custom-rule')).toBeDefined();
    expect(body.findings.find((item: any) => item.detector === 'cli-plugin')).toBeDefined();
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Loaded 1 detector plugin(s)'),
        expect.stringContaining('Loaded rule directory:'),
      ]),
    );
  });

  it('supports git-diff mode in CLI', async () => {
    const gitArgs = [
      ['init'],
      ['config', 'user.email', 'scan-cli@example.com'],
      ['config', 'user.name', 'scan-cli'],
      ['add', 'scan.txt'],
      ['commit', '-m', 'init'],
    ];

    for (const args of gitArgs) {
      const cmd = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
      if (cmd.status !== 0) {
        throw new Error(String(cmd.stderr ?? `git ${args.join(' ')} failed`));
      }
    }

    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'api_key = changedsecretvalue9999', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: cli-diff-rule',
        '    name: CLI Diff Rule',
        '    severity: high',
        '    type: regex',
        "    pattern: 'changedsecretvalue9999'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    const result = runCli([
      '--path', rootDir,
      '--rules', path.join(rootDir, 'rules.yaml'),
      '--git-diff', 'HEAD',
      '--json',
      '--no-default-rules',
    ], rootDir);

    expect(result.status).toBe(1);
    const body = JSON.parse(result.stdout);
    expect(body.total_files).toBe(1);
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].rule_id).toBe('cli-diff-rule');
  });

  it('writes json output to file with --output', async () => {
    const safeContent = 'this file does not contain any known secret pattern';
    await fs.writeFile(path.join(rootDir, 'scan.txt'), safeContent, 'utf8');
    const outputPath = path.join(rootDir, 'scan-output.json');
    const result = runCli([
      '--path', path.join(rootDir, 'scan.txt'),
      '--rules', path.join(rootDir, 'non-exist-rules.json'),
      '--no-default-rules',
      '--json',
      '--output', outputPath,
    ], rootDir);

    expect(result.status).toBe(0);
    expect(await fs.pathExists(outputPath)).toBe(true);
    const body = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(body);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(typeof parsed.total_files).toBe('number');
  });

  it('supports --format for CLI output', async () => {
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: cli-format-rule',
        '    name: CLI Format Rule',
        '    severity: medium',
        '    type: regex',
        "    pattern: 'format_secret_token'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'format_secret_token = xyz', 'utf8');

    const result = runCli([
      '--path',
      path.join(rootDir, 'scan.txt'),
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--format',
      'json',
    ], rootDir);

    expect(result.status).toBe(1);
    const body = JSON.parse(result.stdout);
    expect(body.total_files).toBe(1);
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].rule_id).toBe('cli-format-rule');
  });

  it('redacts CLI json output by default and supports --no-redact', async () => {
    const rawSecret = 'verysecretvalue123456789';
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: cli-redact-rule',
        '    name: CLI Redact Rule',
        '    severity: high',
        '    type: regex',
        `    pattern: '${rawSecret}'`,
        '    flags: i',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(path.join(rootDir, 'scan.txt'), `token = ${rawSecret}`, 'utf8');

    const redacted = runCli([
      '--path',
      path.join(rootDir, 'scan.txt'),
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--json',
    ], rootDir);
    expect(redacted.status).toBe(1);
    expect(redacted.stdout).not.toContain(rawSecret);
    expect(JSON.parse(redacted.stdout).findings[0].match).toContain('[REDACTED]');

    const raw = runCli([
      '--path',
      path.join(rootDir, 'scan.txt'),
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--json',
      '--no-redact',
    ], rootDir);
    expect(raw.status).toBe(1);
    expect(raw.stdout).toContain(rawSecret);
  });

  it('uses exit code 2 for rule configuration errors in strict mode', async () => {
    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'clean = value', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: strict-bad-rule',
        '    name: Strict Bad Rule',
        '    severity: critical',
        '    type: regex',
        "    pattern: '['",
      ].join('\n'),
      'utf8',
    );

    const nonStrict = runCli([
      '--path',
      path.join(rootDir, 'scan.txt'),
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--json',
    ], rootDir);
    expect(nonStrict.status).toBe(0);
    expect(JSON.parse(nonStrict.stdout).errors[0]).toContain('Invalid regex');

    const strict = runCli([
      '--path',
      path.join(rootDir, 'scan.txt'),
      '--rules',
      path.join(rootDir, 'rules.yaml'),
      '--no-default-rules',
      '--json',
      '--strict',
    ], rootDir);
    expect(strict.status).toBe(2);
    expect(JSON.parse(strict.stdout).errors[0]).toContain('Invalid regex');
  });

  it('uses parent directory for cache path on single file scans', async () => {
    const targetDir = path.join(rootDir, 'single-target');
    const targetFile = path.join(targetDir, 'scan.txt');
    await fs.mkdirp(targetDir);
    await fs.writeFile(targetFile, 'api_key = local-test-secret-123', 'utf8');

    const invalidCachePath = path.join(targetFile, '.ai-hub-secret-scan-cache.json');
    const expectedCachePath = path.join(targetDir, '.ai-hub-secret-scan-cache.json');

    const result = runCli([
      '--path', targetFile,
      '--no-default-rules',
      '--cache',
    ], rootDir);

    expect(result.status).toBe(0);
    expect(await fs.pathExists(expectedCachePath)).toBe(true);
    expect(await fs.pathExists(invalidCachePath)).toBe(false);
  });
});
