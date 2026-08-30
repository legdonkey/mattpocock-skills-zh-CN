import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ACTIVE_SKILL_PATHS_EVENT } from "./pi_slash_compatible.ts";

type ProfileName = "curated" | "all";

interface Profiles {
  curated: string[];
  all: string[];
}

const packageRoot = resolve(
  dirname(fileURLToPath(new URL("../package.json", import.meta.url))),
);
const profilesPath = join(packageRoot, "pi-profiles.json");

function readProfiles(): Profiles {
  try {
    return JSON.parse(readFileSync(profilesPath, "utf8")) as Profiles;
  } catch (error) {
    throw new Error(`读取 Pi skill profiles 失败：${profilesPath}`, {
      cause: error,
    });
  }
}

const profiles = readProfiles();
const configDir =
  process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
const configPath = join(configDir, "mattpocock-skills.json");

function readSavedProfile(): ProfileName | undefined {
  try {
    const profile = (
      JSON.parse(readFileSync(configPath, "utf8")) as { profile?: unknown }
    ).profile;
    return profile === "curated" || profile === "all" ? profile : undefined;
  } catch {
    return undefined;
  }
}

function saveProfile(profile: ProfileName): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    configPath,
    `${JSON.stringify({ profile }, null, 2)}\n`,
    "utf8",
  );
}

function parseProfileArgument(args: string): ProfileName | undefined {
  const value = args.trim().toLowerCase();
  if (["a", "curated", "精选"].includes(value)) return "curated";
  if (["b", "all", "全部"].includes(value)) return "all";
  return undefined;
}

const profileLabels = {
  curated: `A. 精选（${profiles.curated.length} 个）`,
  all: `B. 全部（${profiles.all.length} 个）`,
} satisfies Record<ProfileName, string>;

export default function (pi: ExtensionAPI) {
  let selectedProfile = readSavedProfile();

  pi.on("session_start", async (_event, ctx) => {
    if (!selectedProfile) {
      if (ctx.mode === "tui") {
        const choice = await ctx.ui.select("选择 Matt Pocock Skills 配置", [
          profileLabels.curated,
          profileLabels.all,
        ]);

        if (choice) {
          selectedProfile = choice === profileLabels.all ? "all" : "curated";
          try {
            saveProfile(selectedProfile);
          } catch (error) {
            ctx.ui.notify(`保存配置失败：${String(error)}`, "warning");
          }
        }
      }

      selectedProfile ??= "curated";
    }
  });

  pi.on("resources_discover", () => {
    const skillPaths = profiles[selectedProfile ?? "curated"].map((skillPath) =>
      resolve(packageRoot, skillPath),
    );
    pi.events.emit(ACTIVE_SKILL_PATHS_EVENT, { skillPaths });
    return { skillPaths };
  });

  pi.registerCommand("mattpocock-profile", {
    description: "切换 Matt Pocock Skills 配置：curated 或 all",
    handler: async (args, ctx) => {
      let profile = parseProfileArgument(args);

      if (!profile && ctx.hasUI) {
        const choice = await ctx.ui.select("选择 Matt Pocock Skills 配置", [
          profileLabels.curated,
          profileLabels.all,
        ]);
        if (!choice) return;
        profile = choice === profileLabels.all ? "all" : "curated";
      }

      if (!profile) {
        ctx.ui.notify("用法：/mattpocock-profile curated|all", "warning");
        return;
      }

      if (profile === selectedProfile) {
        ctx.ui.notify(`当前已经是${profileLabels[profile]}`, "info");
        return;
      }

      try {
        saveProfile(profile);
      } catch (error) {
        ctx.ui.notify(`保存配置失败：${String(error)}`, "error");
        return;
      }

      await ctx.reload();
      return;
    },
  });
}
