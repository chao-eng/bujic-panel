# Bujic Panel — Agent 开发指南

> 本文件是仓库 **Codex / Claude Code / OpenCode 等编码 Agent 的统一中文指南**。
> `AGENTS.md` 与 `CLAUDE.md` 均指向本文件。修改仓库代码前请先通读本指南。

---

## 1. 项目是什么

`Bujic Panel` —— 高颜值、自托管、多用户的**网站导航与书签管理系统**（单应用，非 monorepo）。核心能力：

- **双展示模式**：网站模式（经典卡片导航）与网页模式（带描述的信息流书签）。
- **服务监控 Widget**：书签可挂载实时监控组件（Beszel / qBittorrent / Jellyfin / Umami / wg-easy / Uptime Kuma），由后端代理拉取第三方服务数据并渲染在卡片上。
- **多用户与权限**：管理员/普通用户两级，个人资料、头像、密码管理，JSON 一键备份/恢复。
- **数据自托管**：SQLite 单文件存储；`DATA_DIR` 统一归口数据库与上传文件，Docker 友好。

技术栈：**Next.js 16 (App Router) + React 19 + TailwindCSS v4 + Prisma 6 / SQLite**，构建产物为 Docker 多架构镜像。

---

## 2. 仓库布局

> Next.js 工程位于 **`app/`**（包名 `app`，pnpm workspace 单包）。**所有前端/数据库命令在 `app/` 下执行**；根目录只放部署文件。

| 路径 | 说明 |
|------|------|
| `app/package.json` | 脚本（dev/build/lint/db:setup 等）与依赖 |
| `app/next.config.ts` | `output: "standalone"`（供 Docker 多阶段构建） |
| `app/prisma/schema.prisma` | **数据库结构真相**（8 个 model，全部 `@map` 蛇形表名） |
| `app/prisma/seed.ts` | 种子：默认管理员 admin/admin、示例分组/书签 |
| `app/prisma/current.sql` | 由 schema 生成的 DDL，Docker 首启建表用 |
| `app/scripts/prisma.js` | Prisma CLI 代理（先注入 `DATABASE_URL` 再执行） |
| `app/start.js` | 容器入口：同步表结构 → seed → 启动 standalone server |
| `app/src/lib/db.ts` | PrismaClient 单例 + SQLite WAL 优化（**先读它**） |
| `app/src/lib/auth.ts` | 密码三重 MD5、JWT 签发/校验、`getCurrentUser`/`verifyRequestAuth` |
| `app/src/lib/crypto.ts` | 服务端 AES-256-GCM 解密 + 客户端密钥派生（HMAC） |
| `app/src/lib/client-crypto.ts` | 前端 `encryptSensitive()`（Web Crypto，HTTP 降级 @noble/ciphers） |
| `app/src/actions/` | **Server Actions（写操作主通道）**：`userActions` / `groupActions` / `iconActions` |
| `app/src/app/api/` | Route Handlers：favicon 抓取、文件上传、widget stats、openness、crypto |
| `app/src/app/uploads/[...path]` | 静态上传文件代理（含目录穿越防护） |
| `app/src/components/` | React 组件（Dashboard / Widgets / Modals / ui） |
| `app/src/lib/widgets/providers/` | Widget Provider 扩展点（见第 6 节） |
| `app/src/lib/i18n.ts` | zh/en 双语文案字典（组件文案必须走这里） |
| `app/src/lib/themes.ts` | 12 套主题定义与默认值 |
| `.agents/skills/frontend-ui-ux/` | 前端 UI 美学 skill（暗色 cinematic） |

> 另见根目录 `Dockerfile`（多阶段构建）与 `.github/workflows/docker-build.yml`（master 推送 → 阿里云 ACR 多架构镜像）。

---

## 3. 常用命令（在 `app/` 下）

```bash
pnpm dev                    # 开发服务，默认 :3000
pnpm build                  # 生产构建（next build）
pnpm start                  # 生产启动（需先 build）
pnpm lint                   # ESLint（eslint-config-next: core-web-vitals + typescript）

# 数据库
pnpm db:setup               # db push + seed（首次运行）
pnpm db:push                # 同步 schema 到 SQLite（改 schema.prisma 后用）
pnpm db:seed                # 灌入默认数据
pnpm db:sql                 # 由 schema 重新生成 prisma/current.sql

# Docker 镜像（仓库根）
docker build -t bujic-panel .
```

