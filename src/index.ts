#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { buildUserContext, printEnvironmentReport } from './config';
import {
  loadCatalog,
  filterSkills,
  filterCommands,
  filterMcps,
  installItem,
  saveLockFile,
  loadLockFile,
  uninstallByLock,
  listInstalled,
  viewItemContent,
  viewChangelog,
  resolveCommandDependencies,
} from './installer';
import { c, confirm, printTable, parseChangelog } from './utils';
import { CliOptions, RemoteSkill, RemoteCommand, RemoteMcp } from './types';

const program = new Command();

program
  .name('ai-hub')
  .description('AI Skill/Command/MCP distribution manager for enterprise teams')
  .version('1.0.0')
  .option('-r, --role <role>', 'User role (dev/ba/qa/devops/all)')
  .option('-a, --agents <agents>', 'Comma-separated agent list (opencode,copilot,codex,claude)')
  .option('-g, --global', 'Install to global directory', true)
  .option('-y, --yes', 'Auto-confirm without prompts')
  .option('-v, --verbose', 'Verbose logging')
  .option('--dry-run', 'Simulate without installing')
  .option('--owner <owner>', 'GitHub repo owner')
  .option('--repo <repo>', 'GitHub repo name')
  .option('--branch <branch>', 'GitHub branch', 'main')
  .option('--github-host <host>', 'GitHub Enterprise host', 'github.com');

function parseOptions(cmd: Command): CliOptions {
  const opts = cmd.opts();
  return {
    role: opts.role,
    agents: opts.agents?.split(',') as CliOptions['agents'],
    global: opts.global,
    yes: opts.yes,
    verbose: opts.verbose,
    dryRun: opts.dryRun,
    owner: opts.owner,
    repo: opts.repo,
    branch: opts.branch,
    github_host: opts.githubHost,
  };
}

async function selectItemsInteractively<T extends { metadata: { name: string; description: string; version: string } }>(
  items: T[],
  itemType: string
): Promise<T[]> {
  if (items.length === 0) return [];

  const choices = items.map((item) => ({
    name: `${item.metadata.name} ${c.version(item.metadata.version)} - ${item.metadata.description.slice(0, 50)}`,
    value: item,
    checked: true,
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: `Select ${itemType} to install (Space to toggle, Enter to confirm):`,
      choices,
      pageSize: 15,
    },
  ]);

  return selected;
}

