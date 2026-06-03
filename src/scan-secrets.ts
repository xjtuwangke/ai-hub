#!/usr/bin/env node

import { runScanSecretsCli } from './scan-secrets-runner';

try {
  const exitCode = runScanSecretsCli(process.argv);
  process.exit(exitCode);
} catch (error) {
  console.error(`scan-secrets failed: ${error}`);
  process.exit(1);
}
