const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. 推导数据库路径与 URL
const dataDir = process.env.DATA_DIR || "/app/data";
const dbPath = path.isAbsolute(dataDir) 
  ? path.join(dataDir, "database", "database.db") 
  : path.resolve(process.cwd(), dataDir, "database", "database.db");

const dbDir = path.dirname(dbPath);
fs.mkdirSync(dbDir, { recursive: true });

process.env.DATABASE_URL = `file:${dbPath}`;
console.log(`[Start] DATABASE_URL 设置为: ${process.env.DATABASE_URL}`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`
    }
  }
});

// SQL 分割辅助函数：过滤注释并按行结束分号拆分
function splitSqlStatements(sqlContent) {
  const statements = [];
  let currentStatement = '';
  const lines = sqlContent.split(/\r?\n/);
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) {
      continue; // 忽略注释行
    }
    if (!trimmed) {
      continue; // 忽略空行
    }
    
    currentStatement += line + '\n';
    if (trimmed.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements.filter(stmt => stmt.length > 0);
}

async function syncDatabaseSchema() {
  try {
    console.log("[Start] 正在检查数据库表结构...");

    // 1. 检查核心表 user 是否存在
    let isDbEmpty = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "user" LIMIT 1`;
      console.log("[Start] 核心表 user 存在，跳过初始化。");
    } catch (e) {
      isDbEmpty = true;
    }

    // 2. 如果不存在，直接利用 prisma/current.sql 动态同步 DDL
    if (isDbEmpty) {
      console.log("[Start] 核心表未检测到，全新环境，开始根据最新的 schema 自动生成表...");
      const schemaSqlPath = path.join(__dirname, 'prisma', 'current.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const sql = fs.readFileSync(schemaSqlPath, 'utf8');
        const statements = splitSqlStatements(sql);
        for (const statement of statements) {
          await prisma.$executeRawUnsafe(statement);
        }
        console.log("[Start] 数据库表结构同步成功！");
      } else {
        console.warn(`[Start] 未找到 DDL 脚本: ${schemaSqlPath}，跳过表初始化。请在开发环境运行 pnpm db:sql 生成此文件。`);
      }
    }
  } catch (error) {
    console.error("[Start] 数据库初始化失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // 1. 同步数据库
  await syncDatabaseSchema();

  // 2. 执行数据填充 (Seed)
  try {
    const seedPath = path.join(__dirname, "prisma", "seed.js");
    if (fs.existsSync(seedPath)) {
      console.log("[Start] 检测到 seed.js，正在填充初始数据...");
      require(seedPath);
    }
  } catch (err) {
    console.error("[Start] 填充数据失败:", err);
  }

  // 3. 启动 Next.js 主服务
  console.log("[Start] 正在启动 Next.js 服务...");
  require("./server.js");
}

main().catch(err => {
  console.error("[Start] 启动失败:", err);
  process.exit(1);
});
