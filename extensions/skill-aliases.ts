import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface PackageManifest {
  pi?: {
    skills?: string[];
  };
}

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageManifest = JSON.parse(
  readFileSync(packageJsonPath, "utf8"),
) as PackageManifest;
const skillNames = (packageManifest.pi?.skills ?? []).map((skillPath) =>
  basename(skillPath),
);

export default function (pi: ExtensionAPI) {
  for (const name of skillNames) {
    pi.registerCommand(name, {
      description: `加载 ${name} skill（等同于 /skill:${name}）`,
      handler: async (args, ctx) => {
        const suffix = args.trim();
        const command = `/skill:${name}${suffix ? ` ${suffix}` : ""}`;

        if (ctx.isIdle()) {
          pi.sendUserMessage(command, { expandPromptTemplates: true });
          return;
        }

        pi.sendUserMessage(command, {
          deliverAs: "followUp",
          expandPromptTemplates: true,
        });
        ctx.ui.notify(`已排队：/${name}`, "info");
      },
    });
  }

  pi.registerCommand("clear", {
    description: "开始新会话（兼容 Claude Code 的 /clear）",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      const result = await ctx.newSession();
      if (result.cancelled) {
        ctx.ui.notify("新会话已取消", "warning");
      }
    },
  });
}
