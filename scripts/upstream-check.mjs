#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  config,
  currentBranch,
  ensureUpstreamRemote,
  fetchUpstream,
  getUpstreamStatus,
  needsReview,
  readJsonAtRef,
  root,
  shortSha,
} from "./fork-utils.mjs";

try {
  const remote = ensureUpstreamRemote();
  if (remote.added) {
    console.log(`已添加直接上游 remote：${remote.remote} -> ${remote.url}`);
  }

  console.log(`正在获取 ${config.directUpstream.repository}...`);
  fetchUpstream();

  const status = getUpstreamStatus();
  const localPlugin = JSON.parse(
    readFileSync(resolve(root, ".claude-plugin/plugin.json"), "utf8"),
  );
  const upstreamPlugin = readJsonAtRef(
    status.ref,
    ".claude-plugin/plugin.json",
  );
  const reviewChanges = status.changes.filter((change) =>
    change.paths.some(needsReview),
  );

  console.log("\n上游追踪状态");
  console.log(`- 当前分支：${currentBranch() || "detached HEAD"}`);
  console.log(`- 本地 HEAD：${shortSha(status.localSha)}`);
  console.log(`- 直接上游：${status.ref}@${shortSha(status.upstreamSha)}`);
  console.log(`- 已纳入上游基线：${shortSha(status.mergeBase)}`);
  console.log(`- 本地领先：${status.ahead} 个 commit`);
  console.log(`- 待同步：${status.behind} 个 commit`);

  if (upstreamPlugin?.version) {
    const versionState =
      localPlugin.version === upstreamPlugin.version ? "一致" : "需要同步";
    console.log(
      `- 版本：本地 ${localPlugin.version} / 上游 ${upstreamPlugin.version}（${versionState}）`,
    );
  }

  if (status.behind === 0) {
    console.log("\n当前已经包含直接上游的全部提交。工作区未被修改。");
    process.exit(0);
  }

  console.log("\n待同步提交：");
  console.log(status.incomingLog || "（没有可显示的提交）");

  console.log("\n上游改动文件：");
  for (const change of status.changes) {
    const marker = change.paths.some(needsReview) ? " [需复核]" : "";
    console.log(`- ${change.status}\t${change.paths.join(" -> ")}${marker}`);
  }

  if (reviewChanges.length > 0) {
    console.log(
      `\n有 ${reviewChanges.length} 项改动触碰本地策略文件，执行同步后必须人工复核。`,
    );
  }
  console.log("\n运行 npm run upstream:sync 可创建同步分支并准备合并。工作区未被修改。");
} catch (error) {
  console.error(`上游检查失败：${error.message}`);
  process.exit(1);
}
