# Fork 扩展与上游同步策略

本仓库是 [`vinvcn/mattpocock-skills-zh-CN`](https://github.com/vinvcn/mattpocock-skills-zh-CN) 的功能扩展 fork。直接上游已经负责把 [`mattpocock/skills`](https://github.com/mattpocock/skills) 本地化为简体中文；本仓库在此基础上增加 Pi Package、配置选择和 Claude Code 精选安装能力。

## 上游关系

| 角色 | 仓库 | Git remote | 用途 |
| --- | --- | --- | --- |
| 本仓库 | `legdonkey/mattpocock-skills-zh-CN` | `origin` | 发布和维护本地扩展 |
| 直接上游 | `vinvcn/mattpocock-skills-zh-CN` | `upstream` | 日常同步目标 |
| 源上游 | `mattpocock/skills` | `source`（按需配置） | 英文原始内容，仅用于追溯或直接上游缺失内容时的兜底刷新 |

普通同步只跟踪 `upstream/main`。不要绕过直接上游，把 `source/main` 直接合并进本仓库。

## 必须保留的本地能力

| 能力 | 关键文件 | 不变量 |
| --- | --- | --- |
| Pi Package 支持 | `package.json` | `pi.extensions` 加载两个本地 extension，`pi.skills` 保持为空 |
| Pi 精选与全量配置 | `pi-profiles.json`、`extensions/pi-skill-profiles.ts` | 默认精选 13 个；全量自动覆盖 Engineering 和 Productivity 的稳定 skills |
| Claude Code 斜杠命令兼容 | `extensions/pi_slash_compatible.ts` | Pi 中的 `/clear` 开始新会话；当前 profile 内的 `/<skill-name>` 转发到 `/skill:<skill-name>` |
| Claude Code 精选安装 | `.claude-plugin/plugin.json` | `skills` 与 `pi-profiles.json.curated` 完全一致 |
| Fork 安装身份 | README、plugin manifest、维护规则 | 用户安装地址始终为 `legdonkey/mattpocock-skills-zh-CN` |
| 版本策略 | `package.json`、`.claude-plugin/plugin.json` | 两者版本一致，并跟随直接上游版本；不为本地打包改动单独升版 |

机器可读配置位于 [`fork.config.json`](./fork.config.json)，自动校验位于 `scripts/check-fork.mjs` 和 `scripts/check-pi-package.mjs`。

## 文件归属

### 以上游内容为主

- `skills/`
- `docs/`
- `.out-of-scope/`
- 上游新增的内容文件和 skill 支持文件

同步这些路径时，原则上接受直接上游内容；如果本地也修改过同一文件，按实际语义解决冲突。

### 本地扩展为主

- `FORK.md`
- `fork.config.json`
- `package.json`
- `pi-profiles.json`
- `extensions/`
- `scripts/check-fork.mjs`
- `scripts/check-pi-package.mjs`
- `scripts/fork-utils.mjs`
- `scripts/upstream-check.mjs`
- `scripts/upstream-sync.mjs`

直接上游通常没有这些文件。同步时不得因为上游目录结构变化而删除它们。

### 每次同步必须人工复核

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.claude-plugin/`
- `.skills/translate-skill/`
- `scripts/`

这些文件同时承载上游内容和本地安装、打包策略。同步脚本会在上游触碰这些路径时单独提示。

## 一键检查上游

```bash
npm run upstream:check
```

该命令会：

1. 检查 `upstream` remote；不存在时自动添加为 `vinvcn/mattpocock-skills-zh-CN`。
2. 获取 `upstream/main`。
3. 报告本地领先提交、待同步提交、上次纳入的上游 commit 和版本差异。
4. 列出上游改动文件，并标记需要重点复核的路径。
5. 不修改工作区、不创建 commit、不 push。

## 一键准备同步

先保证位于 `main` 且工作区干净，然后运行：

```bash
npm run upstream:sync
```

该命令会：

1. fetch `upstream`。
2. 创建 `sync/vinvcn-<upstream-short-sha>` 分支。
3. 以 `--no-commit` 合并 `upstream/main`。
4. 没有冲突时自动运行 `npm run check`。
5. 保留合并结果供人工检查，不自动 commit 或 push。

如果出现冲突，脚本会停在同步分支上并保留现场。解决冲突后运行：

```bash
git add -A
npm run check
git commit -m "chore: 同步 vinvcn 上游 <sha>"
```

检查通过后再把同步分支合并到 `main`。任何时候都不要为了让检查通过而移除本地扩展能力。

## 完整校验

```bash
npm run check
```

它会检查：

- Markdown、frontmatter、安装路径和许可证不变量。
- Pi 精选 13 个与全量配置完整性。
- Claude Code plugin 只提供精选配置。
- Fork 安装地址、版本策略、Pi extensions 和本地维护文件。
- Git patch whitespace。

Claude Code CLI 可用时，再运行原生 manifest 校验：

```bash
npm run check:claude
```

## 源上游兜底刷新

只有当直接上游尚未本地化某项内容、且维护者决定自行从 `mattpocock/skills` 刷新时，才使用 `.skills/translate-skill/SKILL.md`。这种刷新不是普通 fork 同步，必须单独审查翻译结果，并保留本文件定义的全部本地能力。
