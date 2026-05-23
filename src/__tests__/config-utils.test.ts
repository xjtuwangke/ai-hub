const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
import { getDefaultHubConfig, buildUserContext } from '../config';
import { getHubCacheDir, getConfigDir, getLockFilePath, readJson, writeJson, getSkillsDir, getCommandsDir } from '../utils';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_HUB_OWNER;
    delete process.env.AI_HUB_REPO;
    delete process.env.AI_HUB_BRANCH;
    delete process.env.GH_HOST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('getDefaultHubConfig returns defaults', () => {
    const config = getDefaultHubConfig();
    expect(config.owner).toBe('xjtuwangke');
    expect(config.repo).toBe('ai-hub');
    expect(config.branch).toBe('main');
    expect(config.github_host).toBe('github.com');
  });

  it('getDefaultHubConfig respects env vars', () => {
    process.env.AI_HUB_OWNER = 'my-org';
    process.env.AI_HUB_REPO = 'custom-hub';
    process.env.AI_HUB_BRANCH = 'develop';
    process.env.GH_HOST = 'github.mycompany.com';

    const config = getDefaultHubConfig();
    expect(config.owner).toBe('my-org');
    expect(config.repo).toBe('custom-hub');
    expect(config.branch).toBe('develop');
    expect(config.github_host).toBe('github.mycompany.com');
  });

  it('buildUserContext returns valid context', async () => {
    const ctx = await buildUserContext({ agents: ['opencode'] });
    expect(ctx.home_dir).toBeTruthy();
    expect(ctx.cwd).toBeTruthy();
    expect(ctx.hub_config).toBeDefined();
    expect(Array.isArray(ctx.agents)).toBe(true);
  });
});

describe('utils directories', () => {
  it('getHubCacheDir returns cache path', () => {
    const dir = getHubCacheDir();
    expect(dir).toContain('.cache');
    expect(dir).toContain('ai-hub');
  });

  it('getConfigDir returns config path', () => {
    const dir = getConfigDir();
    expect(dir).toContain('.config');
    expect(dir).toContain('ai-hub');
  });

  it('getLockFilePath returns lock file path', () => {
    const path = getLockFilePath();
    expect(path).toContain('lock.json');
  });

  it('getSkillsDir returns skills path', () => {
    const dir = getSkillsDir();
    expect(dir).toContain('skills');
  });

  it('getCommandsDir returns commands path', () => {
    const dir = getCommandsDir();
    expect(dir).toContain('commands');
  });
});

describe('readJson and writeJson', () => {
  const testFile = '/tmp/ai-hub-test-' + Date.now() + '.json';

  it('writeJson and readJson roundtrip', async () => {
    const data = { name: 'test', version: '1.0.0' };
    await writeJson(testFile, data);
    const read = await readJson<typeof data>(testFile);
    expect(read).toEqual(data);
  });

  it('readJson returns null for missing file', async () => {
    const result = await readJson('/tmp/ai-hub-nonexistent-12345.json');
    expect(result).toBeNull();
  });
});
