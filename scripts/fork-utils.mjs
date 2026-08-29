import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const config = JSON.parse(
  readFileSync(resolve(root, "fork.config.json"), "utf8"),
);

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.error) throw result.error;

  const stdout = result.stdout?.trim() ?? "";
  const stderr = result.stderr?.trim() ?? "";
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(stderr || stdout || `${command} 执行失败（${result.status}）`);
  }

  return { status: result.status ?? 1, stdout, stderr };
}

export function runGit(args, options = {}) {
  return runCommand("git", args, options);
}

function githubRepository(value) {
  const match = value.match(/github\.com(?::|\/)([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match?.[1]?.replace(/\.git$/i, "").toLowerCase();
}

export function ensureUpstreamRemote() {
  const { remote, repository, url } = config.directUpstream;
  const remotes = runGit(["remote"]).stdout.split("\n").filter(Boolean);

  if (!remotes.includes(remote)) {
    runGit(["remote", "add", remote, url]);
    return { added: true, remote, url };
  }

  const currentUrl = runGit(["remote", "get-url", remote]).stdout;
  if (githubRepository(currentUrl) !== repository.toLowerCase()) {
    throw new Error(
      `Git remote ${remote} 当前指向 ${currentUrl}，预期为 ${url}。为避免覆盖现有配置，脚本已停止。`,
    );
  }

  return { added: false, remote, url: currentUrl };
}

export function fetchUpstream() {
  const { remote } = config.directUpstream;
  return runGit(["fetch", "--prune", remote], { stdio: "inherit" });
}

export function upstreamRef() {
  const { remote, branch } = config.directUpstream;
  return `${remote}/${branch}`;
}

export function currentBranch() {
  return runGit(["branch", "--show-current"]).stdout;
}

export function requireCleanWorktree() {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"])
    .stdout;
  if (status) {
    throw new Error(
      `工作区不干净，不能开始上游同步：\n${status}\n请先提交、暂存到其他位置或处理这些改动。`,
    );
  }
}

export function refExists(ref) {
  return runGit(["rev-parse", "--verify", "--quiet", ref], {
    allowFailure: true,
  }).status === 0;
}

export function readJsonAtRef(ref, path) {
  const result = runGit(["show", `${ref}:${path}`], { allowFailure: true });
  if (result.status !== 0) return undefined;
  return JSON.parse(result.stdout);
}

export function getUpstreamStatus() {
  const ref = upstreamRef();
  if (!refExists(ref)) {
    throw new Error(`找不到 ${ref}，请先获取直接上游。`);
  }

  const mergeBase = runGit(["merge-base", "HEAD", ref]).stdout;
  const localSha = runGit(["rev-parse", "HEAD"]).stdout;
  const upstreamSha = runGit(["rev-parse", ref]).stdout;
  const ahead = Number(runGit(["rev-list", "--count", `${ref}..HEAD`]).stdout);
  const behind = Number(runGit(["rev-list", "--count", `HEAD..${ref}`]).stdout);
  const incomingLog = runGit([
    "log",
    "--oneline",
    "--no-decorate",
    `${mergeBase}..${ref}`,
  ]).stdout;
  const changedOutput = runGit([
    "diff",
    "--name-status",
    `${mergeBase}..${ref}`,
  ]).stdout;
  const changes = changedOutput
    ? changedOutput.split("\n").map((line) => {
        const [status, ...paths] = line.split("\t");
        return { status, paths };
      })
    : [];

  return {
    ref,
    mergeBase,
    localSha,
    upstreamSha,
    ahead,
    behind,
    incomingLog,
    changes,
  };
}

export function needsReview(path) {
  return config.reviewPaths.some((rule) =>
    rule.endsWith("/") ? path.startsWith(rule) : path === rule,
  );
}

export function shortSha(sha) {
  return sha.slice(0, 7);
}

export function pathExists(path) {
  return existsSync(resolve(root, path));
}
