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

function createChecklist(dir: string): void {
  const checklist = `# Security Audit Checklist

- [ ] SQL Injection checks
- [ ] XSS prevention
- [ ] CSRF tokens
- [ ] Authentication validation
- [ ] Input sanitization
- [ ] Dependency vulnerability scan
`;
  const checklistPath = path.join(dir, 'checklist.md');
  fs.writeFileSync(checklistPath, checklist);
  console.log(`Created checklist: ${checklistPath}`);
}

console.log('Setting up security-audit skill...');
const dir = setupSecurityDir();
writeConfig(dir);
createChecklist(dir);
console.log('security-audit setup complete!');
