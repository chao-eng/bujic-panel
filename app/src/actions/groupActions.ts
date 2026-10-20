'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import { ensureUserTabs } from '../lib/nav';
import * as panel from '../lib/panelService';

// 获取分组列表 (带初始化兜底)
export async function getGroupsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await ensureUserTabs(user.id);

  let groups = await panel.listGroups(user.id);

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

  // tabId 缺失时兜底到该用户第一个 Tab（保持既有行为）
  let tabId = data.tabId;
  if (!tabId) {
    const firstTab = await db.viewTab.findFirst({
      where: { userId: user.id },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    tabId = firstTab?.id ?? 0;
  }
  if (!tabId) throw new Error('请先创建导航 Tab');

  const result = data.id
    ? await panel.updateGroup(user.id, {
        id: data.id,
        title: data.title,
        icon: data.icon,
        description: data.description,
        sort: data.sort,
        tabId,
      })
    : await panel.createGroup(user.id, {
        title: data.title,
        icon: data.icon,
        description: data.description,
        sort: data.sort,
        tabId,
      });

  revalidatePath('/');
  return result;
}

// 批量删除分组 (带级联删除)
export async function deleteGroupsAction(ids: number[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await panel.deleteGroups(user.id, ids);

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

  await panel.applyGroupSort(user.id, sortItems, tabId);

  revalidatePath('/');
  return { success: true };
}
