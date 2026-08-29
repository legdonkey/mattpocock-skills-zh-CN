#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  config,
  readJsonAtRef,
  refExists,
  root,
  upstreamRef,
} from "./fork-utils.mjs";

const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const readText = (path) => readFileSync(resolve(root, path), "utf8");
const errors = [];
const fail = (message) => errors.push(message);

const packageManifest = readJson("package.json");
const pluginManifest = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");
const profiles = readJson("pi-profiles.json");
const readme = readText("README.md");
const agents = readText("AGENTS.md");
const claude = readText("CLAUDE.md");

const expectedRepository = config.installRepository;
const expectedGitUrl = `https://github.com/${expectedRepository}.git`;
const expectedWebUrl = `https://github.com/${expectedRepository}`;

if (packageManifest.repository?.url !== expectedGitUrl) {
  fail(`package.json repository 必须为 ${expectedGitUrl}`);
}
if (pluginManifest.repository !== expectedWebUrl) {
  fail(`.claude-plugin/plugin.json repository 必须为 ${expectedWebUrl}`);
}
if (packageManifest.version !== pluginManifest.version) {
  fail(
    `package.json 与 Claude plugin 版本必须一致：${packageManifest.version} != ${pluginManifest.version}`,
  );
}

if ((profiles.curated ?? []).length !== config.curatedSkillCount) {
  fail(
    `精选配置应为 ${config.curatedSkillCount} 个 skills，当前为 ${(profiles.curated ?? []).length} 个`,
  );
}
if (
  JSON.stringify(pluginManifest.skills ?? []) !==
  JSON.stringify(profiles.curated ?? [])
) {
  fail("Claude Code plugin skills 必须与 pi-profiles.json.curated 完全一致");
}
if (
  JSON.stringify(packageManifest.pi?.extensions ?? []) !==
  JSON.stringify(config.piExtensions)
) {
  fail("package.json pi.extensions 未与 fork.config.json 保持一致");
}
if ((packageManifest.pi?.skills ?? []).length !== 0) {
  fail("package.json pi.skills 必须为空，由 skill profile extension 动态加载");
}

if (marketplace.plugins?.length !== 1) {
  fail("Claude Code marketplace 必须只发布一个精选 plugin");
} else if (
  marketplace.plugins[0].name !== pluginManifest.name ||
  marketplace.plugins[0].source !== "./"
) {
  fail("Marketplace plugin 必须从仓库根目录发布 mattpocock-skills");
}

const requiredInstallSnippets = [
  `npx skills@latest add ${expectedRepository}`,
  `/plugin marketplace add ${expectedRepository}`,
  `claude plugin marketplace add ${expectedRepository}`,
  `pi install git:github.com/${expectedRepository}`,
];
for (const snippet of requiredInstallSnippets) {
  if (!readme.includes(snippet)) {
    fail(`README.md 缺少安装入口：${snippet}`);
  }
}

const directUpstream = config.directUpstream.repository;
const staleInstallLines = readme
  .split("\n")
  .filter((line) =>
    /npx skills@latest add|plugin marketplace add|pi install git:github\.com|skills\.sh\//.test(
      line,
    ),
  )
  .filter((line) => line.includes(directUpstream));
if (staleInstallLines.length > 0) {
  fail(`README.md 仍有指向直接上游的安装入口：${staleInstallLines.join(" | ")}`);
}

for (const path of config.requiredLocalPaths) {
  if (!existsSync(resolve(root, path))) {
    fail(`缺少 fork 本地维护文件：${path}`);
  }
}

for (const [path, text] of [
  ["README.md", readme],
  ["AGENTS.md", agents],
  ["CLAUDE.md", claude],
]) {
  if (!text.includes("FORK.md")) {
    fail(`${path} 必须链接或指向 FORK.md`);
  }
}

if (config.versionPolicy !== "follow-direct-upstream") {
  fail("fork.config.json versionPolicy 必须为 follow-direct-upstream");
}

const fetchedUpstreamRef = upstreamRef();
if (refExists(fetchedUpstreamRef)) {
  const upstreamPlugin = readJsonAtRef(
    fetchedUpstreamRef,
    ".claude-plugin/plugin.json",
  );
  if (
    upstreamPlugin?.version &&
    pluginManifest.version !== upstreamPlugin.version
  ) {
    fail(
      `本地版本 ${pluginManifest.version} 未跟随已获取的直接上游版本 ${upstreamPlugin.version}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Fork 校验通过：安装仓库 ${expectedRepository}，版本 ${pluginManifest.version}，Claude 精选 ${profiles.curated.length} 个。`,
);
