import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// 与 db.ts 保持一致，从 DATA_DIR 推导数据库绝对路径
const dataDir = process.env.DATA_DIR || 'data';
const absoluteDbPath = path.resolve(process.cwd(), dataDir, 'database', 'database.db');
const dbDir = path.dirname(absoluteDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const databaseUrl = `file:${absoluteDbPath}`;

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

function passwordEncryption(password: string): string {
  return md5(md5(md5(password)));
}

async function main() {
  console.log('开始 Seed 数据...');

  // 1. 初始化管理员账户
  const userCount = await prisma.user.count();
  let adminUserId = 1;
  if (userCount === 0) {
    const adminUser = await prisma.user.create({
      data: {
        id: 1,
        username: 'admin',
        password: passwordEncryption('admin'),
        name: '管理员',
        mail: 'admin@example.com',
        status: 1,
        role: 1,
      },
    });
    console.log('成功创建默认管理员账户: admin/admin');
    adminUserId = adminUser.id;
  } else {
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (admin) {
      adminUserId = admin.id;
    }
  }

  // 2. 初始化示例分组与站点/书签 (如果没有分组数据)
  const groupCount = await prisma.itemIconGroup.count();
  if (groupCount === 0) {
    // 创建分组
    const group1 = await prisma.itemIconGroup.create({
      data: {
        title: '常用网站',
        sort: 1,
        groupType: 'website',
        icon: 'material-symbols:language',
        userId: adminUserId,
      },
    });
    const group2 = await prisma.itemIconGroup.create({
      data: {
        title: '技术博客',
        sort: 2,
        groupType: 'website',
        icon: 'material-symbols:book',
        userId: adminUserId,
      },
    });
    const group3 = await prisma.itemIconGroup.create({
      data: {
        title: '视频娱乐',
        sort: 3,
        groupType: 'website',
        icon: 'material-symbols:web-asset',
        userId: adminUserId,
      },
    });

    console.log('成功创建默认分组');

    // 创建书签数据 (存储 iconJson 作为 stringified JSON)
    const googleIcon = JSON.stringify({ itemType: 1, src: 'https://www.google.com/favicon.ico' });
    const githubIcon = JSON.stringify({ itemType: 1, src: 'https://github.com/favicon.ico' });
    const baiduIcon = JSON.stringify({ itemType: 1, src: 'https://www.baidu.com/favicon.ico' });
    const zhihuIcon = JSON.stringify({ itemType: 1, src: 'https://www.zhihu.com/favicon.ico' });
    const csdnIcon = JSON.stringify({ itemType: 1, src: 'https://blog.csdn.net/favicon.ico' });
    const youtubeIcon = JSON.stringify({ itemType: 1, src: 'https://www.youtube.com/favicon.ico' });

    await prisma.itemIcon.createMany({
      data: [
        {
          title: 'Google',
          url: 'https://www.google.com',
          iconJson: googleIcon,
          itemIconGroupId: group1.id,
          userId: adminUserId,
          sort: 1,
        },
        {
          title: 'GitHub',
          url: 'https://github.com',
          iconJson: githubIcon,
          itemIconGroupId: group1.id,
          userId: adminUserId,
          sort: 2,
        },
        {
          title: 'Baidu',
          url: 'https://www.baidu.com',
          iconJson: baiduIcon,
          itemIconGroupId: group1.id,
          userId: adminUserId,
          sort: 3,
        },
        {
          title: '知乎',
          url: 'https://www.zhihu.com',
          iconJson: zhihuIcon,
          itemIconGroupId: group2.id,
          userId: adminUserId,
          sort: 1,
        },
        {
          title: 'CSDN',
          url: 'https://blog.csdn.net',
          iconJson: csdnIcon,
          itemIconGroupId: group2.id,
          userId: adminUserId,
          sort: 2,
        },
        {
          title: 'YouTube',
          url: 'https://www.youtube.com',
          iconJson: youtubeIcon,
          itemIconGroupId: group3.id,
          userId: adminUserId,
          sort: 1,
        },
      ],
    });

    // 创建示例网页数据（网页模式 - 信息流）
    const toutiaoIcon = JSON.stringify({ itemType: 1, src: 'https://www.toutiao.com/favicon.ico' });
    const runoobIcon = JSON.stringify({ itemType: 1, src: 'https://www.runoob.com/favicon.ico' });
    const giteeIcon = JSON.stringify({ itemType: 1, src: 'https://gitee.com/favicon.ico' });
    const v2exIcon = JSON.stringify({ itemType: 1, src: 'https://www.v2ex.com/favicon.ico' });

    await prisma.itemIcon.createMany({
      data: [
        {
          title: '科技动态 - 今日头条',
          url: 'https://www.toutiao.com/',
          iconJson: toutiaoIcon,
          description: '实时科技资讯',
          itemIconGroupId: group2.id,
          userId: adminUserId,
          sort: 10,
        },
        {
          title: '编程教程 - 菜鸟教程',
          url: 'https://www.runoob.com/',
          iconJson: runoobIcon,
          description: '入门编程教程',
          itemIconGroupId: group2.id,
          userId: adminUserId,
          sort: 11,
        },
        {
          title: '开源项目 - Gitee',
          url: 'https://gitee.com/',
          iconJson: giteeIcon,
          description: '代码托管平台',
          itemIconGroupId: group1.id,
          userId: adminUserId,
          sort: 4,
        },
        {
          title: '技术社区 - V2EX',
          url: 'https://www.v2ex.com/',
          iconJson: v2exIcon,
          description: '程序员讨论社区',
          itemIconGroupId: group2.id,
          userId: adminUserId,
          sort: 12,
        },
      ],
    });

    console.log('成功创建默认示例书签数据');
  }

  console.log('Seed 数据完成。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