> [!TIP] 启动前后端依赖的 SQLite 数据库路径由 `DATA_DIR` 推导（默认 `app/data`，未设置时为 `data` 相对 `app`）。`db.*` 脚本通过 `scripts/prisma.js` 自动注入 `DATABASE_URL`，**不要手动 set**。

### 改动后的验证 checklist

- 改了 `.ts`/`.tsx` → `pnpm lint`；有类型风险再跑 `pnpm exec tsc --noEmit`。
- 改了 `prisma/schema.prisma` → 跑 `pnpm db:push`，并在根 `Dockerfile` 的 builder 阶段对应产物（`current.sql`）同步后再构建镜像。

---

## 4. 架构要点

### 4.1 数据写操作走 Server Actions；读操作直连 db 或走 GET 路由

- **`src/actions/`**（`'use server'`）：`userActions` / `groupActions` / `iconActions`。每个 action 内部自己 `getCurrentUser()` 鉴权，数据天然按 `userId` 隔离。
- **页面/布局**：在 RSC 里 `await getCurrentUser()` 后直接 `db.x.findMany({ where: { userId: user.id } })` 预取，把数据以 props 传给 Client 组件（参考 `page.tsx`）。
- **需要 REST 的场景**（favicon 抓取、文件上传、Widget 轮询、登录前公开端点）：用 `app/api/*` Route Handler，JWT 从 `Authorization: Bearer` / `token` header 或 Cookie 提取（`verifyRequestAuth`）。

### 4.2 鉴权（人）

- 登录密码与改密、Widget 凭证等敏感字段，前端一律 `encryptSensitive()`（AES-256-GCM）后再提交；服务端 `decryptFromTransport()` 解密（非密文格式原样返回，向后兼容）。
- 密码落库 = **三重 MD5**（`passwordEncryption`）。登录签发 JWT（HS256，7 天）写入 `auth_token` httpOnly Cookie。
- 管理员判断：`role === 1`（普通用户 `role === 2`），页面/action 内用 `user.role !== 1` 拦截。
- 公开端点仅限 `/api/openness/*` 与 `/api/crypto`；`uploads` 与静态资源放行（见 `src/proxy.ts`）。

### 4.3 SQLite + Prisma（无迁移历史）

- `schema.prisma` 中每个 model 用 `@map` 映射为 snake_case 物理表名（`item_icon` 等），**没有外键约束**（曾去掉物理外键，全靠应用层事务保证）。
- 表结构演进 = 编辑 `schema.prisma` → `pnpm db:push`。生产/容器首启由 `start.js` 执行 `prisma/current.sql` 建表（只做"空库建表"，**不做增量迁移**）。
- `db.ts` 启动时对连接执行 `PRAGMA journal_mode=WAL; synchronous=NORMAL; busy_timeout=5000` 优化并发。

### 4.4 数据模型速览（8 个 model）

| Model（物理表） | 用途 | 关键字段 |
|------|------|------|
| `User`（`user`） | 用户 | username/password/role/status/token |
| `SystemSetting`（`system_setting`） | 系统设置键值 | `config_name`/`config_value`（disclaimer、system_application、web_about_description…） |
| `ItemIconGroup`（`item_icon_group`） | 分组 | groupType: `website`\|`webpage` |
| `ItemIcon`（`item_icon`） | 书签 + Widget | **`widgetType`/`widgetSettings`** 非空即监控组件；iconJson 存 stringified JSON |
| `ModuleConfig`（`module_config`） | 用户模块配置 | userId+name 唯一，valueJson |
| `UserConfig`（`user_config`） | 面板/搜索引擎 JSON | panelJson、searchEngineJson |
| `File`（`file`） | 上传文件登记 | src 为相对 `/uploads/yyyy/M/d/…` 路径 |
| `Notice`（`notice`） | 公告 | displayType 登录页/首页 |

---

## 5. 前端（`app/` 全部代码在前端，无独立 web 子目录）

Next.js App Router + React 19 + TailwindCSS v4（CSS-first，无 `tailwind.config`）+ shadcn/ui（`src/components/ui`，`cn()` 在 `src/lib/utils.ts`）+ lucide-react。`@/` 别名 → `src/`。

- 主页面 `src/app/page.tsx` → `Dashboard.tsx` → `IconGrid.tsx`；分组折叠、拖拽排序（@dnd-kit）。
- 弹窗集中在 `src/components/Modals/`（设置/分组/书签/删除），设置 Modal 内含「管理后台」区块（role===1 可见）。
- Widget UI 在 `src/components/Widgets/`，每个 Provider 配一个 `XxxWidget.tsx`（自设轮询拉 `/api/widgets/stats`）。
- **文案必须走 `src/lib/i18n.ts` 字典**（zh/en 双份，新文案要同时补两个字典），组件通过 `useI18n()`/`t` 取用。
- 主题：12 套在 `src/lib/themes.ts`，用户选择存 localStorage（`bujic-theme`）。
- 新增/调整 UI 遵循 `.agents/skills/frontend-ui-ux/SKILL.md`（项目级 skill）。

