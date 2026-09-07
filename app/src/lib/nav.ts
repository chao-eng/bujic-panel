import { db } from './db';

/**
 * 用户侧「导航初始化」兜底：
 * 保证每个用户至少存在一个导航 Tab（以及可选的旧形态默认 Tab）。
 * - 新用户 / 无任何 Tab 的用户：根据旧 groupType 存量分组回填建 Tab；
 *   无任何分组时建一个默认「卡片」Tab。
 * 幂等：仅当该用户没有任何 view_tab 时才执行。
 */
export async function ensureUserTabs(userId: number) {
  const count = await db.viewTab.count({ where: { userId } });
  if (count > 0) return;

  const groups = await db.itemIconGroup.findMany({
    where: { userId },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  const hasWebsite = groups.some((g) => g.groupType === 'website');
  const hasWebpage = groups.some((g) => g.groupType === 'webpage');

  const defaultTabs: { name: string; type: string }[] = [];
  if (hasWebsite) defaultTabs.push({ name: '收藏', type: 'card' });
  if (hasWebpage) defaultTabs.push({ name: '书签', type: 'list' });
  if (defaultTabs.length === 0) defaultTabs.push({ name: '常用', type: 'card' });

  await db.$transaction(async (tx) => {
    const tabs: { id: number; type: string }[] = [];
    for (let i = 0; i < defaultTabs.length; i++) {
      const t = await tx.viewTab.create({
        data: {
          name: defaultTabs[i].name,
          type: defaultTabs[i].type,
          sort: i + 1,
          userId,
        },
      });
      tabs.push({ id: t.id, type: t.type });
    }

    // 回填存量分组到对应形态的 Tab（group_type 弃用前只读一次）
    for (const g of groups) {
      const target = tabs.find((t) =>
        g.groupType === 'webpage' ? t.type === 'list' : t.type === 'card'
      );
      const tabId = target?.id ?? tabs[0].id;
      await tx.itemIconGroup.update({
        where: { id: g.id, userId },
        data: { tabId },
      });
    }

    // 无主书签兜底归入第一个 Tab 的首个分组（或建空分组）
    const orphans = await tx.itemIcon.findMany({
      where: { userId, itemIconGroupId: 0 },
      select: { id: true },
    });
    if (orphans.length > 0) {
      const firstGroup = await tx.itemIconGroup.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });
      const groupId = firstGroup?.id;
      if (groupId) {
        await tx.itemIcon.updateMany({
          where: { userId, itemIconGroupId: 0 },
          data: { itemIconGroupId: groupId },
        });
      }
    }
  });
}
