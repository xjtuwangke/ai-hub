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

For agent behavior matrix (opencode/copilot/codex/claude), see `AGENTS.md`.

### Secret Scanner

```bash
# Scan directory (default: current directory)
npx github:your-org/ai-hub scan-secrets --path .

# Scan one file
npx github:your-org/ai-hub scan-secrets --path ./services/auth/config.ts

# Scan only changed files
npx github:your-org/ai-hub scan-secrets --git-diff

# Scan changed files against a base and ignore staged/untracked files
npx github:your-org/ai-hub scan-secrets --git-diff HEAD~1 --no-git-diff-staged --no-git-diff-untracked

# Scan against base commit and emit SARIF
npx github:your-org/ai-hub scan-secrets --git-diff HEAD~1 --sarif --output secret-scan.sarif

# Load custom rule file + plugin directory
npx github:your-org/ai-hub scan-secrets \
  --rules ./secret-scan-rules.example.yaml \
  --plugin-dir ./plugins \
  --output scan-result.json

# CI-friendly JSON run (non-zero exit code if findings)
npx github:your-org/ai-hub scan-secrets --path . --json --output scan-full.json

# Incremental cache with explicit path
npx github:your-org/ai-hub scan-secrets --path . --cache --cache-path ./.scan-cache.json
```

### Standalone Binary

`scan-secrets` is also available after build:

```bash
npm run build
scan-secrets --path .
scan-secrets --path ./services/auth/config.ts --no-default-rules --rules ./secret-scan-rules.example.yaml
```

### CLI 参数参考

```bash
scan-secrets \
  --path ./repo-or-file \
  --rules ./my-rules.yaml \
  --rules-dir ./rules \
  --plugin-dir ./plugins \
  --baseline ./baseline.json \
  --git-diff [base] \
  --no-default-rules \
  --cache \
  --cache-path ./.scan-cache.json \
  --format json \
  --output scan.json \
  --max-size 2097152 \
  --concurrency 8 \
  --binary \
  --ignore dist/** node_modules/** \
  --no-redact \
  --strict \
  --no-gitignore
```

核心说明：

- `--path`: 目标路径（文件或目录），默认当前工作目录。
- `--rules`: 单个规则文件（支持 `json` / `yaml`）。
- `--rules-dir`: 规则目录，递归加载 `*.json/*.yml/*.yaml`。
- `--plugin-dir`: 插件目录，递归加载 `.js/.mjs/.cjs`。
- `--baseline`: 已知告警抑制文件（JSON 指纹集合）。
- `--git-diff [base]`: 仅扫描变更文件；不传 `base` 时包含 unstaged、staged、untracked。
  Git 路径使用 NUL 分隔解析，可处理空格、引号和中文文件名。
- `--no-git-diff-staged`: `--git-diff` 下排除暂存文件。
- `--no-git-diff-untracked`: `--git-diff` 下排除未追踪文件。
- `--cache`: 开启增量缓存，默认路径为 `<scan_path>/.ai-hub-secret-scan-cache.json`；
  当扫描单文件时自动落在文件所在目录。
- `--cache-path`: 覆盖默认缓存路径。
- `--format`: 输出格式，默认 `summary`，支持 `summary/json/sarif`。
- `--json` / `--sarif`: 兼容参数，等价于 `--format json/sarif`。
- `--output`: 输出到文件，不传则写终端/默认终端统计摘要。
- `--no-default-rules`: 不使用内置规则，仅运行自定义规则和插件。
- `--no-gitignore`: 忽略 `.gitignore` 过滤。
- `--binary`: 扫描二进制文件（默认跳过）。
- `--max-size`: 单文件扫描上限（字节），默认 `1048576`。
- `--concurrency`: 并发 worker 数，默认 `4`。
- `--ignore <pattern...>`: 额外忽略 glob 模式（可重复传递）。
- `--no-redact`: 关闭输出脱敏；默认 JSON/SARIF/summary 会脱敏 `match` 与 `snippet`。
- `--strict`: 规则/插件配置错误时返回退出码 `2`；非严格模式会继续扫描并在 `errors` 字段报告问题。

### 场景化调用示例（可直接复制）

