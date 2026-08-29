#!/usr/bin/env node

import {
  config,
  currentBranch,
  ensureUpstreamRemote,
  fetchUpstream,
  getUpstreamStatus,
  refExists,
  requireCleanWorktree,
  runCommand,
  runGit,
  shortSha,
} from "./fork-utils.mjs";

try {
  requireCleanWorktree();

  const branch = currentBranch();
  if (branch !== config.integrationBranch) {
    throw new Error(
      `必须从 ${config.integrationBranch} 分支开始同步，当前分支为 ${branch || "detached HEAD"}。`,
    );
  }

  const remote = ensureUpstreamRemote();
  if (remote.added) {
    console.log(`已添加直接上游 remote：${remote.remote} -> ${remote.url}`);
  }

  console.log(`正在获取 ${config.directUpstream.repository}...`);
  fetchUpstream();

  const status = getUpstreamStatus();
  if (status.behind === 0) {
    console.log(
      `当前已经包含 ${status.ref}@${shortSha(status.upstreamSha)}，无需同步。`,
    );
    process.exit(0);
  }

  const syncBranch = `sync/vinvcn-${shortSha(status.upstreamSha)}`;
  if (refExists(`refs/heads/${syncBranch}`)) {
    throw new Error(
      `同步分支 ${syncBranch} 已存在。请先检查该分支，不会覆盖或复用它。`,
    );
  }

  runGit(["switch", "-c", syncBranch], { stdio: "inherit" });
  console.log(`正在以不自动提交的方式合并 ${status.ref}...`);
  const merge = runGit(
    ["merge", "--no-ff", "--no-commit", status.ref],
    { allowFailure: true, stdio: "inherit" },
  );

  if (merge.status !== 0) {
    console.error(
      "\n上游合并存在冲突。脚本已保留同步分支和冲突现场，没有自动覆盖、提交或 push。",
    );
    console.error("请按 FORK.md 解决冲突，然后运行：git add -A && npm run check");
    process.exit(1);
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log("\n合并已准备完成，正在运行完整校验...");
  const check = runCommand(npm, ["run", "check"], {
    allowFailure: true,
    stdio: "inherit",
  });

  if (check.status !== 0) {
    console.error(
      "\n合并没有冲突，但本地不变量校验失败。结果已保留且尚未提交。",
    );
    console.error("请按错误提示修复，随后运行：git add -A && npm run check");
    process.exit(1);
  }

  console.log("\n同步分支已准备好，所有校验通过，但尚未提交或 push。");
  console.log("建议先检查 git diff --cached 和 git status，然后执行：");
  console.log(
    `git commit -m "chore: 同步 vinvcn 上游 ${shortSha(status.upstreamSha)}"`,
  );
} catch (error) {
  console.error(`上游同步失败：${error.message}`);
  process.exit(1);
}
