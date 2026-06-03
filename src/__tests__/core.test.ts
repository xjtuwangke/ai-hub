const { describe, it, expect } = require('@jest/globals');
import {
  isRemoteSkill,
  isRemoteCommand,
  isRemoteMcp,
  getItemName,
  getItemVersion,
  SkillMetadata,
  CommandMetadata,
  McpServerConfig,
  RemoteSkill,
  RemoteCommand,
  RemoteMcp,
} from '../types';
import { scanSecurity, parseChangelog, parseFrontmatter, expandHome, formatTags } from '../utils';
import { matchesAgents, matchesTags, matchesSearch, normalizeHooks } from '../installer';
import { asyncPool } from '../github-client';

describe('types', () => {
  const skill: RemoteSkill = {
    name: 'api-testing',
    metadata: {
      name: 'api-testing',
      version: '1.0.0',
      description: 'Test API',
      tags: ['qa'],
      agents: ['opencode'],
      roles: ['qa'],
      last_updated: '2026-01-01',
    } as SkillMetadata,
    raw_base_url: 'https://example.com/skills/api-testing',
  };

  const command: RemoteCommand = {
    name: '/code-review',
    metadata: {
      name: '/code-review',
      version: '1.0.0',
      description: 'Review code',
      tags: ['dev'],
      agents: ['opencode'],
      roles: ['dev'],
      last_updated: '2026-01-01',
    } as CommandMetadata,
    raw_base_url: 'https://example.com/commands/code-review',
  };

  const mcp: RemoteMcp = {
    name: 'jira-mcp',
    config: {
      name: 'jira-mcp',
      description: 'Jira integration',
      version: '1.0.0',
      command: 'npx',
      agents: ['opencode'],
      tags: ['pm'],
      security_approved: true,
    } as McpServerConfig,
    raw_url: 'https://example.com/mcp/jira-mcp.json',
  };

  it('isRemoteSkill identifies skills and commands', () => {
    expect(isRemoteSkill(skill)).toBe(true);
    expect(isRemoteSkill(command)).toBe(true);
    expect(isRemoteSkill(mcp)).toBe(false);
  });

  it('isRemoteCommand identifies commands only', () => {
    expect(isRemoteCommand(command)).toBe(true);
    expect(isRemoteCommand(skill)).toBe(false);
    expect(isRemoteCommand(mcp)).toBe(false);
  });

  it('isRemoteMcp identifies mcps', () => {
    expect(isRemoteMcp(mcp)).toBe(true);
    expect(isRemoteMcp(skill)).toBe(false);
    expect(isRemoteMcp(command)).toBe(false);
  });

  it('getItemName returns correct name', () => {
    expect(getItemName(skill)).toBe('api-testing');
    expect(getItemName(command)).toBe('/code-review');
    expect(getItemName(mcp)).toBe('jira-mcp');
  });

  it('getItemVersion returns correct version', () => {
    expect(getItemVersion(skill)).toBe('1.0.0');
    expect(getItemVersion(command)).toBe('1.0.0');
    expect(getItemVersion(mcp)).toBe('1.0.0');
  });
});

