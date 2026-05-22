import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  AgentType,
  DetectedAgent,
  AgentPaths,
  HubConfig,
  UserContext,
  CliOptions,
} from './types';
import { expandHome, readJson, c } from './utils';
import chalk from 'chalk';

const AGENT_DEFINITIONS: Array<{
  type: AgentType;
  name: string;
  checkCommands: string[];
  paths: AgentPaths;
}> = [
  {
    type: 'opencode',
    name: 'OpenCode',
    checkCommands: ['opencode --version', 'which opencode'],
    paths: {
      skills: ['~/.config/opencode/skills', '.opencode/skills'],
      commands: ['~/.config/opencode/command', '.opencode/command'],
      mcp: ['~/.config/opencode', '.opencode'],
      config_file: ['~/.config/opencode/opencode.json', '.opencode/opencode.json'],
    },
  },
  {
    type: 'copilot',
    name: 'GitHub Copilot',
    checkCommands: ['gh copilot --version', 'which gh'],
    paths: {
      skills: ['~/.copilot/skills', '.github/skills'],
      commands: [],
      mcp: ['.github/copilot', '.vscode'],
      config_file: ['.github/copilot/mcp.json', '.vscode/mcp.json'],
    },
  },
  {
    type: 'codex',
    name: 'OpenAI Codex',
    checkCommands: ['codex --version', 'which codex'],
    paths: {
      skills: ['~/.codex/skills', '.codex/skills', '.agents/skills'],
      commands: [],
      mcp: ['~/.codex', '.codex'],
      config_file: ['~/.codex/config.json'],
    },
  },
  {
    type: 'claude',
    name: 'Claude Code',
    checkCommands: ['claude --version', 'which claude'],
    paths: {
      skills: ['~/.claude/skills', '.claude/skills'],
      commands: ['~/.claude/commands', '.claude/commands'],
      mcp: ['~/.claude', '.claude'],
      config_file: ['~/.claude/.mcp.json', '.mcp.json'],
    },
  },
  {
    type: 'cursor',
    name: 'Cursor',
    checkCommands: ['cursor --version', 'which cursor'],
    paths: {
      skills: ['~/.cursor/skills', '.cursor/skills'],
      commands: [],
      mcp: ['~/.cursor', '.cursor'],
      config_file: ['~/.cursor/mcp.json', '.cursor/mcp.json'],
    },
  },
];

export async function detectInstalledAgents(options: CliOptions): Promise<DetectedAgent[]> {
  const agents: DetectedAgent[] = [];
  const targetAgents = options.agents
    ? AGENT_DEFINITIONS.filter((a) => options.agents!.includes(a.type))
    : AGENT_DEFINITIONS;

  for (const def of targetAgents) {
    const detected = await detectSingleAgent(def);
    if (detected) agents.push(detected);
  }

  return agents;
}

async function detectSingleAgent(def: (typeof AGENT_DEFINITIONS)[0]): Promise<DetectedAgent | null> {
  let version: string | undefined;
  let isInstalled = false;

  for (const cmd of def.checkCommands) {
    try {
      const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      version = result.trim().split('\n')[0];
      isInstalled = true;
      break;
    } catch {
      continue;
    }
  }

  const expandedPaths: AgentPaths = {
    skills: def.paths.skills.map(expandHome).filter((p) => fs.existsSync(p)),
    commands: def.paths.commands.map(expandHome).filter((p) => fs.existsSync(p)),
    mcp: def.paths.mcp.map(expandHome).filter((p) => fs.existsSync(p)),
    config_file: def.paths.config_file?.map(expandHome).filter((p) => fs.existsSync(p)),
  };

  const hasAnyPath =
    expandedPaths.skills.length > 0 ||
    expandedPaths.commands.length > 0 ||
    expandedPaths.mcp.length > 0 ||
    (expandedPaths.config_file && expandedPaths.config_file.length > 0);

  if (!isInstalled && !hasAnyPath) return null;

  return {
    type: def.type,
    version,
    paths: {
      skills: expandedPaths.skills.length > 0 ? expandedPaths.skills : def.paths.skills.map(expandHome),
      commands: expandedPaths.commands.length > 0 ? expandedPaths.commands : def.paths.commands.map(expandHome),
      mcp: expandedPaths.mcp.length > 0 ? expandedPaths.mcp : def.paths.mcp.map(expandHome),
      config_file: def.paths.config_file?.map(expandHome),
    },
    is_installed: isInstalled,
  };
}

export function getDefaultHubConfig(): HubConfig {
  return {
    owner: process.env.AI_HUB_OWNER || 'xjtuwangke',
    repo: process.env.AI_HUB_REPO || 'ai-hub',
    branch: process.env.AI_HUB_BRANCH || 'main',
    skills_path: 'skills',
    commands_path: 'commands',
    mcp_path: 'mcp',
    github_host: process.env.GH_HOST || 'github.com',
  };
}

export async function loadHubConfig(): Promise<HubConfig> {
  const localConfig = await readJson<Partial<HubConfig>>('./ai-hub.json');
  if (localConfig) return { ...getDefaultHubConfig(), ...localConfig };

  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const globalConfig = await readJson<Partial<HubConfig>>(path.join(home, '.config', 'ai-hub', 'config.json'));
  if (globalConfig) return { ...getDefaultHubConfig(), ...globalConfig };

  return getDefaultHubConfig();
}

export async function buildUserContext(options: CliOptions): Promise<UserContext> {
  const [agents, hubConfig] = await Promise.all([
    detectInstalledAgents(options),
    loadHubConfig(),
  ]);

  return {
    agents,
    hub_config: hubConfig,
    home_dir: process.env.HOME || process.env.USERPROFILE || '.',
    cwd: process.cwd(),
  };
}

export function printEnvironmentReport(ctx: UserContext): void {
  c.header('Environment Report');
  c.bullet('Working Directory', ctx.cwd);
  c.bullet('Hub Repository', `${ctx.hub_config.owner}/${ctx.hub_config.repo}@${ctx.hub_config.branch}`);

  if (ctx.agents.length === 0) {
    c.warning('No AI agents detected, will install to project directories only');
  } else {
    c.info(`Detected ${ctx.agents.length} agent(s):`);
    for (const agent of ctx.agents) {
      const status = agent.is_installed
        ? chalk.green(`installed ${agent.version ? `(${agent.version})` : ''}`)
        : chalk.yellow('config directory exists');
      console.log(`  ${c.agent(agent.type)} ${status}`);
    }
  }
}
