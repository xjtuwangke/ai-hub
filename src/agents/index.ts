import { AgentType, AgentPaths, DetectedAgent, AgentAdapter } from '../types';

import * as opencode from './opencode';
import * as copilot from './copilot';
import * as codex from './codex';
import * as claude from './claude';

const adapters: Record<AgentType, AgentAdapter> = {
  opencode: opencode.adapter,
  copilot: copilot.adapter,
  codex: codex.adapter,
  claude: claude.adapter,
  cursor: opencode.adapter,
  windsurf: opencode.adapter,
};

export function getAdapter(agentType: AgentType): AgentAdapter {
  return adapters[agentType];
}

export function getAgentInstallPath(
  agent: DetectedAgent,
  type: 'skills' | 'commands' | 'mcp',
  isGlobal: boolean
): string {
  const paths = agent.paths[type];
  if (!paths || paths.length === 0) {
    throw new Error(`${agent.type} has no configured ${type} paths`);
  }

  if (isGlobal) {
    const globalPath = paths.find((p) => p.includes('~/.config') || p.includes('~/.claude') || p.includes('~/.codex'));
    if (globalPath) return globalPath;
  }

  const projectPath = paths.find((p) => !p.includes('~'));
  if (projectPath) return projectPath;

  return paths[0];
}
