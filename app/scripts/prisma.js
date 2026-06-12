#!/usr/bin/env node
/**
 * Prisma 命令代理脚本
 * 自动从 DATA_DIR 环境变量推导 DATABASE_URL 后，再执行传入的 Prisma CLI 命令。
 * 用法: node scripts/prisma.js db push
 *       node scripts/prisma.js migrate deploy
 */

const path = require('path');
const { execSync } = require('child_process');

// 加载 .env 文件（如果存在）
try {
  require('fs').readdirSync('.');
  const dotenvPath = path.resolve(process.cwd(), '.env');
  if (require('fs').existsSync(dotenvPath)) {
    const content = require('fs').readFileSync(dotenvPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

// 从 DATA_DIR 推导 DATABASE_URL
if (!process.env.DATABASE_URL) {
  const dataDir = process.env.DATA_DIR || 'data';
  const absoluteDbPath = path.resolve(process.cwd(), dataDir, 'database', 'database.db');
  process.env.DATABASE_URL = `file:${absoluteDbPath}`;
  console.log(`[db] DATABASE_URL 自动推导为: ${process.env.DATABASE_URL}`);
}

// 执行传入的 prisma 子命令
const args = process.argv.slice(2);

// db seed 特殊处理：直接用 tsx 运行，保证继承当前环境变量
if (args.join(' ') === 'db seed') {
  const cmd = `npx tsx prisma/seed.ts`;
  console.log(`[db] 执行: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
} else {
  const cmd = `npx prisma ${args.join(' ')}`;
  console.log(`[db] 执行: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
}
