# 🏝️ 布吉岛导航 - 核心应用 (App)

本目录为 **布吉岛导航 (Bujic Panel)** 的 Next.js 前后端核心项目包。

> [!TIP]
> 完整的项目描述与部署文档请参阅根目录的 [README.md](file:///Users/guojc/Documents/UGit/bujic-Panel/README.md)。

---

## 🚀 本地开发快速开始

### 1. 安装依赖
在当前目录下执行：
```bash
pnpm install
```

### 2. 配置环境变量
在当前目录下创建 `.env` 文件，用于指定数据存放路径：
```env
DATA_DIR="data"
```
*如果不指定，默认使用当前目录下的 `data` 目录。*

### 3. 数据库初始化 (Migrate & Seed)
执行数据库结构推送与初始数据灌入：
```bash
pnpm db:setup
```
> 该命令会同步 SQLite 数据库结构并生成默认数据。
>
> 默认管理员账号为：
> - **用户名**：`admin`
> - **密码**：`admin`

### 4. 启动开发服务器
```bash
pnpm dev
```
访问 [http://localhost:3000](http://localhost:3000) 查看导航系统效果。

---

## 🛠️ 可用命令脚本

在 `package.json` 中定义了以下便捷命令：

- `pnpm dev`：启动 Next.js 本地开发服务。
- `pnpm build`：编译并构建生产环境包。
- `pnpm start`：以生产模式启动已编译的服务。
- `pnpm db:setup`：快速执行数据库模式推送并导入初始示例数据。
- `pnpm db:push`：推送 Prisma Schema 结构到当前 SQLite 数据库。
- `pnpm db:seed`：执行 `prisma/seed.ts` 生成示例分组和常用书签。
- `pnpm db:migrate`：在生产环境下部署 Prisma 迁移记录。