```bash
# 只扫描 PR 变更并输出 SARIF
scan-secrets --path . --git-diff HEAD~1 --sarif --output .artifacts/secret-scan.sarif

# CI 强制模式：发现问题返回 1，规则/插件配置错误返回 2
scan-secrets --path . --json --strict --output /tmp/scan.json
if [ $? -ne 0 ]; then
  echo "secret scan failed" >&2
  exit 1
fi

# 本地调试时输出原始命中内容（不要用于 CI artifact）
scan-secrets --path . --json --no-redact

# 只扫描 src 和 services，并排除构建产物
scan-secrets \
  --path . \
  --ignore "dist/**" "build/**" "coverage/**" \
  --rules-dir ./rules \
  --plugin-dir ./plugins \
  --format summary

# 扫描单文件，仅执行插件检测（示例）
scan-secrets \
  --path ./services/auth/config.ts \
  --no-default-rules \
  --plugin-dir ./plugins \
  --json \
  --output config-scan.json
```

### Baseline（指纹）示例

```bash
# 生成基线（可直接复用为 --baseline）
scan-secrets --path . --json --output baseline-full.json

# 使用基线文件抑制历史告警
scan-secrets --path . --baseline baseline-full.json --sarif --output pr-scan.sarif

# 也可手工写最小 baseline
cat > baseline.json <<'EOF'
{
  "findings": [
    { "fingerprint": "replace-with-real-fingerprint" }
  ]
}
EOF
```

### 可复用规则示例（yaml/json）

```yaml
# secret-rules.yaml
version: 1
rules:
  - id: api-key-generic
    name: Generic API Key
    description: API keys in common assignment format
    severity: high
    type: regex
    pattern: "api[_-]?key\\s*[:=]\\s*[\\\"']?([A-Za-z0-9_\\-/\\+]{16,})"
    flags: i
    keywords:
      - api
      - key
    allowlist:
      - placeholder
      - example
    paths:
      - src/**/*.ts

  - id: config-token
    name: Config Token
    description: config token with high-entropy body
    severity: medium
    type: entropy
    pattern: '[A-Za-z0-9+/=]{24,}'
    entropy:
      enabled: true
      min_length: 24
      entropy_threshold: 4.4
      window_size: 64
      charset: base64
```

JSON 示例（同名结构）：

```json
{
  "version": 1,
  "rules": [
    {
      "id": "aws-like-key",
      "name": "AWS Access Key",
      "description": "AWS AccessKeyID style",
      "severity": "critical",
      "type": "regex",
      "pattern": "AKIA[0-9A-Z]{16}",
      "flags": "i",
      "paths": ["**/*.ts", "**/*.js", "**/*.py"]
    }
  ]
}
```

### 插件示例

插件支持：

- 导出单个 detector 函数：`module.exports = function(context) { ... }`
- 导出对象：`{ id, name, scan }`
- 导出多个 detector：`{ id, detectors: [...] }`

```javascript
function scan(context) {
  const findings = [];
  for (let i = 0; i < context.lines.length; i++) {
    const line = context.lines[i];
    const match = line.match(/TODO_SECRET=([A-Za-z0-9_-]{12,})/i);
    if (!match) continue;
    findings.push({
      rule_id: 'todo-secret',
      rule_name: 'TODO secret marker',
      severity: 'medium',
      line: i + 1,
      column: match.index + 1,
      match: match[1],
      snippet: line,
      detector: 'todo-secret-plugin',
    });
  }
  return findings;
}

module.exports = {
  id: 'todo-secret-plugin',
  name: 'Todo Marker Detector',
  scan,
};
```

```javascript
module.exports = {
  id: 'multi-detector-plugin',
  detectors: [
    { id: 'pk-pattern', scan: (context) => [] },
    { id: 'password-pattern', scan: (context) => [] },
  ],
};
```

`context` 可用字段：

```typescript
{
  absolutePath: string;
  relativePath: string;
  rootPath: string;
  content: string;
  lines: string[];
}
```

### 示例输出

```bash
# 默认终端摘要
scan-secrets --path .

# JSON 命令行输出并落盘
scan-secrets --path . --json --output scan.json

# SARIF 输出用于 CI 安全平台
scan-secrets --git-diff HEAD~1 --sarif --output scan.sarif
```

### 直接验证入口（可用于 CI）

```bash
# 入口一致性：独立命令与主命令
scan-secrets --path ./scan.txt --no-default-rules --cache
ai-hub scan-secrets --path ./scan.txt --no-default-rules --cache
```

## 扩展规则与插件（可扩展版本设计）

`scan-secrets` 使用可插拔设计，规则和检测器可独立扩展：

- 规则通过 `--rules` / `--rules-dir` 追加到执行链末尾，且不会影响主命令参数解析。
- 插件通过 `--plugin-dir` 动态加载，支持单文件导出 detector。
- 扫描流程固定为：读取文件 → 内置/自定义规则匹配 → 规则告警 → 插件检测 → 合并结果。
- 输出层与扫描层解耦：`outputScanResult` 统一处理 `json/sarif/summary`，后续可新增更多输出格式。

