# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-23

### Added
- Fetch timeout and retry logic for GitHub API calls
- Network error logging instead of silent failures
- Project infrastructure files: `.gitignore`, `LICENSE`, `CONTRIBUTING.md`
- Type guards: `isRemoteSkill`, `isRemoteCommand`, `isRemoteMcp`, `getItemName`, `getItemVersion`

### Fixed
- Removed all `as any` type casts from codebase
- Replaced dynamic `require()` calls with static ES module imports
- Fixed `CommandMetadata` interface to include required `roles` field
- Fixed `AggregatedLockFile.type` to include `'mcp'`
- Fixed CI workflow to validate `commands/*/metadata.json` and `commands/*/COMMAND.md`
- Fixed `scripts/generate-content.js` to generate directory-based command structure
- Fixed `node-fetch` type declaration circular reference by removing custom `.d.ts`
- Fixed `cursor` and `windsurf` agent adapter mappings

## [1.0.0] - 2026-05-20

### Added
- Initial release of AI Hub CLI
- Skill, Command, and MCP distribution
- Interactive TUI mode with checkbox selection
- Role-based and agent-based content filtering
- Security scanning for dangerous patterns and hardcoded secrets
- Lock file tracking for installed content
- Post-install script support
- Agent adapters for OpenCode, GitHub Copilot, OpenAI Codex, Claude Code, Cursor, Windsurf
