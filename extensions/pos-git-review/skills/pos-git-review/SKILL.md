---
name: pos-git-review
description: 根据 gygd_pos / POS 项目的 git 版本号、commit hash、branch 或 tag 做代码 review，并提出 POS 代码修改意见。只给反馈，不实际修改代码。当用户说“review 这个版本”“根据 commit 看下 POS 代码”“这个版本有什么问题”“提出修改意见”时使用。
---

# POS Git 代码 Review

根据 `gygd_pos` 仓库的 git ref（commit hash / branch / tag）生成代码 review 与修改建议。

**只读分析，不实际修改 POS 代码。**

## 触发场景

用户给出 git 版本号 / commit hash / branch / tag，要求：

- review 代码
- 看下这个版本有没有问题
- 提出 POS 代码修改意见
- 对这个 commit 做代码审查
- 只给反馈，不要动代码

## 工作流

必须把 review 请求转发给 `med_ai_agent` 后端，后端是唯一允许读取 POS git diff 的地方。

```bash
curl -s --max-time 180 --connect-timeout 5 \
  "http://localhost:8080/api/pos-review/git-ref/markdown?repoPath=C%3A%2FUsers%2Fhaoming%2FIdeaProjects%2Fgygd_pos&ref=<GIT_REF>&requirement=POS%20code%20review%20only%3B%20provide%20feedback%3B%20do%20not%20modify%20code"
```

如果当前工具集里有 `pos_git_review` 工具，也可以调用该工具；该工具内部同样只是转发到上面的后端接口。

后端会：

1. 在 POS 仓库中只执行只读 git 命令：`rev-parse` / `cat-file` / `show` / `diff`
2. 如果本地没有该 ref，自动执行 `git fetch --all --prune` 后重试
3. 把 stat + diff 交给 LLM 做 POS 代码 review
4. 返回中文 Markdown 报告

## 输出要求

把工具返回的 review 报告原样给用户。报告应包含：

- 总体结论：可合并 / 建议修改后合并 / 不建议合并
- 高风险问题（没有就写“无”）
- 中低风险建议
- 建议修改点（尽量指出文件/函数/代码方向）
- UAT 自测建议

## POS review 重点

- 是否符合 POS 项目最小侵入原则：优先扩展，少改老逻辑
- 是否复用已有实现，避免重复造轮子
- SQL / MyBatis / Mapper 是否有性能问题、全表扫描、日期条件错误、空值错误
- 是否影响已有业务路径、定时任务、接口兼容性、UAT 数据
- 是否有空指针、金额/数量精度、事务边界、并发风险
- 是否存在 SQL 注入、越权、日志泄密等安全问题

## 失败处理

如果工具返回 `git ref 不存在，已自动 fetch 远程后仍未找到`：

- 告诉用户该版本号不在当前 `gygd_pos` 本地 + 远程可见引用中
- 工具会展示最近远程提交候选，优先让用户核对是否给错 commit hash
- 不要继续猜测版本；让用户确认仓库/分支/commit

## 禁止事项

- 不要自己执行 `git rev-parse` / `git show` / `git diff` / `git log` / `git fetch`
- 不要自己读取 POS 仓库文件或 diff 后直接 review
- 不要修改 `gygd_pos` 代码
- 不要切分支
- 不要提交 commit
- 不要执行写数据库操作
- 不要把 review 变成实现任务；除非用户另行明确要求开发，否则本 skill 只输出反馈
