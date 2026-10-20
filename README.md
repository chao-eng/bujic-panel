# 🏝️ 布吉岛导航 (Bujic Panel)

[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-0c344b?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)

布吉岛导航是一个自托管的网站导航与书签管理面板，用 Next.js App Router、TailwindCSS v4 和 SQLite 写成，面向个人服务器、私有云和局域网环境。可以多用户共用，也可以只自己用。

数据全部存在一个 SQLite 文件里，不需要额外部署数据库；Docker 一条命令就能启动，挂载一个目录就能把全部数据带走。

---

## ✨ 核心特性

**两种展示形态。** 常用站点用卡片网格，需要写长备注的书签用列表。两种形态可以同时存在于一个面板里，按分组切换。

**12 套配色主题。** 午夜蓝图、宇宙、炽焰、极光、樱花、冰川六组配色，每组各有深色和浅色版，在设置面板里切换，选择记在浏览器本地。

**拖拽排序。** 基于 `@dnd-kit`，直接在页面上拖动卡片调整顺序，松手后排序结果写回数据库。

**两级搜索。** 顶部搜索框可以选 Google、Bing、Baidu 或 GitHub，选中的引擎下次打开还在；输入的同时也会对当前页书签做本地实时过滤。

**一键抓取网页信息。** 新建或编辑书签时填上 URL，后端会请求目标页面，取出标题和 Favicon 存到本地。标题抓不到时退回用域名，图标抓不到就留空。

**JSON 备份与恢复。** 面板配置可以整体导出成一个 JSON 文件，也能从备份文件导回来，用于迁移服务器或定期留档。

**用户与权限。** 分管理员和普通用户两种角色。管理后台负责用户增删改查和账号状态；用户在自己的个人中心改昵称、邮箱、头像和密码。

**服务监控组件。** 书签可以挂上 Beszel、Uptime Kuma、qBittorrent、Jellyfin、Umami 或 WireGuard 的监控组件，卡片上直接显示那个服务的实时状态，用法见下文的服务监控组件一节。

**MCP 接入。** 生成访问令牌后，AI 助手可以通过 MCP 协议读写你的导航空间、分组和书签，用法见下文的 MCP 接入一节。

**部署省事。** 存储位置由 `DATA_DIR` 一个环境变量决定，数据库文件和上传附件（头像、壁纸、图标）都归在这个目录下，Docker 挂载和备份都只需要处理它。

---

## 🛠️ 技术栈

