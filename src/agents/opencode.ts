import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentPaths, AgentAdapter } from '../types';
import { ensureDir, readJson, writeJson, c } from '../utils';

export const adapter: AgentAdapter = {
  async installSkill(skillName: string, skillDir: string, paths: AgentPaths, isGlobal: boolean): Promise<void> {
    const targetDir = resolvePath(paths.skills, isGlobal, skillName);
    await ensureDir(path.dirname(targetDir));
    await fs.copy(skillDir, targetDir, { overwrite: true });
    c.sub(`[OpenCode] skill installed: ${skillName}`);
  },

  async uninstallSkill(skillName: string, paths: AgentPaths): Promise<void> {
    for (const basePath of paths.skills) {
      const skillPath = path.join(basePath, skillName);
      if (await fs.pathExists(skillPath)) {
        await fs.remove(skillPath);
        c.sub(`[OpenCode] skill removed: ${skillName}`);
      }
    }
  },

  async installCommand(commandName: string, content: string, paths: AgentPaths, isGlobal: boolean): Promise<void> {
    const targetDir = resolvePath(paths.commands, isGlobal);
    await ensureDir(targetDir);
    const targetFile = path.join(targetDir, `${commandName.replace(/^\//, '')}.md`);
    await fs.writeFile(targetFile, content);
    c.sub(`[OpenCode] command installed: ${commandName}`);
  },

  async uninstallCommand(commandName: string, paths: AgentPaths): Promise<void> {
    for (const basePath of paths.commands) {
      const cmdPath = path.join(basePath, `${commandName.replace(/^\//, '')}.md`);
      if (await fs.pathExists(cmdPath)) {
        await fs.remove(cmdPath);
        c.sub(`[OpenCode] command removed: ${commandName}`);
      }
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

  async listInstalled(paths: AgentPaths): Promise<{ skills: string[]; commands: string[]; mcps: string[] }> {
    const skills: string[] = [];
    const commands: string[] = [];
    const mcps: string[] = [];

    for (const skillPath of paths.skills) {
      if (await fs.pathExists(skillPath)) {
        const dirs = await fs.readdir(skillPath);
        skills.push(...dirs.filter((d) => fs.statSync(path.join(skillPath, d)).isDirectory()));
      }
    }

    for (const cmdPath of paths.commands) {
      if (await fs.pathExists(cmdPath)) {
        const files = await fs.readdir(cmdPath);
        commands.push(...files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', '')));
      }
    }

    for (const configPath of paths.config_file || []) {
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

function resolvePath(paths: string[], isGlobal: boolean, subPath?: string): string {
  let base: string;
  if (isGlobal) {
    base = paths.find((p) => p.includes('~/.config') || p.includes('~/.claude') || p.includes('~/.codex')) || paths[0];
  } else {
    base = paths.find((p) => !p.includes('~')) || paths[0];
  }
  return subPath ? path.join(base, subPath) : base;
}
