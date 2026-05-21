import fetch from 'node-fetch';
import {
  HubConfig,
  SkillMetadata,
  CommandMetadata,
  McpServerConfig,
  RemoteSkill,
  RemoteCommand,
  RemoteMcp,
  HubCatalog,
} from './types';

function getRawBaseUrl(config: HubConfig): string {
  const host = config.github_host || 'github.com';
  return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}`;
}

function getApiBaseUrl(config: HubConfig): string {
  const host = config.github_host || 'github.com';
  if (host === 'github.com') {
    return `https://api.github.com/repos/${config.owner}/${config.repo}`;
  }
  return `https://${host}/api/v3/repos/${config.owner}/${config.repo}`;
}

async function fetchText(url: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) headers.Authorization = `token ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, token?: string): Promise<T | null> {
  const text = await fetchText(url, token);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function fetchCatalog(config: HubConfig, token?: string): Promise<HubCatalog | null> {
  const apiUrl = `${getApiBaseUrl(config)}/git/trees/${config.branch}?recursive=1`;
  const treeData = await fetchJson<{ tree: Array<{ path: string; type: string }> }>(apiUrl, token);

  if (!treeData || !treeData.tree) return null;

  const skills: RemoteSkill[] = [];
  const commands: RemoteCommand[] = [];
  const mcps: RemoteMcp[] = [];

  const rawBase = getRawBaseUrl(config);
  const skillDirs = new Set<string>();
  const commandDirs = new Set<string>();
  const mcpFiles: string[] = [];

  for (const item of treeData.tree) {
    if (item.type !== 'blob') continue;

    const skillMatch = item.path.match(new RegExp(`^${config.skills_path}/([^/]+)/metadata.json$`));
    if (skillMatch) {
      skillDirs.add(skillMatch[1]);
    }

    const commandMatch = item.path.match(new RegExp(`^${config.commands_path}/([^/]+)/metadata.json$`));
    if (commandMatch) {
      commandDirs.add(commandMatch[1]);
    }

    if (item.path.startsWith(`${config.mcp_path}/`) && item.path.endsWith('.json')) {
      mcpFiles.push(item.path);
    }
  }

  for (const skillName of skillDirs) {
    const metaUrl = `${rawBase}/${config.skills_path}/${skillName}/metadata.json`;
    const metadata = await fetchJson<SkillMetadata>(metaUrl, token);
    if (metadata) {
      skills.push({
        name: skillName,
        metadata,
        raw_base_url: `${rawBase}/${config.skills_path}/${skillName}`,
      });
    }
  }

  for (const cmdName of commandDirs) {
    const metaUrl = `${rawBase}/${config.commands_path}/${cmdName}/metadata.json`;
    const metadata = await fetchJson<CommandMetadata>(metaUrl, token);
    if (metadata) {
      commands.push({
        name: cmdName,
        metadata,
        raw_base_url: `${rawBase}/${config.commands_path}/${cmdName}`,
      });
    }
  }

  for (const mcpPath of mcpFiles) {
    const rawUrl = `${rawBase}/${mcpPath}`;
    const mcpConfig = await fetchJson<McpServerConfig>(rawUrl, token);
    if (mcpConfig) {
      mcps.push({ name: mcpConfig.name, config: mcpConfig, raw_url: rawUrl });
    }
  }

  return { skills, commands, mcps };
}

export async function fetchSkillContent(skill: RemoteSkill, filename: string, token?: string): Promise<string | null> {
  const url = `${skill.raw_base_url}/${filename}`;
  return fetchText(url, token);
}

export async function fetchCommandContent(cmd: RemoteCommand, filename: string, token?: string): Promise<string | null> {
  const url = `${cmd.raw_base_url}/${filename}`;
  return fetchText(url, token);
}

export async function fetchChangelog(skill: RemoteSkill, token?: string): Promise<string | null> {
  const changelogFile = skill.metadata.changelog_file || 'CHANGELOG.md';
  return fetchSkillContent(skill, changelogFile, token);
}
