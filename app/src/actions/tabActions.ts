'use server';

import { getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import * as panel from '../lib/panelService';
import { isMcpError } from '../lib/mcp/errors';

type TabType = 'card' | 'list';

// 获取当前用户全部导航 Tab
export async function getTabsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  return panel.listTabs(user.id);
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

  const result = data.id
    ? await panel.updateTab(user.id, { id: data.id, name: data.name, type: data.type })
    : await panel.createTab(user.id, { name: data.name, type: data.type, sort: data.sort });

  revalidatePath('/');
  return result;
}

// 保存 Tab 排序
export async function saveTabSortAction(sortItems: { id: number; sort: number }[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  await panel.applyTabSort(user.id, sortItems);

  revalidatePath('/');
  return { success: true };
}

// 删除 Tab（级联删除其下分组与书签）
export async function deleteTabAction(id: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  try {
    await panel.deleteTab(user.id, { id, strategy: 'cascade' });
  } catch (e) {
    if (isMcpError(e)) return { success: false, message: e.message };
    throw e;
  }

  revalidatePath('/');
  return { success: true };
}

// 迁移 Tab 下所有分组到目标 Tab，再删除源 Tab（可选流程）
export async function migrateAndDeleteTabAction(id: number, targetTabId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  try {
    await panel.deleteTab(user.id, { id, strategy: 'migrate', targetTabId });
  } catch (e) {
    if (isMcpError(e)) return { success: false, message: e.message };
    throw e;
  }

  revalidatePath('/');
  return { success: true };
}
