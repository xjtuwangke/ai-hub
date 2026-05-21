import * as fs from 'fs-extra';
import * as path from 'path';
import {
  UserContext,
  CliOptions,
  RemoteSkill,
  RemoteCommand,
  RemoteMcp,
  InstallRecord,
  LockFile,
  AgentType,
  HubCatalog,
} from './types';
import {
  startSpinner,
  stopSpinner,
  updateSpinner,
  ensureDir,
  writeJson,
  readJson,
  scanSecurity,
  getLockFilePath,
  getHubCacheDir,
  getConfigDir,
  c,
} from './utils';
import { getAdapter } from './agents';
import { fetchCatalog, fetchSkillContent, fetchCommandContent } from './github-client';

export async function loadCatalog(ctx: UserContext, token?: string): Promise<HubCatalog | null> {
  const cachePath = path.join(getHubCacheDir(), 'catalog.json');

  startSpinner('Fetching catalog from remote...');
  const catalog = await fetchCatalog(ctx.hub_config, token);

  if (catalog) {
    await ensureDir(path.dirname(cachePath));
    await writeJson(cachePath, catalog);
    stopSpinner(true, `Catalog loaded: ${catalog.skills.length} skills, ${catalog.commands.length} commands, ${catalog.mcps.length} mcps`);
  } else {
    stopSpinner(false, 'Failed to fetch catalog, trying cache...');
    const cached = await readJson<HubCatalog>(cachePath);
    if (cached) {
      c.info('Using cached catalog');
      return cached;
    }
  }

  return catalog;
}

function matchesAgents(item: { agents: string[] }, ctx: UserContext): boolean {
  const userAgents = ctx.agents.map((a) => a.type);
  return item.agents.some((a) => userAgents.includes(a as AgentType));
}

function matchesTags(item: { tags: string[]; roles?: string[] }, tags?: string[]): boolean {
  if (!tags || tags.length === 0) return true;
  const allTags = [...item.tags, ...(item.roles || [])];
  return tags.some((t) => allTags.includes(t));
}

function matchesSearch(item: { name: string; description: string; tags: string[]; roles?: string[] }, search?: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return (
    item.name.toLowerCase().includes(lower) ||
    item.description.toLowerCase().includes(lower) ||
    item.tags.some((t) => t.toLowerCase().includes(lower)) ||
    (item.roles || []).some((r) => r.toLowerCase().includes(lower))
  );
}

export function filterSkills(
  items: RemoteSkill[],
  ctx: UserContext,
  options?: { tags?: string[]; search?: string }
): RemoteSkill[] {
  return items.filter((item) => {
    const m = item.metadata;
    return (
      matchesAgents(m, ctx) &&
      matchesTags(m, options?.tags) &&
      matchesSearch(m, options?.search)
    );
  });
}

export function filterCommands(
  items: RemoteCommand[],
  ctx: UserContext,
  options?: { tags?: string[]; search?: string }
): RemoteCommand[] {
  return items.filter((item) => {
    const m = item.metadata;
    return (
      matchesAgents(m, ctx) &&
      matchesTags(m, options?.tags) &&
      matchesSearch(m, options?.search)
    );
  });
}

export function filterMcps(
  items: RemoteMcp[],
  ctx: UserContext,
  options?: { tags?: string[]; search?: string }
): RemoteMcp[] {
  return items.filter((item) => {
    const c = item.config;
    return (
      matchesAgents(c, ctx) &&
      matchesTags(c, options?.tags) &&
      matchesSearch(c, options?.search)
    );
  });
}

export async function installItem(
  ctx: UserContext,
  item: RemoteSkill | RemoteCommand | RemoteMcp,
  type: 'skill' | 'command' | 'mcp',
  options: CliOptions,
  token?: string
): Promise<InstallRecord | null> {
  const spinner = startSpinner(`Installing ${type}: ${(item as any).metadata?.name || (item as any).name}`);

  if (options.dryRun) {
    updateSpinner(`[dry-run] would install ${type}: ${(item as any).metadata?.name || (item as any).name}`);
    stopSpinner(true);
    return null;
  }

  if (type === 'skill') {
    return await installSkillItem(ctx, item as RemoteSkill, options, token, spinner);
  } else if (type === 'command') {
    return await installCommandItem(ctx, item as RemoteCommand, options, token, spinner);
  } else {
    return await installMcpItem(ctx, item as RemoteMcp, options, spinner);
  }
}

