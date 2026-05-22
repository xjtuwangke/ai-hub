import * as fs from 'fs';
import * as path from 'path';

interface SecurityConfig {
  enabled: boolean;
  rules: string[];
  severity: 'low' | 'medium' | 'high';
}

const defaultConfig: SecurityConfig = {
  enabled: true,
  rules: ['sql-injection', 'xss', 'csrf', 'auth-bypass'],
  severity: 'high'
};

function setupSecurityDir(): string {
  const dir = path.join(process.cwd(), 'security');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created security directory: ${dir}`);
  }
  return dir;
}

function writeConfig(dir: string): void {
  const configPath = path.join(dir, 'security-config.json');
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`Wrote security config to: ${configPath}`);
}

function createAuditScript(dir: string): void {
  const script = `#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

console.log('Running security audit...');

// Run npm audit
try {
  const result = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe' });
  const audit = JSON.parse(result);
  console.log(\`Vulnerabilities found: \${audit.metadata.vulnerabilities.total}\`);
} catch {
  console.log('npm audit completed');
}
`;
  const scriptPath = path.join(dir, 'run-audit.js');
  fs.writeFileSync(scriptPath, script);
  fs.chmodSync(scriptPath, 0o755);
  console.log(`Created audit script: ${scriptPath}`);
}

console.log('Setting up security-audit skill...');
const dir = setupSecurityDir();
writeConfig(dir);
createAuditScript(dir);
console.log('security-audit setup complete!');
