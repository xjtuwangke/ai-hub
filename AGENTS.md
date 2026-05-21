# AI Hub

Enterprise AI Skill/Command/MCP distribution platform.

## For AI Agents

This is a TypeScript CLI project that distributes AI skills, commands, and MCP server configurations from a single GitHub repository to team members.

### Project Structure

```
ai-hub/
├── skills/           # AI agent skills (directory per skill)
│   ├── metadata.json # Skill metadata
│   ├── SKILL.md      # Skill instructions
│   └── CHANGELOG.md  # Version history
├── commands/         # AI agent commands (directory per command)
│   ├── metadata.json # Command metadata
│   └── COMMAND.md    # Command instructions
├── mcp/              # MCP server configurations
├── src/              # TypeScript CLI source
│   ├── index.ts      # CLI entry point
│   ├── github-client.ts
│   ├── installer.ts
│   ├── config.ts
│   ├── utils.ts
│   └── types.ts
└── dist/             # Compiled JavaScript output
```

### Key Commands

- `npm run build` - Compile TypeScript
- `node dist/index.js` - Run CLI
- `node dist/index.js install` - Install content
- `node dist/index.js list` - List available content

### Technology Stack

- **Language**: TypeScript 5.4+
- **Runtime**: Node.js 18+
- **Key Dependencies**:
  - `commander` - CLI framework
  - `inquirer` - Interactive prompts
  - `ora` - CLI spinners
  - `chalk` - Terminal colors
  - `node-fetch` - HTTP client
  - `fs-extra` - File system utilities

### Development Notes

- All content is fetched from GitHub via raw API and cached locally
- Skills/commands filter by user role and detected AI agents
- Commands can declare dependencies on skills (auto-installed)
- Security scanning is performed before installation
- Lock file tracks installed content at `~/.config/ai-hub/lock.json`

### Architecture

```
User Context → Load Catalog → Filter by Role/Agents → Install → Save Lock File
    ↑              ↑                                               ↓
  Config      GitHub API                                    Agent Adapters
    |              |                                               |
Role/Agents  Raw Content                                  opencode.ts
GitHub Host  Tree API                                      copilot.ts
detect       Recursive                                    codex.ts
                                                      claude.ts
```
