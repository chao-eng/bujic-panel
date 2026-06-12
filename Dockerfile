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

# 备份并精简 Prisma CLI 及其二进制引擎，仅保留数据库迁移必需的 schema-engine，极大地压缩体积
# -L 用于解引用 symlinks，保证复制的是实际文件而非 pnpm 软链接
RUN mkdir -p /app/pruned-prisma/node_modules/@prisma && \
    cp -rL node_modules/prisma /app/pruned-prisma/node_modules/prisma && \
    cp -rL node_modules/@prisma/engines /app/pruned-prisma/node_modules/@prisma/engines && \
    cp -rL node_modules/@prisma/config /app/pruned-prisma/node_modules/@prisma/config && \
    rm -f /app/pruned-prisma/node_modules/@prisma/engines/query-engine-* && \
    rm -f /app/pruned-prisma/node_modules/@prisma/engines/libquery-engine-* && \
    rm -f /app/pruned-prisma/node_modules/@prisma/engines/prisma-fmt-*

# 阶段 2: 运行阶段 (Runner)
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 openssl 确保 Prisma Engine (Rust 编写的本地二进制文件) 在 Alpine 下正常运行
RUN apk add --no-cache openssl

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# 从构建阶段中复制 Next.js standalone 打包产物 (仅包含运行所需的代码及精简后的生产 node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# 从构建阶段复制我们备份并精简后的 Prisma CLI 及其二进制迁移引擎 (避免在 Runner 阶段 npm install -g 产生上百兆开销)
COPY --from=builder /app/pruned-prisma/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/pruned-prisma/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/pruned-prisma/node_modules/@prisma/config ./node_modules/@prisma/config

# 暴露端口
EXPOSE 3000

# 容器启动时：
# 1. 动态解析并导出 DATABASE_URL，确保支持运行时修改 DATA_DIR，并提前创建数据库目录以防 Prisma 报错
# 2. 自动执行数据库迁移确保表结构为最新状态 (使用我们复制出来的轻量级本地 Prisma CLI 运行 migrate deploy)
# 3. 运行编译后的 seed.js (node prisma/seed.js) 导入种子数据 (如果不存在)
# 4. 使用 node server.js 启动 Next.js Standalone 服务 (省去 next cli 开销)
CMD ["sh", "-c", "export DATABASE_URL=\"file:${DATA_DIR}/database/database.db\" && mkdir -p \"${DATA_DIR}/database\" && node node_modules/prisma/build/index.js migrate deploy && node prisma/seed.js && node server.js"]
