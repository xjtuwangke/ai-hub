# Contributing to AI Hub

Thank you for your interest in contributing to AI Hub! This document provides guidelines and instructions for contributing.

## Development Setup

```bash
git clone https://github.com/your-org/ai-hub.git
cd ai-hub
npm install
npm run build
```

## Project Structure

- `src/` - TypeScript CLI source code
- `skills/` - Skill definitions (metadata.json + SKILL.md + CHANGELOG.md)
- `commands/` - Command definitions (metadata.json + COMMAND.md)
- `mcp/` - MCP server configurations (.json files)
- `scripts/` - Build and generation utilities

## Adding a New Skill

1. Create a directory under `skills/<skill-name>/`
2. Add `metadata.json` with required fields: `name`, `version`, `description`, `tags`, `roles`, `agents`
3. Add `SKILL.md` with instructions
4. Add `CHANGELOG.md` with version history

## Adding a New Command

1. Create a directory under `commands/<command-name>/`
2. Add `metadata.json` with required fields
3. Add `COMMAND.md` with command instructions
4. Optionally declare `dependencies` on skills

## Code Style

- TypeScript strict mode is enabled
- Avoid `any` type casts
- Use ES module imports (`import`) instead of `require()`
- Handle errors explicitly; do not swallow exceptions

## Testing

Run the test suite before submitting:

```bash
npm test
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## Code Review

All submissions require review before being merged. Please ensure:
- CI checks pass
- TypeScript compiles without errors
- No new linting warnings

## Questions?

Open an issue on GitHub or reach out to the platform team.
