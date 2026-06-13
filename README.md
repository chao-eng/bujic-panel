# 🏝️ 布吉岛导航 (Bujic Panel)

[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-0c344b?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

**布吉岛导航 (Bujic Panel)** 是一款基于 Next.js Fullstack (App Router) + TailwindCSS v4 + SQLite 开发的高颜值、自托管、多用户的网站导航与书签管理系统。它兼具极致的视觉设计和流畅的交互体验，支持深度自定义，非常适合个人服务器、私有云和局域网部署。

---

## ✨ 核心特性

- 🎨 **高颜值视觉设计**
  - 内置 12 套精心雕琢的配色主题（如“午夜蓝图”、“深空宇宙”、“樱花深色”、“暖阳浅色”等），支持深色与浅色模式。
  - 采用现代磨砂玻璃质感（Glassmorphism）、微交互动画和响应式网格布局。
- 🔄 **双展示模式**
  - **网站模式**：经典的卡片式导航，适合高频使用的常用工具与网站。
  - **网页模式**：带有详细描述、长文本备注的信息流式列表，适合深度网页书签管理。
- 🖱️ **无缝拖拽排序**
  - 基于 `@dnd-kit` 实现，用户可直接在页面上拖拽书签卡片进行实时排序，操作结果自动保存至后台。
- 🔍 **搜索引擎与智能检索**
  - 支持快捷搜索框，可自定义搜索引擎，并支持对当前页面书签进行秒级的本地关键字模糊过滤。
- 🕷️ **一键抓取元数据**
  - 添加或编辑书签时，输入 URL 即可在后端一键抓取目标网页的标题（Title）和 Favicon 图标，省去手动填写的繁琐。
- 📦 **数据备份与恢复**
  - 支持一键导出完整的 JSON 格式备份，并支持从备份文件重新导入，方便数据迁移与跨设备备份。
- 👥 **多用户与权限管理**
  - 内置精细的用户权限系统（管理员/普通用户），提供专门的管理后台、用户增删改查以及状态控制。
  - 支持个人中心修改昵称、邮箱、头像以及密码。
- 🐳 **容器化与自托管友好**
  - 基于 SQLite 嵌入式数据库，免去复杂的外部数据库部署。
  - 核心存储路径由 `DATA_DIR` 环境变量统一控制，数据库文件与用户上传附件（头像、壁纸、图标）全部归口存放，极易进行 Docker 容器挂载与备份。

---

## 🛠️ 技术栈

- **前端框架**：[Next.js 16](https://nextjs.org) (App Router) & [React 19](https://react.dev)
- **样式方案**：[TailwindCSS v4](https://tailwindcss.com) & PostCSS
- **图标组件**：[Lucide React](https://lucide.dev)
- **拖拽库**：[dnd-kit](https://dnd-kit.com)
- **ORM / 数据库**：[Prisma](https://www.prisma.io) & [SQLite](https://sqlite.org)
- **权限认证**：JWT (基于 `jose` 库)

---

## 🚀 快速开始

### 1. 环境准备
确保您的系统安装了：
- [Node.js](https://nodejs.org/) (推荐 v18+ 或 v20+)
- [pnpm](https://pnpm.io/) (推荐) 或 npm / yarn

### 2. 获取代码与安装依赖
首先进入 `app` 目录并安装依赖：
```bash
cd app
pnpm install
```

### 3. 配置环境变量
在 `app` 目录下创建或修改 `.env` 文件：
```env
DATA_DIR="data"

# 敏感信息传输加密密钥（64 位十六进制字符串，可用下方命令生成）
ENCRYPT_KEY=your_64_hex_chars_here
```

> [!NOTE]
> `DATA_DIR` 路径可以是相对路径或绝对路径。系统会自动在其下创建 `database` 文件夹存放 SQLite 数据库文件，以及 `uploads` 文件夹存放上传的文件。如果不指定，默认使用 `app/data`。

> [!IMPORTANT]
> `ENCRYPT_KEY` 用于对前后端传输中的敏感字段（登录密码、Widget 凭证等）进行 **AES-256-GCM** 加密，防止明文出现在网络请求体中。
> - 生产环境**必须**自定义此密钥，请使用以下命令生成随机值：
>   ```bash
>   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
>   ```
> - 若未设置，系统将使用内置 fallback 密钥（仅适用于本地开发/体验，**不应用于生产**）。
> - 修改此密钥后，已有的会话不受影响（密钥仅作用于传输层，不影响数据库存储格式）。

### 4. 数据库初始化 (Migrate & Seed)
执行数据库推送与初始数据灌入脚本：
```bash
pnpm db:setup
```
> 该命令会运行 `prisma db push` 同步数据库结构，并调用 `prisma/seed.ts` 生成默认数据。
>
> 默认创建的管理员账号为：
> - **用户名**：`admin`
> - **密码**：`admin`

### 5. 启动开发服务器
```bash
pnpm dev
```
启动后，可在浏览器访问：[http://localhost:3000](http://localhost:3000)

### 6. 构建与生产运行
```bash
pnpm build
pnpm start
```

---

## 🐳 Docker 部署（推荐）

项目提供预构建的 Docker 镜像，**无需下载源码，一条命令即可运行**。

### 方式一：Docker Compose（推荐）

创建 `docker-compose.yml`：
```yaml
version: '3.8'
services:
  bujic-panel:
    image: crpi-a1liy20beodq2bdl.cn-beijing.personal.cr.aliyuncs.com/bujic/bujic-panel:latest
    container_name: bujic-panel
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATA_DIR=/app/data
      - ENCRYPT_KEY=your_64_hex_chars_here  # 生产必填，见下方说明
```

启动服务：
```bash
docker compose up -d
```

启动后访问 [http://localhost:3000](http://localhost:3000)

> [!NOTE]
> 默认管理员账号：**admin** / **admin**，首次登录后请立即修改密码。

> [!TIP]
> 数据（数据库 + 上传文件）统一保存在宿主机的 `./data` 目录中，升级镜像时数据不会丢失。

### 方式二：Docker Run（快速体验）

```bash
docker run -d \
  --name bujic-panel \
  --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -e DATA_DIR=/app/data \
  crpi-a1liy20beodq2bdl.cn-beijing.personal.cr.aliyuncs.com/bujic/bujic-panel:latest
```

### 方式三：自行构建镜像（高级）

<details>
<summary>展开查看自行构建步骤</summary>

在项目根目录执行：
```bash
# 构建镜像
docker build -t bujic-panel .

# 运行容器
docker run -d \
  --name bujic-panel \
  -p 3000:3000 \
  -v /my/local/data:/app/data \
  bujic-panel
```

参考 `Dockerfile`（多阶段构建）：
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY app/package.json app/pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY app/ .
RUN npx prisma generate
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

RUN npm install -g pnpm
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
```

</details>

---

## 📁 项目目录结构

```text
bujic-Panel/
├── app/                      # 核心应用目录
│   ├── prisma/               # Prisma schema 与种子脚本
│   │   ├── schema.prisma     # 数据库结构定义
│   │   └── seed.ts           # 默认数据生成脚本
│   ├── scripts/              # 数据库辅助脚本 (代理 Prisma CLI)
│   ├── src/
│   │   ├── actions/          # Next.js Server Actions (逻辑操作API)
│   │   ├── app/              # Next.js App Router 页面及 API 路由
│   │   │   ├── api/          # 接口：一键爬取 Favicon、文件上传等
│   │   │   ├── login/        # 登录页面
│   │   │   ├── uploads/      # 安全文件读取代理 (防御目录穿越)
│   │   │   └── page.tsx      # 主导航大盘页面
│   │   ├── components/       # 可重用 UI 组件 (主题设置、分组管理、书签网格)
│   │   └── lib/              # 工具库 (数据库连接、JWT认证、多语言、主题数据)
│   ├── package.json          # 项目依赖与运行脚本
│   └── tailwind.config.ts    # 样式配置
└── README.md                 # 项目自述文件 (本文件)
```

---

## 🔒 安全与优化

1. **敏感信息加密传输**：登录密码、修改密码、Widget 第三方服务凭证（Beszel、qBittorrent、Jellyfin、Umami 等）在提交前均经过 **AES-256-GCM** 客户端加密，服务端解密后再进行后续处理，防止明文凭证出现在网络请求体或代理日志中。加密密钥由 `ENCRYPT_KEY` 环境变量控制，服务端通过 HMAC 派生客户端密钥，主密钥从不暴露到前端。
2. **目录穿越防御**：`/uploads` 路由经过严苛的 `path.resolve` 与 `startsWith` 校验，杜绝通过相对路径 `../` 读取宿主机系统文件的风险。
3. **SQLite 并发优化 (WAL)**：在 `src/lib/db.ts` 初始化数据库连接时，自动执行：
   - `PRAGMA journal_mode = WAL;`（启用预写日志，提高高并发读写性能）。
   - `PRAGMA synchronous = NORMAL;`（平衡安全性与物理写盘开销）。
   - `PRAGMA busy_timeout = 5000;`（防止 SQLite 多并发写入时频繁抛出 locked 错误）。
4. **文件上传过滤**：限定文件上传大小最大为 10MB，上传内容基于文件 MD5 散列命名，避免文件名重复冲突。

---

## 📄 开源协议

本项目采用 MIT 协议开源。
