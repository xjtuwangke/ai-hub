import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentPaths, AgentAdapter } from '../types';
import { readJson, writeJson, c, getSkillsDir, getCommandsDir, ensureDir } from '../utils';

export const adapter: AgentAdapter = {
  async installSkill(skillName: string, skillDir: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    const targetDir = path.join(getSkillsDir(), skillName);
    await ensureDir(path.dirname(targetDir));
    await fs.copy(skillDir, targetDir, { overwrite: true });
    c.sub(`[OpenCode] skill installed: ${skillName}`);
  },

  async uninstallSkill(skillName: string, _paths: AgentPaths): Promise<void> {
    const skillPath = path.join(getSkillsDir(), skillName);
    if (await fs.pathExists(skillPath)) {
      await fs.remove(skillPath);
      c.sub(`[OpenCode] skill removed: ${skillName}`);
    }
  },

  async installCommand(commandName: string, content: string, _paths: AgentPaths, _isGlobal: boolean): Promise<void> {
    const targetDir = getCommandsDir();
    await ensureDir(targetDir);
    const targetFile = path.join(targetDir, `${commandName.replace(/^\//, '')}.md`);
    await fs.writeFile(targetFile, content);
    c.sub(`[OpenCode] command installed: ${commandName}`);
  },

  async uninstallCommand(commandName: string, _paths: AgentPaths): Promise<void> {
    const cmdPath = path.join(getCommandsDir(), `${commandName.replace(/^\//, '')}.md`);
    if (await fs.pathExists(cmdPath)) {
      await fs.remove(cmdPath);
      c.sub(`[OpenCode] command removed: ${commandName}`);
    }
  },

  async installMcp(mcpName: string, config: unknown, paths: AgentPaths): Promise<void> {
    for (const configPath of paths.config_file || []) {
      if (configPath.endsWith('.json')) {
        const opencodeConfig = (await readJson<Record<string, unknown>>(configPath)) || {};
        const mcpServers = (opencodeConfig.mcp as Record<string, unknown>) || {};
        mcpServers[mcpName] = config;
        opencodeConfig.mcp = mcpServers;
        await writeJson(configPath, opencodeConfig);
        c.sub(`[OpenCode] mcp configured: ${mcpName}`);
        break;
      }
    }
  },

  async uninstallMcp(mcpName: string, paths: AgentPaths): Promise<void> {
    for (const configPath of paths.config_file || []) {
      if (configPath.endsWith('.json')) {
        const opencodeConfig = await readJson<Record<string, unknown>>(configPath);
        if (opencodeConfig && opencodeConfig.mcp) {
          const mcpServers = opencodeConfig.mcp as Record<string, unknown>;
          delete mcpServers[mcpName];
          await writeJson(configPath, opencodeConfig);
          c.sub(`[OpenCode] mcp removed: ${mcpName}`);
          break;
        }
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
      if (configPath.endsWith('.json') && (await fs.pathExists(configPath))) {
        const config = await readJson<Record<string, unknown>>(configPath);
        if (config && config.mcp) {
          mcps.push(...Object.keys(config.mcp as Record<string, unknown>));
        }
      }
    }

    return { skills: [...new Set(skills)], commands: [...new Set(commands)], mcps: [...new Set(mcps)] };
  },
};
