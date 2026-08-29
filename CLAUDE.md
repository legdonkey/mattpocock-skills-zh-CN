Skills 按 bucket folder 组织在 `skills/` 下：

- `engineering/` - 日常代码工作
- `productivity/` - 日常非代码工作流工具
- `misc/` - 保留但很少使用
- `in-progress/` - beta：有意公开、欢迎反馈，但不随 plugin 发布
- `deprecated/` - 不再使用

`engineering/`、`productivity/` 或 `misc/` 中的每个 skill，都必须在顶层 `README.md` 中有引用。`.claude-plugin/plugin.json` 只发布 `pi-profiles.json` 中 `curated` 配置列出的 13 个精选 skills，并且两份清单必须完全一致。`in-progress/` 和 `deprecated/` 中的 skills 不得出现在 plugin 或顶层公开索引中。

顶层 `README.md` 中的每个 skill 条目都必须把 skill 名称链接到对应的 `SKILL.md`。

每个 bucket folder 都有一个 `README.md`，列出该 bucket 中的所有 skills，并给出一行描述；skill 名称需要链接到对应的 `SKILL.md`。Bucket `README.md` 和顶层 `README.md` 都按 **User-invoked** 与 **Model-invoked** 分组。

每个 `SKILL.md` 要么是 user-invoked（frontmatter 中设置 `disable-model-invocation: true`，并在 `agents/openai.yaml` 中设置 `policy.allow_implicit_invocation: false`，只能由人类显式调用），要么是 model-invoked（模型和用户都可以调用）。完整定义、description 约定，以及为什么 user-invoked skill 可以调用 model-invoked skills 但不能调用另一个 user-invoked skill，见 [docs/invocation.md](./docs/invocation.md)。

本仓库也是一个单 plugin 的 Claude Code marketplace：`.claude-plugin/marketplace.json` 列出唯一的 `mattpocock-skills` plugin，默认只提供 13 个精选 skills，不提供完整配置。修改 `.claude-plugin/plugin.json` 或 marketplace manifest 后，运行 `npm run check` 和 `npm run check:claude`。Plugin 版本必须与直接上游保持同步，不因本地打包或清单调整而单独提升。

## 上游同步

本仓库的直接上游是 `vinvcn/mattpocock-skills-zh-CN`，英文源上游是 `mattpocock/skills`。开始任何上游同步前必须完整阅读 [`FORK.md`](./FORK.md)，使用 `npm run upstream:check` 检查，使用 `npm run upstream:sync` 创建同步分支并准备合并。同步时必须保留 Pi Package、精选/全量配置、Claude Code 精选 13 个、`legdonkey` 安装身份和版本跟随策略。

普通同步只合并直接上游，不重新翻译已经本地化的内容。只有明确决定直接从 `mattpocock/skills` 补充英文源内容时，才先使用 `.skills/translate-skill/SKILL.md`，并把它作为独立的翻译刷新处理。