- **前端框架** 用 [Next.js 16](https://nextjs.org) (App Router) 和 [React 19](https://react.dev)
- **样式方案** 用 [TailwindCSS v4](https://tailwindcss.com) 加 PostCSS
- **图标组件** 用 [Lucide React](https://lucide.dev)
- **拖拽** 用 [dnd-kit](https://dnd-kit.com)
- **数据层** 用 [Prisma](https://www.prisma.io) 读写 [SQLite](https://sqlite.org)
- **认证** 用 JWT（基于 `jose` 库）

---

## 🚀 快速开始

### 1. 环境准备

- [Node.js](https://nodejs.org/) 20.9 或更高版本（Docker 镜像里用的是 Node 22）
- [pnpm](https://pnpm.io/)（推荐），npm、yarn 也可以

### 2. 获取代码与安装依赖

进入 `app` 目录安装依赖。

```bash
cd app
pnpm install
```

### 3. 配置环境变量

在 `app` 目录下创建或修改 `.env` 文件，写入下面两行。

```env
DATA_DIR="data"

# 敏感信息传输加密密钥（64 位十六进制字符串，可用下方命令生成）
ENCRYPT_KEY=your_64_hex_chars_here
```

`DATA_DIR` 可以是相对路径，也可以是绝对路径。系统会在它下面自动创建 `database` 目录存放 SQLite 文件、`uploads` 目录存放上传文件；不填写时默认使用 `app/data`。

> [!IMPORTANT]
> `ENCRYPT_KEY` 用于对前后端传输中的敏感字段（登录密码、Widget 凭证等）做 **AES-256-GCM** 加密，避免明文出现在网络请求体中。生产环境必须自行设置，用这条命令生成随机值。
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> 不设置的话，系统会退回内置密钥，只适合本地开发或试用。修改这个密钥不影响已有会话，它只作用于传输层，不改变数据库里的存储格式。

### 4. 数据库初始化 (Migrate & Seed)

```bash
pnpm db:setup
```

这条命令先跑 `prisma db push` 同步表结构，再执行 `prisma/seed.ts` 灌入默认数据。默认创建的管理员账号是 `admin` / `admin`。

### 5. 启动开发服务器

```bash
pnpm dev
```

启动后浏览器访问 [http://localhost:3000](http://localhost:3000)。

### 6. 构建与生产运行

```bash
pnpm build
pnpm start
```

---

## 🐳 Docker 部署（推荐）

项目提供预构建镜像，无需下载源码，一条命令即可运行。

### 方式一：Docker Compose（推荐）

创建 `docker-compose.yml`。

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

启动命令如下。

```bash
docker compose up -d
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

> [!NOTE]
> 默认管理员账号 `admin` / `admin`，首次登录后请立即修改密码。

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
  -e ENCRYPT_KEY=your_64_hex_chars_here \
  crpi-a1liy20beodq2bdl.cn-beijing.personal.cr.aliyuncs.com/bujic/bujic-panel:latest
```

### 方式三：自行构建镜像（高级）

<details>
<summary>展开查看自行构建步骤</summary>

在仓库根目录构建并运行。

```bash
# 构建镜像
docker build -t bujic-panel .

# 运行容器
docker run -d \
  --name bujic-panel \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -e ENCRYPT_KEY=your_64_hex_chars_here \
  bujic-panel
```

镜像由仓库根目录的 [Dockerfile](./Dockerfile) 多阶段构建。builder 阶段安装依赖、生成 Prisma Client 并编译 Next.js 产物；runner 阶段基于 alpine 只保留 standalone 产物和 `node start.js` 启动脚本，体积比完整 Node 镜像小得多。

容器启动时 `start.js` 会先推导数据库路径、按 `prisma/current.sql` 建表、补齐旧版本缺失的表和字段，再灌入种子数据，最后拉起 Next.js 服务。所以新环境不需要手动执行数据库初始化。

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
│   ├── start.js              # 容器启动入口 (建表、升级、种子、起服务)
│   ├── src/
│   │   ├── actions/          # Next.js Server Actions (逻辑操作API)
│   │   ├── app/              # Next.js App Router 页面及 API 路由
│   │   │   ├── api/          # 接口：Favicon 抓取、文件上传、Widget 状态等
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

## 📊 服务监控组件 (Widget)

书签可以挂一个监控组件，卡片上直接显示那个服务的实时状态。内置 6 种。

| 组件 | 显示内容 |
| --- | --- |
| Beszel | 在线状态、CPU、内存、磁盘占用、运行时长、温度 |
| Uptime Kuma | 监控项总数、在线数、离线数、平均延迟 |
| qBittorrent | 下载与上传速度、累计流量、连接状态、下载中与已完成数量 |
| Jellyfin | 电影数、剧集数、单集数，以及正在播放的会话 |
| Umami | 访客数、访问次数、浏览量 |
| WireGuard (wg-easy) | 客户端总数、已启用数、在线数、收发流量 |

在编辑书签时选择组件类型，填上服务地址和凭证即可。各组件要的凭证不一样，Beszel 要邮箱、密码和系统名称，qBittorrent 要用户名和密码，Jellyfin 要 API Key，Umami 要用户名、密码和网站域名，wg-easy 要密码，Uptime Kuma 要监控 slug（默认 `default`）。地址填组件后台自己的地址，例如 `http://192.168.1.10:8090`。

刷新间隔按类型区分，Beszel、qBittorrent、Uptime Kuma 默认 5 秒，Jellyfin、Umami、wg-easy 默认 30 秒。可以在书签里单独改，范围 2 秒到 300 秒。页面切到后台时轮询暂停，回到前台立即恢复。

取数在服务端完成。前端只请求 `/api/widgets/stats`，后端并发去连各个组件，单个组件 5 秒超时，某个组件连不上只会让那张卡片报错，不影响其他书签。组件服务用自签名 HTTPS 证书也能连上，这种情况下服务端会关闭 TLS 证书校验（`NODE_TLS_REJECT_UNAUTHORIZED`）。

---

## 🤖 MCP 接入

面板内置了一个 MCP (Model Context Protocol) 端点，AI 助手可以按协议读写你自己的导航空间、分组和书签，也能查询监控组件的状态。端点是 `/api/mcp`，走 Streamable HTTP 传输，用 `Authorization: Bearer mcp_xxx` 鉴权，不依赖 Cookie。

在「设置 → MCP 接入」里生成令牌，每个用户最多 5 个。令牌分只读和读写两种权限，只读令牌只能调用查询类工具，写操作会被服务端拒绝。明文只在生成时显示一次，数据库里存的是 SHA-256 哈希，令牌删除或停用后立即失效，用户被停用后令牌也跟着失效。

客户端配置示例，把 `YOUR_MCP_TOKEN` 换成上一步生成的令牌。

```json
{
  "mcpServers": {
    "bujic-panel": {
      "type": "http",
      "url": "http://your-host:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}
```

目前提供 20 个工具，按导航空间、分组、书签、监控四层划分，覆盖查看概览与统计、增删改与排序、搜索书签、批量创建、查询组件实时状态，另有一个 `panel_health_check` 用于确认连通性。删除类工具要求显式传 `confirm: true`，必须先征得用户同意。协议版本按 MCP 2025-06-18 实现，支持 `initialize`、`ping`、`tools/list`、`tools/call` 以及批量 JSON-RPC。

---

## 🔒 安全与优化

1. **敏感信息加密传输**。登录密码、修改密码、Widget 第三方服务凭证（Beszel、qBittorrent、Jellyfin、Umami 等）在提交前都会在前端做 **AES-256-GCM** 加密，服务端解密后再处理，明文不会出现在网络请求体或代理日志中。密钥由 `ENCRYPT_KEY` 控制，服务端通过 HMAC 派生客户端密钥，主密钥不下发到浏览器。
   - 在 HTTPS 或 localhost 下，前端走浏览器原生的 **Web Crypto API**（`window.crypto.subtle`），性能最好。
   - 纯 HTTP 访问时浏览器会禁用这套 API，系统自动降级到纯 JavaScript 密码学库（`@noble/ciphers`），加密强度不变，HTTP 传输同样是前端加密的。
   - HTTP 协议本身的会话和中间数据仍有被中间人攻击的风险，**外网部署时请配置并强制使用 HTTPS**。内网 HTTP 环境下如果想用原生 Web Crypto，可以在 Chrome/Edge 的 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 里填入你的访问地址。
2. **目录穿越防御**。`/uploads` 路由对请求路径做 `path.resolve` 与 `startsWith` 双重校验，杜绝用 `../` 的相对路径读取宿主机系统文件。
3. **SQLite 并发优化 (WAL)**。`src/lib/db.ts` 初始化连接时自动执行三条 PRAGMA，`journal_mode = WAL` 开启预写日志提升并发读写，`synchronous = NORMAL` 在安全性与写盘开销之间折中，`busy_timeout = 5000` 避免多并发写入时频繁抛出 locked 错误。
4. **文件上传过滤**。单个文件最大 10MB，文件名取内容 MD5，重名文件不会互相覆盖。

---

## 📄 开源协议

本项目采用 MIT 协议开源。
