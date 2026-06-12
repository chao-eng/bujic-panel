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
RUN npx prisma generate

# 编译 Next.js 生产产物
RUN pnpm build

# 阶段 2: 运行阶段 (Runner)
FROM node:20-alpine AS runner

WORKDIR /app

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# 全局安装 pnpm 以及 tsx (在无外网生产环境中运行 TypeScript seed 种子脚本时无需现场下载 tsx)
RUN npm install -g pnpm tsx

# 复制依赖定义并只安装生产依赖
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# 从构建器中复制所需的编译产物和静态文件
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# 暴露端口
EXPOSE 3000

# 容器启动时：
# 1. 自动执行数据库迁移确保表结构为最新状态 (db:migrate)
# 2. 自动检查数据库中是否存在默认管理员和默认站点，如为空则进行种子数据灌入 (db:seed)
# 3. 启动 Next.js 生产服务器
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed && pnpm start"]
