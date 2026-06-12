import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prismaClientSingleton = () => {
  let databaseUrl: string;

  // 优先使用 DATA_DIR 推导数据库绝对路径
  // 未设置 DATA_DIR 时使用默认值 'data'（相对于 app 目录）
  const dataDir = process.env.DATA_DIR || 'data';
  const absoluteDbPath = path.resolve(process.cwd(), dataDir, 'database', 'database.db');

  // 确保数据库文件所在的父文件夹存在
  const dbDir = path.dirname(absoluteDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  databaseUrl = `file:${absoluteDbPath}`;

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: { db: { url: databaseUrl } },
  });

  // 异步执行 SQLite 并发读写优化配置 (WAL)
  client.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`).catch((err) => {
    console.error('Failed to set journal_mode to WAL:', err);
  });
  client.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`).catch((err) => {
    console.error('Failed to set synchronous to NORMAL:', err);
  });
  client.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`).catch((err) => {
    console.error('Failed to set busy_timeout:', err);
  });

  return client;
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = db;
}
