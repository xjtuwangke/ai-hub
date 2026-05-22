import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import YAML from 'yaml';
import { CommandMetadata, ChangelogEntry } from './types';

export const c = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  dim: (msg: string) => console.log(chalk.gray(msg)),
  header: (msg: string) => console.log('\n' + chalk.bold.cyan('▶'), chalk.bold(msg)),
  sub: (msg: string) => console.log('  ' + chalk.gray(msg)),
  bullet: (label: string, value: string) => console.log(`  ${chalk.cyan('•')} ${label}: ${chalk.white(value)}`),
  agent: (agent: string) => {
    const colors: Record<string, string> = {
      opencode: chalk.hex('#FF6B6B')(agent),
      copilot: chalk.hex('#6BCB77')(agent),
      codex: chalk.hex('#4D96FF')(agent),
      claude: chalk.hex('#D4A373')(agent),
      cursor: chalk.hex('#9B59B6')(agent),
      windsurf: chalk.hex('#1ABC9C')(agent),
    };
    return colors[agent] || chalk.white(agent);
  },
  tag: (tag: string) => chalk.bgGray(chalk.white(` ${tag} `)),
  grade: (grade: string) => {
    const colors: Record<string, string> = {
      A: chalk.bgGreen(chalk.black(` ${grade} `)),
      B: chalk.bgYellow(chalk.black(` ${grade} `)),
      C: chalk.bgRed(chalk.white(` ${grade} `)),
      F: chalk.bgRedBright(chalk.white(` ${grade} `)),
    };
    return colors[grade] || chalk.gray(grade);
  },
  version: (v: string) => chalk.cyan(`v${v}`),
};

let currentSpinner: Ora | null = null;

export function startSpinner(text: string): Ora {
  if (currentSpinner) currentSpinner.stop();
  currentSpinner = ora({ text, color: 'cyan' }).start();
  return currentSpinner;
}

export function stopSpinner(success = true, text?: string): void {
  if (currentSpinner) {
    if (success) currentSpinner.succeed(text);
    else currentSpinner.fail(text);
    currentSpinner = null;
  }
}

export function updateSpinner(text: string): void {
  if (currentSpinner) currentSpinner.text = text;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir);
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

export async function readYaml<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return YAML.parse(content) as T;
  } catch {
    return null;
  }
}

export function parseFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { metadata: {}, body: content };
  try {
    const metadata = YAML.parse(match[1]) as Record<string, unknown>;
    return { metadata, body: match[2] };
  } catch {
    return { metadata: {}, body: content };
  }
}

export function parseCommandFile(content: string): { metadata: CommandMetadata; body: string } {
  const { metadata, body } = parseFrontmatter(content);
  return {
    metadata: {
      name: (metadata.name as string) || '',
      version: (metadata.version as string) || '1.0.0',
      description: (metadata.description as string) || '',
      roles: (metadata.roles as string[]) || ['all'],
      agents: (metadata.agents as string[]) || ['opencode'],
      tags: (metadata.tags as string[]) || [],
      dependencies: (metadata.dependencies as string[]) || [],
      category: (metadata.category as string) || 'general',
      author: (metadata.author as string) || '',
      last_updated: (metadata.last_updated as string) || new Date().toISOString().split('T')[0],
      ...metadata,
    } as CommandMetadata,
    body,
  };
}

export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', filepath.slice(2));
  }
  return filepath;
}

export function getHubCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.cache', 'ai-hub');
}

export function getConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.config', 'ai-hub');
}

export function getLockFilePath(): string {
  return path.join(getConfigDir(), 'lock.json');
}

export function getCatalogCachePath(): string {
  return path.join(getHubCacheDir(), 'catalog.json');
}

