import { getCurrentUser } from '../lib/auth';
import { db } from '../lib/db';
import { redirect } from 'next/navigation';
import Dashboard from '../components/Dashboard';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // 获取所有分组
  let groups = await db.itemIconGroup.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  // 如果没有分组，执行自动初始化并重新获取 (服务端兼容性首运行)
  if (groups.length === 0) {
    await db.$transaction(async (tx) => {
      const g1 = await tx.itemIconGroup.create({
        data: {
          title: '常用网站',
          icon: 'lucide:globe',
          groupType: 'website',
          userId: user.id,
          sort: 1,
        },
      });
      const g2 = await tx.itemIconGroup.create({
        data: {
          title: '日常网页',
          icon: 'lucide:layout',
          groupType: 'webpage',
          userId: user.id,
          sort: 2,
        },
      });
      // 将无主图标划分至第一个分组
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
    let iconParsed = { itemType: 1, src: '' };
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

  const serializedUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    headImage: user.headImage,
    role: user.role,
    mail: user.mail,
  };

  return (
    <Dashboard
      user={serializedUser}
      initialGroups={groups}
      initialIcons={icons}
    />
  );
}
