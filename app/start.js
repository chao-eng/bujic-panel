const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

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
    } catch {
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
    } else {
      // 2b. 存量库增量升级：按最新 DDL 为旧库补齐缺失的表与列
      //     通过建表/加列兜底（不破坏既有数据），后续数据回填在 seed 前由升级函数完成。
      await upgradeExistingSchema();
    }
  } catch (error) {
    console.error("[Start] 数据库初始化失败:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 表是否已存在
async function tableExists(name) {
  const rows = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}`;
  return Array.isArray(rows) && rows.length > 0;
}

// 幂等的存量结构升级：缺失则按 current.sql 补表，并补 item_icon_group.tab_id 列
async function upgradeExistingSchema() {
  // 1. 逐个检测 current.sql 里的表，缺哪张建哪张
  //    旧版本升级上来的库会缺新功能用到的表（例如 MCP 令牌表的 mcp_token）
  const schemaSqlPath = path.join(__dirname, 'prisma', 'current.sql');
  if (fs.existsSync(schemaSqlPath)) {
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
      const tableMatch = statement.match(/^CREATE TABLE "([^"]+)"/i);
      if (tableMatch) {
        const table = tableMatch[1];
        if (await tableExists(table)) continue;
        await prisma.$executeRawUnsafe(statement);
        console.log(`[Start] 存量库缺少 ${table} 表，已按最新结构补充。`);
        continue;
      }
      // 索引：表已存在时索引也已存在，重复创建会失败，忽略即可
      if (/^CREATE (UNIQUE )?INDEX/i.test(statement)) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch {}
      }
    }
  } else {
    console.warn(`[Start] 未找到 DDL 脚本: ${schemaSqlPath}，跳过存量表补齐。`);
  }

  // 2. 确保 item_icon_group.tab_id 列存在
  let hasTabId = false;
  try {
    const cols = await prisma.$queryRaw`PRAGMA table_info("item_icon_group")`;
    hasTabId = (cols || []).some((c) => c.name === 'tab_id');
  } catch {}
  if (!hasTabId) {
    console.log("[Start] 存量库缺少 item_icon_group.tab_id 列，正在补充...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "item_icon_group" ADD COLUMN "tab_id" INTEGER NOT NULL DEFAULT 0`);
  }
}

// 存量库数据回填：为每个尚无 Tab 的用户按旧 groupType 建 Tab 并回填 tabId（幂等）
async function backfillUserTabs() {
  console.log("[Start] 检查用户导航 Tab 数据（存量升级回填）...");
  const users = await prisma.$queryRaw`SELECT id FROM "user"`;
  for (const u of users) {
    const tabCount = await prisma.$queryRaw`SELECT COUNT(*) AS c FROM "view_tab" WHERE "user_id" = ${u.id}`;
    if (Number(tabCount[0].c) > 0) continue; // 已有 Tab，跳过

    const groups = await prisma.$queryRaw`
      SELECT id, "group_type" AS gtype FROM "item_icon_group" WHERE "user_id" = ${u.id} ORDER BY "sort" ASC, "created_at" ASC
    `;
    const tabs = [];
    if (groups.some((g) => g.gtype === 'website')) tabs.push({ name: '收藏', type: 'card' });
    if (groups.some((g) => g.gtype === 'webpage')) tabs.push({ name: '书签', type: 'list' });
    if (tabs.length === 0) tabs.push({ name: '常用', type: 'card' });

    const createdTabs = [];
    for (let i = 0; i < tabs.length; i++) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "view_tab" ("created_at", "updated_at", "name", "type", "sort", "user_id") VALUES (datetime('now'), datetime('now'), ?, ?, ?, ?)`,
        tabs[i].name, tabs[i].type, i + 1, u.id
      );
      const created = await prisma.$queryRaw`SELECT id, "type" AS ttype FROM "view_tab" WHERE "user_id" = ${u.id} ORDER BY "id" DESC LIMIT 1`;
      createdTabs.push({ id: Number(created[0].id), type: created[0].ttype });
    }

    for (const g of groups) {
      const target = createdTabs.find((t) => (g.gtype === 'webpage' ? t.type === 'list' : t.type === 'card'));
      const tabId = target ? target.id : createdTabs[0].id;
      await prisma.$executeRawUnsafe(
        `UPDATE "item_icon_group" SET "tab_id" = ?, "updated_at" = datetime('now') WHERE "id" = ? AND "user_id" = ?`,
        tabId, Number(g.id), u.id
      );
    }
    console.log(`[Start] 用户 ${u.id} Tab 回填完成（${tabs.length} 个 Tab，${groups.length} 个分组）。`);
  }
}

async function main() {
  // 1. 同步数据库
  await syncDatabaseSchema();

  // 1b. 存量库数据回填（升级新版本时执行，幂等）
  try {
    await backfillUserTabs();
  } catch (err) {
    console.error("[Start] 导航 Tab 数据回填失败:", err);
  }

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
