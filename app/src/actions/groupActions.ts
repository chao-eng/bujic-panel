'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import { ensureUserTabs } from '../lib/nav';

// 获取分组列表 (带初始化兜底)
export async function getGroupsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await ensureUserTabs(user.id);

  // 获取该用户的所有分组
  let groups = await db.itemIconGroup.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  // 兜底初始化逻辑 (如果数据库中无该用户分组，则为默认 Tab 建一个示例分组)
  if (groups.length === 0) {
    const tabs = await db.viewTab.findMany({
      where: { userId: user.id },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    const firstTab = tabs[0];
    if (firstTab) {
      const created = await db.itemIconGroup.create({
        data: {
          title: '常用网站',
          icon: 'lucide:globe',
          groupType: 'website',
          tabId: firstTab.id,
          userId: user.id,
          sort: 1,
        },
      });
      groups = [created];
    }
  }

  return groups;
}

// 编辑/新增分组
export async function editGroupAction(data: {
  id?: number;
  title: string;
  icon: string;
  description?: string;
  sort?: number;
  groupType: string;
  tabId?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // tabId 缺失时兜底到该用户第一个 Tab
  let tabId = data.tabId;
  if (!tabId) {
    const firstTab = await db.viewTab.findFirst({
      where: { userId: user.id },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    tabId = firstTab?.id ?? 0;
  }
  if (!tabId) throw new Error('请先创建导航 Tab');

  // 校验 tab 归属
  const tab = await db.viewTab.findFirst({ where: { id: tabId, userId: user.id } });
  if (!tab) throw new Error('目标 Tab 不存在');

  if (data.id) {
    // 编辑
    const updated = await db.itemIconGroup.update({
      where: { id: data.id, userId: user.id },
      data: {
        title: data.title,
        icon: data.icon,
        description: data.description || '',
        sort: data.sort,
        groupType: tab.type === 'list' ? 'webpage' : 'website', // 以所属 Tab 形态为准
        tabId,
      },
    });
    revalidatePath('/');
    return updated;
  } else {
    // 新增
    const created = await db.itemIconGroup.create({
      data: {
        title: data.title,
        icon: data.icon,
        description: data.description || '',
        sort: data.sort || 99,
        groupType: tab.type === 'list' ? 'webpage' : 'website',
        tabId,
        userId: user.id,
      },
    });
    revalidatePath('/');
    return created;
  }
}

// 批量删除分组 (带级联删除和保留兜底)
export async function deleteGroupsAction(ids: number[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await db.$transaction(async (tx) => {
    // 级联删除关联 of ItemIcon
    await tx.itemIcon.deleteMany({
      where: {
        userId: user.id,
        itemIconGroupId: { in: ids },
      },
    });

    // 删除分组本身
    await tx.itemIconGroup.deleteMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
    });
  });

  revalidatePath('/');
  return { success: true };
}

// 保存分组排序
export async function saveGroupSortAction(
  sortItems: { id: number; sort: number }[],
  tabId?: number
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await db.$transaction(
    sortItems.map((item) =>
      db.itemIconGroup.update({
        where: {
          id: item.id,
          userId: user.id,
          ...(tabId ? { tabId } : {}),
        },
        data: { sort: item.sort },
      })
    )
  );

  revalidatePath('/');
  return { success: true };
}
