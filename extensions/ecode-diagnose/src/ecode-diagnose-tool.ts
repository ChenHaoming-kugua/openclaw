import { Type } from "typebox";

type PluginCfg = {
  medAiAgentBaseUrl?: string;
};

function baseUrl(cfg: PluginCfg): string {
  const raw = cfg.medAiAgentBaseUrl?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:8080";
}

async function apiCall(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`med_ai_agent 返回 HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

function formatBlockReason(diagnosis: Record<string, unknown>): string {
  const baseInfo = diagnosis.baseInfo as Record<string, unknown> | undefined;
  const fails = (diagnosis.fails as string[]) ?? [];
  const passes = (diagnosis.passes as string[]) ?? [];
  const checks = (diagnosis.checks as Array<Record<string, unknown>>) ?? [];

  const lines: string[] = [];

  if (baseInfo) {
    lines.push("## 零售明细信息");
    lines.push(`- 门店: ${baseInfo.PLACEPOINTNAME ?? baseInfo.PLACEPOINTID}`);
    lines.push(`- 零售单号: ${baseInfo.RSAID}`);
    lines.push(`- 明细行ID: ${baseInfo.RSADTLID}`);
    lines.push(`- 商品: ${baseInfo.GOODSNAME} (ID: ${baseInfo.GOODSID})`);
    lines.push(`- 销售时间: ${baseInfo.CREDATE}`);
    lines.push("");
  }

  if (diagnosis.blocked) {
    lines.push("## 阻塞原因 (阻断上传)");
    for (const f of fails) {
      lines.push(`- **${f}**`);
    }
    lines.push("");
  } else {
    lines.push("## 所有检查通过，该记录应可正常上传");
    lines.push("");
  }

  lines.push("## 逐项检查结果");
  lines.push("");
  lines.push("| 检查项 | 结果 | 详情 |");
  lines.push("|--------|------|------|");
  for (const c of checks) {
    const checkName = (c.check as string) ?? "";
    const pass = c.pass ? "通过" : "未通过";
    const detail = (c.detail as string) ?? "";
    const icon = c.pass ? "O" : "X";
    // Truncate detail for table formatting
    const shortDetail = detail.length > 80 ? detail.slice(0, 77) + "..." : detail;
    lines.push(`| ${checkName} | ${icon} ${pass} | ${shortDetail} |`);
  }

  // Full detail for failed checks
  const failedChecks = checks.filter((c) => !c.pass);
  if (failedChecks.length > 0) {
    lines.push("");
    lines.push("## 失败检查详情");
    for (const c of failedChecks) {
      lines.push(`### ${c.check}`);
      for (const [k, v] of Object.entries(c)) {
        if (k !== "check" && k !== "pass") {
          lines.push(`- **${k}**: ${v}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatBatchResult(result: Record<string, unknown>): string {
  const lines: string[] = [];

  if (result.error) {
    lines.push(`## 查询失败: ${result.error}`);
    return lines.join("\n");
  }

  const alreadySyncedFalsePositive = (result.alreadySyncedFalsePositive as number) ?? 0;

  lines.push(`## 门店 ${result.placepointid} 追溯码上传诊断报告`);
  lines.push(`- 时间范围: ${result.beginTime} ~ ${result.endTime}`);
  lines.push(`- 候选未上传记录数: ${result.unsentCount}`);
  if (alreadySyncedFalsePositive > 0) {
    lines.push(`- **假阳性(已上传,UI延迟): ${alreadySyncedFalsePositive}**`);
    lines.push(`- **真实未上传: ${result.hasEcodeButNotUploaded}**`);
  }
  lines.push(`- 无采集记录: ${result.noEcodeRecord}`);
  lines.push(`- ${result.summary}`);
  lines.push("");

  const details = result.details as Array<Record<string, unknown>> | undefined;
  if (details && details.length > 0) {
    lines.push("## 明细列表");
    lines.push("");
    lines.push("| 明细ID | 零售单号 | 商品 | 追溯码 | 强控 | 触发上传 | 原因 |");
    lines.push("|--------|----------|------|--------|------|----------|------|");
    for (const d of details.slice(0, 50)) {
      const reason = (d.reason as string) ?? "";
      const shortReason = reason.length > 50 ? reason.slice(0, 47) + "..." : reason;
      const triggered = d.syncTriggered;
      let triggerIcon: string;
      if (triggered === undefined || triggered === null) {
        triggerIcon = "-";
      } else if (triggered) {
        triggerIcon = d.syncSuccess ? "Y(OK)" : "Y(FAIL)";
      } else {
        triggerIcon = "N";
      }
      lines.push(
        `| ${d.rsadtlid} | ${d.rsaid} | ${d.goodsname} | ${d.traceCode} | ${d.strongControl} | ${triggerIcon} | ${shortReason} |`,
      );
    }
    if (details.length > 50) {
      lines.push(`| ... | ... | ... | ... | ... | ... | 还有 ${details.length - 50} 条 ... |`);
    }
    lines.push("");
    lines.push(
      "**触发上传列说明**: `-`=无采集记录无需上传, `Y(OK)`=已触发且成功(假阳性), `Y(FAIL)`=已触发但失败, `N`=调度层未触发",
    );
  }

  return lines.join("\n");
}

function formatStatsResult(result: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`## 门店 ${result.placepointid} 追溯码上传概览`);
  lines.push(`- 时间范围: ${result.timeRange}`);
  lines.push("");
  lines.push("| 指标 | 数量 |");
  lines.push("|------|------|");
  lines.push(`| 零售明细总数 | ${result.totalDetailCount} |`);
  lines.push(`| 其中需上传追溯码的明细数 | ${result.ecodeGoodsDetailCount} |`);
  lines.push(`| 已成功上传 | ${result.syncedCount} |`);
  lines.push(`| 异常记录(未激活/过期等) | ${result.abnormalCount} |`);
  lines.push(`| 已售出标记 | ${result.alreadySaleCount} |`);
  lines.push(`| 数据不全 | ${result.abnormalDataCount} |`);
  lines.push(`| **漏网之鱼(有采集记录但未上传)** | **${result.missedCount}** |`);
  lines.push(`| 上传率 | ${result.uploadRate} |`);
  return lines.join("\n");
}

export const ecodeDiagnoseToolDef = {
  name: "ecode_diagnose",
  label: "追溯码单条诊断",
  description:
    "诊断单条零售明细的追溯码为什么没有上传到码上放心平台。传入门店ID(placepointid)和明细行ID(rsadtlid)，逐项检查：商品是否启用追溯码、门店是否配置同步、区域是否匹配、BMS_ECODE_RECORD采集记录是否存在、是否已被同步/标记异常/标记已售出/标记数据不全等。",
  parameters: Type.Object({
    placepointid: Type.Number({ description: "门店ID (gpcs_placepoint.placepointid)" }),
    rsadtlid: Type.Number({ description: "零售明细行ID (gresa_sa_dtl.rsadtlid)" }),
  }),
};

export const ecodeDiagnoseByCodeToolDef = {
  name: "ecode_diagnose_by_code",
  label: "追溯码反查诊断",
  description:
    "通过20位追溯码(ecode)诊断为什么没有上传到码上放心平台。先在bms_ecode_record中反查该追溯码对应的零售明细，再逐项排查未上传原因。当用户给出20位数字的追溯码时优先使用此工具。",
  parameters: Type.Object({
    ecode: Type.String({ description: "追溯码，20位数字，例如 84765620001563394047" }),
    placepointid: Type.Number({ description: "门店ID" }),
  }),
};

export const ecodeDiagnoseBatchToolDef = {
  name: "ecode_diagnose_batch",
  label: "追溯码批量诊断",
  description:
    "批量诊断某个门店在某时间段内所有未上传追溯码的零售明细。找出所有漏传的记录并归类原因（无采集记录 vs 有采集记录但未上传）。",
  parameters: Type.Object({
    placepointid: Type.Number({ description: "门店ID" }),
    beginTime: Type.String({
      description: "开始日期，格式 yyyy-MM-dd，例如 2026-06-01",
    }),
    endTime: Type.String({
      description: "结束日期，格式 yyyy-MM-dd，例如 2026-06-09",
    }),
  }),
};

export const ecodeDiagnoseStatsToolDef = {
  name: "ecode_diagnose_stats",
  label: "追溯码上传概览",
  description:
    "查看某个门店在某时间段内的追溯码上传统计概览。对比应上传数量 vs 已上传数量 vs 异常数量，快速了解上传健康度。",
  parameters: Type.Object({
    placepointid: Type.Number({ description: "门店ID" }),
    beginTime: Type.String({
      description: "开始日期，格式 yyyy-MM-dd",
    }),
    endTime: Type.String({
      description: "结束日期，格式 yyyy-MM-dd",
    }),
  }),
};

export function createEcodeDiagnoseTool(cfg: PluginCfg) {
  const url = baseUrl(cfg);
  return {
    ...ecodeDiagnoseToolDef,
    async execute(_id: string, params: { placepointid: number; rsadtlid: number }) {
      const apiUrl = `${url}/api/ecode/diagnose?placepointid=${params.placepointid}&rsadtlid=${params.rsadtlid}`;
      const data = (await apiCall(apiUrl)) as Record<string, unknown>;
      return {
        content: [{ type: "text", text: formatBlockReason(data) }],
        details: { json: data },
      };
    },
  };
}

export function createEcodeDiagnoseByCodeTool(cfg: PluginCfg) {
  const url = baseUrl(cfg);
  return {
    ...ecodeDiagnoseByCodeToolDef,
    async execute(_id: string, params: { ecode: string; placepointid: number }) {
      const apiUrl = `${url}/api/ecode/diagnose/by-code?ecode=${encodeURIComponent(params.ecode)}&placepointid=${params.placepointid}`;
      const data = (await apiCall(apiUrl)) as Record<string, unknown>;
      return {
        content: [{ type: "text", text: formatBlockReason(data) }],
        details: { json: data },
      };
    },
  };
}

export function createEcodeDiagnoseBatchTool(cfg: PluginCfg) {
  const url = baseUrl(cfg);
  return {
    ...ecodeDiagnoseBatchToolDef,
    async execute(
      _id: string,
      params: { placepointid: number; beginTime: string; endTime: string },
    ) {
      const apiUrl = `${url}/api/ecode/diagnose/batch?placepointid=${params.placepointid}&beginTime=${encodeURIComponent(params.beginTime)}&endTime=${encodeURIComponent(params.endTime)}`;
      const data = (await apiCall(apiUrl)) as Record<string, unknown>;
      return {
        content: [{ type: "text", text: formatBatchResult(data) }],
        details: { json: data },
      };
    },
  };
}

export function createEcodeDiagnoseStatsTool(cfg: PluginCfg) {
  const url = baseUrl(cfg);
  return {
    ...ecodeDiagnoseStatsToolDef,
    async execute(
      _id: string,
      params: { placepointid: number; beginTime: string; endTime: string },
    ) {
      const apiUrl = `${url}/api/ecode/diagnose/stats?placepointid=${params.placepointid}&beginTime=${encodeURIComponent(params.beginTime)}&endTime=${encodeURIComponent(params.endTime)}`;
      const data = (await apiCall(apiUrl)) as Record<string, unknown>;
      return {
        content: [{ type: "text", text: formatStatsResult(data) }],
        details: { json: data },
      };
    },
  };
}
