import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentPaths, AgentAdapter } from '../types';
import { ensureDir, readJson, writeJson, c } from '../utils';

export const adapter: AgentAdapter = {
  async installSkill(skillName: string, skillDir: string, paths: AgentPaths, isGlobal: boolean): Promise<void> {
    const targetDir = resolvePath(paths.skills, isGlobal, skillName);
    await ensureDir(path.dirname(targetDir));
    await fs.copy(skillDir, targetDir, { overwrite: true });
    c.sub(`[Codex] skill installed: ${skillName}`);
  },

  async uninstallSkill(skillName: string, paths: AgentPaths): Promise<void> {
    for (const basePath of paths.skills) {
      const skillPath = path.join(basePath, skillName);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
        c.sub(`[Codex] skill removed: ${skillName}`);
      }
    }
  },

  async installCommand(_commandName: string, _content: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    c.warning('[Codex] commands not supported');
  },

  async uninstallCommand(_commandName: string, _paths: AgentPaths): Promise<void> {
    c.warning('[Codex] commands not supported');
  },

  async installMcp(mcpName: string, config: unknown, paths: AgentPaths): Promise<void> {
    const configFile = paths.config_file?.[0] || '.codex/mcp.json';
    await ensureDir(path.dirname(configFile));
    const mcpConfig = (await readJson<Record<string, unknown>>(configFile)) || {};
    const mcpServers = (mcpConfig.mcpServers as Record<string, unknown>) || {};
    mcpServers[mcpName] = config;
    mcpConfig.mcpServers = mcpServers;
    await writeJson(configFile, mcpConfig);
    c.sub(`[Codex] mcp configured: ${mcpName}`);
  },

  async uninstallMcp(mcpName: string, paths: AgentPaths): Promise<void> {
    for (const configPath of paths.config_file || []) {
      const mcpConfig = await readJson<Record<string, unknown>>(configPath);
      if (mcpConfig && mcpConfig.mcpServers) {
        const servers = mcpConfig.mcpServers as Record<string, unknown>;
        delete servers[mcpName];
        await writeJson(configPath, mcpConfig);
        c.sub(`[Codex] mcp removed: ${mcpName}`);
        break;
      }
    }
  },

  async listInstalled(paths: AgentPaths): Promise<{ skills: string[]; commands: string[]; mcps: string[] }> {
    const skills: string[] = [];
    const mcps: string[] = [];

    for (const skillPath of paths.skills) {
      if (await fs.pathExists(skillPath)) {
        const dirs = await fs.readdir(skillPath);
        skills.push(...dirs.filter((d) => fs.statSync(path.join(skillPath, d)).isDirectory()));
      }
    }

    for (const configPath of paths.config_file || []) {
      if (await fs.pathExists(configPath)) {
        const config = await readJson<Record<string, unknown>>(configPath);
        if (config && config.mcpServers) {
          mcps.push(...Object.keys(config.mcpServers as Record<string, unknown>));
        }
      }
    }

    return { skills: [...new Set(skills)], commands: [], mcps: [...new Set(mcps)] };
  },
};

function resolvePath(paths: string[], isGlobal: boolean, subPath?: string): string {
  let base: string;
  if (isGlobal) {
    base = paths.find((p) => p.includes('~/.codex') || p.includes('~/.config')) || paths[0];
  } else {
    base = paths.find((p) => !p.includes('~')) || paths[0];
  }
  return subPath ? path.join(base, subPath) : base;
}
