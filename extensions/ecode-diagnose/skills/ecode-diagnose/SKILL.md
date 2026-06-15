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
