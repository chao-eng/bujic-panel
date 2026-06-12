'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';

// 获取分组下的书签列表
export async function getIconsByGroupIdAction(groupId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const icons = await db.itemIcon.findMany({
    where: {
      userId: user.id,
      itemIconGroupId: groupId,
    },
    orderBy: [
      { pinned: 'desc' }, // 置顶项在前
      { sort: 'asc' },    // 按拖拽排序升序
      { createdAt: 'desc' }, // 创建时间从新到旧
    ],
  });

  // 解析 iconJson
  return icons.map((icon) => {
    let iconParsed = { itemType: 1, src: '' };
    try {
      if (icon.iconJson) {
        iconParsed = JSON.parse(icon.iconJson);
      }
    } catch (e) {
      // 容错
    }
    return {
      ...icon,
      icon: iconParsed,
    };
  });
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
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (data.itemIconGroupId === 0) {
    throw new Error('Group is mandatory');
  }

  // 1. URL 查重
  if (data.url) {
    const existing = await db.itemIcon.findFirst({
      where: {
        url: data.url,
        userId: user.id,
        ...(data.id ? { id: { not: data.id } } : {}),
      },
    });

    if (existing) {
      throw new Error(`已有重复链接：[${existing.title}]，请修改！`);
    }
  }

  const iconJson = JSON.stringify(data.icon || { itemType: 1, src: '' });

  if (data.id) {
    // 编辑
    const updated = await db.itemIcon.update({
      where: { id: data.id, userId: user.id },
      data: {
        title: data.title,
        url: data.url,
        lanUrl: data.lanUrl || '',
        description: data.description || '',
        openMethod: data.openMethod ?? 1,
        pinned: data.pinned ?? false,
        itemIconGroupId: data.itemIconGroupId,
        iconJson,
        ...(data.sort !== undefined ? { sort: data.sort } : {}),
      },
    });
    revalidatePath('/');
    return updated;
  } else {
    // 新增
    const created = await db.itemIcon.create({
      data: {
        title: data.title,
        url: data.url,
        lanUrl: data.lanUrl || '',
        description: data.description || '',
        openMethod: data.openMethod ?? 1,
        pinned: data.pinned ?? false,
        itemIconGroupId: data.itemIconGroupId,
        iconJson,
        sort: data.sort ?? 9999,
        userId: user.id,
      },
    });
    revalidatePath('/');
    return created;
  }
}

// 删除书签
export async function deleteItemIconsAction(ids: number[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await db.itemIcon.deleteMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
  });

  revalidatePath('/');
  return { success: true };
}

// 批量增加书签
export async function addMultipleItemIconsAction(
  items: {
    title: string;
    url: string;
    description?: string;
    itemIconGroupId: number;
    icon?: { itemType: number; src: string };
  }[]
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const insertData = items.map((item) => ({
    title: item.title,
    url: item.url,
    lanUrl: '',
    description: item.description || '',
    openMethod: 1,
    pinned: false,
    itemIconGroupId: item.itemIconGroupId,
    iconJson: JSON.stringify(item.icon || { itemType: 1, src: '' }),
    userId: user.id,
    sort: 9999,
  }));

  const created = await db.itemIcon.createMany({
    data: insertData,
  });

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

  await db.$transaction(
    sortItems.map((item) =>
      db.itemIcon.update({
        where: {
          id: item.id,
          userId: user.id,
          itemIconGroupId: groupId,
        },
        data: { sort: item.sort },
      })
    )
  );

  revalidatePath('/');
  return { success: true };
}
