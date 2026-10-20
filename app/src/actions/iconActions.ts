'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import { decryptFromTransport } from '../lib/crypto';
import * as panel from '../lib/panelService';

// 获取分组下的书签列表
export async function getIconsByGroupIdAction(groupId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  return panel.listBookmarksByGroup(user.id, groupId);
}

// 编辑/新增书签
export async function editItemIconAction(data: {
  id?: number;
  title: string;
  url: string;
  lanUrl?: string;
  description?: string;
  openMethod?: number;
  pinned?: boolean;
  itemIconGroupId: number;
  icon?: { itemType: number; src: string };
  sort?: number;
  widgetType?: string;
  widgetSettings?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (data.itemIconGroupId === 0) {
    throw new Error('Group is mandatory');
  }

  // 解密前端加密传输的 widgetSettings，如未加密则原样保留
  const widgetSettings = decryptFromTransport(data.widgetSettings ?? '{}');

  const result = await panel.saveBookmark(user.id, {
    id: data.id,
    title: data.title,
    url: data.url,
    lanUrl: data.lanUrl,
    description: data.description,
    openMethod: data.openMethod,
    pinned: data.pinned,
    itemIconGroupId: data.itemIconGroupId,
    icon: data.icon,
    sort: data.sort,
    widgetType: data.widgetType,
    widgetSettings,
  });

  revalidatePath('/');
  return result;
}

// 删除书签
export async function deleteItemIconsAction(ids: number[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await panel.deleteBookmarks(user.id, ids);

  revalidatePath('/');
  return { success: true };
}

// 批量增加书签（导入场景，批量落库不做逐条查重）
export async function addMultipleItemIconsAction(
  items: {
    title: string;
    url: string;
    lanUrl?: string;
    description?: string;
    openMethod?: number;
    pinned?: boolean;
    itemIconGroupId: number;
    icon?: { itemType: number; src: string };
  }[]
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const insertData = items.map((item) => ({
    title: item.title,
    url: item.url,
    lanUrl: item.lanUrl || '',
    description: item.description || '',
    openMethod: item.openMethod ?? 1,
    pinned: item.pinned ?? false,
    itemIconGroupId: item.itemIconGroupId,
    iconJson: JSON.stringify(item.icon || { itemType: 1, src: '' }),
    userId: user.id,
    sort: 9999,
  }));

  const created = await db.itemIcon.createMany({ data: insertData });

  revalidatePath('/');
  return created;
}

// 保存排序
export async function saveItemIconSortAction(
  groupId: number,
  sortItems: { id: number; sort: number }[]
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await panel.applyBookmarkSort(user.id, groupId, sortItems);

  revalidatePath('/');
  return { success: true };
}
