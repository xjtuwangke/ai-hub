# ai-hub

Enterprise AI Skill/Command/MCP distribution platform. A single GitHub repository serves as the source of truth for skills, commands, and MCP configurations, distributed to team members via a TypeScript CLI.

## Quick Start

### For Team Members

```bash
# Run directly via npx (no installation needed)
npx github:your-org/ai-hub install

# Interactive TUI mode - select what to install
npx github:your-org/ai-hub install --interactive

# Install with specific role
npx github:your-org/ai-hub install --role qa

# List available content
npx github:your-org/ai-hub list

# View a specific skill content
npx github:your-org/ai-hub view api-testing --type skill

# View changelog
npx github:your-org/ai-hub changelog api-testing

# Update installed content
npx github:your-org/ai-hub update

# Diagnose environment
npx github:your-org/ai-hub doctor
```

### Environment Variables

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export GH_HOST="github.your-company.com"
export AI_HUB_ROLE="dev"
export AI_HUB_OWNER="your-org"
export AI_HUB_REPO="ai-hub"
export AI_HUB_YES="1"  # Auto-confirm
```

## Repository Structure

```
ai-hub/
├── skills/                    # Flat skill directories (20 examples)
│   ├── api-testing/
│   │   ├── metadata.json      # Version, tags, roles, dependencies
│   │   ├── SKILL.md           # Skill instructions
│   │   └── CHANGELOG.md       # Version history
│   ├── code-review/
│   ├── security-audit/
│   └── ... (17 more)
├── commands/                  # Flat command directories (5 examples)
│   ├── code-review/           # Depends on: code-review skill
│   │   ├── metadata.json
│   │   └── COMMAND.md
│   ├── security-audit/        # Depends on: security-audit skill
│   │   ├── metadata.json
│   │   └── COMMAND.md
│   ├── test-plan/             # Depends on: api-testing, test-automation
│   │   ├── metadata.json
│   │   └── COMMAND.md
│   ├── deploy-checklist/      # Depends on: ci-cd-pipeline, infrastructure-as-code
│   │   ├── metadata.json
│   │   └── COMMAND.md
│   └── requirement-doc/     # Depends on: requirement-analysis, documentation-writing
│       ├── metadata.json
│       └── COMMAND.md
├── mcp/                       # MCP server configurations
│   ├── jira-mcp.json
│   └── internal-api-mcp.json
├── src/                       # TypeScript CLI source
│   ├── index.ts               # CLI entry with TUI
│   ├── github-client.ts       # GitHub Raw API client
│   ├── installer.ts           # Install/update/uninstall logic
│   ├── config.ts              # Role & agent detection
│   ├── utils.ts               # Utilities & security scanner
│   ├── types.ts               # Type definitions
│   └── agents/                # Agent adapters
│       ├── opencode.ts
│       ├── copilot.ts
│       ├── codex.ts
│       └── claude.ts
├── scripts/
│   └── generate-content.js    # Batch content generator
└── .github/workflows/
│   └── validate.yml           # CI validation pipeline
```

## Skill Format

Each skill is a flat directory with three files:

### metadata.json

```json
{
  "name": "api-testing",
  "version": "1.2.0",
  "description": "API testing strategy and automated test case generation",
  "tags": ["qa", "dev", "testing", "http", "rest"],
  "roles": ["qa", "dev"],
  "agents": ["opencode", "codex", "claude"],
  "author": "platform-team",
  "security_grade": "A",
  "last_updated": "2026-05-20",
  "changelog_file": "CHANGELOG.md"
}
```

### SKILL.md

```markdown
---
name: api-testing
description: API testing strategy and automated test case generation
---

# API Testing Skill

## Purpose
Generate comprehensive API test cases covering functional, boundary, and error scenarios.
```

### CHANGELOG.md

```markdown
# Changelog

## [1.2.0] - 2026-05-20

- Added GraphQL support
- Improved test data generation

## [1.0.0] - 2026-01-15

- Initial release
```

## Command Format

Each command is a flat directory with two files, similar to skills.

```
commands/
├── security-audit/
│   ├── metadata.json       # Command metadata and dependencies
│   └── COMMAND.md          # Command instructions
└── ...
```

### metadata.json

```json
{
  "name": "/security-audit",
  "version": "1.1.0",
  "description": "Run OWASP Top 10 security audit on the codebase",
  "roles": ["qa", "dev"],
  "agents": ["opencode", "claude"],
  "tags": ["security", "audit", "qa"],
  "dependencies": ["security-audit"],
  "author": "platform-team",
  "last_updated": "2026-05-20"
}
```

### COMMAND.md

```markdown
1. Scan for injection vulnerabilities
2. Check authentication logic
3. ...
```

## MCP Format

```json
{
  "name": "jira-mcp",
  "description": "Jira issue management",
  "version": "1.0.0",
  "command": "npx",
  "args": ["@your-org/jira-mcp@latest"],
  "roles": ["dev", "qa", "ba"],
  "agents": ["opencode", "copilot", "claude", "codex"],
  "tags": ["project-management", "jira", "tracking"],
  "env_required": ["JIRA_API_TOKEN", "JIRA_HOST"],
  "security_approved": true
}
```

## CLI Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `install` | `i` | Install skills/commands/MCPs (with --interactive for TUI) |
| `update` | `u` | Update installed content |
| `uninstall` | `rm` | Uninstall all ai-hub content |
| `list` | `ls` | List available/installed content |
| `view <name>` | - | View skill/command/MCP content |
| `changelog <name>` | - | View skill changelog |
| `doctor` | - | Diagnose environment |

### Global Options

| Option | Description |
|--------|-------------|
| `-r, --role <role>` | User role (dev/ba/qa/devops/all) |
| `-a, --agents <agents>` | Target agents (comma-separated) |
| `-g, --global` | Install to global directory |
| `-y, --yes` | Auto-confirm |
| `--dry-run` | Simulate without installing |
| `--owner, --repo, --branch` | Override hub repository |

### TUI Interactive Mode

```bash
npx github:your-org/ai-hub install --interactive
```

This opens a checkbox interface where you can:
- Select individual skills to install
- Select commands
- Select MCP servers
- Space to toggle, Enter to confirm

## Role-Based Distribution

Content is filtered by `roles` and `agents` fields:

**Roles**: `dev`, `ba`, `qa`, `devops`, `all`
**Agents**: `opencode`, `copilot`, `codex`, `claude`, `cursor`, `windsurf`

The CLI automatically:
1. Detects user role (CLI arg > env > GitHub Teams API > default)
2. Detects installed AI agents
3. Filters catalog by role + agent compatibility
4. Installs matching content to correct agent directories

## Command Dependencies

Commands can declare `dependencies` on skills. When a command is installed, the CLI will:
1. Check if dependent skills are already installed
2. Auto-install missing dependencies
3. Log dependency resolution

## Security

All content is security-scanned before installation:
- Dangerous patterns (eval, exec, child_process, rm -rf)
- Hardcoded secrets (API_KEY, TOKEN, SECRET)
- MCP servers require `security_approved: true`

## CI/CD Validation

GitHub Actions validates every PR:
- metadata.json schema validation
- SKILL.md frontmatter check
- Command frontmatter check
- Security scanning
- MCP config validation

## Local Development

```bash
npm install
npm run build
node dist/index.js install --role dev --dry-run
```

## License

MIT
