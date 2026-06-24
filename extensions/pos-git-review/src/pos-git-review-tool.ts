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

async function getReviewMarkdown(
  cfg: PluginCfg,
  params: { repoPath?: string; ref: string; baseRef?: string; requirement?: string },
): Promise<string> {
  const url = new URL(`${baseUrl(cfg)}/api/pos-review/git-ref/markdown`);
  url.searchParams.set("repoPath", repoPath(cfg, params.repoPath));
  url.searchParams.set("ref", params.ref);
  if (params.baseRef?.trim()) url.searchParams.set("baseRef", params.baseRef.trim());
  url.searchParams.set(
    "requirement",
    params.requirement ?? "POS code review only; provide feedback; do not modify code",
  );
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`med_ai_agent 返回 HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
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
      const text = await getReviewMarkdown(cfg, params);
      return {
        content: [{ type: "text", text }],
        details: { ref: params.ref, baseRef: params.baseRef ?? "" },
      };
    },
  };
}
