import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
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
