// 码上放心门店同步插件入口
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type } from "typebox";
import { createMsfxSyncStoresTool, msfxSyncStoresToolDef } from "./src/msfx-sync-stores-tool.js";

export default defineToolPlugin({
  id: "msfx-sync-stores",
  name: "码上放心门店同步",
  description:
    "把码上放心导出的连锁企业绑定详情 Excel 同步到 MSFX 数据库 ALI_HEALTH_SYNC_STORE_D 表。读 Excel → 调 med_ai_agent 比对 → 输出可人工审核的 SQL 文件，不直接执行。",
  configSchema: Type.Object(
    {
      medAiAgentBaseUrl: Type.Optional(
        Type.String({
          default: "http://localhost:8080",
          description: "med_ai_agent 后端地址",
        }),
      ),
      pythonPath: Type.Optional(
        Type.String({
          default: "python",
          description: "Python 可执行文件路径，需要安装 openpyxl",
        }),
      ),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      ...msfxSyncStoresToolDef,
      optional: true,
      factory: ({ config }) =>
        createMsfxSyncStoresTool(
          (config ?? {}) as { medAiAgentBaseUrl?: string; pythonPath?: string },
        ),
    }),
  ],
});
