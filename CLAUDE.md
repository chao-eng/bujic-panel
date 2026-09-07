# CLAUDE.md

> 本仓库面向 **Claude Code 等编码 Agent** 的统一指南已迁移到中文文档：
>
> ➡️ **请阅读 [`Agent开发指南.md`](./Agent开发指南.md)**（项目是什么、仓库布局、常用命令、架构要点、Widget 扩展、约定与改动 checklist）。

简要提醒：

- Next.js 工程在 `app/`（非仓库根）；所有 pnpm / prisma 命令在 `app/` 下执行。
- 提交信息用中文。
- 改代码前先读 `Agent开发指南.md` 与 `app/src/lib/db.ts`。
- 此版本 Next.js（16）有破坏性变更，写代码前先看 `app/node_modules/next/dist/docs/`。
