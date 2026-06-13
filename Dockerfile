# ==========================================
# 阶段 1: 构建阶段 (Builder)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@11.6.0 && npm cache clean --force

# 1. 复制依赖定义并安装
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2. 复制 Schema 并生成 Prisma 客户端
COPY app/prisma/schema.prisma ./prisma/
RUN pnpm exec prisma generate

# 3. 编译 Next.js 生产产物
COPY app/ .
RUN pnpm build

# 4. 编译种子文件并生成 current.sql
RUN pnpm exec tsc prisma/seed.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck
RUN pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/current.sql

# ==========================================
# 阶段 2: 运行阶段 (Runner)
# ==========================================
FROM alpine:3.20 AS runner

WORKDIR /app

# 安装最轻量的 Node.js 运行时、openssl 和 CA 证书
RUN apk add --no-cache nodejs openssl ca-certificates

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    SECURE_COOKIE=false

# 1. 复制 Next.js 核心 standalone 产物与配置
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.js ./

EXPOSE 3000

# 优雅停机直占 PID 1 进程
CMD ["node", "start.js"]