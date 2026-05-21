export type UserRole = 'dev' | 'ba' | 'qa' | 'devops' | 'all';

export type AgentType = 'opencode' | 'copilot' | 'codex' | 'claude' | 'cursor' | 'windsurf';

export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  tags: string[];
  roles: UserRole[];
  agents: AgentType[];
  author?: string;
  dependencies?: string[];
  requires_mcp?: string[];
  security_grade?: 'A' | 'B' | 'C' | 'F';
  last_updated: string;
  changelog_file?: string;
}

export interface CommandMetadata {
  name: string;
  version: string;
  description: string;
  roles: UserRole[];
  agents: AgentType[];
  tags: string[];
  dependencies?: string[];
  category?: string;
  author?: string;
  last_updated: string;
  changelog_file?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface McpServerConfig {
  name: string;
  description: string;
  version: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  roles: UserRole[];
  agents: AgentType[];
  tags: string[];
  env_required?: string[];
  security_approved: boolean;
}

export interface HubConfig {
  owner: string;
  repo: string;
  branch: string;
  skills_path: string;
  commands_path: string;
  mcp_path: string;
  github_host: string;
}

export interface InstallRecord {
  name: string;
  type: 'skill' | 'command' | 'mcp';
  version: string;
  installed_at: string;
  agents: AgentType[];
  source_path: string;
}

export interface LockFile {
  version: string;
  installed_at: string;
  user_role: UserRole;
  items: InstallRecord[];
}

export interface AgentPaths {
  skills: string[];
  commands: string[];
  mcp: string[];
  config_file?: string[];
}

export interface AgentAdapter {
  installSkill(skillName: string, skillDir: string, paths: AgentPaths, isGlobal: boolean): Promise<void>;
  uninstallSkill(skillName: string, paths: AgentPaths): Promise<void>;
  installCommand(commandName: string, content: string, paths: AgentPaths, isGlobal: boolean): Promise<void>;
  uninstallCommand(commandName: string, paths: AgentPaths): Promise<void>;
  installMcp(mcpName: string, config: unknown, paths: AgentPaths): Promise<void>;
  uninstallMcp(mcpName: string, paths: AgentPaths): Promise<void>;
  listInstalled(paths: AgentPaths): Promise<{ skills: string[]; commands: string[]; mcps: string[] }>;
}

export interface CliOptions {
  role?: UserRole;
  agents?: AgentType[];
  global?: boolean;
  yes?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  github_host?: string;
  skills?: string[];
  commands?: string[];
  mcps?: string[];
}

export interface DetectedAgent {
  type: AgentType;
  version?: string;
  paths: AgentPaths;
  is_installed: boolean;
}

export interface UserContext {
  role: UserRole;
  agents: DetectedAgent[];
  hub_config: HubConfig;
  home_dir: string;
  cwd: string;
}

export interface RemoteSkill {
  name: string;
  metadata: SkillMetadata;
  raw_base_url: string;
}

export interface RemoteCommand {
  name: string;
  metadata: CommandMetadata;
  raw_base_url: string;
}

export interface RemoteMcp {
  name: string;
  config: McpServerConfig;
  raw_url: string;
}

export interface HubCatalog {
  skills: RemoteSkill[];
  commands: RemoteCommand[];
  mcps: RemoteMcp[];
}

export interface FilterOptions {
  role?: UserRole;
  agents?: AgentType[];
  tags?: string[];
  search?: string;
}