### 内置规则文件结构（v1）

```yaml
version: 1
rules:
  - id: my-api-key
    name: Generic API Key
    description: Example rule
    severity: high
    type: regex
    pattern: 'api_key\\s*=\\s*([A-Za-z0-9_]{16,})'
    flags: i
    keywords: [api, key]
    allowlist: [example, doc]
```

支持 `regex` 与 `entropy` 两种类型；`type: entropy` 时可配置：

```yaml
    entropy:
      enabled: true
      min_length: 24
      entropy_threshold: 4.4
      charset: base64
```

### 插件约定（v1）

插件入口文件可输出：

```javascript
module.exports = {
  id: 'my-plugin',
  name: 'My Detector Plugin',
  scan: (context) => {
    return [{
      rule_id: 'my-rule',
      line: 1,
      column: 1,
      match: 'token',
      severity: 'medium',
      snippet: context.lines[0],
      detector: 'my-plugin',
    }];
  },
};
```

也可以直接导出一个 detector 函数，或导出 `detectors` 数组。

`context` 结构示例：

```typescript
{
  absolutePath: string;
  relativePath: string;
  rootPath: string;
  content: string;   // 完整文件内容
  lines: string[];   // 行数组
}
```

建议在插件中返回轻量对象并尽量避免副作用；一次扫描内会并行按文件维度执行，不建议做重 IO 操作。

### 可扩展路线图（V1 -> V2）

- V1（当前）：规则/插件热加载（单次进程内动态发现）、`json/sarif` 双输出、`git-diff` 基线扫描。
- V2（建议）：插件与规则签名白名单、缓存 `mtime+hash` 加速增量扫描、企业内置策略仓库、告警聚合策略（按规则级别/路径）
- V3（企业定制）：多租户策略配置、扫描结果入库、增量告警/历史比对、REST webhook 输出。

### Environment Variables

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export GH_HOST="github.your-company.com"
export AI_HUB_ROLE="dev"
export AI_HUB_OWNER="your-org"
export AI_HUB_REPO="ai-hub"
export AI_HUB_YES="1"  # Auto-confirm
```

### Proxy Configuration

If you are behind a corporate firewall or in a region where GitHub is restricted, you can configure a proxy in three ways (highest priority first):

**1. CLI option (per-command)**

```bash
ai-hub list --proxy http://127.0.0.1:7897
ai-hub install --proxy socks5://127.0.0.1:7897
```

**2. Environment variables**

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897
```

**3. Configuration file (`ai-hub.json`)**

```json
{
  "owner": "your-org",
  "repo": "ai-hub",
  "proxy": "http://127.0.0.1:7897"
}
```

Supported proxy formats: `http://`, `https://`, `socks5://`.

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

## Lifecycle Hooks

Skills and commands can optionally include **lifecycle hooks** that run around install, update, and uninstall operations.

### Supported Events

| Event | When it runs |
|-------|--------------|
| `before-install` | After content is downloaded, before it is copied to agents |
| `post-install` | After a normal install completes |
| `before-update` | Before an installed item is removed during update |
| `post-update` | After the updated item is installed |
| `before-uninstall` | Before an installed item is removed |
| `post-uninstall` | After an installed item is removed |

### Why Use Hooks?

- Validate required tools (e.g., check if `jest` or `docker` is installed)
- Create sample configuration files (e.g., `api-test-config.json`)
- Set up directory structures (e.g., `test-plans/` folder)
- Initialize databases or environment variables
- Generate boilerplate code or templates
- Migrate or clean up generated files during update/uninstall

### Script Requirements

- Must be compatible with **Node.js** (`.js`, `.mjs`, `.cjs`) or **TypeScript** (`.ts` via `ts-node`)
- Must pass security scanning (no `eval`, `exec` with user input, etc.)
- Should be idempotent (safe to run multiple times)
- Should exit with code 0 on success, non-zero on failure

### How to Add Hooks

Add a `hooks` object to your `metadata.json`. Each event can define one script or an array of scripts:

```json
{
  "name": "api-testing",
  "version": "1.2.0",
  "hooks": {
    "before-install": {
      "cmd": ["node", "validate-tools.js"],
      "description": "Validates required local tools"
    },
    "post-install": {
      "cmd": ["node", "post-install.js"],
      "description": "Creates sample config and test files"
    },
    "post-update": [
      {
        "cmd": ["node", "migrate-config.js"],
        "description": "Migrates generated config files"
      }
    ]
  }
}
```

