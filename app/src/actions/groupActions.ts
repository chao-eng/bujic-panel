'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';

// 获取分组列表 (带初始化兜底)
export async function getGroupsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // 获取该用户的所有分组
  let groups = await db.itemIconGroup.findMany({
    where: { userId: user.id },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });

  // 兜底初始化逻辑 (如果数据库中无该用户分组)
  if (groups.length === 0) {
    groups = await db.$transaction(async (tx: any) => {
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
        where: {
          userId: user.id,
          itemIconGroupId: 0,
        },
        data: {
          itemIconGroupId: g1.id,
        },
      });

      return [g1, g2];
    });
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
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  if (data.id) {
    // 编辑
    const updated = await db.itemIconGroup.update({
      where: { id: data.id, userId: user.id },
      data: {
        title: data.title,
        icon: data.icon,
        description: data.description || '',
        sort: data.sort,
        groupType: data.groupType,
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
        groupType: data.groupType,
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

  // 获取该用户的分组总数
  const totalCount = await db.itemIconGroup.count({
    where: { userId: user.id },
  });

  if (ids.length >= totalCount) {
    return { success: false, code: 1201, message: '请至少保留一个分组！' };
  }

  await db.$transaction(async (tx: any) => {
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
export async function saveGroupSortAction(sortItems: { id: number; sort: number }[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await db.$transaction(
    sortItems.map((item) =>
      db.itemIconGroup.update({
        where: { id: item.id, userId: user.id },
        data: { sort: item.sort },
      })
    )
  );

  revalidatePath('/');
  return { success: true };
}
