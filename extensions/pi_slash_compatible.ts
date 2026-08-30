import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const ACTIVE_SKILL_PATHS_EVENT = "mattpocock-skills:active-skill-paths";

interface ActiveSkillPathsEvent {
  skillPaths: string[];
}

export function registerSkillSlashCommands(
  pi: ExtensionAPI,
  skillPaths: string[],
): void {
  const skillNames = new Set(
    skillPaths.map((skillPath) => basename(skillPath)),
  );

  for (const skillName of skillNames) {
    pi.registerCommand(skillName, {
      description: `调用 ${skillName} skill（/skill:${skillName} 的短别名）`,
      handler: (args, ctx) => {
        const trimmedArgs = args.trim();
        const command = `/skill:${skillName}${trimmedArgs ? ` ${trimmedArgs}` : ""}`;

        if (ctx.isIdle()) {
          pi.sendUserMessage(command, { expandPromptTemplates: true });
        } else {
          pi.sendUserMessage(command, {
            deliverAs: "followUp",
            expandPromptTemplates: true,
          });
        }

        return Promise.resolve();
      },
    });
  }
}

export default function (pi: ExtensionAPI) {
  pi.events.on(ACTIVE_SKILL_PATHS_EVENT, (data) => {
    const { skillPaths } = data as ActiveSkillPathsEvent;
    registerSkillSlashCommands(pi, skillPaths);
  });
}