program
  .command('install')
  .alias('i')
  .description('Install skills, commands, and MCPs matching your role and agents')
  .option('--interactive', 'Use interactive TUI to select items')
  .option('--skills-only', 'Install only skills')
  .option('--commands-only', 'Install only commands')
  .option('--mcps-only', 'Install only MCPs')
  .option('--tag <tag>', 'Filter by tag')
  .option('--search <query>', 'Search by name/description')
  .action(async (cmdOptions) => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);

      printEnvironmentReport(ctx);

      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const catalog = await loadCatalog(ctx, token);

      if (!catalog) {
        c.error('Failed to load catalog from remote');
        process.exit(1);
      }

      const filterOpts = {
        tags: cmdOptions.tag ? [cmdOptions.tag] : undefined,
        search: cmdOptions.search,
      };

      let skills = filterSkills(catalog.skills, ctx, filterOpts);
      let commands = filterCommands(catalog.commands, ctx, filterOpts);
      let mcps = filterMcps(catalog.mcps, ctx, filterOpts);

      if (cmdOptions.skillsOnly) { commands = []; mcps = []; }
      if (cmdOptions.commandsOnly) { skills = []; mcps = []; }
      if (cmdOptions.mcpsOnly) { skills = []; commands = []; }

      if (cmdOptions.interactive) {
        skills = await selectItemsInteractively(skills, 'skills');
        commands = await selectItemsInteractively(commands, 'commands');
        if (mcps.length > 0) {
          const mcpChoices = mcps.map((m) => ({
            name: `${m.config.name} ${c.version(m.config.version)} - ${m.config.description.slice(0, 50)}`,
            value: m,
            checked: true,
          }));
          const { selectedMcps } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedMcps',
              message: 'Select MCPs to install (Space to toggle, Enter to confirm):',
              choices: mcpChoices,
              pageSize: 15,
            },
          ]);
          mcps = selectedMcps;
        }
      }

      if (commands.length > 0) {
        const { skillsToAdd, warnings } = resolveCommandDependencies(commands, catalog.skills, skills, ctx);

        if (skillsToAdd.length > 0) {
          c.info(`Auto-installing ${skillsToAdd.length} dependent skills for commands: ${skillsToAdd.map((s) => s.name).join(', ')}`);
          skills = [...skills, ...skillsToAdd];
        }

        for (const warning of warnings) {
          c.warning(warning);
        }
      }

      const total = skills.length + commands.length + mcps.length;
      if (total === 0) {
        c.warning('No items match your filters');
        return;
      }

      c.header(`Install plan: ${skills.length} skills, ${commands.length} commands, ${mcps.length} mcps`);

      const shouldProceed = options.yes || (await confirm('Proceed with installation?'));
      if (!shouldProceed) {
        c.info('Cancelled');
        return;
      }

      const records = [];

      for (const skill of skills) {
        const record = await installItem(ctx, skill, 'skill', options, token);
        if (record) records.push(record);
      }

      for (const cmd of commands) {
        const record = await installItem(ctx, cmd, 'command', options, token);
        if (record) records.push(record);
      }

      for (const mcp of mcps) {
        const record = await installItem(ctx, mcp, 'mcp', options, token);
        if (record) records.push(record);
      }

      await saveLockFile(ctx.role, records);

      c.header('Installation complete');
      c.success(`Installed ${records.length} items`);
      c.dim(`Lock file saved: ~/.config/ai-hub/lock.json`);
      c.dim('Restart your AI agent to load new content');
    } catch (error) {
      c.error(`Install failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('update')
  .alias('u')
  .description('Update installed content')
  .action(async () => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);
      const lockFile = await loadLockFile();

      if (!lockFile) {
        c.warning('No lock file found. Run install first.');
        return;
      }

      c.info('Uninstalling old versions...');
      await uninstallByLock(ctx, lockFile, options);

      c.info('Installing new versions...');
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const catalog = await loadCatalog(ctx, token);

      if (!catalog) {
        c.error('Failed to load catalog');
        process.exit(1);
      }

      let skills = filterSkills(catalog.skills, ctx);
      const commands = filterCommands(catalog.commands, ctx);
      const mcps = filterMcps(catalog.mcps, ctx);

      if (commands.length > 0) {
        const { skillsToAdd, warnings } = resolveCommandDependencies(commands, catalog.skills, skills, ctx);

        if (skillsToAdd.length > 0) {
          c.info(`Auto-installing ${skillsToAdd.length} dependent skills for commands: ${skillsToAdd.map((s) => s.name).join(', ')}`);
          skills = [...skills, ...skillsToAdd];
        }

        for (const warning of warnings) {
          c.warning(warning);
        }
      }

      const records = [];
      for (const skill of skills) {
        const record = await installItem(ctx, skill, 'skill', options, token);
        if (record) records.push(record);
      }
      for (const cmd of commands) {
        const record = await installItem(ctx, cmd, 'command', options, token);
        if (record) records.push(record);
      }
      for (const mcp of mcps) {
        const record = await installItem(ctx, mcp, 'mcp', options, token);
        if (record) records.push(record);
      }

      await saveLockFile(ctx.role, records);
      c.success('Update complete');
    } catch (error) {
      c.error(`Update failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .alias('rm')
  .description('Uninstall all content installed by ai-hub')
  .action(async () => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);
      const lockFile = await loadLockFile();

      if (!lockFile) {
        c.warning('No lock file found, nothing to uninstall');
        return;
      }

      const shouldProceed = options.yes || (await confirm('Uninstall all content?'));
      if (!shouldProceed) {
        c.info('Cancelled');
        return;
      }

      await uninstallByLock(ctx, lockFile, options);
      c.success('Uninstall complete');
    } catch (error) {
      c.error(`Uninstall failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List available and installed content')
  .option('--installed', 'Show only installed content')
  .option('--tag <tag>', 'Filter by tag')
  .option('--search <query>', 'Search by name/description')
  .action(async (cmdOptions) => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);

      if (cmdOptions.installed) {
        await listInstalled(ctx);
        return;
      }

      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const catalog = await loadCatalog(ctx, token);

      if (!catalog) {
        c.error('Failed to load catalog');
        process.exit(1);
      }

      const filterOpts = {
        tags: cmdOptions.tag ? [cmdOptions.tag] : undefined,
        search: cmdOptions.search,
      };

      const skills = filterSkills(catalog.skills, ctx, filterOpts);
      const commands = filterCommands(catalog.commands, ctx, filterOpts);
      const mcps = filterMcps(catalog.mcps, ctx, filterOpts);

      c.header(`Available Skills (${skills.length})`);
      if (skills.length > 0) {
        printTable(
          ['Name', 'Version', 'Description', 'Tags'],
          skills.map((s) => [
            s.metadata.name,
            s.metadata.version,
            s.metadata.description.slice(0, 35),
            s.metadata.tags.slice(0, 3).join(', '),
          ])
        );
      } else {
        c.sub('No matching skills');
      }

      c.header(`Available Commands (${commands.length})`);
      if (commands.length > 0) {
        printTable(
          ['Name', 'Version', 'Description', 'Dependencies'],
          commands.map((c) => [
            c.metadata.name,
            c.metadata.version,
            c.metadata.description.slice(0, 35),
            (c.metadata.dependencies || []).join(', ') || '-',
          ])
        );
      } else {
        c.sub('No matching commands');
      }

      c.header(`Available MCPs (${mcps.length})`);
      if (mcps.length > 0) {
        printTable(
          ['Name', 'Version', 'Description', 'Approved'],
          mcps.map((m) => [
            m.config.name,
            m.config.version,
            m.config.description.slice(0, 35),
            m.config.security_approved ? 'Yes' : 'No',
          ])
        );
      } else {
        c.sub('No matching MCPs');
      }
    } catch (error) {
      c.error(`List failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('view <name>')
  .description('View content of a skill or command')
  .option('--type <type>', 'Item type (skill/command/mcp)', 'skill')
  .action(async (name, cmdOptions) => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const catalog = await loadCatalog(ctx, token);

      if (!catalog) {
        c.error('Failed to load catalog');
        process.exit(1);
      }

      let item: RemoteSkill | RemoteCommand | RemoteMcp | undefined;

      if (cmdOptions.type === 'skill') {
        item = catalog.skills.find((s) => s.name === name);
      } else if (cmdOptions.type === 'command') {
        item = catalog.commands.find((c) => c.name === name);
      } else {
        item = catalog.mcps.find((m) => m.name === name);
      }

      if (!item) {
        c.error(`Item not found: ${name}`);
        process.exit(1);
      }

      const content = await viewItemContent(item, cmdOptions.type, token);
      console.log('\n' + content);
    } catch (error) {
      c.error(`View failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('changelog <skill-name>')
  .description('View changelog for a skill')
  .action(async (skillName) => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const catalog = await loadCatalog(ctx, token);

      if (!catalog) {
        c.error('Failed to load catalog');
        process.exit(1);
      }

      const skill = catalog.skills.find((s) => s.name === skillName);
      if (!skill) {
        c.error(`Skill not found: ${skillName}`);
        process.exit(1);
      }

      const changelogContent = await viewChangelog(skill, token);
      if (!changelogContent) {
        c.warning(`No changelog found for ${skillName}`);
        return;
      }

      const entries = parseChangelog(changelogContent);

      c.header(`Changelog: ${skillName}`);
      for (const entry of entries) {
        console.log(`\n${c.version(entry.version)} - ${entry.date}`);
        for (const change of entry.changes) {
          c.sub(`- ${change}`);
        }
      }
    } catch (error) {
      c.error(`Changelog failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Diagnose environment configuration')
  .action(async () => {
    try {
      const options = parseOptions(program);
      const ctx = await buildUserContext(options);
      printEnvironmentReport(ctx);

      const lockFile = await loadLockFile();
      if (lockFile) {
        c.header('Lock File Info');
        c.bullet('Installed at', lockFile.installed_at);
        c.bullet('Role', lockFile.user_role);
        c.bullet('Items', `${lockFile.items.length}`);
      }
    } catch (error) {
      c.error(`Doctor failed: ${error}`);
      process.exit(1);
    }
  });

program.parse();
