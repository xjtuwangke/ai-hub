import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
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

const FETCH_TIMEOUT_MS = 30000;
const FETCH_RETRIES = 2;
const MAX_CONCURRENCY = 5;

export async function asyncPool<T, R>(concurrency: number, items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function getProxyAgent(url: string, proxyUrl?: string): import('node-fetch').RequestInit['agent'] | undefined {
  if (!proxyUrl) return undefined;

  if (url.startsWith('https:')) {
    return new HttpsProxyAgent(proxyUrl) as unknown as import('node-fetch').RequestInit['agent'];
  }
  if (url.startsWith('http:')) {
    return new HttpProxyAgent(proxyUrl) as unknown as import('node-fetch').RequestInit['agent'];
  }
  return undefined;
}

async function fetchWithTimeout(
  url: string,
  options: Record<string, unknown> = {},
  token?: string,
  proxyUrl?: string
): Promise<import('node-fetch').Response | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) headers.Authorization = `token ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const agent = getProxyAgent(url, proxyUrl);
    const fetchOptions: import('node-fetch').RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    };
    if (agent) {
      (fetchOptions as Record<string, unknown>).agent = agent;
    }
    const res = await fetch(url, fetchOptions);
    return res;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error(`Request timeout: ${url}`);
    } else {
      console.error(`Request failed: ${url} - ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: string, token?: string, proxyUrl?: string): Promise<string | null> {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const res = await fetchWithTimeout(url, {}, token, proxyUrl);
    if (res) {
      if (!res.ok) return null;
      return await res.text();
    }
    if (attempt < FETCH_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function fetchJson<T>(url: string, token?: string, proxyUrl?: string): Promise<T | null> {
  const text = await fetchText(url, token, proxyUrl);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(`JSON parse failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

export async function fetchCatalog(config: HubConfig, token?: string): Promise<HubCatalog | null> {
  const apiUrl = `${getApiBaseUrl(config)}/git/trees/${config.branch}?recursive=1`;
  const treeData = await fetchJson<{ tree: Array<{ path: string; type: string }> }>(apiUrl, token, config.proxy);

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

  const skillResults = await asyncPool(
    MAX_CONCURRENCY,
    [...skillDirs],
    async (skillName) => {
      const metaUrl = `${rawBase}/${config.skills_path}/${skillName}/metadata.json`;
      const metadata = await fetchJson<SkillMetadata>(metaUrl, token, config.proxy);
      return metadata
        ? { name: skillName, metadata, raw_base_url: `${rawBase}/${config.skills_path}/${skillName}` }
        : null;
    }
  );
  skills.push(...skillResults.filter((s): s is NonNullable<typeof s> => s !== null));

  const commandResults = await asyncPool(
    MAX_CONCURRENCY,
    [...commandDirs],
    async (cmdName) => {
      const metaUrl = `${rawBase}/${config.commands_path}/${cmdName}/metadata.json`;
      const metadata = await fetchJson<CommandMetadata>(metaUrl, token, config.proxy);
      return metadata
        ? { name: cmdName, metadata, raw_base_url: `${rawBase}/${config.commands_path}/${cmdName}` }
        : null;
    }
  );
  commands.push(...commandResults.filter((c): c is NonNullable<typeof c> => c !== null));

  const mcpResults = await asyncPool(
    MAX_CONCURRENCY,
    mcpFiles,
    async (mcpPath) => {
      const rawUrl = `${rawBase}/${mcpPath}`;
      const mcpConfig = await fetchJson<McpServerConfig>(rawUrl, token, config.proxy);
      return mcpConfig ? { name: mcpConfig.name, config: mcpConfig, raw_url: rawUrl } : null;
    }
  );
  mcps.push(...mcpResults.filter((m): m is NonNullable<typeof m> => m !== null));

  return { skills, commands, mcps };
}

export async function fetchSkillContent(skill: RemoteSkill, filename: string, token?: string, proxyUrl?: string): Promise<string | null> {
  const url = `${skill.raw_base_url}/${filename}`;
  return fetchText(url, token, proxyUrl);
}

export async function fetchCommandContent(cmd: RemoteCommand, filename: string, token?: string, proxyUrl?: string): Promise<string | null> {
  const url = `${cmd.raw_base_url}/${filename}`;
  return fetchText(url, token, proxyUrl);
}

export async function fetchChangelog(skill: RemoteSkill, token?: string, proxyUrl?: string): Promise<string | null> {
  const changelogFile = skill.metadata.changelog_file || 'CHANGELOG.md';
  return fetchSkillContent(skill, changelogFile, token, proxyUrl);
}