const DANGEROUS_PATTERNS = [
  /eval\s*\(/i,
  /exec\s*\(/i,
  /child_process/i,
  /spawn\s*\(/i,
  /rm\s+-rf/i,
  />\s*\/dev\/null/i,
  /curl\s+.*\|\s*sh/i,
  /wget\s+.*\|\s*sh/i,
  /API_KEY\s*[:=]\s*["']\w+/i,
  /TOKEN\s*[:=]\s*["']\w+/i,
  /SECRET\s*[:=]\s*["']\w+/i,
];

export function scanSecurity(content: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }
  return { safe: issues.length === 0, issues };
}

export async function confirm(message: string, defaultYes = false): Promise<boolean> {
  if (process.env.AI_HUB_YES === '1') return true;

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const suffix = defaultYes ? ' [Y/n]' : ' [y/N]';
    rl.question(chalk.yellow(`${message}${suffix} `), (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') resolve(defaultYes);
      else resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) => {
    const maxContent = Math.max(...rows.map((r) => (r[i] || '').length));
    return Math.max(h.length, maxContent, 10);
  });

  const sep = '  ';
  const line = widths.map((w) => '─'.repeat(w)).join('─┬─');

  console.log('┌─' + line + '─┐');
  console.log('│ ' + headers.map((h, i) => h.padEnd(widths[i])).join(sep) + ' │');
  console.log('├─' + line + '─┤');
  for (const row of rows) {
    console.log('│ ' + row.map((cell, i) => (cell || '').padEnd(widths[i])).join(sep) + ' │');
  }
  console.log('└─' + line + '─┘');
}

export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = content.split('\n');
  let current: ChangelogEntry | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+\[(\d+\.\d+\.\d+)\]\s+-\s+(\d{4}-\d{2}-\d{2})/);
    if (versionMatch) {
      if (current) entries.push(current);
      current = { version: versionMatch[1], date: versionMatch[2], changes: [] };
    } else if (current && line.trim().startsWith('- ')) {
      current.changes.push(line.trim().slice(2));
    }
  }
  if (current) entries.push(current);
  return entries;
}

export function formatTags(tags: string[], limit = 3): string {
  return tags.slice(0, limit).map((t) => c.tag(t)).join(' ');
}

export async function writeContentLock(
  installDir: string,
  lock: {
    name: string;
    type: 'skill' | 'command' | 'mcp';
    version: string;
    source_url: string;
    agents: string[];
    dependencies?: string[];
    tags?: string[];
    post_install_script?: unknown;
  }
): Promise<void> {
  const lockFileName = lock.type === 'skill' ? '.skill-lock.json' : `.${lock.type}-lock.json`;
  const lockPath = path.join(installDir, lockFileName);

  const content = {
    schema_version: '1.0',
    name: lock.name,
    type: lock.type,
    version: lock.version,
    installed_at: new Date().toISOString(),
    source: {
      url: lock.source_url,
    },
    installed_by: 'ai-hub',
    installer_version: '1.0.0',
    agents: lock.agents,
    ...(lock.dependencies && lock.dependencies.length > 0 ? { dependencies: lock.dependencies } : {}),
    ...(lock.tags && lock.tags.length > 0 ? { tags: lock.tags } : {}),
    ...(lock.post_install_script ? { post_install_script: lock.post_install_script } : {}),
  };

  await fs.writeFile(lockPath, JSON.stringify(content, null, 2));
}

export async function readContentLock(
  installDir: string,
  type: 'skill' | 'command' | 'mcp'
): Promise<Record<string, unknown> | null> {
  const lockFileName = type === 'skill' ? '.skill-lock.json' : `.${type}-lock.json`;
  const lockPath = path.join(installDir, lockFileName);
  return readJson<Record<string, unknown>>(lockPath);
}

export async function removeContentLock(
  installDir: string,
  type: 'skill' | 'command' | 'mcp'
): Promise<void> {
  const lockFileName = type === 'skill' ? '.skill-lock.json' : `.${type}-lock.json`;
  const lockPath = path.join(installDir, lockFileName);
  if (await fs.pathExists(lockPath)) {
    await fs.remove(lockPath);
  }
}
