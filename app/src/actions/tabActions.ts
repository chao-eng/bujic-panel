'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import { ensureUserTabs } from '../lib/nav';

type TabType = 'card' | 'list';

// 获取当前用户全部导航 Tab
export async function getTabsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await ensureUserTabs(user.id);

  return db.viewTab.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  });
}

// 编辑/新增 Tab
export async function editTabAction(data: {
  id?: number;
  name: string;
  type: TabType;
  sort?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const name = data.name.trim();
  if (!name) throw new Error('Tab 名称不能为空');
  if (name.length > 20) throw new Error('Tab 名称不能超过 20 个字符');

  if (data.id) {
    const updated = await db.viewTab.update({
      where: { id: data.id, userId: user.id },
      data: { name, type: data.type === 'list' ? 'list' : 'card' },
    });
    revalidatePath('/');
    return updated;
  }

  const maxSort = await db.viewTab.aggregate({
    where: { userId: user.id },
    _max: { sort: true },
  });
  const created = await db.viewTab.create({
    data: {
      name,
      type: data.type === 'list' ? 'list' : 'card',
      sort: data.sort ?? (maxSort._max.sort ?? 0) + 1,
      userId: user.id,
    },
  });
  revalidatePath('/');
  return created;
}

// 保存 Tab 排序
export async function saveTabSortAction(sortItems: { id: number; sort: number }[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await db.$transaction(
    sortItems.map((item) =>
      db.viewTab.update({
        where: { id: item.id, userId: user.id },
        data: { sort: item.sort },
      })
    )
  );

  revalidatePath('/');
  return { success: true };
}

// 删除 Tab（默认级联删除其下分组与书签）
export async function deleteTabAction(id: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const total = await db.viewTab.count({ where: { userId: user.id } });
  if (total <= 1) {
    return { success: false, message: '至少保留一个导航 Tab' };
  }

  const target = await db.viewTab.findFirst({ where: { id, userId: user.id } });
  if (!target) {
    return { success: false, message: 'Tab 不存在' };
  }

  await db.$transaction(async (tx) => {
    const groups = await tx.itemIconGroup.findMany({ where: { tabId: id, userId: user.id } });
    for (const g of groups) {
      await tx.itemIcon.deleteMany({ where: { userId: user.id, itemIconGroupId: g.id } });
    }
    await tx.itemIconGroup.deleteMany({ where: { tabId: id, userId: user.id } });
    await tx.viewTab.delete({ where: { id, userId: user.id } });
  });

  revalidatePath('/');
  return { success: true };
}

// 迁移 Tab 下所有分组到目标 Tab，再删除源 Tab（可选流程）
export async function migrateAndDeleteTabAction(id: number, targetTabId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const target = await db.viewTab.findFirst({ where: { id: targetTabId, userId: user.id } });
  if (!target) throw new Error('目标 Tab 不存在');

  const total = await db.viewTab.count({ where: { userId: user.id } });
  if (total <= 1) {
    return { success: false, message: '至少保留一个导航 Tab' };
  }

  await db.$transaction(async (tx) => {
    await tx.itemIconGroup.updateMany({
      where: { tabId: id, userId: user.id },
      data: { tabId: targetTabId },
    });
    await tx.viewTab.delete({ where: { id, userId: user.id } });
  });

  revalidatePath('/');
  return { success: true };
}
