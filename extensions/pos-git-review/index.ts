// POS Git 代码 Review 插件入口
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type } from "typebox";
import { createPosGitReviewTool, posGitReviewToolDef } from "./src/pos-git-review-tool.js";

export default defineToolPlugin({
  id: "pos-git-review",
  name: "POS Git 代码 Review",
  description:
    "根据 gygd_pos 的 git commit/branch/tag 生成代码 review 与 POS 修改建议，只给反馈，不实际修改代码。",
  configSchema: Type.Object(
    {
      medAiAgentBaseUrl: Type.Optional(
        Type.String({
          default: "http://localhost:8080",
          description: "med_ai_agent 后端地址",
        }),
      ),
      defaultPosRepoPath: Type.Optional(
        Type.String({
          default: "C:/Users/haoming/IdeaProjects/gygd_pos",
          description: "默认 gygd_pos 仓库路径",
        }),
      ),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      ...posGitReviewToolDef,
      optional: true,
      factory: ({ config }) =>
        createPosGitReviewTool(
          (config ?? {}) as { medAiAgentBaseUrl?: string; defaultPosRepoPath?: string },
        ),
    }),
  ],
});