async function installSkillItem(
  ctx: UserContext,
  skill: RemoteSkill,
  options: CliOptions,
  token: string | undefined,
  spinner: ReturnType<typeof startSpinner>
): Promise<InstallRecord | null> {
  const skillMd = await fetchSkillContent(skill, 'SKILL.md', token);
  if (!skillMd) {
    stopSpinner(false, `Failed to fetch SKILL.md for ${skill.name}`);
    return null;
  }

  const security = scanSecurity(skillMd);
  if (!security.safe) {
    stopSpinner(false, `Security scan failed for ${skill.name}`);
    security.issues.forEach((issue) => c.error(`  - ${issue}`));
    return null;
  }

  const cacheDir = getHubCacheDir();
  const downloadDir = path.join(cacheDir, 'downloads', skill.name);
  await ensureDir(downloadDir);

  await fs.writeFile(path.join(downloadDir, 'SKILL.md'), skillMd);
  await fs.writeFile(path.join(downloadDir, 'metadata.json'), JSON.stringify(skill.metadata, null, 2));

  for (const agent of ctx.agents) {
    if (!skill.metadata.agents.includes(agent.type)) continue;
    try {
      const adapter = getAdapter(agent.type);
      const isGlobal = options.global ?? true;
      await adapter.installSkill(skill.name, downloadDir, agent.paths, isGlobal);
    } catch (error) {
      c.error(`  Failed to install to ${agent.type}: ${error}`);
    }
  }

  stopSpinner(true, `Skill installed: ${skill.name}`);
  return {
    name: skill.name,
    type: 'skill',
    version: skill.metadata.version,
    installed_at: new Date().toISOString(),
    agents: ctx.agents.filter((a) => skill.metadata.agents.includes(a.type)).map((a) => a.type),
    source_path: skill.raw_base_url,
  };
}

async function installCommandItem(
  ctx: UserContext,
  cmd: RemoteCommand,
  options: CliOptions,
  token: string | undefined,
  spinner: ReturnType<typeof startSpinner>
): Promise<InstallRecord | null> {
  const commandMd = await fetchCommandContent(cmd, 'COMMAND.md', token);
  if (!commandMd) {
    stopSpinner(false, `Failed to fetch COMMAND.md for ${cmd.name}`);
    return null;
  }

  const security = scanSecurity(commandMd);
  if (!security.safe) {
    stopSpinner(false, `Security scan failed for command ${cmd.name}`);
    security.issues.forEach((issue) => c.error(`  - ${issue}`));
    return null;
  }

  for (const agent of ctx.agents) {
    if (!cmd.metadata.agents.includes(agent.type)) continue;
    try {
      const adapter = getAdapter(agent.type);
      const isGlobal = options.global ?? true;
      await adapter.installCommand(cmd.metadata.name, commandMd, agent.paths, isGlobal);
    } catch (error) {
      c.error(`  Failed to install to ${agent.type}: ${error}`);
    }
  }

  stopSpinner(true, `Command installed: ${cmd.name}`);
  return {
    name: cmd.name,
    type: 'command',
    version: cmd.metadata.version,
    installed_at: new Date().toISOString(),
    agents: ctx.agents.filter((a) => cmd.metadata.agents.includes(a.type)).map((a) => a.type),
    source_path: cmd.raw_base_url,
  };
}

async function installMcpItem(
  ctx: UserContext,
  mcp: RemoteMcp,
  options: CliOptions,
  spinner: ReturnType<typeof startSpinner>
): Promise<InstallRecord | null> {
  if (!mcp.config.security_approved) {
    stopSpinner(false, `MCP ${mcp.name} not security approved`);
    return null;
  }

  const payload = mcp.config.url
    ? { url: mcp.config.url, ...(mcp.config.env ? { env: mcp.config.env } : {}) }
    : { command: mcp.config.command, args: mcp.config.args || [], ...(mcp.config.env ? { env: mcp.config.env } : {}) };

  for (const agent of ctx.agents) {
    if (!mcp.config.agents.includes(agent.type)) continue;
    try {
      const adapter = getAdapter(agent.type);
      await adapter.installMcp(mcp.name, payload, agent.paths);
    } catch (error) {
      c.error(`  Failed to configure ${agent.type}: ${error}`);
    }
  }

  stopSpinner(true, `MCP configured: ${mcp.name}`);
  return {
    name: mcp.name,
    type: 'mcp',
    version: mcp.config.version,
    installed_at: new Date().toISOString(),
    agents: ctx.agents.filter((a) => mcp.config.agents.includes(a.type)).map((a) => a.type),
    source_path: mcp.raw_url,
  };
}

