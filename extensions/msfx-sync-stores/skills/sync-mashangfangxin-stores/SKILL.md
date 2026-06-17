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

也可用于排查码上放心零售单据为什么未上传，例如用户给出：

- 追溯码、单据号、单据细单号、零售流水总单号
- "同样类型单子有的传上去了有的没传"
- "对比已同步和未同步的码上放心单子"
- 指定走 `runTaskQuanZhou` / `syncStoreSaleTraceCode` / `/data/sync/v2/syncStoreSaleTC`

## 门店 Excel 同步工作流

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

## 零售单据未上传排查工作流

如果用户要排查“已同步 / 未同步”零售追溯码单据，不要只看截图中的“单据细单号”和“单据业务日期”。当前代码实际链路是：

1. 定时任务传 `syncAreaCode` / `parentAreaCode`，如泉州 `runTaskQuanZhou` 是 `161`，且 `12:00` 前直接 `return`。
2. `syncStoreSaleTraceCode` 调 `posSetlService.getStoreSetlInfoList(placePointId, extMap)`。
3. SQL 源表是 `gygdpos.gresa_sa_doc/gresa_sa_dtl`，日期窗口用 `GRESA_SA_DOC.CREDATE`，不是截图中的 `BMS_ECODE_RECORD.CREDATE`。
4. 如果截图细单号来自订单销售管理 / 团购层，先查 `gygdpos.ZX_GROUP_BUY_DTL`：`GROUPBUYDTLID` 是截图细单号，`RSADTLID` 才是 `GRESA_SA_DTL.RSADTLID`。
5. 追溯码关联条件必须同时考虑：`BMS_ECODE_RECORD.SOURCEID = GRESA_SA_DTL.RSADTLID` 或 `SOURCEID = ZX_GROUP_BUY_DTL.GROUPBUYDTLID`。
6. 进入候选还要满足 `PUB_GOODS_AREA.ISECODE=1`、`STRONGCONTROL=1`、`SPECECODE=0`、追溯码数量等于 `GOODSQTY`，并且未出现在成功/异常/已售出/预校验异常表。

### 表 owner 规则

代码里部分 SQL 不带 schema，MSFX 连接用户下实际落表是：

- 成功上传：`MSFX.ALI_HEALTH_ECODE_SYNC_D`
- 请求日志：`MSFX.ALI_HEALTH_SYNC_REQUSET_LOG`
- 已售出码：`MSFX.ALI_HEALTH_ALREADY_SALE_ECODE`
- 异常码：`MSFX.ALI_HEALTH_ABNORMAL_ECODE`
- 预校验异常：`MSFX.ALI_SYNC_ECODE_ABNORMAL_DATA`
- 源单/追溯码/门店映射：`gygdpos.GRESA_SA_DOC`、`gygdpos.GRESA_SA_DTL`、`gygdpos.BMS_ECODE_RECORD`、`gygdpos.ALI_HEALTH_SYNC_STORE_D`

不要误查 `gygdpos.ALI_HEALTH_ECODE_SYNC_D` 来判断当前代码是否已上传。

### 后端辅助接口

可调用 `med_ai_agent`：

```http
POST /api/msfx-sync/retail-diagnosis-sql
Content-Type: application/json

{
  "parentAreaCode": "161",
  "placepointId": "106016",
  "screenshotDetailIds": ["25308471", "25308472"],
  "realDetailIds": ["2973263763", "2973263764"],
  "businessDate": "2026-06-16",
  "rsaid": "1216350238",
  "traceCodes": ["84401580005906179487"]
}
```

接口只生成排查 SQL，不执行写操作。返回的 SQL 应按顺序验证：截图细单映射、真实销售单时间、追溯码关联、日期窗口、完整候选 SQL、成功表/请求日志/异常表。

## 多文件场景

用户一次给多个 Excel：把所有路径放到 `files` 数组里一次调用，工具会按企业名去重（首次出现优先）。

## 注意

- **不要** 试图自己写 SQL、查数据库、用 `curl` 直接打 8080 接口。所有比对都让工具完成。
- **不要硬编码** PARENT_AREA_CODE（例如不要凭印象写 863）。工具会根据 appkey 在 ALI 表里的现状推断，并把推断来源写在 SQL 头部注释里。
- 用户可能用半角 `()` 或全角 `（）`。工具会自动两种都试。
- 总公司 / 组织节点（`PUB_COMPANY` 命中但 `GPCS_PLACEPOINT` 中没有）会进入 SKIP，并在 SQL 末尾注释列出。
- 如果 Python 报 `openpyxl not installed`，提示用户 `pip install openpyxl`。
