// 追溯码上传诊断插件。诊断零售追溯码未上传至码上放心平台的原因。
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type } from "typebox";
import {
  createEcodeDiagnoseBatchTool,
  createEcodeDiagnoseByCodeTool,
  createEcodeDiagnoseStatsTool,
  createEcodeDiagnoseTool,
  ecodeDiagnoseBatchToolDef,
  ecodeDiagnoseByCodeToolDef,
  ecodeDiagnoseStatsToolDef,
  ecodeDiagnoseToolDef,
} from "./src/ecode-diagnose-tool.js";

export default defineToolPlugin({
  id: "ecode-diagnose",
  name: "追溯码上传诊断",
  description:
    "诊断零售追溯码未上传至码上放心平台的原因。逐项检查商品追溯码启用状态、门店同步配置、区域匹配、采集记录、同步历史等。",
  configSchema: Type.Object(
    {
      medAiAgentBaseUrl: Type.Optional(
        Type.String({
          default: "http://localhost:8080",
          description: "med_ai_agent 后端地址",
        }),
      ),
    },
    { additionalProperties: false },
  ),
  tools: (tool) => [
    tool({
      ...ecodeDiagnoseByCodeToolDef,
      optional: true,
      factory: ({ config }) =>
        createEcodeDiagnoseByCodeTool((config ?? {}) as { medAiAgentBaseUrl?: string }),
    }),
    tool({
      ...ecodeDiagnoseToolDef,
      optional: true,
      factory: ({ config }) =>
        createEcodeDiagnoseTool((config ?? {}) as { medAiAgentBaseUrl?: string }),
    }),
    tool({
      ...ecodeDiagnoseBatchToolDef,
      optional: true,
      factory: ({ config }) =>
        createEcodeDiagnoseBatchTool((config ?? {}) as { medAiAgentBaseUrl?: string }),
    }),
    tool({
      ...ecodeDiagnoseStatsToolDef,
      optional: true,
      factory: ({ config }) =>
        createEcodeDiagnoseStatsTool((config ?? {}) as { medAiAgentBaseUrl?: string }),
    }),
  ],
});
