import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

type ScanTarget = {
  entryPath: string;
  usesTsNode: boolean;
};

function makeTargets(): ScanTarget[] {
  const cwd = process.cwd();
  const currentDir = __dirname;

  const projectRoots = [cwd, currentDir, path.resolve(currentDir, '..')];

  return projectRoots.flatMap((root) => [
    {
      entryPath: path.join(root, 'tools', 'scan-secrets', 'dist', 'index.js'),
      usesTsNode: false,
    },
    {
      entryPath: path.join(root, 'tools', 'scan-secrets', 'src', 'index.ts'),
      usesTsNode: true,
    },
  ]);
}

export function resolveScanSecretsTarget(): ScanTarget | null {
  const candidates = makeTargets();

  for (const candidate of candidates) {
    if (existsSync(candidate.entryPath)) {
      return candidate;
    }
  }

  return null;
}

function isScanSecretsCommandArg(arg: string): boolean {
  return arg === 'scan-secrets'
    || arg.endsWith('/scan-secrets')
    || arg.endsWith('/scan-secrets.js')
    || arg.endsWith('/scan-secrets.ts');
}

function extractScanSecretsArgs(rawArgs: string[]): string[] {
  const commandIndex = rawArgs.findIndex(isScanSecretsCommandArg);
  if (commandIndex >= 0) {
    return rawArgs.slice(commandIndex + 1);
  }

  if (rawArgs.length >= 2) {
    return rawArgs.slice(2);
  }

  return [];
}

export function runScanSecretsCli(rawArgs: string[]): number {
  const target = resolveScanSecretsTarget();
  if (!target) {
    throw new Error(
      'scan-secrets entry not found. Run `npm --prefix tools/scan-secrets run build` or build from root with `npm run build:scan-secrets`.'
    );
  }

  const args = extractScanSecretsArgs(rawArgs);
  const spawnArgs = target.usesTsNode
    ? ['-r', require.resolve('ts-node/register'), target.entryPath, ...args]
    : [target.entryPath, ...args];

  const child = spawnSync(process.execPath, spawnArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (child.error) {
    throw child.error;
  }

  if (child.signal) {
    throw new Error(`scan-secrets terminated by signal: ${child.signal}`);
  }

  return child.status ?? 0;
}
