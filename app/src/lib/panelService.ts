import { db } from './db';
import { Prisma } from '@prisma/client';
import { ensureUserTabs } from './nav';
import { McpError } from './mcp/errors';

// 面板业务服务层（userId 维度）
// 说明：本层承载「导航空间 / 分组 / 书签 / 监控」的核心规则（校验、查重、级联、排序），
// 供 MCP 工具与浏览器 Server Action 共同复用，保证规则单一真相。
// 本层不做鉴权（调用方负责），不调用 revalidatePath（属于 Next 层职责）。

type TabType = 'card' | 'list';

function normalizeTabType(type: unknown): TabType {
  return type === 'list' ? 'list' : 'card';
}

function parseIconJson(iconJson: string): { itemType: number; src: string } {
  try {
    if (iconJson) return JSON.parse(iconJson);
  } catch {
    // 容错
  }
  return { itemType: 1, src: '' };
}

// ============ 导航空间（ViewTab） ============

export async function listTabs(userId: number) {
  await ensureUserTabs(userId);

  const [tabs, groups, icons] = await Promise.all([
    db.viewTab.findMany({
      where: { userId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    }),
    db.itemIconGroup.findMany({ where: { userId }, select: { id: true, tabId: true } }),
    db.itemIcon.findMany({ where: { userId }, select: { itemIconGroupId: true } }),
  ]);

  const iconCountByGroup = new Map<number, number>();
  for (const i of icons) {
    iconCountByGroup.set(i.itemIconGroupId, (iconCountByGroup.get(i.itemIconGroupId) ?? 0) + 1);
  }

  return tabs.map((t) => {
    const tabGroups = groups.filter((g) => g.tabId === t.id);
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      sort: t.sort,
      groupCount: tabGroups.length,
      bookmarkCount: tabGroups.reduce((sum, g) => sum + (iconCountByGroup.get(g.id) ?? 0), 0),
    };
  });
}

