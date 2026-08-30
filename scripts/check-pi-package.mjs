#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => {
  const absolutePath = resolve(root, path);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`读取 JSON 失败：${absolutePath}`, { cause: error });
  }
};
const packageManifest = readJson("package.json");
const claudePlugin = readJson(".claude-plugin/plugin.json");
const profiles = readJson("pi-profiles.json");
const profileExtension = readFileSync(
  resolve(root, "extensions/pi-skill-profiles.ts"),
  "utf8",
);
const slashCompatibilityExtension = readFileSync(
  resolve(root, "extensions/pi_slash_compatible.ts"),
  "utf8",
);
const clearCompatibilityExtension = readFileSync(
  resolve(root, "extensions/claude-clear.ts"),
  "utf8",
);
const errors = [];

const includedCategories = ["./skills/engineering", "./skills/productivity"];
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
  errors.push(
    "package.json 的 pi.skills 必须为空，skills 应由配置 extension 动态加载",
  );
}

const expectedPiExtensions = [
  "./extensions/pi-skill-profiles.ts",
  "./extensions/pi_slash_compatible.ts",
  "./extensions/claude-clear.ts",
];
if (
  JSON.stringify(packageManifest.pi?.extensions ?? []) !==
  JSON.stringify(expectedPiExtensions)
) {
  errors.push(
    "package.json 必须加载 profile、skill 斜杠与 /clear 兼容 extensions",
  );
}

if (
  !profileExtension.includes(
    "pi.events.emit(ACTIVE_SKILL_PATHS_EVENT, { skillPaths })",
  )
) {
  errors.push("skill 斜杠兼容命令必须直接使用当前 profile 返回的 skillPaths");
}

for (const requiredSource of [
  "pi.events.on(ACTIVE_SKILL_PATHS_EVENT",
  "pi.registerCommand(skillName",
  "`/skill:${skillName}",
  "expandPromptTemplates: true",
]) {
  if (!slashCompatibilityExtension.includes(requiredSource)) {
    errors.push(`Pi 斜杠命令兼容 extension 缺少实现：${requiredSource}`);
  }
}

for (const requiredSource of [
  'pi.registerCommand("clear"',
  "ctx.newSession()",
]) {
  if (!clearCompatibilityExtension.includes(requiredSource)) {
    errors.push(`Claude /clear 兼容 extension 缺少实现：${requiredSource}`);
  }
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
    const skillFile = resolve(root, skillPath, "SKILL.md");
    if (!existsSync(skillFile)) {
      errors.push(`缺少 skill 文件：${skillPath}/SKILL.md`);
      continue;
    }

    const frontmatterName = readFileSync(skillFile, "utf8").match(
      /^name:\s*([^\s"']+)\s*$/m,
    )?.[1];
    const directoryName = basename(skillPath);
    if (frontmatterName !== directoryName) {
      errors.push(
        `skill 目录名必须与 frontmatter name 一致，以生成斜杠别名：${skillPath}`,
      );
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
  process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Pi Package 校验通过：精选 ${curated.length} 个，全部 ${all.length} 个，${packageManifest.pi.extensions.length} 个 extension。\n`,
);
