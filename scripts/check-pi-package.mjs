#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const packageManifest = readJson("package.json");
const claudePlugin = readJson(".claude-plugin/plugin.json");

const excludedForPi = new Set([
  "./skills/misc/git-guardrails-claude-code",
]);
const expectedSkills = claudePlugin.skills.filter(
  (skillPath) => !excludedForPi.has(skillPath),
);
const actualSkills = packageManifest.pi?.skills ?? [];
const errors = [];

if (new Set(actualSkills).size !== actualSkills.length) {
  errors.push("package.json 的 pi.skills 存在重复项");
}

if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
  errors.push(
    "package.json 的 pi.skills 未与 Claude 稳定清单同步（扣除 Pi 排除项后）",
  );
}

for (const skillPath of actualSkills) {
  if (!existsSync(resolve(root, skillPath, "SKILL.md"))) {
    errors.push(`缺少 skill 文件：${skillPath}/SKILL.md`);
  }
}

for (const extensionPath of packageManifest.pi?.extensions ?? []) {
  if (!existsSync(resolve(root, extensionPath))) {
    errors.push(`缺少 extension 文件：${extensionPath}`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Pi Package 校验通过：${actualSkills.length} 个 skills，${packageManifest.pi.extensions.length} 个 extension。`,
);
