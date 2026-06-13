# 阶段 1: 构建阶段 (Builder)
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@11.6.0

# 复制依赖定义并安装 (包含开发依赖以进行打包构建)
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 复制应用源码
COPY app/ .

# 生成 Prisma 客户端
RUN pnpm exec prisma generate

# 编译 Next.js 生产产物 (已在 next.config.ts 中启用 standalone 模式)
RUN pnpm build

# 编译 seed.ts 种子文件为 seed.js，方便在 runner 阶段以纯 node env 运行 (免去安装 tsx 依赖)
RUN pnpm exec tsc prisma/seed.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# 提取并解引用 Prisma CLI 及其二进制引擎，用于后续 Runner 运行迁移（避免使用 pnpm 符号链接）
RUN mkdir -p /app/prisma-cli && \
    cp -rL /app/node_modules/prisma /app/prisma-cli/prisma && \
    cp -rL /app/node_modules/@prisma/engines /app/prisma-cli/@prisma/engines

# 阶段 2: 运行阶段 (Runner)
FROM node:22-alpine AS runner

WORKDIR /app

# 安装 openssl (SQLite 和 Prisma 运行依赖)
RUN apk add --no-cache openssl

# 设置生产环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV SECURE_COOKIE=false

# 从构建阶段中复制 Next.js standalone 打包产物 (仅包含运行所需的代码及精简后的生产 node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# 复制已解引用的 prisma CLI 和配套引擎，免去在 Runner 阶段下载安装的体积与网络耗时
COPY --from=builder /app/prisma-cli/prisma ./node_modules/prisma
COPY --from=builder /app/prisma-cli/@prisma/engines ./node_modules/@prisma/engines

# 极度精简无用的引擎二进制文件和非 SQLite 数据库的 Wasm 驱动
# 1. 在本地 prisma cli 引擎中，只保留 schema-engine (执行迁移所需)，删除 query-engine 和 formatter
# 2. 从项目 node_modules 中清理非 SQLite 驱动产物 (如 postgresql, mysql, cockroachdb, sqlserver) 以节省空间
RUN rm -f ./node_modules/@prisma/engines/query-engine-* \
          ./node_modules/@prisma/engines/libquery-engine-* \
          ./node_modules/@prisma/engines/prisma-fmt-* && \
    find ./node_modules/ -type f \( -name "*mysql*" -o -name "*postgresql*" -o -name "*cockroachdb*" -o -name "*sqlserver*" \) -delete

# 暴露端口
EXPOSE 3000

# 容器启动时：
# 1. 动态解析并导出 DATABASE_URL，确保支持运行时修改 DATA_DIR，并提前创建数据库目录以防 Prisma 报错
# 2. 执行数据库同步：使用 npx prisma 替代全局命令运行迁移，优先使用 migrate deploy；若报 P3005 则降级使用 db push；若均失败则警告并继续启动
# 3. 运行编译后的 seed.js (node prisma/seed.js) 导入种子数据 (如果不存在)
# 4. 使用 node server.js 启动 Next.js Standalone 服务 (省去 next cli 开销)
CMD ["sh", "-c", "export DATABASE_URL=\"file:${DATA_DIR}/database/database.db\" && mkdir -p \"${DATA_DIR}/database\" && (npx prisma migrate deploy || npx prisma db push --skip-generate || echo \"Warning: Database schema sync skipped\") && node prisma/seed.js && node server.js"]
