#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const packageManifest = readJson("package.json");
const claudePlugin = readJson(".claude-plugin/plugin.json");
const profiles = readJson("pi-profiles.json");
const errors = [];

const includedCategories = [
  "./skills/engineering",
  "./skills/productivity",
];
const expectedAll = includedCategories
  .flatMap((category) =>
    readdirSync(resolve(root, category), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(resolve(root, category, entry.name, "SKILL.md")),
      )
      .map((entry) => `${category}/${entry.name}`),
  )
  .sort();
const curated = profiles.curated ?? [];
const all = profiles.all ?? [];
const claudeSkills = claudePlugin.skills ?? [];

if ((packageManifest.pi?.skills ?? []).length !== 0) {
  errors.push("package.json 的 pi.skills 必须为空，skills 应由配置 extension 动态加载");
}

if (JSON.stringify(all) !== JSON.stringify(expectedAll)) {
  errors.push(
    "pi-profiles.json 的 all 未与 Engineering、Productivity 目录中的稳定 skills 同步",
  );
}

if (JSON.stringify(claudeSkills) !== JSON.stringify(curated)) {
  errors.push(
    ".claude-plugin/plugin.json 的 skills 必须与 pi-profiles.json 的 curated 配置一致",
  );
}

if (curated.length !== 13) {
  errors.push(`精选配置应为 13 个 skills，当前为 ${curated.length} 个`);
}

for (const [profileName, skillPaths] of Object.entries({ curated, all })) {
  if (new Set(skillPaths).size !== skillPaths.length) {
    errors.push(`${profileName} 配置存在重复项`);
  }

  for (const skillPath of skillPaths) {
    if (!all.includes(skillPath)) {
      errors.push(`${profileName} 包含不在 all 配置中的 skill：${skillPath}`);
    }
    if (!existsSync(resolve(root, skillPath, "SKILL.md"))) {
      errors.push(`缺少 skill 文件：${skillPath}/SKILL.md`);
    }
  }
}

if (!curated.includes("./skills/engineering/setup-matt-pocock-skills")) {
  errors.push("精选配置必须包含 setup-matt-pocock-skills");
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
  `Pi Package 校验通过：精选 ${curated.length} 个，全部 ${all.length} 个，${packageManifest.pi.extensions.length} 个 extension。`,
);