---

## 6. 服务监控 Widget（改动频繁区）

数据流：**书签存 `widgetType` + `widgetSettings`** → 前端 `XxxWidget.tsx` 轮询 `GET /api/widgets/stats?ids=…` → Route Handler 按 `widgetType` 查 `widgetProviders` 注册表 → 调 Provider 的 `fetchData(url, settings)` 并发拉取 → 返回 `Record<bookmarkId, {success,data|error}>`。

### 新增一种服务监控的标准步骤

1. 在 `src/lib/widgets/providers/` 新增 `xxx.ts`，实现 `WidgetProvider`（`fetchData(url, settings): Promise<any>`），**自带 5s 超时与清晰中文报错**（参考 `jellyfin.ts`）。
2. 在 `providers/index.ts` 注册 `xxx: new XxxProvider()`。
3. 新增 `src/components/Widgets/XxxWidget.tsx`（参考 `BeszelWidget.tsx` 的轮询与渲染）。
4. 书签表单支持：在 `EditIconModal.tsx` 里按 `widgetType` 渲染对应设置项，敏感凭证存 `widgetSettings` JSON，**提交前对包含密码的 settings 用 `encryptSensitive()` 加密**（编辑再保存时勿覆盖已存密钥——参考现有 Provider 的 settings 处理）。
5. 需要预设项（图标/href/container/镜像名等）可在书签内维护 `service.yaml` 式数据或 DB 字段——**以现有 Provider 的 settings 约定为准**。

### 安全注意

- `stats` 路由校验了"书签必须属于当前用户"（`userId: user.id`），新增逻辑不要破坏这层隔离。
- `widgetSettings` 解密后包含明文凭证，**不要 console.log、不要写进日志**。
- 服务端 fetch 已开 `NODE_TLS_REJECT_UNAUTHORIZED='0'`（兼容局域网自签证书），新增 Provider 沿用即可，但不要把它用于其他用途。

---

## 7. 约定

- **提交信息用中文**（见 git log，如 `增加beszel监控功能`、`服务监控面板添加对 Uptime Kuma 组件的支持`）。
- 代码风格：TS 走 `pnpm lint`；组件走 Tailwind 语义类；不添加无关注释。
- 新文案：zh + en 两处字典一起补。
- 新表：改 `schema.prisma` + `@map` 蛇形表名 + `pnpm db:push`；DB 层保持**无物理外键**，级联靠事务里手动 deleteMany。
- 迁移 `doc/jellyfin`（OpenAPI）等开发期参考文件属于临时产物，与 Jellyfin 无关的 Widget 不要依赖本仓库外的大 JSON。

---

## 8. CI / 部署

`.github/workflows/docker-build.yml`：master 推送时 `docker/build-push-action` 多架构（amd64/arm64）构建并推阿里云 ACR（日期/最新 三标签）。`Dockerfile` 本地等价：builder 阶段 `pnpm install --frozen-lockfile` + `prisma generate` + `pnpm build` + 生成 `current.sql`；runner 阶段用 `node:22-alpine`，`CMD ["node", "start.js"]`。

> 部署链路关键点：`start.js` 靠 `/app/.next/standalone` + 复制 `prisma/current.sql`、`seed.js`；改了 schema 记得同步这两个产物与镜像版本。

---

## 9. 快速上手（改代码前 checklist）

1. 先读 `app/src/lib/db.ts` 与 `app/src/lib/auth.ts`，理解数据库连接与鉴权方式。
2. 写操作进 `src/actions/`（自鉴权），读操作在 RSC 里直连 db；确需 REST 才加 `app/api/*`。
3. 涉及敏感字段 → 前端 `encryptSensitive()`、服务端 `decryptFromTransport()`，参照现有 Provider。
4. 需要持久化 → 改 `prisma/schema.prisma`，别新增其他 ORM。
5. 涉及 Widget → 守第 6 节注册/轮询/隔离约定。
6. 涉及 UI 文案 → 补 zh/en 字典；UI 风格参考 frontend-ui-ux skill 与现成组件。
7. 跑 `pnpm lint`；必要时 `pnpm build` 验证。
8. 提交信息用中文。
