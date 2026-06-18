import { Type } from "typebox";

type PluginCfg = {
  medAiAgentBaseUrl?: string;
  defaultPosRepoPath?: string;
};

function baseUrl(cfg: PluginCfg): string {
  const raw = cfg.medAiAgentBaseUrl?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:8080";
}

function repoPath(cfg: PluginCfg, value?: string): string {
  return (
    value?.trim() || cfg.defaultPosRepoPath?.trim() || "C:/Users/haoming/IdeaProjects/gygd_pos"
  );
}

async function postReview(
  cfg: PluginCfg,
  params: { repoPath?: string; ref: string; baseRef?: string; requirement?: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl(cfg)}/api/pos-review/git-ref`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      repoPath: repoPath(cfg, params.repoPath),
      ref: params.ref,
      baseRef: params.baseRef ?? "",
      requirement: params.requirement ?? "",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`med_ai_agent 返回 HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function formatResult(result: Record<string, unknown>): string {
  if (result.error) {
    const lines = [
      `## POS Git Review 失败`,
      `- ref: ${result.ref ?? ""}`,
      `- repo: ${result.repoPath ?? ""}`,
      `- 已自动 fetch 远程: ${result.fetchedRemote ? "是" : "否"}`,
      `- error: ${result.error}`,
    ];
    if (result.suggestion) lines.push(`- 建议: ${result.suggestion}`);
    if (result.detail)
      lines.push("", "### Git 错误详情", "```", String(result.detail).trim(), "```");
    if (result.recentRemoteCommits) {
      lines.push(
        "",
        "### 最近远程提交候选",
        "```",
        String(result.recentRemoteCommits).trim(),
        "```",
      );
    }
    return lines.join("\n");
  }
  const lines: string[] = [];
  lines.push(`## POS Git Review 报告`);
  lines.push(`- repo: ${result.repoPath}`);
  lines.push(`- ref: ${result.ref}`);
  if (result.baseRef) lines.push(`- baseRef: ${result.baseRef}`);
  lines.push(`- diffRange: ${result.diffRange}`);
  if (result.truncated) lines.push("- 注意: diff 已截断，必要时请人工补充查看完整变更");
  lines.push("");
  lines.push(String(result.review ?? ""));
  return lines.join("\n");
}

export const posGitReviewToolDef = {
  name: "pos_git_review",
  label: "POS Git 代码 Review",
  description:
    "根据 gygd_pos 的 git commit/branch/tag 生成代码 review 与 POS 修改建议。只读 git diff 并给反馈，不实际修改代码。用户给出版本号/commit hash 时使用。",
  parameters: Type.Object({
    ref: Type.String({
      description:
        "要 review 的 git ref：commit hash / branch / tag，例如 516cb624485401f504c81e87b31396580405f2cd",
    }),
    baseRef: Type.Optional(
      Type.String({
        description:
          "可选：对比基线 ref。不传时 review 单个 commit 的 ^! diff；传入时 review baseRef...ref",
      }),
    ),
    repoPath: Type.Optional(
      Type.String({
        description: "可选：gygd_pos 仓库路径，默认 C:/Users/haoming/IdeaProjects/gygd_pos",
      }),
    ),
    requirement: Type.Optional(
      Type.String({
        description: "可选：需求背景/重点关注点，例如 山西医保库存管理、码上放心未上传排查 等",
      }),
    ),
  }),
};

export function createPosGitReviewTool(cfg: PluginCfg) {
  return {
    ...posGitReviewToolDef,
    async execute(
      _id: string,
      params: { ref: string; baseRef?: string; repoPath?: string; requirement?: string },
    ) {
      const result = await postReview(cfg, params);
      return {
        content: [{ type: "text", text: formatResult(result) }],
        details: { json: result },
      };
    },
  };
}