describe('utils', () => {
  describe('scanSecurity', () => {
    it('passes safe content', () => {
      const result = scanSecurity('# Hello World\nThis is safe content.');
      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('detects eval', () => {
      const result = scanSecurity('eval(something)');
      expect(result.safe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('detects hardcoded secrets', () => {
      const result = scanSecurity("const token = 'abc123secret'");
      expect(result.safe).toBe(false);
    });
  });

  describe('parseChangelog', () => {
    it('parses changelog correctly', () => {
      const content = `# Changelog\n\n## [1.2.0] - 2026-05-20\n\n- Added feature A\n- Fixed bug B\n\n## [1.0.0] - 2026-01-15\n\n- Initial release\n`;
      const entries = parseChangelog(content);
      expect(entries).toHaveLength(2);
      expect(entries[0].version).toBe('1.2.0');
      expect(entries[0].date).toBe('2026-05-20');
      expect(entries[0].changes).toHaveLength(2);
      expect(entries[1].version).toBe('1.0.0');
    });

    it('returns empty for invalid content', () => {
      const entries = parseChangelog('no changelog here');
      expect(entries).toHaveLength(0);
    });
  });

  describe('parseFrontmatter', () => {
    it('parses YAML frontmatter', () => {
      const content = '---\nname: test\ndescription: A test\n---\n\nBody content';
      const result = parseFrontmatter(content);
      expect(result.metadata).toEqual({ name: 'test', description: 'A test' });
      expect(result.body).toBe('Body content');
    });

    it('returns empty metadata for no frontmatter', () => {
      const result = parseFrontmatter('Just body');
      expect(result.metadata).toEqual({});
      expect(result.body).toBe('Just body');
    });
  });

  describe('expandHome', () => {
    it('expands tilde to HOME', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/home/testuser';
      expect(expandHome('~/config')).toBe('/home/testuser/config');
      process.env.HOME = originalHome;
    });

    it('leaves other paths unchanged', () => {
      expect(expandHome('/usr/local/bin')).toBe('/usr/local/bin');
    });
  });

  describe('formatTags', () => {
    it('formats tags with limit', () => {
      const tags = ['dev', 'qa', 'prod', 'test'];
      const result = formatTags(tags, 2);
      expect(result).toContain('dev');
      expect(result).toContain('qa');
      expect(result).not.toContain('prod');
    });
  });

  describe('normalizeHooks', () => {
    it('keeps lifecycle hooks', () => {
      const hooks = normalizeHooks({
        hooks: {
          'before-install': { cmd: ['node', 'prepare.js'] },
          'post-update': [{ cmd: ['node', 'migrate.js'] }],
        },
      });

      expect(hooks['before-install']).toEqual({ cmd: ['node', 'prepare.js'] });
      expect(hooks['post-update']).toEqual([{ cmd: ['node', 'migrate.js'] }]);
    });

    it('maps legacy post_install_script to post-install', () => {
      const hooks = normalizeHooks({
        post_install_script: {
          cmd: ['node', 'post-install.js'],
          description: 'legacy setup',
        },
      });

      expect(hooks['post-install']).toEqual({
        cmd: ['node', 'post-install.js'],
        description: 'legacy setup',
      });
    });
  });
});

describe('installer filters', () => {
  const ctx = {
    agents: [{ type: 'opencode' as const, version: '1.0', paths: { skills: [], commands: [], mcp: [] }, is_installed: true }],
    hub_config: { owner: 'test', repo: 'hub', branch: 'main', skills_path: 'skills', commands_path: 'commands', mcp_path: 'mcp', github_host: 'github.com' },
    home_dir: '/home/test',
    cwd: '/project',
  };

  describe('matchesAgents', () => {
    it('matches when agent is compatible', () => {
      expect(matchesAgents({ agents: ['opencode', 'claude'] }, ctx)).toBe(true);
    });

    it('rejects when no agents match', () => {
      expect(matchesAgents({ agents: ['cursor'] }, ctx)).toBe(false);
    });
  });

  describe('matchesTags', () => {
    it('matches included tags', () => {
      expect(matchesTags({ tags: ['dev', 'qa'], roles: ['dev'] }, ['qa'])).toBe(true);
    });

    it('passes when no tags specified', () => {
      expect(matchesTags({ tags: ['dev'] }, [])).toBe(true);
    });
  });

  describe('matchesSearch', () => {
    it('matches by name', () => {
      expect(matchesSearch({ name: 'api-testing', description: 'Test APIs', tags: ['qa'] }, 'api')).toBe(true);
    });

    it('matches by description', () => {
      expect(matchesSearch({ name: 'foo', description: 'Test APIs', tags: [] }, 'api')).toBe(true);
    });

    it('rejects non-matching search', () => {
      expect(matchesSearch({ name: 'foo', description: 'bar', tags: [] }, 'baz')).toBe(false);
    });
  });
});

describe('github client utilities', () => {
  it('asyncPool waits for all tasks and preserves item order', async () => {
    const results = await asyncPool(2, [30, 10, 20], async (delay, index) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return `item-${index}`;
    });

    expect(results).toEqual(['item-0', 'item-1', 'item-2']);
  });
});
