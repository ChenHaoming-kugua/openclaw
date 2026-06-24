---
name: ecode-diagnose
description: Use when the user asks why a drug traceability code (追溯码) hasn't been uploaded to 码上放心 (AliHealth ECode platform), or needs to diagnose upload failures for retail pharmacy trace codes. Triggers on keywords like 追溯码, 码上放心, 未上传, 上传失败, 排查, 诊断, ecode, trace code.
---

# 追溯码上传诊断

Use this skill when diagnosing why retail pharmacy drug traceability codes (追溯码) failed to upload to the 码上放心 (AliHealth ECode) platform.

## How to diagnose

The med_ai_agent backend (http://localhost:8080) provides diagnostic APIs. Call them directly with curl:

### If the user provides a 20-digit trace code + store ID:

```bash
curl -s --max-time 30 --connect-timeout 5 "http://localhost:8080/api/ecode/diagnose/by-code?ecode=<ECODE>&placepointid=<STORE_ID>"
```

Example:

```bash
curl -s --max-time 30 --connect-timeout 5 "http://localhost:8080/api/ecode/diagnose/by-code?ecode=84765620001563394047&placepointid=101457"
```

### If the user provides a store ID + detail line ID (rsadtlid):

```bash
curl -s "http://localhost:8080/api/ecode/diagnose?placepointid=<STORE_ID>&rsadtlid=<DETAIL_ID>"
```

### If the user provides a store ID + date range (batch diagnosis):

```bash
curl -s --max-time 30 --connect-timeout 5 "http://localhost:8080/api/ecode/diagnose/batch?placepointid=<STORE_ID>&beginTime=2026-06-01&endTime=2026-06-09"
```

### For upload statistics overview:

```bash
curl -s --max-time 30 --connect-timeout 5 "http://localhost:8080/api/ecode/diagnose/stats?placepointid=<STORE_ID>&beginTime=2026-06-01&endTime=2026-06-09"
```

## Interpreting results

The diagnostic report JSON shows:

- **blocked: true** — there is a problem preventing upload
- **blockReason** — the specific reason(s) the code was blocked
- **ecodeRecords** — (for by-code lookup) the matching records in bms_ecode_record
- **checks** — each of the 10 checks with pass/fail status
- **fails** — list of failed checks
- **passes** — list of passed checks

Common failure reasons:

- "追溯码未采集: bms_ecode_record 中无此码记录" — the ecode was never scanned at POS (most common)
- "商品未启用追溯码" — the goods isn't flagged for ecode tracking
- "门店未配置码上放心同步" — the store isn't in ali_health_sync_store_d
- "已成功同步过" — already uploaded, no action needed
- "记录在 ALI_HEALTH_ABNORMAL_ECODE 中" — previously detected as abnormal (unactivated/expired/invalid format)

## Workflow

1. Parse the user's input: extract store ID (门店), ecode (20-digit 追溯码), and/or date range
2. Run the appropriate curl command
3. Present results as a clear table showing which checks passed and which failed
4. Highlight the specific blocking reason

## 门店哪些追溯码没传码上放心（批量补推送）

用户问"门店哪些追溯码没传码上放心""哪些码没上传""补推送清单"时，调用后端生成可执行 SQL，把 SQL 原样给用户在 SQL Developer 跑，**不要自己连数据库，不要去看 POS 仓库**：

```bash
curl -s "http://localhost:8080/api/msfx-sync/unsent-ecode-sql?placepointId=101457&beginDate=2026-06-17&endDate=2026-06-24&scene=all"
```

也支持 POST JSON，但优先用 GET。参数全可选：

- `placepointId` 不传 = 全部门店
- `beginDate` / `endDate` 不传 = 默认近 7 天
- `scene` 默认 `all`，可选 `retail`（零售单上传）、`inout`（出入库单据上传）、`all`（两者 UNION）
- `excludeAlreadySale` 默认 true（已销售码不重推，业务红线，仅零售）
- `excludeAbnormal` 默认 false（平台驳回=传过，不排除，仅零售）
- `excludePrecheckAbnormal` 默认 false（预校验异常=传过，不排除，仅零售）

**业务规则（已对齐 medins-databridge-platform 仓内逻辑）**：

- 零售单上传接口 `alibaba.alihealth.drugtrace.top.lsyd.uploadretail` 落 `ALI_HEALTH_ECODE_SYNC_D`。
- 出入库单据上传接口 `alibaba.alihealth.drugtrace.top.lsyd.uploadinoutbill` 落 `ALI_HEALTH_PURCH_ECODE_D`。
- "传过" = 对应上传日志表里存在该追溯码记录，**不限 SYNC_FLAG**。成功/失败/驳回都算传过，避免重复推送。
- "已销售" = `ALI_HEALTH_ALREADY_SALE_ECODE` 里有记录，默认排除（不能重推，仅零售）。
- "平台驳回" = `ALI_HEALTH_ABNORMAL_ECODE`，默认不排除（驳回=传过，仅零售）。
- "预校验异常" = `ALI_SYNC_ECODE_ABNORMAL_DATA`，默认不排除（=传过，仅零售）。

后端返回的 `sql` 字段可以直接在 SQL Developer 执行。`tables` 字段列出真实表名对照，`rule` 字段说明业务规则。

## 禁止事项

- **不要自己连 Oracle / 不要装 sqlplus / 不要用 JDBC 直连** — 你没有数据库客户端，也不应该有。所有数据访问走 med_ai_agent 后端 API。
- **不要自己写 SQL 猜表名** — 之前出现过的 `ALI_HEALTH_UPLOAD_LOG`、`bms_ecode_record.GOODS_CODE`、`r.BATCH_NO`、`r.BUSINESS_NO`、`u.STATUS` 全是幻觉，真实表里不存在。要 SQL 就调 `/api/msfx-sync/unsent-ecode-sql`。
- **不要让用户去跑你手写的 SQL** — 除非是从后端 `/api/msfx-sync/unsent-ecode-sql` 拿到的。
- **不要去看 POS 仓库 (gygd_pos)** — 追溯码上传逻辑在 `medins-databridge-platform` 仓库，不在 POS。问"码上放心为什么没传"时调后端 API，不要调 `/api/pos-review/git-ref`。
- 如果后端 8080 没响应，告诉用户重启 `med_ai_agent`，不要绕过后端自己去连库。
