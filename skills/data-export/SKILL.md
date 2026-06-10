---
name: data-export
description: "当用户要求导数据、查看运营数据时，调用后端 API 按需查询单个指标"
metadata: { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# 数据导出助手

当用户说以下关键词时，先 `GET /api/stats/metrics` 获取可用指标列表，然后只查用户关心的指标：

- 导数据、导出数据、统计数据、运营数据、销售数据
- 门店数、SKU、追溯码、处方、促销、库存

## 第一步：获取可用指标列表

```bash
curl -s http://localhost:8080/api/stats/metrics
```

返回：

```json
["有销售门店数", "有销售门店数_医保店", "销售商品SKU数", ...]
```

## 第二步：只查用户要的指标（不要全查！）

```bash
curl -s "http://localhost:8080/api/stats/有销售门店数?startDate=2026-01-01&endDate=2026-06-09"
```

返回：

```json
{ "metric": "有销售门店数", "timeRange": "2026-01-01 ~ 2026-06-09", "value": 3217 }
```

## 处理规则

- **只查用户要的指标**，一个指标一次请求，不要调 `/api/stats`（全量接口太慢）
- 如果用户一次要多个指标，逐个调，最后汇总展示
- value=-1 表示该指标暂不可用
- API 调用失败时告知用户后端可能未启动