export async function getOverview(userId: number) {
  await ensureUserTabs(userId);

  const [tabs, groups, icons] = await Promise.all([
    db.viewTab.findMany({ where: { userId }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
    db.itemIconGroup.findMany({ where: { userId }, select: { id: true, tabId: true } }),
    db.itemIcon.findMany({
      where: { userId },
      select: { itemIconGroupId: true, pinned: true, widgetType: true },
    }),
  ]);

  const iconCountByGroup = new Map<number, number>();
  const widgetBuckets: Record<string, number> = {};
  let pinned = 0;
  let widgets = 0;
  for (const i of icons) {
    iconCountByGroup.set(i.itemIconGroupId, (iconCountByGroup.get(i.itemIconGroupId) ?? 0) + 1);
    if (i.pinned) pinned += 1;
    if (i.widgetType) {
      widgets += 1;
      widgetBuckets[i.widgetType] = (widgetBuckets[i.widgetType] ?? 0) + 1;
    }
  }

  return {
    tabs: tabs.map((t) => {
      const tabGroups = groups.filter((g) => g.tabId === t.id);
      return {
        id: t.id,
        name: t.name,
        type: t.type,
        groupCount: tabGroups.length,
        bookmarkCount: tabGroups.reduce((sum, g) => sum + (iconCountByGroup.get(g.id) ?? 0), 0),
      };
    }),
    totals: {
      tabs: tabs.length,
      groups: groups.length,
      bookmarks: icons.length,
      pinned,
      widgets,
    },
    widgetTypes: widgetBuckets,
  };
}

export async function createTab(
  userId: number,
  data: { name: string; type?: TabType; sort?: number }
) {
  const name = (data.name ?? '').trim();
  if (!name) throw new McpError('INVALID_ARGUMENT', 'Tab 名称不能为空');
  if (name.length > 20) throw new McpError('INVALID_ARGUMENT', 'Tab 名称不能超过 20 个字符');

  const maxSort = await db.viewTab.aggregate({ where: { userId }, _max: { sort: true } });
  return db.viewTab.create({
    data: {
      name,
      type: normalizeTabType(data.type),
      sort: data.sort ?? (maxSort._max.sort ?? 0) + 1,
      userId,
    },
  });
}

export async function updateTab(
  userId: number,
  data: { id: number; name?: string; type?: TabType }
) {
  const target = await db.viewTab.findFirst({ where: { id: data.id, userId } });
  if (!target) throw new McpError('NOT_FOUND', 'Tab 不存在');

  const patch: { name?: string; type?: TabType } = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new McpError('INVALID_ARGUMENT', 'Tab 名称不能为空');
    if (name.length > 20) throw new McpError('INVALID_ARGUMENT', 'Tab 名称不能超过 20 个字符');
    patch.name = name;
  }
  if (data.type !== undefined) patch.type = normalizeTabType(data.type);

  return db.viewTab.update({ where: { id: data.id, userId }, data: patch });
}

// 删除导航 Tab：级联删除 或 迁移分组后删除
export async function deleteTab(
  userId: number,
  data: { id: number; strategy: 'cascade' | 'migrate'; targetTabId?: number }
) {
  const total = await db.viewTab.count({ where: { userId } });
  if (total <= 1) throw new McpError('INVALID_ARGUMENT', '至少保留一个导航 Tab');

  const target = await db.viewTab.findFirst({ where: { id: data.id, userId } });
  if (!target) throw new McpError('NOT_FOUND', 'Tab 不存在');

  if (data.strategy === 'migrate') {
    const targetTabId = data.targetTabId;
    if (!targetTabId) throw new McpError('INVALID_ARGUMENT', '迁移需要提供目标 Tab');
    if (targetTabId === data.id) throw new McpError('INVALID_ARGUMENT', '目标 Tab 不能是自身');
    const dest = await db.viewTab.findFirst({ where: { id: targetTabId, userId } });
    if (!dest) throw new McpError('NOT_FOUND', '目标 Tab 不存在');

    await db.$transaction(async (tx) => {
      await tx.itemIconGroup.updateMany({
        where: { tabId: data.id, userId },
        data: { tabId: targetTabId },
      });
      await tx.viewTab.delete({ where: { id: data.id, userId } });
    });
    return;
  }

  await db.$transaction(async (tx) => {
    const groups = await tx.itemIconGroup.findMany({ where: { tabId: data.id, userId } });
    for (const g of groups) {
      await tx.itemIcon.deleteMany({ where: { userId, itemIconGroupId: g.id } });
    }
    await tx.itemIconGroup.deleteMany({ where: { tabId: data.id, userId } });
    await tx.viewTab.delete({ where: { id: data.id, userId } });
  });
}

// 排序：全量替换语义（orderedIds 必须等于该用户全部 Tab 集合）
export async function reorderTabs(userId: number, orderedIds: number[]) {
  const tabs = await db.viewTab.findMany({ where: { userId }, select: { id: true } });
  const owned = new Set(tabs.map((t) => t.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    throw new McpError('INVALID_ARGUMENT', '排序列表必须覆盖当前用户全部导航 Tab');
  }
  await db.$transaction(
    orderedIds.map((id, idx) =>
      db.viewTab.update({ where: { id, userId }, data: { sort: idx + 1 } })
    )
  );
}

// ============ 分组（ItemIconGroup） ============

export async function listGroups(userId: number, tabId?: number) {
  await ensureUserTabs(userId);
  return db.itemIconGroup.findMany({
    where: { userId, ...(tabId ? { tabId } : {}) },
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createGroup(
  userId: number,
  data: { title: string; icon?: string; description?: string; sort?: number; tabId?: number }
) {
  let tabId = data.tabId;
  if (!tabId) {
    const firstTab = await db.viewTab.findFirst({
      where: { userId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    tabId = firstTab?.id ?? 0;
  }
  if (!tabId) throw new McpError('INVALID_ARGUMENT', '请先创建导航 Tab');

  const tab = await db.viewTab.findFirst({ where: { id: tabId, userId } });
  if (!tab) throw new McpError('NOT_FOUND', '目标 Tab 不存在');

  return db.itemIconGroup.create({
    data: {
      title: data.title,
      icon: data.icon || 'lucide:globe',
      description: data.description || '',
      sort: data.sort || 99,
      groupType: tab.type === 'list' ? 'webpage' : 'website',
      tabId,
      userId,
    },
  });
}

export async function updateGroup(
  userId: number,
  data: {
    id: number;
    title?: string;
    icon?: string;
    description?: string;
    sort?: number;
    tabId?: number;
  }
) {
  const current = await db.itemIconGroup.findFirst({ where: { id: data.id, userId } });
  if (!current) throw new McpError('NOT_FOUND', '分组不存在');

  const nextTabId = data.tabId ?? current.tabId;
  const tab = await db.viewTab.findFirst({ where: { id: nextTabId, userId } });
  if (!tab) throw new McpError('NOT_FOUND', '目标 Tab 不存在');

  return db.itemIconGroup.update({
    where: { id: data.id, userId },
    data: {
      title: data.title ?? current.title,
      icon: data.icon ?? current.icon,
      description: data.description ?? current.description ?? '',
      sort: data.sort ?? current.sort,
      groupType: tab.type === 'list' ? 'webpage' : 'website',
      tabId: nextTabId,
    },
  });
}

// 批量删除分组（级联删除组内书签）
export async function deleteGroups(userId: number, ids: number[]) {
  await db.$transaction(async (tx) => {
    await tx.itemIcon.deleteMany({ where: { userId, itemIconGroupId: { in: ids } } });
    await tx.itemIconGroup.deleteMany({ where: { id: { in: ids }, userId } });
  });
}

export async function reorderGroups(userId: number, orderedIds: number[], tabId?: number) {
  const groups = await db.itemIconGroup.findMany({
    where: { userId, ...(tabId ? { tabId } : {}) },
    select: { id: true },
  });
  const owned = new Set(groups.map((g) => g.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    throw new McpError('INVALID_ARGUMENT', '排序列表必须覆盖目标范围内的全部分组');
  }
  await db.$transaction(
    orderedIds.map((id, idx) =>
      db.itemIconGroup.update({ where: { id, userId }, data: { sort: idx + 1 } })
    )
  );
}

// ============ 书签（ItemIcon） ============

export interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  lanUrl: string | null;
  description: string | null;
  openMethod: number;
  pinned: boolean;
  sort: number;
  itemIconGroupId: number;
  widgetType: string;
  icon: { itemType: number; src: string };
  createdAt: Date;
  updatedAt: Date;
}

function toBookmarkRow(icon: {
  id: number;
  title: string;
  url: string;
  lanUrl: string | null;
  description: string | null;
  openMethod: number;
  pinned: boolean;
  sort: number;
  itemIconGroupId: number;
  widgetType: string;
  iconJson: string;
  createdAt: Date;
  updatedAt: Date;
}): BookmarkRow {
  // 脱敏：永不输出 widgetSettings
  return {
    id: icon.id,
    title: icon.title,
    url: icon.url,
    lanUrl: icon.lanUrl,
    description: icon.description,
    openMethod: icon.openMethod,
    pinned: icon.pinned,
    sort: icon.sort,
    itemIconGroupId: icon.itemIconGroupId,
    widgetType: icon.widgetType,
    icon: parseIconJson(icon.iconJson),
    createdAt: icon.createdAt,
    updatedAt: icon.updatedAt,
  };
}

export async function listBookmarksByGroup(userId: number, groupId: number): Promise<BookmarkRow[]> {
  const icons = await db.itemIcon.findMany({
    where: { userId, itemIconGroupId: groupId },
    orderBy: [{ pinned: 'desc' }, { sort: 'asc' }, { createdAt: 'desc' }],
  });
  return icons.map(toBookmarkRow);
}

export async function searchBookmarks(
  userId: number,
  filters: {
    keyword?: string;
    tabId?: number;
    groupId?: number;
    widgetType?: string;
    pinnedOnly?: boolean;
    page?: number;
    pageSize?: number;
  }
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  if (filters.tabId && filters.groupId) {
    throw new McpError('INVALID_ARGUMENT', 'tabId 与 groupId 不能同时指定');
  }

  // tabId 过滤：先求出该 Tab 下的分组 id 集合
  let groupIdFilter: number[] | undefined;
  if (filters.tabId) {
    const groups = await db.itemIconGroup.findMany({
      where: { userId, tabId: filters.tabId },
      select: { id: true },
    });
    groupIdFilter = groups.map((g) => g.id);
    if (groupIdFilter.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
  }

  const where: Prisma.ItemIconWhereInput = {
    userId,
    ...(filters.groupId ? { itemIconGroupId: filters.groupId } : {}),
    ...(groupIdFilter ? { itemIconGroupId: { in: groupIdFilter } } : {}),
    ...(filters.pinnedOnly ? { pinned: true } : {}),
  };
  if (filters.widgetType) {
    where.widgetType = filters.widgetType;
  }
  const keyword = filters.keyword?.trim();
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { url: { contains: keyword } },
      { description: { contains: keyword } },
    ];
  }

  const [total, icons] = await Promise.all([
    db.itemIcon.count({ where }),
    db.itemIcon.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { sort: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items: icons.map(toBookmarkRow), total, page, pageSize };
}

export async function getBookmarkById(userId: number, id: number): Promise<BookmarkRow> {
  const icon = await db.itemIcon.findFirst({ where: { id, userId } });
  if (!icon) throw new McpError('NOT_FOUND', '书签不存在');
  return toBookmarkRow(icon);
}

async function assertNoDuplicateUrl(userId: number, url: string, excludeId?: number) {
  if (!url) return;
  const existing = await db.itemIcon.findFirst({
    where: { url, userId, widgetType: '', ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    // 文案与既有 Web 行为保持一致；details 供 MCP 层向 Agent 透出已存在书签的 id
    throw new McpError('INVALID_ARGUMENT', `已有重复链接：[${existing.title}]，请修改！`, {
      existingId: existing.id,
      existingTitle: existing.title,
      url,
    });
  }
}

export interface SaveBookmarkInput {
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
  widgetSettings?: string; // 已解密的明文 JSON 字符串
}

// 全量新增/编辑（供浏览器 Server Action 使用）
export async function saveBookmark(userId: number, data: SaveBookmarkInput) {
  if (!data.itemIconGroupId) throw new McpError('INVALID_ARGUMENT', '必须指定所属分组');

  if (data.url && !data.widgetType) {
    await assertNoDuplicateUrl(userId, data.url, data.id);
  }

  const iconJson = JSON.stringify(data.icon || { itemType: 1, src: '' });

  if (data.id) {
    return db.itemIcon.update({
      where: { id: data.id, userId },
      data: {
        title: data.title,
        url: data.url,
        lanUrl: data.lanUrl || '',
        description: data.description || '',
        openMethod: data.openMethod ?? 1,
        pinned: data.pinned ?? false,
        itemIconGroupId: data.itemIconGroupId,
        iconJson,
        widgetType: data.widgetType ?? '',
        widgetSettings: data.widgetSettings ?? '{}',
        ...(data.sort !== undefined ? { sort: data.sort } : {}),
      },
    });
  }

  return db.itemIcon.create({
    data: {
      title: data.title,
      url: data.url,
      lanUrl: data.lanUrl || '',
      description: data.description || '',
      openMethod: data.openMethod ?? 1,
      pinned: data.pinned ?? false,
      itemIconGroupId: data.itemIconGroupId,
      iconJson,
      widgetType: data.widgetType ?? '',
      widgetSettings: data.widgetSettings ?? '{}',
      sort: data.sort ?? 9999,
      userId,
    },
  });
}

// 部分更新（供 MCP 使用）：不触碰 widgetType / widgetSettings 凭证字段
export async function updateBookmarkPartial(
  userId: number,
  patch: {
    id: number;
    title?: string;
    url?: string;
    lanUrl?: string;
    description?: string;
    openMethod?: number;
    pinned?: boolean;
    moveToGroupId?: number;
  }
) {
  const current = await db.itemIcon.findFirst({ where: { id: patch.id, userId } });
  if (!current) throw new McpError('NOT_FOUND', '书签不存在');

  const nextUrl = patch.url ?? current.url;
  if (patch.url !== undefined && current.widgetType === '') {
    await assertNoDuplicateUrl(userId, nextUrl, patch.id);
  }

  let nextGroupId = current.itemIconGroupId;
  if (patch.moveToGroupId !== undefined) {
    const group = await db.itemIconGroup.findFirst({
      where: { id: patch.moveToGroupId, userId },
    });
    if (!group) throw new McpError('NOT_FOUND', '目标分组不存在');
    nextGroupId = patch.moveToGroupId;
  }

  const updated = await db.itemIcon.update({
    where: { id: patch.id, userId },
    data: {
      title: patch.title ?? current.title,
      url: nextUrl,
      lanUrl: patch.lanUrl ?? current.lanUrl ?? '',
      description: patch.description ?? current.description ?? '',
      openMethod: patch.openMethod ?? current.openMethod,
      pinned: patch.pinned ?? current.pinned,
      itemIconGroupId: nextGroupId,
    },
  });
  return toBookmarkRow(updated);
}

export async function deleteBookmarks(userId: number, ids: number[]) {
  const res = await db.itemIcon.deleteMany({ where: { id: { in: ids }, userId } });
  return res.count;
}

export async function reorderBookmarks(userId: number, groupId: number, orderedIds: number[]) {
  const items = await db.itemIcon.findMany({
    where: { userId, itemIconGroupId: groupId },
    select: { id: true },
  });
  const owned = new Set(items.map((i) => i.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    throw new McpError('INVALID_ARGUMENT', '排序列表必须覆盖该分组内全部书签');
  }
  await db.$transaction(
    orderedIds.map((id, idx) =>
      db.itemIcon.update({
        where: { id, userId, itemIconGroupId: groupId },
        data: { sort: idx + 1 },
      })
    )
  );
}

// 批量新增（供 MCP 批量导入使用）
export async function batchCreateBookmarks(
  userId: number,
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
  const created: BookmarkRow[] = [];
  const failed: { index: number; title: string; url: string; reason: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (!item.title || !item.title.trim()) throw new McpError('INVALID_ARGUMENT', '标题不能为空');
      if (!item.url || !item.url.trim()) throw new McpError('INVALID_ARGUMENT', '链接地址不能为空');
      if (!item.itemIconGroupId) throw new McpError('INVALID_ARGUMENT', '缺少所属分组');
      const group = await db.itemIconGroup.findFirst({
        where: { id: item.itemIconGroupId, userId },
      });
      if (!group) throw new McpError('NOT_FOUND', '目标分组不存在');
      await assertNoDuplicateUrl(userId, item.url);

      const row = await db.itemIcon.create({
        data: {
          title: item.title,
          url: item.url,
          lanUrl: item.lanUrl || '',
          description: item.description || '',
          openMethod: item.openMethod ?? 1,
          pinned: item.pinned ?? false,
          itemIconGroupId: item.itemIconGroupId,
          iconJson: JSON.stringify(item.icon || { itemType: 1, src: '' }),
          sort: 9999,
          userId,
        },
      });
      created.push(toBookmarkRow(row));
    } catch (e) {
      failed.push({
        index: i,
        title: item.title,
        url: item.url,
        reason: e instanceof Error ? e.message : '创建失败',
      });
    }
  }

  return { created, failed };
}

// ============ 排序（宽松原语，供浏览器 Action 沿用既有行为） ============

export async function applyTabSort(userId: number, items: { id: number; sort: number }[]) {
  await db.$transaction(
    items.map((item) =>
      db.viewTab.update({ where: { id: item.id, userId }, data: { sort: item.sort } })
    )
  );
}

export async function applyGroupSort(
  userId: number,
  items: { id: number; sort: number }[],
  tabId?: number
) {
  await db.$transaction(
    items.map((item) =>
      db.itemIconGroup.update({
        where: { id: item.id, userId, ...(tabId ? { tabId } : {}) },
        data: { sort: item.sort },
      })
    )
  );
}

export async function applyBookmarkSort(
  userId: number,
  groupId: number,
  items: { id: number; sort: number }[]
) {
  await db.$transaction(
    items.map((item) =>
      db.itemIcon.update({
        where: { id: item.id, userId, itemIconGroupId: groupId },
        data: { sort: item.sort },
      })
    )
  );
}

// ============ 监控组件（Widget） ============

// 与 /api/widgets/stats 保持同一数据通道与超时策略
function promiseTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('连接超时')), ms)),
  ]);
}

export async function listWidgets(userId: number, widgetType?: string) {
  const icons = await db.itemIcon.findMany({
    where: { userId, ...(widgetType ? { widgetType } : { widgetType: { not: '' } }) },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  });

  const groups = await db.itemIconGroup.findMany({
    where: { userId },
    select: { id: true, title: true, tabId: true },
  });
  const tabs = await db.viewTab.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const tabMap = new Map(tabs.map((t) => [t.id, t]));

  return icons.map((i) => {
    const group = groupMap.get(i.itemIconGroupId);
    const tab = group ? tabMap.get(group.tabId) : undefined;
    return {
      id: i.id,
      title: i.title,
      url: i.url,
      widgetType: i.widgetType,
      groupId: i.itemIconGroupId,
      groupName: group?.title ?? null,
      tabId: group?.tabId ?? null,
      tabName: tab?.name ?? null,
    };
  });
}

export interface WidgetStatusResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// 实时拉取监控状态（不缓存）
export async function fetchWidgetStatuses(
  userId: number,
  bookmarkIds: number[]
): Promise<Record<number, WidgetStatusResult>> {
  const { widgetProviders } = await import('./widgets/providers');

  // 与 /api/widgets/stats 一致：允许局域网自签名 SSL 证书连接
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const bookmarks = await db.itemIcon.findMany({
    where: { id: { in: bookmarkIds }, userId },
  });

  const results: Record<number, WidgetStatusResult> = {};

  await Promise.all(
    bookmarkIds.map(async (id) => {
      const bk = bookmarks.find((b) => b.id === id);
      if (!bk) {
        results[id] = { success: false, error: '书签不存在' };
        return;
      }
      if (!bk.widgetType) {
        results[id] = { success: false, error: '该条目不是监控组件' };
        return;
      }
      const provider = widgetProviders[bk.widgetType];
      if (!provider) {
        results[id] = { success: false, error: `不支持的组件类型: ${bk.widgetType}` };
        return;
      }
      try {
        const settings = JSON.parse(bk.widgetSettings || '{}');
        const data = await promiseTimeout(provider.fetchData(bk.url, settings), 5000);
        results[id] = { success: true, data };
      } catch (err) {
        results[id] = { success: false, error: err instanceof Error ? err.message : '数据拉取失败' };
      }
    })
  );

  return results;
}

// 健康巡检：对全部监控书签实时拉取一次状态并汇总
export async function healthCheck(userId: number, chunkSize = 20) {
  const widgets = await db.itemIcon.findMany({
    where: { userId, widgetType: { not: '' } },
    select: { id: true, title: true, widgetType: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
  });

  const allResults: Record<number, WidgetStatusResult> = {};
  for (let i = 0; i < widgets.length; i += chunkSize) {
    const chunk = widgets.slice(i, i + chunkSize).map((w) => w.id);
    const res = await fetchWidgetStatuses(userId, chunk);
    Object.assign(allResults, res);
  }

  const details = widgets.map((w) => {
    const r = allResults[w.id] ?? { success: false, error: '未获取到状态' };
    return {
      id: w.id,
      title: w.title,
      widgetType: w.widgetType,
      success: r.success,
      error: r.error,
      data: r.data,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    total: widgets.length,
    healthy: details.filter((d) => d.success).length,
    unhealthy: details.filter((d) => !d.success).length,
    details,
  };
}
