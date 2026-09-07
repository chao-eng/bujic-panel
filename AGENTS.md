# AGENTS.md

> 本仓库面向 **Codex / OpenCode 等编码 Agent** 的统一指南已迁移到中文文档：
>
> ➡️ **请阅读 [`Agent开发指南.md`](./Agent开发指南.md)**（项目是什么、仓库布局、常用命令、架构要点、Widget 扩展、约定与改动 checklist）。

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `app/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

简要提醒：

- Next.js 工程在 `app/`（非仓库根）；所有 pnpm / prisma 命令在 `app/` 下执行。
- 提交信息用中文。
- 改代码前先读 `Agent开发指南.md` 与 `app/src/lib/db.ts`。
