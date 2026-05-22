import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentPaths, AgentAdapter } from '../types';
import { ensureDir, readJson, writeJson, c, getSkillsDir, getCommandsDir } from '../utils';

export const adapter: AgentAdapter = {
  async installSkill(skillName: string, skillDir: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    const targetDir = path.join(getSkillsDir(), skillName);
    await ensureDir(path.dirname(targetDir));
    await fs.copy(skillDir, targetDir, { overwrite: true });
    c.sub(`[Claude] skill installed: ${skillName}`);
  },

  async uninstallSkill(skillName: string, _paths: AgentPaths): Promise<void> {
    const skillPath = path.join(getSkillsDir(), skillName);
    if (await fs.pathExists(skillPath)) {
      await fs.remove(skillPath);
      c.sub(`[Claude] skill removed: ${skillName}`);
    }
  },

  async installCommand(commandName: string, content: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    const targetDir = getCommandsDir();
    await ensureDir(targetDir);
    const targetFile = path.join(targetDir, `${commandName.replace(/^\//, '')}.md`);
    await fs.writeFile(targetFile, content);
    c.sub(`[Claude] command installed: ${commandName}`);
  },

  async uninstallCommand(commandName: string, _paths: AgentPaths): Promise<void> {
    const cmdPath = path.join(getCommandsDir(), `${commandName.replace(/^\//, '')}.md`);
    if (await fs.pathExists(cmdPath)) {
      await fs.remove(cmdPath);
      c.sub(`[Claude] command removed: ${commandName}`);
    }
  },

  async installMcp(mcpName: string, config: unknown, paths: AgentPaths): Promise<void> {
    const configFile = paths.config_file?.[0] || '.mcp.json';
    await ensureDir(path.dirname(configFile));
    const mcpConfig = (await readJson<Record<string, unknown>>(configFile)) || {};
    const mcpServers = (mcpConfig.mcpServers as Record<string, unknown>) || {};
    mcpServers[mcpName] = config;
    mcpConfig.mcpServers = mcpServers;
    await writeJson(configFile, mcpConfig);
    c.sub(`[Claude] mcp configured: ${mcpName}`);
  },

  async uninstallMcp(mcpName: string, paths: AgentPaths): Promise<void> {
    for (const configPath of paths.config_file || []) {
      const mcpConfig = await readJson<Record<string, unknown>>(configPath);
      if (mcpConfig && mcpConfig.mcpServers) {
        const servers = mcpConfig.mcpServers as Record<string, unknown>;
        delete servers[mcpName];
        await writeJson(configPath, mcpConfig);
        c.sub(`[Claude] mcp removed: ${mcpName}`);
        break;
      }
    }
  },

  async listInstalled(_paths: AgentPaths): Promise<{ skills: string[]; commands: string[]; mcps: string[] }> {
    const skills: string[] = [];
    const commands: string[] = [];
    const mcps: string[] = [];

    const skillsDir = getSkillsDir();
    if (await fs.pathExists(skillsDir)) {
      const dirs = await fs.readdir(skillsDir);
      skills.push(...dirs.filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory()));
    }

    const commandsDir = getCommandsDir();
    if (await fs.pathExists(commandsDir)) {
      const files = await fs.readdir(commandsDir);
      commands.push(...files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')));
    }

    for (const configPath of _paths.config_file || []) {
      if (await fs.pathExists(configPath)) {
        const config = await readJson<Record<string, unknown>>(configPath);
        if (config && config.mcpServers) {
          mcps.push(...Object.keys(config.mcpServers as Record<string, unknown>));
        }
      }
    }

    return { skills: [...new Set(skills)], commands: [...new Set(commands)], mcps: [...new Set(mcps)] };
  },
};
