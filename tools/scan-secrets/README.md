# scan-secrets Tool

Standalone secret scanner extracted into the `tools/` workspace.

## 运行方式

```bash
cd /Volumes/External/work/ai-hub/tools/scan-secrets
npm run build
node bin/scan-secrets --help
node dist/index.js --help
```

也可以直接调用已编译产物（仓库根目录）：

```bash
node tools/scan-secrets/dist/index.js -p .
```

## 常用命令

```bash
# 扫描当前目录
node dist/index.js

# 指定规则文件
node dist/index.js -r ../../secret-scan-rules.example.yaml

# 使用插件目录
node dist/index.js --plugin-dir ./my-plugins

# 仅扫描 git 变更
node dist/index.js --git-diff
node dist/index.js --git-diff main --git-diff-staged

# 输出 JSON/SARIF
node dist/index.js --json
node dist/index.js --sarif
node dist/index.js --output result.json --format json

# 启用缓存、基线与严格模式
node dist/index.js --cache --cache-path .ai-hub-secret-scan-cache.json
node dist/index.js --baseline .secret-scan-baseline.json
node dist/index.js --strict
```

## 与根仓库联动

主仓库 `ai-hub scan-secrets` 命令仍可用；`tools/scan-secrets` 是同一逻辑的独立运行包。

## 目录约定

- `src/index.ts`：CLI 入口
- `src/secret-scan/*`：扫描核心（规则、检测器、输出、缓存）
- `dist/`：编译产物

## 示例输入

- `secret-scan-rules.example.yaml`（仓库根目录）
- `secret-scan-plugin.example.js`（仓库根目录）
