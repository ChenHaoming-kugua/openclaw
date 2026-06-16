import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Type } from "typebox";

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON_SCRIPT = join(SCRIPT_DIR, "scripts", "read_excel.py");

type PluginCfg = {
  medAiAgentBaseUrl?: string;
  pythonPath?: string;
};

function baseUrl(cfg: PluginCfg): string {
  const raw = cfg.medAiAgentBaseUrl?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return "http://localhost:8080";
}

function pythonBin(cfg: PluginCfg): string {
  return cfg.pythonPath?.trim() || "python";
}

type ExcelRow = {
  name: string;
  appkey: string;
  refEntId: string;
  entId: string;
  source?: string;
};

async function parseExcels(cfg: PluginCfg, files: string[]): Promise<ExcelRow[]> {
  const args = [PYTHON_SCRIPT, ...files];
  const { stdout } = await execFileAsync(pythonBin(cfg), args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  const parsed = JSON.parse(stdout);
  if (parsed.error) throw new Error(`读 Excel 失败: ${parsed.error}`);
  return parsed.rows as ExcelRow[];
}

async function postDiagnose(cfg: PluginCfg, rows: ExcelRow[]): Promise<Record<string, unknown>> {
  const url = `${baseUrl(cfg)}/api/msfx-sync/diagnose`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`med_ai_agent 返回 HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function formatSummary(summary: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push("## 处理摘要");
  lines.push(`- 总行数: ${summary.totalRows}`);
  lines.push(`- INSERT: ${summary.insertCount}`);
  lines.push(`- UPDATE: ${summary.updateCount}`);
  lines.push(`- 已一致(NOOP): ${summary.noopCount}`);
  lines.push(`- 跳过(SKIP): ${summary.skipCount}`);
  const appkeys = summary.appkeys as Record<
    string,
    { code?: string; name?: string; source?: string }
  >;
  if (appkeys && Object.keys(appkeys).length > 0) {
    lines.push("");
    lines.push("### PARENT_AREA 推断");
    for (const [k, v] of Object.entries(appkeys)) {
      lines.push(`- appkey=\`${k}\` → ${v.code ?? ""} / ${v.name ?? ""} _[${v.source ?? ""}]_`);
    }
  }
  return lines.join("\n");
}

export const msfxSyncStoresToolDef = {
  name: "msfx_sync_stores_diagnose",
  label: "码上放心门店同步：生成 SQL",
  description:
    "解析 1 或多个'码上放心'后台导出的'连锁企业绑定详情' Excel，与 MSFX 数据库 ALI_HEALTH_SYNC_STORE_D 比对，生成可人工审核的 SQL 文件（INSERT/UPDATE/SKIP 分类）。不直接执行 SQL。",
  parameters: Type.Object({
    files: Type.Array(
      Type.String({
        description: "Excel 绝对路径，形如 'XXX-连锁企业绑定详情导出YYYYMMDDxxxx.xlsx'",
      }),
      { minItems: 1, description: "一个或多个 Excel 文件路径" },
    ),
    outputDir: Type.Optional(
      Type.String({
        description: "SQL 文件输出目录。不传时默认为第一个 Excel 所在目录。",
      }),
    ),
  }),
};

export function createMsfxSyncStoresTool(cfg: PluginCfg) {
  return {
    ...msfxSyncStoresToolDef,
    async execute(_id: string, params: { files: string[]; outputDir?: string }) {
      const files = params.files.map((f) => (isAbsolute(f) ? f : resolve(f)));
      const rows = await parseExcels(cfg, files);
      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Excel 中未找到 授权状态=是 的有效行（已校验 12 列表头）。请确认文件格式。",
            },
          ],
          details: { rowCount: 0 },
        };
      }
      const result = await postDiagnose(cfg, rows);
      if (result.error) {
        return {
          content: [{ type: "text", text: `后端诊断失败: ${result.error}` }],
          details: { json: result },
        };
      }
      const sql = result.sql as string;
      const fileName = result.sqlFileName as string;
      const outDir = params.outputDir ?? dirname(files[0]);
      await mkdir(outDir, { recursive: true });
      const sqlPath = join(outDir, fileName);
      await writeFile(sqlPath, sql, "utf8");

      const summaryText = formatSummary(result.summary as Record<string, unknown>);
      const lines: string[] = [];
      lines.push(`## SQL 已生成: \`${sqlPath}\``);
      lines.push(`Excel 解析行数: ${rows.length}（已过滤 授权状态=是）`);
      lines.push("");
      lines.push(summaryText);
      lines.push("");
      lines.push(
        "⚠️ **不直接执行**。请在 SQL Developer 事务环境中打开该文件，复核 PARENT_AREA / SKIP 后再 COMMIT。",
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
          sqlPath,
          summary: result.summary,
          rowCount: rows.length,
        },
      };
    },
  };
}
