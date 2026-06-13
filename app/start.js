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

async function runMigrations() {
  try {
    console.log("[Start] 正在检查并执行数据库结构迁移...");
    
    // 初始化 _prisma_migrations 表（如果不存在）
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          "id"                    TEXT PRIMARY KEY NOT NULL,
          "checksum"              TEXT NOT NULL,
          "finished_at"           DATETIME,
          "migration_name"        TEXT NOT NULL,
          "logs"                  TEXT,
          "rolled_back_at"        DATETIME,
          "started_at"            DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
          "applied_steps_count"   INTEGER DEFAULT 0 NOT NULL
      );
    `);

    // 读取所有的迁移目录
    const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log("[Start] 未找到 prisma/migrations 目录，跳过迁移步骤。");
      return;
    }

    const migrationNames = fs.readdirSync(migrationsDir)
      .filter(name => {
        const fullPath = path.join(migrationsDir, name);
        return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'migration.sql'));
      })
      .sort(); // 升序排序，保证按时间戳顺序应用

    // 查询已应用的迁移
    const appliedMigrations = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`
    );
    const appliedSet = new Set(appliedMigrations.map(m => m.migration_name));

    for (const migrationName of migrationNames) {
      if (appliedSet.has(migrationName)) {
        console.log(`[Start] 迁移 [${migrationName}] 已存在，跳过。`);
        continue;
      }

      console.log(`[Start] 正在应用新迁移: [${migrationName}]...`);
      const sqlPath = path.join(migrationsDir, migrationName, 'migration.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      // 拆分 SQL 语句逐条执行，防止 SQLite 驱动在单次 query 中不支持执行多条语句或 PRAGMA 不生效的问题
      const statements = splitSqlStatements(sqlContent);
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }

      // 写入迁移记录，生成兼容 Prisma 规范的数据
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES (?, ?, datetime('now'), ?, datetime('now'), 1)`,
        id, checksum, migrationName
      );

      console.log(`[Start] 迁移 [${migrationName}] 应用成功。`);
    }

    console.log("[Start] 数据库初始化与结构迁移完成。");
  } catch (error) {
    console.error("[Start] 数据库初始化/迁移失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // 1. 执行迁移
  await runMigrations();

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
