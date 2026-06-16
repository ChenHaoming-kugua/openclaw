---
name: sync-mashangfangxin-stores
description: 把"码上放心"后台导出的"连锁企业绑定详情"Excel 同步到 MSFX 数据库 gygdpos.ALI_HEALTH_SYNC_STORE_D 表，生成可人工审核的 SQL 文件。当用户给出一个或多个 "xxx-连锁企业绑定详情导出YYYYMMDDxxxx.xlsx" 并要求"更新到数据库 / 同步到码上放心同步表 / 帮我更新一下"时使用。
---

# 码上放心门店同步

把阿里"码上放心"平台导出的【连锁企业绑定详情】Excel，同步到 MSFX 数据库的 `gygdpos.ALI_HEALTH_SYNC_STORE_D` 表，**只生成可审核的 SQL 文件，不直接执行**。

所有数据库访问 / 比对 / SQL 生成都由 `med_ai_agent` 后端完成，本 skill 只编排：解析 Excel → 调工具 → 反馈结果。

## 触发场景

用户提交一个或多个形如 `XXX-连锁企业绑定详情导出YYYYMMDDxxxx.xlsx` 的文件，要求：

- "更新到数据库"
- "同步到码上放心"
- "更新到码上放心同步表"
- "帮我更新一下"

## 工作流（只有 1 步）

调 `msfx_sync_stores_diagnose` 工具：

```json
{
  "files": ["C:/Users/.../XXX-连锁企业绑定详情导出20260616xxxx.xlsx"],
  "outputDir": "（可选）SQL 输出目录，默认为第一个 Excel 所在目录"
}
```

工具内部会：

1. 用 Python `openpyxl` 解析所有 sheet，过滤 `授权状态 = 是` 的行
2. POST 行数据到 `med_ai_agent` 的 `/api/msfx-sync/diagnose`
3. 后端按企业名 → `PUB_COMPANY` → `GPCS_PLACEPOINT` 匹配；按 appkey 推断 `PARENT_AREA_CODE`（取 ALI 表中最常见值，新 appkey 则递归 `PUB_COMPANY.PARENTCOMPANYID` 向上找）
4. 后端分类每行为 INSERT / UPDATE / NOOP / SKIP，并渲染完整 SQL
5. 工具把 SQL 写到 `update_ali_health_sync_store_<YYYYMMDD>.sql`
6. 返回摘要：多少 INSERT / UPDATE / NOOP / SKIP，每个 appkey 推断到的 PARENT_AREA_CODE

## 交付给用户

把工具返回的内容原样转给用户：

- SQL 文件绝对路径
- 处理摘要（数量分布 + PARENT_AREA 推断来源）
- 强提示：**不要直接 COMMIT**，请用 SQL Developer 事务执行 + 跑验证查询 + 人工核对 PARENT_AREA 与 SKIP 列表后再 COMMIT

## 多文件场景

用户一次给多个 Excel：把所有路径放到 `files` 数组里一次调用，工具会按企业名去重（首次出现优先）。

## 注意

- **不要** 试图自己写 SQL、查数据库、用 `curl` 直接打 8080 接口。所有比对都让工具完成。
- **不要硬编码** PARENT_AREA_CODE（例如不要凭印象写 863）。工具会根据 appkey 在 ALI 表里的现状推断，并把推断来源写在 SQL 头部注释里。
- 用户可能用半角 `()` 或全角 `（）`。工具会自动两种都试。
- 总公司 / 组织节点（`PUB_COMPANY` 命中但 `GPCS_PLACEPOINT` 中没有）会进入 SKIP，并在 SQL 末尾注释列出。
- 如果 Python 报 `openpyxl not installed`，提示用户 `pip install openpyxl`。
