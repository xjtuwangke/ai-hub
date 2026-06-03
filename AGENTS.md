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
│   ├── COMMAND.md    # COMMAND instructions
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

## AGENTS.md 补充（本地维护）

- `scan-secrets` 为独立可执行命令：`scan-secrets`，同时也支持 `ai-hub scan-secrets` 子命令路径。
- 支持 `--rules` / `--rules-dir` / `--plugin-dir`，用于扩展规则与 detector 插件。
- 支持增量缓存策略：`--cache`（默认 `scan_path/.ai-hub-secret-scan-cache.json`）与 `--cache-path`，用于减少重复扫描时的 IO。
- `--baseline` 接受扫描结果 JSON（完整对象或 `{"findings":[...]}`），通过 `fingerprint` 抑制历史告警。
- `--git-diff` 用于扫描变更文件，默认包含 unstaged/staged/untracked，可配 `--no-git-diff-staged`、`--no-git-diff-untracked` 精确控制；Git 输出使用 NUL 分隔解析以支持空格和中文文件名。
- 输出默认脱敏 `match` 与 `snippet`，仅本地调试时使用 `--no-redact` 查看原始命中内容。
- 建议 CI 场景使用：`scan-secrets --path . --json --strict --output scan.json`，结合返回码判断是否阻断流程（发现告警为 `1`，规则/插件配置错误为 `2`）。
- 推荐在仓库根目录配套保存：`.scan-rules/`（规则目录）、`secret-scan-plugin.js`（插件入口）便于审计更新。

### Agent 支持矩阵（关键）
- `opencode`：支持 skill / command / mcp 全链路
- `copilot`：支持 skill/mcp，command 仅提示不支持
- `codex`：支持 skill/mcp，command 仅提示不支持
- `claude`：支持 skill / command / mcp

### 示例调用（agents 自测）

- `scan-secrets --path . --rules-dir ./rules --plugin-dir ./plugins`
- `scan-secrets --path . --git-diff HEAD~1 --sarif --output .artifacts/secret-scan.sarif`
- `scan-secrets --path ./scan.txt --no-default-rules --cache --cache-path .scan-cache.json`
- `scan-secrets --path . --json --strict --output scan-result.json`
- `ai-hub scan-secrets --path . --json --strict --output scan-result.json`

### 调试与验证建议

- 使用 `npm run build && npm test` 验证扫描相关改动（新增规则/插件时优先加回归测试）。
- 修改规则加载、插件加载接口时同步更新 `README.md`“规则示例/插件示例”与 `secret-scan-*.example.*` 文件。

### 兼容说明

- 此节为 `AGENTS.md` 本地补充；原项目结构说明不变。
