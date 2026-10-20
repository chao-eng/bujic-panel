import * as panel from '../panelService';
import { fetchTitleAndIcon } from '../favicon';
import { McpError } from './errors';

// MCP 工具注册表：每个工具 = 名称 + 描述 + JSON Schema + 处理器
// 命名统一 panel_ 前缀；描述面向 Agent 自解释（用途 + 危险提示）

export type McpScopeName = 'readonly' | 'readwrite';

export interface ToolContext {
  userId: number;
  scope: McpScopeName;
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // 是否为写操作（只读令牌调用将被拒绝）
  requiresWrite?: boolean;
  // 是否为破坏性操作（需要 confirm=true）
  requiresConfirm?: boolean;
  // 是否无副作用（用于 MCP annotations.readOnlyHint）
  readOnly?: boolean;
  handle: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// ---------- 参数读取助手（避免裸 any） ----------

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function getNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function getBool(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  return typeof v === 'boolean' ? v : undefined;
}

function getNumberArray(args: Record<string, unknown>, key: string): number[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
}

function getObjectArray(args: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const v = args[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function requireString(args: Record<string, unknown>, key: string): string {
  const v = getString(args, key);
  if (v === undefined || v.trim() === '') {
    throw new McpError('INVALID_ARGUMENT', `缺少必填参数：${key}`);
  }
  return v;
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const v = getNumber(args, key);
  if (v === undefined) {
    throw new McpError('INVALID_ARGUMENT', `缺少必填参数：${key}`);
  }
  return v;
}

// ---------- 工具定义 ----------

export const mcpTools: McpTool[] = [
  {
    name: 'panel_get_overview',
    title: '面板总览',
    description:
      '获取当前用户面板的整体概览：导航空间（Tab）数量、分组数量、书签数量、置顶数量、监控组件数量与类型分布。建议在任何操作前先调用，快速了解面板结构。无参数，无副作用。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    handle: (_args, ctx) => panel.getOverview(ctx.userId),
  },
  {
    name: 'panel_list_tabs',
    title: '列出导航空间',
    description:
      '列出全部导航空间（顶层 Tab），包含各自 id、名称、内容形态（card=卡片 / list=列表）、分组数与书签数。执行书签/分组操作前通常先调用它拿到 tabId。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    handle: (_args, ctx) => panel.listTabs(ctx.userId),
  },
  {
    name: 'panel_create_tab',
    title: '创建导航空间',
    description:
      '创建一个新的导航空间（Tab）。名称必填且不超过 20 个字符；形态可选 card（卡片，适合网站导航）或 list（列表，适合带描述的书签）。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '导航空间名称（≤20 字符）' },
        type: { type: 'string', enum: ['card', 'list'], description: '内容形态，默认 card' },
        sort: { type: 'number', description: '排序权重，缺省为追加到末尾' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.createTab(ctx.userId, {
        name: requireString(args, 'name'),
        type: getString(args, 'type') === 'list' ? 'list' : 'card',
        sort: getNumber(args, 'sort'),
      }),
  },
  {
    name: 'panel_update_tab',
    title: '更新导航空间',
    description: '修改已有导航空间的名称或内容形态。仅传入需要变更的字段即可。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '导航空间 id' },
        name: { type: 'string', description: '新名称（≤20 字符）' },
        type: { type: 'string', enum: ['card', 'list'], description: '新内容形态' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.updateTab(ctx.userId, {
        id: requireNumber(args, 'id'),
        name: getString(args, 'name'),
        type: getString(args, 'type') === 'list' ? 'list' : getString(args, 'type') === 'card' ? 'card' : undefined,
      }),
  },
  {
    name: 'panel_delete_tab',
    title: '删除导航空间',
    description:
      '危险操作：删除一个导航空间。strategy=cascade 会连带删除其下全部分组与书签；strategy=migrate 会先把分组迁移到 targetTabId 指向的空间再删除。系统要求至少保留一个导航空间。必须显式传 confirm=true 才会执行。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '要删除的导航空间 id' },
        strategy: {
          type: 'string',
          enum: ['cascade', 'migrate'],
          description: 'cascade=连带删除；migrate=迁移分组后删除',
        },
        targetTabId: { type: 'number', description: 'strategy=migrate 时的目标导航空间 id' },
        confirm: { type: 'boolean', description: '必须为 true 才执行' },
      },
      required: ['id', 'strategy', 'confirm'],
      additionalProperties: false,
    },
    requiresWrite: true,
    requiresConfirm: true,
    handle: (args, ctx) =>
      panel
        .deleteTab(ctx.userId, {
          id: requireNumber(args, 'id'),
          strategy: getString(args, 'strategy') === 'migrate' ? 'migrate' : 'cascade',
          targetTabId: getNumber(args, 'targetTabId'),
        })
        .then(() => ({ success: true })),
  },
  {
    name: 'panel_reorder_tabs',
    title: '重排导航空间',
    description:
      '按给定 id 顺序重排全部导航空间。orderedIds 必须是当前用户全部 Tab 的完整排列（不能多、不能少），否则整体拒绝。',
    inputSchema: {
      type: 'object',
      properties: {
        orderedIds: { type: 'array', items: { type: 'number' }, description: '全部 Tab id 的目标顺序' },
      },
      required: ['orderedIds'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.reorderTabs(ctx.userId, getNumberArray(args, 'orderedIds') ?? []).then(() => ({ success: true })),
  },
  {
    name: 'panel_list_groups',
    title: '列出分组',
    description:
      '列出当前用户的全部书签分组，可按 tabId 过滤。返回分组 id、标题、图标、所属 Tab。创建书签前通常先调用它拿到 groupId。',
    inputSchema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: '可选，仅列出该导航空间下的分组' } },
      additionalProperties: false,
    },
    readOnly: true,
    handle: (args, ctx) => panel.listGroups(ctx.userId, getNumber(args, 'tabId')),
  },
  {
    name: 'panel_create_group',
    title: '创建分组',
    description: '在指定导航空间下创建书签分组。title 必填；tabId 缺省时落到第一个导航空间。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '分组标题' },
        icon: { type: 'string', description: '图标（如 lucide:globe），默认 lucide:globe' },
        description: { type: 'string', description: '分组描述' },
        sort: { type: 'number', description: '排序权重' },
        tabId: { type: 'number', description: '所属导航空间 id' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.createGroup(ctx.userId, {
        title: requireString(args, 'title'),
        icon: getString(args, 'icon'),
        description: getString(args, 'description'),
        sort: getNumber(args, 'sort'),
        tabId: getNumber(args, 'tabId'),
      }),
  },
  {
    name: 'panel_update_group',
    title: '更新分组',
    description: '修改分组标题、图标、描述，或把分组移动到另一个导航空间（传 tabId）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '分组 id' },
        title: { type: 'string', description: '新标题' },
        icon: { type: 'string', description: '新图标' },
        description: { type: 'string', description: '新描述' },
        sort: { type: 'number', description: '新排序权重' },
        tabId: { type: 'number', description: '移动到该导航空间' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.updateGroup(ctx.userId, {
        id: requireNumber(args, 'id'),
        title: getString(args, 'title'),
        icon: getString(args, 'icon'),
        description: getString(args, 'description'),
        sort: getNumber(args, 'sort'),
        tabId: getNumber(args, 'tabId'),
      }),
  },
  {
    name: 'panel_delete_groups',
    title: '删除分组',
    description:
      '危险操作：批量删除分组，并连带删除组内全部书签。必须显式传 confirm=true 才会执行。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'number' }, description: '要删除的分组 id 列表' },
        confirm: { type: 'boolean', description: '必须为 true 才执行' },
      },
      required: ['ids', 'confirm'],
      additionalProperties: false,
    },
    requiresWrite: true,
    requiresConfirm: true,
    handle: (args, ctx) =>
      panel
        .deleteGroups(ctx.userId, getNumberArray(args, 'ids') ?? [])
        .then(() => ({ success: true })),
  },
  {
    name: 'panel_search_bookmarks',
    title: '检索书签',
    description:
      '按关键词（匹配标题/链接/描述）与维度（导航空间、分组、监控类型、是否置顶）检索书签，结果分页。tabId 与 groupId 互斥，只能二选一；widgetType 不传或传空字符串表示不限类型（含普通书签与监控书签）。这是定位目标书签的主要入口，找到后再用 panel_update_bookmark / panel_delete_bookmarks 操作。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '关键词，匹配标题/链接/描述' },
        tabId: { type: 'number', description: '限定导航空间（与 groupId 互斥）' },
        groupId: { type: 'number', description: '限定分组（与 tabId 互斥）' },
        widgetType: { type: 'string', description: '限定监控组件类型；不传表示不限类型' },
        pinnedOnly: { type: 'boolean', description: '仅返回置顶书签' },
        page: { type: 'number', description: '页码，从 1 开始，默认 1' },
        pageSize: { type: 'number', description: '每页数量，默认 50，上限 200' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    handle: (args, ctx) =>
      panel.searchBookmarks(ctx.userId, {
        keyword: getString(args, 'keyword'),
        tabId: getNumber(args, 'tabId'),
        groupId: getNumber(args, 'groupId'),
        widgetType: getString(args, 'widgetType'),
        pinnedOnly: getBool(args, 'pinnedOnly'),
        page: getNumber(args, 'page'),
        pageSize: getNumber(args, 'pageSize'),
      }),
  },
  {
    name: 'panel_get_bookmark',
    title: '获取书签详情',
    description: '根据 id 获取单个书签的完整信息（不含任何凭证字段）。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number', description: '书签 id' } },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: true,
    handle: (args, ctx) => panel.getBookmarkById(ctx.userId, requireNumber(args, 'id')),
  },
  {
    name: 'panel_create_bookmark',
    title: '创建书签',
    description:
      '在指定分组下新增一个普通书签。title 与 url 必填；fetchIcon=true（默认）时服务端会尝试抓取网站图标，抓取失败不影响创建。链接重复时会被拒绝，并返回已存在书签的 id，可改用 panel_update_bookmark。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '书签标题' },
        url: { type: 'string', description: '链接地址（公网）' },
        groupId: { type: 'number', description: '所属分组 id' },
        lanUrl: { type: 'string', description: '内网地址（可选）' },
        description: { type: 'string', description: '描述/备注' },
        openMethod: { type: 'number', description: '1=新标签页（默认），2=当前页' },
        pinned: { type: 'boolean', description: '是否置顶' },
        fetchIcon: { type: 'boolean', description: '是否自动抓取图标，默认 true' },
      },
      required: ['title', 'url', 'groupId'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: async (args, ctx) => {
      const url = requireString(args, 'url');
      const fetchIcon = getBool(args, 'fetchIcon') ?? true;
      let icon: { itemType: number; src: string } | undefined;
      if (fetchIcon) {
        try {
          const { iconUrl } = await fetchTitleAndIcon(url, ctx.userId);
          if (iconUrl) icon = { itemType: 1, src: iconUrl };
        } catch {
          // 抓取失败不阻塞创建
        }
      }
      const created = await panel.saveBookmark(ctx.userId, {
        title: requireString(args, 'title'),
        url,
        itemIconGroupId: requireNumber(args, 'groupId'),
        lanUrl: getString(args, 'lanUrl'),
        description: getString(args, 'description'),
        openMethod: getNumber(args, 'openMethod'),
        pinned: getBool(args, 'pinned'),
        icon,
      });
      return {
        id: created.id,
        title: created.title,
        url: created.url,
        itemIconGroupId: created.itemIconGroupId,
      };
    },
  },
  {
    name: 'panel_batch_create_bookmarks',
    title: '批量创建书签',
    description:
      '批量新增书签（适合「把一批链接导入某个分组」）。单次最多 100 条。逐条校验：成功与失败分别返回，失败项会说明原因（如链接重复、分组不存在），不会因个别失败中断整批。',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '书签数组，每项含 title/url/groupId，可选 lanUrl/description/openMethod/pinned',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              groupId: { type: 'number' },
              lanUrl: { type: 'string' },
              description: { type: 'string' },
              openMethod: { type: 'number' },
              pinned: { type: 'boolean' },
            },
            required: ['title', 'url', 'groupId'],
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) => {
      const items = getObjectArray(args, 'items');
      if (items.length === 0) throw new McpError('INVALID_ARGUMENT', 'items 不能为空');
      if (items.length > 100) throw new McpError('INVALID_ARGUMENT', '单次批量最多 100 条，请分批调用');

      // 逐条容错：缺失字段不在此处抛错，交由 service 逐条判定并汇总失败原因
      return panel.batchCreateBookmarks(
        ctx.userId,
        items.map((it) => ({
          title: getString(it, 'title') ?? '',
          url: getString(it, 'url') ?? '',
          itemIconGroupId: getNumber(it, 'groupId') ?? 0,
          lanUrl: getString(it, 'lanUrl'),
          description: getString(it, 'description'),
          openMethod: getNumber(it, 'openMethod'),
          pinned: getBool(it, 'pinned'),
        }))
      );
    },
  },
  {
    name: 'panel_update_bookmark',
    title: '更新书签',
    description:
      '部分更新书签：可改标题、链接、内网地址、描述、打开方式、置顶，或用 moveToGroupId 把书签移动到另一个分组。仅传需要变更的字段。出于安全考虑，本工具不能修改监控组件的凭证配置（请引导用户在面板界面操作）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '书签 id' },
        title: { type: 'string', description: '新标题' },
        url: { type: 'string', description: '新链接地址' },
        lanUrl: { type: 'string', description: '新内网地址' },
        description: { type: 'string', description: '新描述' },
        openMethod: { type: 'number', description: '1=新标签页，2=当前页' },
        pinned: { type: 'boolean', description: '是否置顶' },
        moveToGroupId: { type: 'number', description: '移动到该分组' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel.updateBookmarkPartial(ctx.userId, {
        id: requireNumber(args, 'id'),
        title: getString(args, 'title'),
        url: getString(args, 'url'),
        lanUrl: getString(args, 'lanUrl'),
        description: getString(args, 'description'),
        openMethod: getNumber(args, 'openMethod'),
        pinned: getBool(args, 'pinned'),
        moveToGroupId: getNumber(args, 'moveToGroupId'),
      }),
  },
  {
    name: 'panel_delete_bookmarks',
    title: '删除书签',
    description: '危险操作：按 id 批量删除书签。必须显式传 confirm=true 才会执行。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'number' }, description: '要删除的书签 id 列表' },
        confirm: { type: 'boolean', description: '必须为 true 才执行' },
      },
      required: ['ids', 'confirm'],
      additionalProperties: false,
    },
    requiresWrite: true,
    requiresConfirm: true,
    handle: async (args, ctx) => {
      const ids = getNumberArray(args, 'ids') ?? [];
      const deleted = await panel.deleteBookmarks(ctx.userId, ids);
      return { deleted, requested: ids.length, skipped: ids.length - deleted };
    },
  },
  {
    name: 'panel_reorder_bookmarks',
    title: '重排书签',
    description:
      '按给定 id 顺序重排某个分组内的全部书签。orderedIds 必须是该分组内全部书签的完整排列，否则整体拒绝。',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'number', description: '目标分组 id' },
        orderedIds: { type: 'array', items: { type: 'number' }, description: '该分组内全部书签的目标顺序' },
      },
      required: ['groupId', 'orderedIds'],
      additionalProperties: false,
    },
    requiresWrite: true,
    handle: (args, ctx) =>
      panel
        .reorderBookmarks(ctx.userId, requireNumber(args, 'groupId'), getNumberArray(args, 'orderedIds') ?? [])
        .then(() => ({ success: true })),
  },
  {
    name: 'panel_list_widgets',
    title: '列出监控组件',
    description:
      '列出所有挂载了服务监控组件的书签（含 widgetType、所属导航与分组）。可按 widgetType 过滤。用于知道「面板上都监控了哪些服务」。',
    inputSchema: {
      type: 'object',
      properties: { widgetType: { type: 'string', description: '可选，按监控组件类型过滤' } },
      additionalProperties: false,
    },
    readOnly: true,
    handle: (args, ctx) => panel.listWidgets(ctx.userId, getString(args, 'widgetType')),
  },
  {
    name: 'panel_get_widget_status',
    title: '查询监控状态',
    description:
      '实时拉取指定监控书签的当前状态（不读缓存）。单次最多 20 个。返回每个书签的成功/失败与具体指标数据；失败项会带错误原因。',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'number' }, description: '监控书签 id 列表，最多 20 个' },
      },
      required: ['ids'],
      additionalProperties: false,
    },
    readOnly: true,
    handle: async (args, ctx) => {
      const ids = getNumberArray(args, 'ids') ?? [];
      if (ids.length === 0) throw new McpError('INVALID_ARGUMENT', 'ids 不能为空');
      if (ids.length > 20) throw new McpError('INVALID_ARGUMENT', '单次最多查询 20 个监控书签，请分批调用');
      const results = await panel.fetchWidgetStatuses(ctx.userId, ids);
      return results;
    },
  },
  {
    name: 'panel_health_check',
    title: '服务健康巡检',
    description:
      '对当前用户全部监控组件执行一次实时巡检，汇总正常/异常数量与明细（异常项含错误原因），并带巡检时间戳。适合「帮我看看服务都还活着吗」这类请求。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    handle: (_args, ctx) => panel.healthCheck(ctx.userId),
  },
];

export const mcpToolMap: Record<string, McpTool> = Object.fromEntries(
  mcpTools.map((t) => [t.name, t])
);
