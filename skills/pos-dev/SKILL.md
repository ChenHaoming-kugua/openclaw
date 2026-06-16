---
name: pos-dev
description: "POS需求开发，触发词：需求、开发、看一下需求、搞个需求、山西医保、库存管理、追溯码、720109、gygd_pos、openclaw需求单、POS项目。当用户转发或描述业务需求时，启动Claude Code后台开发。"
metadata: { "openclaw": { "emoji": "💊", "requires": { "bins": ["claude"] } } }
---

# POS 需求开发

当用户在对话中提到 POS 项目(gygd_pos)的开发需求时，启动后台 Claude Code 工作流完成开发。

## 触发条件

- 用户直接描述业务需求（如"山西医保库存管理"、"追溯码上传"、"720109"等需求单号）
- 用户说"看一下这个需求"、"搞个需求"、"开发一下"且内容涉及 POS 系统业务
- 用户转发需求单内容到对话中
- 用户提到 POS 项目、gygd_pos、国大药房系统开发

## 开发流程

1. **切分支**：从 main 切出 `feature-{YYMMDD}-{需求简称}` 分支
2. **分析现有代码**：找到需求相关的已有实现，复用已有功能，对已有逻辑侵入性要小
3. **实现**：基于分析结果编码
4. **UAT自测**：连接 UAT 数据库验证
5. **合并到dev**：开发完成后合并入 dev 分支

## 启动方式

将用户需求整理为 prompt，写入临时文件，用 Claude Code 后台执行：

```bash
PROMPT=$(mktemp -t openclaw-worker-prompt.XXXXXX)
cat >"$PROMPT" <<EOF
你是一个 POS 项目开发者，项目路径：C:\\Users\\haoming\\IdeaProjects\\gygd_pos

开发流程：
1. 从 main 切出 feature-{日期}-{需求简称} 分支
2. 分析现有代码，复用已有实现，最小侵入
3. 实现功能
4. 连接 UAT 数据库自测
5. 合并到 dev 分支

需求内容：
${USER_REQUIREMENT}

Notification route:
- channel: <notifyChannel>
- target: <notifyTarget>
- account: <notifyAccount or omit>
- reply_to: <notifyReplyTo or omit>
- thread_id: <notifyThreadId or omit>

When finished, send exactly one completion or failure message using:
openclaw message send --channel <channel> --target '<target>' --message '<brief result>'
Add --account, --reply-to, or --thread-id only when present above.
Do not use openclaw system event or heartbeat.
EOF
printf 'prompt file: %s\n' "$PROMPT"
bash background:true workdir:"C:\\Users\\haoming\\IdeaProjects\\gygd_pos" command:"claude --permission-mode bypassPermissions --print < \"$PROMPT\""
```

## 硬规则

- 始终 `background:true` 启动，不阻塞对话
- Claude Code 不用 PTY，用 `--permission-mode bypassPermissions --print`
- 必须先获取通知路由再启动 worker
- Worker 完成后通过 `openclaw message send` 回报结果
- 不要在 openclaw 仓库内 checkout 分支，工作目录是 gygd_pos
- 遇到需要用户决策的问题（方案选择、确认等），通过通知渠道询问，不要自行决定

## 状态同步

- 启动时告知用户：需求已接收，worker sessionId，开始开发
- 仅在里程碑、用户提问、错误、需要用户决策、完成时更新
- 被杀死时说明原因
