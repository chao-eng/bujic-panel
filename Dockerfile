# 阶段 1: 构建阶段 (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖定义并安装 (包含开发依赖以进行打包构建)
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 复制应用源码
COPY app/ .

# 生成 Prisma 客户端
RUN pnpm exec prisma generate

# 编译 Next.js 生产产物 (已在 next.config.ts 中启用 standalone 模式)
RUN pnpm build

# 编译 seed.ts 种子文件为 seed.js，方便在 runner 阶段以纯 node 环境运行 (免去安装 tsx 依赖)
RUN pnpm exec tsc prisma/seed.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# 阶段 2: 运行阶段 (Runner)
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 openssl 确保 Prisma Engine (Rust 编写的本地二进制文件) 在 Alpine 下正常运行
# 并在全局安装相同版本的 prisma (用于执行数据库迁移部署，锁定 v6 以防 v7 破坏性变更破坏构建)，随后清理 npm 缓存
RUN apk add --no-cache openssl && \
    npm install -g prisma@6.19.3 && \
    npm cache clean --force

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# 从构建阶段中复制 Next.js standalone 打包产物 (仅包含运行所需的代码及精简后的生产 node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# 暴露端口
EXPOSE 3000

# 容器启动时：
# 1. 自动执行数据库迁移确保表结构为最新状态 (prisma migrate deploy)
# 2. 运行编译后的 seed.js (node prisma/seed.js) 导入种子数据 (如果不存在)
# 3. 使用 node server.js 启动 Next.js Standalone 服务 (省去 next cli 和 devDependencies 带来的几百兆开销)
CMD ["sh", "-c", "prisma migrate deploy && node prisma/seed.js && node server.js"]
