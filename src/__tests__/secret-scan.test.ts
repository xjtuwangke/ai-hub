const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { runSecretScan, outputScanResult, registerScanOutputFormatter, listScanOutputFormats, toSarif } from '../secret-scan';

const execFileAsync = promisify(execFile);

async function runGitCommand(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
  return stdout.trim();
}

describe('secret scan', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-hub-secret-scan-'));
  });

  afterEach(async () => {
    await fs.remove(rootDir);
  });

  it('loads rules from rulesDir and detector plugins', async () => {
    await fs.mkdirp(path.join(rootDir, 'rules', 'nested'));
    await fs.mkdirp(path.join(rootDir, 'plugins'));

    await fs.writeFile(
      path.join(rootDir, 'rules', 'nested', 'custom-rules.yaml'),
      [
        'rules:',
        '  - id: custom-rule',
        '    name: Custom Secret',
        '    severity: medium',
        '    type: regex',
        "    pattern: 'thisisasecretvalue'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    await fs.writeFile(
      path.join(rootDir, 'plugins', 'sample-plugin.js'),
      [
        'module.exports = {',
        "  id: 'sample-plugin',",
        "  name: 'Sample Plugin',",
        '  scan: (context) => {',
        '    const findings = [];',
        '    for (let i = 0; i < context.lines.length; i++) {',
        "      if (context.lines[i].match(/PLUGIN_MARKER\\s*=/)) {",
        '        findings.push({',
        "          rule_id: 'plugin-rule',",
        '          line: i + 1,',
        "          column: context.lines[i].search(/PLUGIN_MARKER\\s*=/) + 1,",
        "          match: 'PLUGIN_MARKER',",
        '          severity: \'high\',',
        "          snippet: context.lines[i],",
        '        });',
        '      }',
        '    }',
        '    return findings;',
        '  },',
        '};',
      ].join('\n'),
      'utf8',
    );

    await fs.writeFile(
      path.join(rootDir, 'scan.txt'),
      [
        'api_key = thisisasecretvalue',
        'PLUGIN_MARKER = enabled',
      ].join('\n'),
      'utf8',
    );

    const result = await runSecretScan({
      rootPath: path.join(rootDir, 'scan.txt'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 2,
      gitDiff: { enabled: false },
      rulesDirs: [path.join(rootDir, 'rules')],
      detectorPluginDirs: [path.join(rootDir, 'plugins')],
      baselinePath: null,
    });

    expect(result.total_files).toBe(1);
    expect(result.findings).toHaveLength(2);
    expect(result.findings.find((item) => item.rule_id === 'custom-rule')).toBeDefined();
    expect(result.findings.find((item) => item.detector === 'sample-plugin')).toBeDefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Loaded 1 detector plugin(s)'),
        expect.stringContaining('Loaded rule directory'),
      ]),
    );
  });

  it('scans only git-diff files when --git-diff is enabled', async () => {
    await fs.writeFile(path.join(rootDir, 'secret.txt'), 'token = baseline\\n', 'utf8');

    await runGitCommand(rootDir, ['init']);
    await runGitCommand(rootDir, ['config', 'user.email', 'scan-test@example.com']);
    await runGitCommand(rootDir, ['config', 'user.name', 'scan test']);
    await runGitCommand(rootDir, ['add', '.']);
    await runGitCommand(rootDir, ['commit', '-m', 'init']);

    await fs.writeFile(
      path.join(rootDir, 'secret.txt'),
      'token = baseline\\napi_key = changedsecretvalue123\\n',
      'utf8',
    );

    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: diff-rule',
        '    name: Diff Secret',
        '    severity: high',
        '    type: regex',
        "    pattern: 'changedsecretvalue123'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    const result = await runSecretScan({
      rootPath: rootDir,
      rulesPath: path.join(rootDir, 'rules.yaml'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 2,
      gitDiff: {
        enabled: true,
        base: 'HEAD',
      },
      baselinePath: null,
    });

    expect(result.total_files).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].rule_id).toBe('diff-rule');
  });

  it('handles git-diff paths with spaces and unicode characters', async () => {
    const specialFile = 'secret folder/凭据 file.txt';
    await fs.mkdirp(path.join(rootDir, 'secret folder'));
    await fs.writeFile(path.join(rootDir, specialFile), 'token = baseline\\n', 'utf8');

    await runGitCommand(rootDir, ['init']);
    await runGitCommand(rootDir, ['config', 'user.email', 'scan-test@example.com']);
    await runGitCommand(rootDir, ['config', 'user.name', 'scan test']);
    await runGitCommand(rootDir, ['add', '.']);
    await runGitCommand(rootDir, ['commit', '-m', 'init']);

    await fs.writeFile(path.join(rootDir, specialFile), 'token = changed_special_secret_123\\n', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: special-diff-rule',
        '    name: Special Diff Rule',
        '    severity: high',
        '    type: regex',
        "    pattern: 'changed_special_secret_123'",
        '    flags: i',
      ].join('\n'),
      'utf8',
    );

    const result = await runSecretScan({
      rootPath: rootDir,
      rulesPath: path.join(rootDir, 'rules.yaml'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 2,
      gitDiff: {
        enabled: true,
        base: 'HEAD',
      },
      baselinePath: null,
    });

    expect(result.total_files).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].path).toBe(specialFile);
  });

  it('returns warning for empty git-diff result', async () => {
    await runGitCommand(rootDir, ['init']);
    await runGitCommand(rootDir, ['config', 'user.email', 'scan-test@example.com']);
    await runGitCommand(rootDir, ['config', 'user.name', 'scan test']);
    await fs.writeFile(path.join(rootDir, 'secret.txt'), 'clean = value\\n', 'utf8');
    await runGitCommand(rootDir, ['add', '.']);
    await runGitCommand(rootDir, ['commit', '-m', 'init']);

    const result = await runSecretScan({
      rootPath: rootDir,
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 2,
      gitDiff: {
        enabled: true,
        base: 'HEAD',
      },
      baselinePath: null,
    });

    expect(result.total_files).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.warnings).toContain('No git diff entries found for base HEAD');
  });

  it('reuses previous scan results with cache enabled', async () => {
    const cachePath = path.join(rootDir, '.scan-cache.json');

    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: cache-rule',
        '    name: Cache Rule',
        '    severity: medium',
        '    type: regex',
        "    pattern: 'cache_secret_token'",
        '    flags: i',
        '    paths:',
        '      - scan.txt',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'cache_secret_token=abc123', 'utf8');

    const baseConfig = {
      rootPath: rootDir,
      rulesPath: path.join(rootDir, 'rules.yaml'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 1,
      gitDiff: { enabled: false },
      baselinePath: null,
      cachePath,
    };

    const first = await runSecretScan(baseConfig);
    expect(first.findings).toHaveLength(1);
    expect(first.warnings).toContain(`Incremental cache enabled: ${cachePath}`);

    const second = await runSecretScan(baseConfig);
    expect(second.findings).toHaveLength(1);
    const cacheSummary = second.warnings?.find((value) => value.startsWith('scan cache hits:'));
    expect(cacheSummary).toEqual(expect.stringMatching(/scan cache hits: [1-9]+, misses: 0/));
  });

  it('applies ignore patterns and path-scoped rules with nested globs', async () => {
    const projectDir = path.join(rootDir, 'project');
    await fs.mkdirp(path.join(projectDir, 'src', 'nested'));
    await fs.mkdirp(path.join(projectDir, 'dist'));
    await fs.writeFile(path.join(projectDir, 'src', 'a.ts'), 'secret_token_alpha', 'utf8');
    await fs.writeFile(path.join(projectDir, 'src', 'nested', 'b.ts'), 'secret_token_beta', 'utf8');
    await fs.writeFile(path.join(projectDir, 'dist', 'bundle.ts'), 'secret_token_dist', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: scoped-glob-rule',
        '    name: Scoped Glob Rule',
        '    severity: high',
        '    type: regex',
        "    pattern: 'secret_token_[a-z]+'",
        '    flags: i',
        '    paths:',
        '      - src/**/*.ts',
      ].join('\n'),
      'utf8',
    );

    const result = await runSecretScan({
      rootPath: projectDir,
      rulesPath: path.join(rootDir, 'rules.yaml'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: ['dist/**'],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 2,
      gitDiff: { enabled: false },
      baselinePath: null,
    });

    expect(result.findings.map((item) => item.path).sort()).toEqual([
      'src/a.ts',
      'src/nested/b.ts',
    ]);
  });

  it('reports rule schema errors without aborting non-strict scans', async () => {
    await fs.writeFile(path.join(rootDir, 'scan.txt'), 'clean = value', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'rules.yaml'),
      [
        'rules:',
        '  - id: bad-severity-rule',
        '    name: Bad Severity Rule',
        '    severity: urgent',
        '    type: regex',
        "    pattern: 'secret'",
        '  - id: good-rule',
        '    name: Good Rule',
        '    severity: low',
        '    type: regex',
        "    pattern: 'does_not_match'",
      ].join('\n'),
      'utf8',
    );

    const result = await runSecretScan({
      rootPath: path.join(rootDir, 'scan.txt'),
      rulesPath: path.join(rootDir, 'rules.yaml'),
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 1,
      gitDiff: { enabled: false },
      baselinePath: null,
    });

    expect(result.total_files).toBe(1);
    expect(result.findings).toHaveLength(0);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('severity must be one of critical/high/medium/low'),
      ]),
    );
  });

  it('invalidates cache when detector plugin content changes', async () => {
    const projectDir = path.join(rootDir, 'project');
    const cachePath = path.join(projectDir, '.scan-cache.json');
    const pluginDir = path.join(rootDir, 'plugins');
    const pluginPath = path.join(pluginDir, 'plugin.js');
    await fs.mkdirp(projectDir);
    await fs.mkdirp(pluginDir);
    await fs.writeFile(path.join(projectDir, 'scan.txt'), 'PLUGIN_MARKER = enabled', 'utf8');
    await fs.writeFile(
      pluginPath,
      [
        'module.exports = {',
        "  id: 'cache-plugin',",
        '  scan: (context) => [{',
        "    rule_id: 'cache-plugin-rule',",
        "    match: 'PLUGIN_MARKER',",
        '    line: 1,',
        '    column: 1,',
        "    severity: 'medium',",
        '    snippet: context.lines[0],',
        '  }],',
        '};',
      ].join('\n'),
      'utf8',
    );

    const baseConfig = {
      rootPath: projectDir,
      useDefaultRules: false,
      useGitIgnore: true,
      ignorePatterns: [],
      maxFileSizeBytes: 1024 * 1024,
      includeBinary: false,
      concurrency: 1,
      gitDiff: { enabled: false },
      baselinePath: null,
      cachePath,
      detectorPluginDirs: [pluginDir],
    };

    const first = await runSecretScan(baseConfig);
    expect(first.findings).toHaveLength(1);

    await fs.writeFile(
      pluginPath,
      [
        'module.exports = {',
        "  id: 'cache-plugin',",
        '  scan: () => [],',
        '};',
      ].join('\n'),
      'utf8',
    );

    const second = await runSecretScan(baseConfig);
    expect(second.findings).toHaveLength(0);
    expect(second.warnings?.some((warning) => warning.includes('Cache signature changed'))).toBe(true);
  });

  it('builds SARIF rules with matching ruleIndex values', () => {
    const sarif = toSarif({
      generated_at: new Date().toISOString(),
      scanned_path: rootDir,
      total_files: 1,
      findings: [
        {
          rule_id: 'first-rule',
          rule_name: 'First Rule',
          severity: 'high',
          path: 'a.ts',
          line: 1,
          column: 1,
          match: 'a',
          snippet: 'a',
          fingerprint: 'first',
          detector: 'regex',
        },
        {
          rule_id: 'second-rule',
          rule_name: 'Second Rule',
          severity: 'medium',
          path: 'b.ts',
          line: 1,
          column: 1,
          match: 'b',
          snippet: 'b',
          fingerprint: 'second',
          detector: 'regex',
        },
      ],
    });

    expect(sarif.runs[0].tool.driver.rules.map((rule: any) => rule.id)).toEqual([
      'first-rule',
      'second-rule',
    ]);
    expect(sarif.runs[0].results.map((result: any) => result.ruleIndex)).toEqual([0, 1]);
  });

  it('creates output directories before writing scan result', async () => {
    const outputPath = path.join(rootDir, 'nested', 'scan', 'result.json');

    await outputScanResult({
      generated_at: new Date().toISOString(),
      scanned_path: rootDir,
      total_files: 0,
      findings: [],
    }, { format: 'json', output: outputPath });

    expect(await fs.pathExists(outputPath)).toBe(true);
  });

  it('redacts finding matches and snippets by default in json output', async () => {
    const outputPath = path.join(rootDir, 'redacted', 'scan.json');
    const rawSecret = 'supersecretvalue123456';

    await outputScanResult({
      generated_at: new Date().toISOString(),
      scanned_path: rootDir,
      total_files: 1,
      findings: [
        {
          rule_id: 'redact-rule',
          rule_name: 'Redact Rule',
          severity: 'high',
          path: 'secret.txt',
          line: 1,
          column: 9,
          match: rawSecret,
          snippet: `token = ${rawSecret}`,
          fingerprint: 'fingerprint-kept',
          detector: 'regex',
        },
      ],
    }, { format: 'json', output: outputPath });

    const body = await fs.readFile(outputPath, 'utf8');
    expect(body).not.toContain(rawSecret);
    const parsed = JSON.parse(body);
    expect(parsed.findings[0].match).toContain('[REDACTED]');
    expect(parsed.findings[0].snippet).toContain('[REDACTED]');
    expect(parsed.findings[0].fingerprint).toBe('fingerprint-kept');
  });

  it('allows raw finding output when redaction is disabled', async () => {
    const outputPath = path.join(rootDir, 'raw', 'scan.json');
    const rawSecret = 'supersecretvalue123456';

    await outputScanResult({
      generated_at: new Date().toISOString(),
      scanned_path: rootDir,
      total_files: 1,
      findings: [
        {
          rule_id: 'raw-rule',
          rule_name: 'Raw Rule',
          severity: 'high',
          path: 'secret.txt',
          line: 1,
          column: 9,
          match: rawSecret,
          snippet: `token = ${rawSecret}`,
          fingerprint: 'raw-fingerprint',
          detector: 'regex',
        },
      ],
    }, { format: 'json', output: outputPath, redact: false });

    const body = await fs.readFile(outputPath, 'utf8');
    expect(body).toContain(rawSecret);
  });

  it('supports custom output formatter registration', async () => {
    const outputPath = path.join(rootDir, 'custom-format.txt');
    const result = {
      generated_at: new Date().toISOString(),
      scanned_path: rootDir,
      total_files: 1,
      findings: [],
    };

    registerScanOutputFormatter('mini', () => 'ok');
    expect(listScanOutputFormats()).toContain('mini');

    await outputScanResult(result, { format: 'mini', output: outputPath });
    const body = await fs.readFile(outputPath, 'utf8');
    expect(body).toBe('ok');
  });
});
