import { getCurrentUser } from '../lib/auth';
import { db } from '../lib/db';
import { redirect } from 'next/navigation';
import Dashboard from '../components/Dashboard';
import { ensureUserTabs } from '../lib/nav';
import { getSiteBrand } from '../lib/settings';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // 保证至少有一个导航 Tab（含存量升级回填），再取分组
  await ensureUserTabs(user.id);

  // 获取所有导航 Tab 与分组
  const tabs = await db.viewTab.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  });

  let groups = await db.itemIconGroup.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  // 如果没有分组，自动初始化一个示例分组（放入第一个 Tab）
  if (groups.length === 0 && tabs.length > 0) {
    await db.$transaction(async (tx) => {
      const g1 = await tx.itemIconGroup.create({
        data: {
          title: '常用网站',
          icon: 'lucide:globe',
          groupType: tabs[0].type === 'list' ? 'webpage' : 'website',
          tabId: tabs[0].id,
          userId: user.id,
          sort: 1,
        },
      });
      // 将无主图标划分至该分组
      await tx.itemIcon.updateMany({
        where: { userId: user.id, itemIconGroupId: 0 },
        data: { itemIconGroupId: g1.id },
      });
    });

    groups = await db.itemIconGroup.findMany({
      where: { userId: user.id },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // 获取该用户的所有书签列表
  const iconsRaw = await db.itemIcon.findMany({
    where: { userId: user.id },
    orderBy: [
      { pinned: 'desc' },
      { sort: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // 解析 iconJson 并序列化
  const icons = iconsRaw.map((icon) => {
    let iconParsed: { itemType: number; src: string } = { itemType: 1, src: '' };
    try {
      if (icon.iconJson) {
        iconParsed = JSON.parse(icon.iconJson);
      }
    } catch (e) {}
    return {
      ...icon,
      icon: iconParsed,
    };
  });

  // 读取站点品牌（全局，登录后任意用户可见）
  const brand = await getSiteBrand();

  const serializedUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    headImage: user.headImage,
    role: user.role,
    mail: user.mail,
  };

  // 序列化为前端可用的纯对象（去掉 Prisma 附加字段）
  const serializedTabs = tabs.map((x) => ({
    id: x.id,
    name: x.name,
    type: (x.type === 'list' ? 'list' : 'card') as 'card' | 'list',
    sort: x.sort,
  }));
  const serializedGroups = groups.map((g) => ({
    id: g.id,
    title: g.title,
    icon: g.icon,
    groupType: g.groupType,
    tabId: g.tabId,
    sort: g.sort,
  }));

  return (
    <Dashboard
      user={serializedUser}
      initialTabs={serializedTabs}
      initialGroups={serializedGroups}
      initialIcons={icons as Array<{ id: number; title: string; url: string; lanUrl: string | null; description: string | null; openMethod: number; pinned: boolean; itemIconGroupId: number; sort: number; icon: { itemType: number; src: string }; widgetType: string; widgetSettings: string }>}
      initialBrandName={brand.name}
      initialBrandIcon={brand.icon}
    />
  );
}
