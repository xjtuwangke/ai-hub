import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentPaths, AgentAdapter } from '../types';
import { ensureDir, readJson, writeJson, c, getSkillsDir } from '../utils';

export const adapter: AgentAdapter = {
  async installSkill(skillName: string, skillDir: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    const targetDir = path.join(getSkillsDir(), skillName);
    await ensureDir(path.dirname(targetDir));
    await fs.copy(skillDir, targetDir, { overwrite: true });
    c.sub(`[Codex] skill installed: ${skillName}`);
  },

  async uninstallSkill(skillName: string, _paths: AgentPaths): Promise<void> {
    const skillPath = path.join(getSkillsDir(), skillName);
    if (await fs.pathExists(skillPath)) {
      await fs.remove(skillPath);
      c.sub(`[Codex] skill removed: ${skillName}`);
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

    const skillsDir = getSkillsDir();
    if (await fs.pathExists(skillsDir)) {
      const dirs = await fs.readdir(skillsDir);
      skills.push(...dirs.filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory()));
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