export async function saveLockFile(role: string, records: InstallRecord[]): Promise<void> {
  const lock: LockFile = {
    version: '1.0',
    installed_at: new Date().toISOString(),
    user_role: role as UserContext['role'],
    items: records,
  };

  const lockPath = getLockFilePath();
  await ensureDir(path.dirname(lockPath));
  await writeJson(lockPath, lock);
}

export async function loadLockFile(): Promise<LockFile | null> {
  return await readJson<LockFile>(getLockFilePath());
}

export async function uninstallByLock(ctx: UserContext, lockFile: LockFile, options: CliOptions): Promise<void> {
  for (const item of lockFile.items) {
    const spinner = startSpinner(`Uninstalling ${item.type}: ${item.name}`);

    if (options.dryRun) {
      updateSpinner(`[dry-run] would uninstall ${item.type}: ${item.name}`);
      stopSpinner(true);
      continue;
    }

    for (const agent of ctx.agents) {
      if (!item.agents.includes(agent.type)) continue;

      try {
        const adapter = getAdapter(agent.type);
        if (item.type === 'skill') {
          await adapter.uninstallSkill(item.name, agent.paths);
        } else if (item.type === 'command') {
          await adapter.uninstallCommand(item.name, agent.paths);
        } else if (item.type === 'mcp') {
          await adapter.uninstallMcp(item.name, agent.paths);
        }
      } catch (error) {
        c.error(`  Failed to uninstall from ${agent.type}: ${error}`);
      }
    }

    stopSpinner(true, `${item.type} uninstalled: ${item.name}`);
  }
}

export async function listInstalled(ctx: UserContext): Promise<void> {
  c.header('Installed Content');

  for (const agent of ctx.agents) {
    console.log(`\n${c.agent(agent.type)}:`);
    const adapter = getAdapter(agent.type);
    const installed = await adapter.listInstalled(agent.paths);

    if (installed.skills.length > 0) c.sub(`Skills: ${installed.skills.join(', ')}`);
    if (installed.commands.length > 0) c.sub(`Commands: ${installed.commands.join(', ')}`);
    if (installed.mcps.length > 0) c.sub(`MCPs: ${installed.mcps.join(', ')}`);
    if (installed.skills.length === 0 && installed.commands.length === 0 && installed.mcps.length === 0) {
      c.sub('(none)');
    }
  }
}

export async function viewItemContent(
  item: RemoteSkill | RemoteCommand | RemoteMcp,
  type: 'skill' | 'command' | 'mcp',
  token?: string
): Promise<string> {
  if (type === 'skill') {
    const content = await fetchSkillContent(item as RemoteSkill, 'SKILL.md', token);
    return content || 'Failed to fetch content';
  } else if (type === 'command') {
    const content = await fetchCommandContent(item as RemoteCommand, 'COMMAND.md', token);
    return content || 'Failed to fetch content';
  } else {
    return JSON.stringify((item as RemoteMcp).config, null, 2);
  }
}

export async function viewChangelog(skill: RemoteSkill, token?: string): Promise<string | null> {
  const { fetchChangelog } = require('./github-client');
  return await fetchChangelog(skill, token);
}

export interface DependencyResolution {
  skillsToAdd: RemoteSkill[];
  warnings: string[];
}

export function resolveCommandDependencies(
  commands: RemoteCommand[],
  allCatalogSkills: RemoteSkill[],
  alreadySelectedSkills: RemoteSkill[],
  ctx: UserContext
): DependencyResolution {
  const selectedSkillNames = new Set(alreadySelectedSkills.map((s) => s.name));
  const skillsToAdd: RemoteSkill[] = [];
  const warnings: string[] = [];

  for (const cmd of commands) {
    if (!cmd.metadata.dependencies || cmd.metadata.dependencies.length === 0) continue;

    for (const depName of cmd.metadata.dependencies) {
      if (selectedSkillNames.has(depName)) continue;

      const skill = allCatalogSkills.find((s) => s.name === depName);
      if (!skill) {
        warnings.push(`Command "${cmd.metadata.name}" depends on skill "${depName}" which is not found in catalog`);
        continue;
      }

      if (!matchesAgents(skill.metadata, ctx)) {
        warnings.push(`Command "${cmd.metadata.name}" depends on skill "${depName}" which is not compatible with your agents`);
        continue;
      }

      skillsToAdd.push(skill);
      selectedSkillNames.add(depName);
    }
  }

  return { skillsToAdd, warnings };
}
