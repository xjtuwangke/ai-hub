const spawnSyncMock = jest.fn();

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawnSync: spawnSyncMock,
}));

const { spawnSync } = require('child_process');
const { resolveScanSecretsTarget, runScanSecretsCli } = require('../scan-secrets-runner');
const fs = require('fs');

describe('scan-secrets runner', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 7, error: null, signal: null, output: [] });
  });

  it('forwards ai-hub subcommand args to tools scan-secrets entry', () => {
    const target = resolveScanSecretsTarget();
    if (!target) {
      throw new Error('Expected scan-secrets target to exist in test environment');
    }

    const status = runScanSecretsCli([
      '/usr/bin/node',
      '/tmp/repo/dist/index.js',
      'scan-secrets',
      '--path',
      '/tmp/workspace',
      '--format',
      'json',
    ]);

    expect(status).toBe(7);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);

    const [command, args] = spawnSync.mock.calls[0] as [string, string[]];
    expect(command).toBe(process.execPath);
    expect(args).toContain('--path');
    expect(args).toContain('/tmp/workspace');
    expect(args).toContain('--format');
    expect(args).toContain('json');

    if (target.usesTsNode) {
      expect(args[0]).toBe('-r');
      expect(args[2]).toBe(target.entryPath);
    } else {
      expect(args[0]).toBe(target.entryPath);
    }
  });

  it('forwards standalone scan-secrets invocation args to tools entry', () => {
    const target = resolveScanSecretsTarget();
    if (!target) {
      throw new Error('Expected scan-secrets target to exist in test environment');
    }

    const status = runScanSecretsCli([
      '/usr/bin/node',
      '/tmp/repo/tools/scan-secrets/bin/scan-secrets',
      '--path',
      '/tmp/workspace',
    ]);

    expect(status).toBe(7);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);

    const [, args] = spawnSync.mock.calls[0] as [string, string[]];
    expect(args).toContain('--path');
    expect(args).toContain('/tmp/workspace');

    if (target.usesTsNode) {
      expect(args[0]).toBe('-r');
      expect(args[2]).toBe(target.entryPath);
    } else {
      expect(args[0]).toBe(target.entryPath);
    }
  });

  it('throws when no tools entry can be resolved', () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() =>
      runScanSecretsCli(['/usr/bin/node', '/tmp/repo/dist/index.js', 'scan-secrets'])
    ).toThrow('scan-secrets entry not found');

    existsSpy.mockRestore();
  });
});
