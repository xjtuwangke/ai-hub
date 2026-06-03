const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { installItem } from '../installer';
import { RemoteSkill, UserContext } from '../types';
import { getHubCacheDir, getSkillsDir } from '../utils';
import { fetchSkillContent, fetchText } from '../github-client';

jest.mock('../github-client', () => ({
  fetchCatalog: jest.fn(),
  fetchSkillContent: jest.fn(),
  fetchCommandContent: jest.fn(),
  fetchText: jest.fn(),
  fetchChangelog: jest.fn(),
}));

const mockedFetchSkillContent = fetchSkillContent as jest.MockedFunction<typeof fetchSkillContent>;
const mockedFetchText = fetchText as jest.MockedFunction<typeof fetchText>;

describe('installer hooks', () => {
  const originalHome = process.env.HOME;
  let homeDir: string;

  const skill: RemoteSkill = {
    name: 'hooked-skill',
    raw_base_url: 'https://example.com/skills/hooked-skill',
    metadata: {
      name: 'hooked-skill',
      version: '1.0.0',
      description: 'Hook integration test skill',
      tags: ['test'],
      agents: ['opencode'],
      last_updated: '2026-01-01',
      hooks: {
        'post-install': {
          cmd: ['node', 'post-install.js'],
        },
      },
    },
  };

  function createContext(): UserContext {
    return {
      agents: [
        {
          type: 'opencode',
          paths: { skills: [], commands: [], mcp: [] },
          is_installed: true,
        },
      ],
      hub_config: {
        owner: 'test',
        repo: 'ai-hub',
        branch: 'main',
        skills_path: 'skills',
        commands_path: 'commands',
        mcp_path: 'mcp',
        github_host: 'github.com',
      },
      home_dir: homeDir,
      cwd: homeDir,
    };
  }

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-hub-hooks-'));
    process.env.HOME = homeDir;
    mockedFetchSkillContent.mockResolvedValue('# Hooked Skill\n');
    mockedFetchText.mockImplementation(async (url: string) => {
      if (url.endsWith('post-install.js')) {
        return [
          "const fs = require('fs');",
          "fs.writeFileSync('hook-marker.txt', `${process.env.AI_HUB_HOOK_EVENT}:${process.env.AI_HUB_CONTENT_NAME}`);",
        ].join('\n');
      }
      if (url.endsWith('fail.js')) {
        return 'process.exit(1);';
      }
      return null;
    });
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    jest.clearAllMocks();
    await fs.remove(homeDir);
  });

  it('runs post-install hooks from metadata', async () => {
    const record = await installItem(createContext(), skill, 'skill', { yes: true }, undefined, 'install');

    expect(record?.hooks?.['post-install']).toEqual({ cmd: ['node', 'post-install.js'] });
    await expect(fs.readFile(path.join(getHubCacheDir(), 'downloads', 'hooked-skill', 'hook-marker.txt'), 'utf-8')).resolves.toBe('post-install:hooked-skill');
    await expect(fs.pathExists(path.join(getSkillsDir(), 'hooked-skill', 'SKILL.md'))).resolves.toBe(true);
  });

  it('stops installation when before-install hook fails', async () => {
    const failingSkill: RemoteSkill = {
      ...skill,
      metadata: {
        ...skill.metadata,
        hooks: {
          'before-install': {
            cmd: ['node', 'fail.js'],
          },
        },
      },
    };

    const record = await installItem(createContext(), failingSkill, 'skill', { yes: true }, undefined, 'install');

    expect(record).toBeNull();
    await expect(fs.pathExists(path.join(getSkillsDir(), 'hooked-skill'))).resolves.toBe(false);
  });
});