Place referenced script files in the same directory:

```
skills/api-testing/
├── metadata.json
├── SKILL.md
├── validate-tools.js
├── post-install.js
└── migrate-config.js
```

### CMD Array Format

`cmd` is an array of strings representing the command and its arguments:

```json
{
  "hooks": {
    "post-install": {
      "cmd": ["node", "post-install.js"],
      "description": "Run setup script"
    }
  }
}
```

```json
{
  "hooks": {
    "post-install": {
      "cmd": ["npx", "ts-node", "setup.ts"],
      "description": "Run TypeScript setup"
    }
  }
}
```

```json
{
  "hooks": {
    "before-install": {
      "cmd": ["npm", "install", "jest", "--save-dev"],
      "description": "Install Jest for testing"
    }
  }
}
```

### Script Examples

#### Example 1: Create Config Files (JavaScript)

```javascript
const fs = require('fs');
const path = require('path');

const config = {
  baseUrl: 'http://localhost:3000',
  timeout: 5000
};

fs.writeFileSync('api-test-config.json', JSON.stringify(config, null, 2));
console.log('Created api-test-config.json');
```

#### Example 2: Setup Directories (TypeScript)

```typescript
import * as fs from 'fs';

const dir = './security';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('Created security/ directory');
}
```

### Execution Order

1. Content is downloaded from GitHub (including referenced script files)
2. Security scan runs on all script files
3. Script files are saved to the download directory
4. CMD array is executed via `spawn(cmd[0], cmd[1:])`
5. `before-*` hook failures stop the current item operation
6. `post-*` hook failures are reported, but the completed operation remains in place

For backward compatibility, `post_install_script` is still read as `hooks["post-install"]`, but new content should use `hooks`.

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

## Lock Files

Every installed skill and command gets a **lock file** written next to it. This makes content trackable, manageable, and compatible with future tooling.

### Skill Lock File

When a skill is installed to `~/.config/opencode/skills/api-testing/`, a `.skill-lock.json` is created alongside it:

```json
{
  "schema_version": "1.0",
  "name": "api-testing",
  "type": "skill",
  "version": "1.2.0",
  "installed_at": "2026-05-22T10:00:00.000Z",
  "source": {
    "url": "https://raw.githubusercontent.com/xjtuwangke/ai-hub/main/skills/api-testing",
    "repo": "xjtuwangke/ai-hub",
    "path": "skills/api-testing"
  },
  "installed_by": "ai-hub",
  "installer_version": "1.0.0",
  "agents": ["opencode", "codex"],
  "dependencies": ["test-automation"],
  "tags": ["qa", "dev", "testing"],
  "hooks": {
    "post-install": {
      "cmd": ["node", "post-install.js"],
      "description": "Creates sample config and test files"
    }
  }
}
```

### Command Lock File

Commands get a `.command-lock.json` in the command directory (e.g., `~/.config/opencode/command/.command-lock.json`):

```json
{
  "schema_version": "1.0",
  "name": "/test-plan",
  "type": "command",
  "version": "1.3.0",
  "installed_at": "2026-05-22T10:00:00.000Z",
  "source": {
    "url": "https://raw.githubusercontent.com/xjtuwangke/ai-hub/main/commands/test-plan"
  },
  "installed_by": "ai-hub",
  "agents": ["opencode", "claude"],
  "dependencies": ["api-testing", "test-automation"],
  "tags": ["testing", "qa", "plan"]
}
```

### Why Lock Files Matter

1. **Traceability**: Know exactly what was installed, when, and from where
2. **Management**: Future tools (including `npx skills`) can read `.skill-lock.json` to manage content
3. **Uninstall**: `ai-hub uninstall` reads lock files to precisely remove content
4. **Update**: Compare lock file version against remote catalog to detect updates
5. **Compatibility**: Standard format that any AI agent tool can understand

### Lock File Schema

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | string | Lock file format version |
| `name` | string | Content name |
| `type` | string | `skill`, `command`, or `mcp` |
| `version` | string | Installed version |
| `installed_at` | string | ISO 8601 timestamp |
| `source.url` | string | Raw GitHub URL |
| `installed_by` | string | Tool that installed it |
| `installer_version` | string | Tool version |
| `agents` | string[] | Target AI agents |
| `dependencies` | string[] | Dependency skills (optional) |
| `tags` | string[] | Content tags (optional) |
| `hooks` | object | Lifecycle hook scripts by event (optional) |

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
