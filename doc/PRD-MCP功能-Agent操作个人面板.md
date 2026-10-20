# PRD — Bujic Panel MCP 功能:让 Agent 操作个人面板

| 项目 | 内容 |
|------|------|
| 版本 | v1.0 |
| 日期 | 2026-10-19 |
| 状态 | 待评审 |
| 作者 | 产品/研发协作产出(prd-reviewer 方法论) |
| 评审记录 | v1.0 初稿,含文末四维自审 |

---

## 0. 原始需求基线(追溯表)

> 所有设计均可向上回溯到本表。后续任何评审/修订,先改这里,再同步下游章节。

| # | 原始需求原句 | 拆解后的产品含义 | 承载章节 |
|---|-------------|-----------------|---------|
| R1 | "为当前项目增加 MCP 功能" | 面板以 MCP(Model Context Protocol)标准对外暴露工具集,AI Agent(Claude Desktop / Trae / Codex / Cursor 等)可作为 MCP Client 程序化操作面板 | §1、§2、§4 |
| R2 | "实现 agent 对个人面板的操作" | Agent 以**某个面板用户**的身份被鉴权,且能力可被该用户限制(只读/读写) | UC-01、UC-02、BR-01~BR-03 |
| R3 | "包含对导航空间\书签的增删改查" | 导航空间 = `ViewTab`(导航 Tab);书签 = `ItemIcon`(含其所属分组 `ItemIconGroup`)。需覆盖完整 CRUD + 排序 + 检索 | UC-03~UC-12 |
| R4 | "包含对监控组件的状态感知" | Agent 可列出挂载了 Widget 的书签,并**实时拉取**其监控状态(复用现有 Provider 体系),支持一键巡检 | UC-13~UC-15 |
| R5 | "或者你认为还可以支持什么功能" | 检索(panel_search_bookmarks)、总览(panel_get_overview)、批量导入、favicon 自动抓取、健康巡检报告;P2 预留只读备份导出与管理员能力 | UC-03、UC-10、§3.9 |
| R6 | "从第一性原理的角度分析" | 本 PRD §1.2 给出第一性原则拆解,论证工具集的"最小完备性" | §1.2 |
| R7 | "持久化到 doc 目录一份 prd 文档" | 本文档即交付物 | — |

---

## 1. 产品概述

### 1.1 产品背景

Bujic Panel 是自托管、多用户的网站导航与书签管理系统,已具备:双展示模式(卡片/信息流)、服务监控 Widget(Beszel / qBittorrent / Jellyfin / Umami / wg-easy / Uptime Kuma)、多用户权限、SQLite 单文件存储。

当前所有操作只能通过浏览器 UI 完成(拖拽排序、弹窗表单)。用户日常高频出现两类真实诉求:

1. **"帮我整理面板"**:"把这一堆浏览器书签导进去"、"把 Jellyfin 的地址改成新域名"、"删掉那几个打不开的站"——机械、批量、适合交给 Agent。
2. **"我的服务现在怎么样"**:"检查一下我挂的服务是不是都活着"、"qb 下载速度多少"——需要实时感知,而 Agent 此前无入口。

MCP 是当下 Agent 生态的事实标准协议。为面板增加 MCP Server 能力,等于把面板从"只能用手点的页面"升级为"Agent 可编排的工具集",一次投入,所有支持 MCP 的客户端同时受益。

### 1.2 第一性原则分析

> 回到本质:**Agent 操作面板,真正提供的是什么?**
> ——把"人在面板上的每一次点按、输入、拖拽",替换为**可组合、可脚本化、可被自然语言驱动的程序化接口**。

**本质需求**:人面板上的一切动作,无外乎对四类资源(导航空间 Tab / 分组 / 书签 / 监控)做两件事——**改变状态(CRUD)** 与**感知状态(读当前值)**。因此 MCP 工具集的最小完备集 = 资源 CRUD 原语 + 状态感知原语 + 检索原语(否则 Agent 无法定位目标资源)。

**必要条件**(逐项对应方案):

| # | 必要条件 | 对应设计 |
|---|---------|---------|
| N1 | Agent 必须能以"某个用户"身份被识别(多用户隔离) | MCP Token 绑定 userId,一切查询天然 `where: { userId }` |
| N2 | 用户必须能限制 Agent 的能力 | Token 携带 scope(readonly / readwrite),删除类工具另加 confirm 门槛 |
| N3 | Agent 没有 UI 可看,工具必须**自解释** | 每个 tool 具备清晰的中文 description + JSON Schema,错误信息面向 Agent 可读 |
| N4 | 写操作必须即时反映到浏览器 | 复用 `revalidatePath('/')`,与现有 Server Action 行为一致 |
| N5 | 监控感知必须是"现在"而非"上次缓存" | 工具内实时调用 Provider `fetchData`(5s 超时),与前端轮询同一数据通道 |

**硬约束**(来自现有架构,不可违背):

| # | 约束 | 应对 |
|---|------|------|
| C1 | SQLite 单写者(WAL 模式,busy_timeout 5000) | 工具内事务保持短小;列表查询分页,避免大结果集长事务 |
| C2 | `widgetSettings` 含明文凭证(AES-GCM 解密后) | MCP 一切输出**脱敏**,凭证字段永不返回(BR-06) |
| C3 | 自托管 Docker 单容器,不引入新进程/中间件 | MCP Server 以 **Next.js Route Handler(内嵌 Streamable HTTP)** 形态实现,零新增部署单元 |
| C4 | 写操作主通道是 Server Actions(依赖 `cookies()`,无法在 MCP 路由复用) | 将 Action 内业务逻辑抽为共享 service 层;MCP 工具与 Server Action 同源调用,校验规则单一真相 |
| C5 | 无物理外键,级联靠应用层事务 | 删除类工具沿用现有事务级联模式,不绕过 |

**架构选型结论**(维度一式推演,三选一):

| 方案 | 说明 | 判定 |
|------|------|------|
| A. 独立 stdio MCP 进程直连 SQLite | 绕过 Next.js 业务层,查重/级联/加密规则全部要重写一遍;容器需多进程管理;与 Web 并发写 | ✗ 否决 |
| B. **内嵌 Streamable HTTP MCP(`/api/mcp` Route Handler)** | 复用 `verifyRequestAuth` 同级的 Token 校验、db、Provider 注册表;容器零改动;天然多用户隔离 | ✓ **采用** |
| C. 独立 HTTP MCP 服务 | 多一个部署单元,自托管用户负担大;与 B 无能力差异 | ✗ 否决 |

### 1.3 产品目标(可测指标)

| # | 目标 | 度量口径 |
|---|------|---------|
| G1 | 主流 MCP 客户端可一键接入并完成全部 P0 工具调用 | Claude Desktop / Trae / Cursor 至少 2 个实测通过,工具调用成功率 100%(标注用例集) |
| G2 | Agent 常规读写体验达标 | 非监控类工具 P95 < 300ms(本地部署);监控状态查询 P95 < 5.5s |
| G3 | Agent 可替代人工完成面板整理 | 标注测试集:20 条自然语言整理指令(增/删/改/查/移动),成功率 ≥ 90% |
| G4 | Agent 可完成服务巡检 | 巡检报告与浏览器 Widget 卡片显示一致率 100%(同一时间窗) |
| G5 | 安全零事故 | 越权(跨用户)用例 0 通过;凭证泄漏用例 0 通过(输出全量扫描) |

### 1.4 系统范围

**范围内核(P0)**:MCP 连接与 Token 鉴权;导航空间/分组/书签 CRUD 与检索;监控组件清单/实时状态/健康巡检。

**范围外(明确不做)**:
- 不做浏览器内嵌聊天框/面板内 AI 对话(用户已有独立 Agent 入口);
- 不做 Widget 的**写操作**(如"暂停 qb 种子")——监控 Provider 当前均为只读拉取,写入属各第三方服务的危险操作,本期仅感知;
- 不做用户账号管理(建号/改密)的 MCP 化;
- 不做 MCP resources / prompts / sampling / 通知推送(P2 再议,见 §3.9);
- 不改动现有浏览器 UI 的任何交互行为(仅新增"MCP 接入"设置区块)。

**组件定义表**:

| 术语 | 定义 |
|------|------|
| MCP Server | 内嵌于本项目的 `/api/mcp` Route Handler,实现 MCP Streamable HTTP 传输 |
| MCP Token | 面板用户在设置页生成的长期访问凭证,绑定 userId + scope,落库仅存哈希 |
| 导航空间(Tab) | `view_tab` 表记录,顶层导航页签(card/list 两种形态) |
| 分组 | `item_icon_group` 表记录,隶属某个 Tab |
| 书签 | `item_icon` 表记录,隶属某个分组;`widgetType` 非空即同时是"监控书签" |
| 监控组件(Widget) | 书签上挂载的服务监控能力,由 `widgetProviders` 注册表的 Provider 实时拉数 |
| 巡检 | 对当前用户全部监控书签并发执行一次状态拉取并输出汇总报告 |

---

## 2. UML 用例模型

### 2.1 系统用例图(ASCII)

```
        面板用户(人)                AI Agent(MCP Client)
             │                            │
             │  生成/吊销 MCP Token        │  (Bearer MCP Token)
             ▼                            ▼
   ┌──────────────────────────────────────────────────┐
   │              Bujic Panel MCP Server               │
   │                                                   │
   │  UC-01 Token 生命周期管理 ◄──────────────────────┐ │
   │  UC-02 MCP 连接与鉴权 ────┐                      │ │
   │                          ▼                      │ │
   │  UC-03 面板总览 ──────────┤                      │ │
   │  UC-04 导航空间查询       │                      │ │
   │  UC-05 导航空间创建/更新   │   (include)         │ │
   │  UC-06 导航空间删除 ◄─────┤── UC-02 鉴权通过    │ │
   │  UC-07 空间/分组排序      │                      │ │
   │  UC-08 分组增删改查       │                      │ │
   │  UC-09 书签检索与详情      │                      │ │
   │  UC-10 书签创建(单/批量)  │                      │ │
   │  UC-11 书签更新/移动/置顶  │                      │ │
   │  UC-12 书签删除           │                      │ │
   │  UC-13 监控组件清单       │                      │ │
   │  UC-14 监控状态查询       │                      │ │
   │  UC-15 服务健康巡检       │                      │ │
   └──────────────────────────────────────────────────┘
                    │
                    ▼ (fetchData, 5s 超时)
        第三方服务(Beszel/qB/Jellyfin/Umami/wg-easy/Uptime Kuma)
```

### 2.2 参与者定义

| 参与者 | 说明 |
|--------|------|
| **AI Agent(MCP Client)** | 通过 MCP 协议连接 `/api/mcp` 的智能体宿主(Claude Desktop、Trae、Codex CLI、Cursor 等)。它不是"人",所有身份来自 MCP Token。 |
| **面板用户** | 面板的合法登录用户。是 MCP Token 的**授权者与属主**,通过设置 UI 管理自己的 Token。 |
| **面板管理员** | `role === 1` 的用户。P0/P1 阶段与普通用户在 MCP 能力上无差异(各自操作自己的数据);管理类工具为 P2 预留。 |

### 2.3 用例列表

| 编号 | 名称 | 参与者 | 优先级 | 对应工具 |
|------|------|--------|--------|---------|
| UC-01 | Token 生命周期管理 | 面板用户 | P0 | —(设置 UI) |
| UC-02 | MCP 连接与鉴权 | AI Agent | P0 | initialize / tools/list |
| UC-03 | 面板总览 | AI Agent | P0 | panel_get_overview |
| UC-04 | 导航空间查询 | AI Agent | P0 | panel_list_tabs |
| UC-05 | 导航空间创建/更新 | AI Agent | P0 | panel_create_tab / panel_update_tab |
| UC-06 | 导航空间删除(级联或迁移) | AI Agent | P1 | panel_delete_tab |
| UC-07 | 空间/分组/书签排序 | AI Agent | P2 | panel_reorder_tabs / panel_reorder_groups / panel_reorder_bookmarks |
| UC-08 | 分组增删改查 | AI Agent | P0 | panel_list_groups / panel_create_group / panel_update_group / panel_delete_groups |
| UC-09 | 书签检索与详情 | AI Agent | P0 | panel_search_bookmarks / panel_get_bookmark |
| UC-10 | 书签创建(单个/批量/favicon) | AI Agent | P0 | panel_create_bookmark / panel_batch_create_bookmarks |
| UC-11 | 书签更新/移动/置顶 | AI Agent | P1 | panel_update_bookmark |
| UC-12 | 书签删除 | AI Agent | P1 | panel_delete_bookmarks |
| UC-13 | 监控组件清单 | AI Agent | P0 | panel_list_widgets |
| UC-14 | 监控状态查询 | AI Agent | P0 | panel_get_widget_status |
| UC-15 | 服务健康巡检 | AI Agent | P1 | panel_health_check |

### 2.4 用例关系

- UC-03 ~ UC-15 **include** UC-02(鉴权不通过,一切工具返回 PERMISSION_DENIED / UNAUTHORIZED)。
- UC-10 **extend** favicon 自动抓取(`fetchIcon=true` 时,复用现有 `/api/favicon` 逻辑)。
- UC-15 **include** UC-14(巡检 = 对全部监控书签批量执行状态查询 + 汇总)。
- UC-06 与 UC-11 的"移动分组"共享"目标资源归属校验"规则(BR-05)。

---

## 3. 详细用例规格说明

> 通用约定(适用于全部工具,后文不再重复):
> - 传输:Streamable HTTP,端点 `POST /api/mcp`(JSON-RPC 2.0);协议版本 MCP `2025-06-18`。
> - 鉴权:每次请求 `Authorization: Bearer mcp_xxx`(BR-01)。
> - 全部数据天然按 Token 绑定的 `userId` 过滤(BR-05)。
> - 全部输出经过脱敏过滤(BR-06,见 §3.10 脱敏表)。
> - 列表默认分页:page=1,pageSize=50,最大 200(BR-13)。

### UC-01 Token 生命周期管理

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-01 |
| **用例名称** | Token 生命周期管理 |
| **参与者** | 面板用户 |
| **优先级** | P0(无 Token 则整个功能不存在) |
| **前置条件** | 用户已登录面板 |
| **后置条件** | 用户持有 0~N 个可用 MCP Token;被吊销 Token 立即失效 |
| **基本事件流** | 1. 用户打开设置弹窗,进入「MCP 接入」区块<br>2. 系统展示当前 Token 列表(名称、权限、状态、最后使用时间、创建时间)<br>3. 用户点击「生成 Token」,输入名称并选择权限(只读/读写)<br>4. 系统生成 `mcp_` 前缀随机串,**明文仅此次展示**,提示用户立即复制<br>5. 用户复制明文,配置到自己的 MCP 客户端<br>6. 用户可随时点击「吊销」,Token 立即失效 |
| **备选事件流** | 3a. Token 数已达上限(5 个):系统拒绝生成并提示先吊销旧 Token(BR-12)<br>4a. 用户关闭弹窗未复制:明文不可找回,只能吊销重生成<br>6a. 吊销时有 Agent 正在连接:后续请求立即 401,不中断已完成的单次调用 |
| **业务规则** | BR-02:落库仅存 SHA-256(token),明文不落库不进日志<br>BR-03:scope=readonly 的 Token 调用任何写工具 → PERMISSION_DENIED<br>BR-12:每用户 Token 上限 5 个<br>BR-17:Token 不设过期时间,仅靠吊销失效;`last_used_at` 在每次成功调用后惰性更新(允许误差 ≤ 60s) |

#### 数据说明表
**MCP Token(mcp_token)** — 唯一新增数据表

| 字段名 | 字段中文名 | 数据类型 | 取值范围 | 是否必填 | 备注说明 |
|--------|------------|----------|----------|----------|----------|
| id | 主键 | Int | 自增 | 是 | `@id @default(autoincrement())` |
| user_id | 所属用户 | Int | 存量 user.id | 是 | 无物理外键(遵守 C5) |
| name | Token 名称 | String | ≤20 字符 | 是 | 用户自定义,如 "我的 Trae" |
| token_hash | Token 哈希 | String | 64 位 hex | 是 | SHA-256(明文),`@unique` |
| scope | 权限范围 | String | readonly \| readwrite | 是 | 默认 readonly |
| status | 状态 | Int | 1 启用 / 2 吊销 | 是 | 默认 1 |
| last_used_at | 最后使用时间 | DateTime? | — | 否 | 惰性更新(BR-17) |
| created_at / updated_at | 创建/更新时间 | DateTime | — | 是 | 遵循现有 `@map` 蛇形约定 |

### UC-02 MCP 连接与鉴权

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-02 |
| **用例名称** | MCP 连接与鉴权 |
| **参与者** | AI Agent |
| **优先级** | P0 |
| **前置条件** | 用户已在 MCP 客户端配置端点 `http(s)://<面板地址>/api/mcp` 与 Bearer Token |
| **后置条件** | Agent 获得工具清单;此后每次调用均通过身份与权限双重校验 |
| **基本事件流** | 1. Agent 发起 MCP `initialize`(携带协议版本与能力声明)<br>2. 服务端校验 Bearer Token:查 `mcp_token` → status=1 → 关联 user(status=1)<br>3. 返回 server 能力(tools)与协议版本,完成握手<br>4. Agent 调用 `tools/list`,获得全部工具的 name/description/inputSchema<br>5. Agent 按需调用 `tools/call` |
| **备选事件流** | 2a. Token 不存在/已吊销:返回 HTTP 401,MCP error code=UNAUTHORIZED<br>2b. Token 关联用户被停用(status≠1):同 2a<br>5a. scope 不足:工具存在但调用返回 PERMISSION_DENIED(BR-03)<br>5c. 同一 Token 1 分钟内连续 401 校验失败 ≥10 次:15 分钟内拒绝该 Token(防爆破,BR-15) |
| **业务规则** | BR-01:仅经 `/api/mcp` 暴露;必须 Bearer Token;不接受 Cookie 鉴权(避免 CSRF 面)<br>BR-04:一切删除类工具必须传 `confirm=true`,否则拒绝并说明<br>BR-14:工具错误统一为 MCP error,中文 message,面向 Agent 可读(含原因与建议) |

### UC-03 面板总览(panel_get_overview)

Agent 接入后的"第一眼"。回答"这个面板里有什么",供 Agent 决定下一步动作,避免盲目全量拉取。

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-03 |
| **用例名称** | 面板总览 |
| **参与者** | AI Agent |
| **优先级** | P0 |
| **前置条件** | 鉴权通过 |
| **后置条件** | Agent 获得当前用户面板的统计摘要 |
| **基本事件流** | 1. Agent 调用 `panel_get_overview`(无参数)<br>2. 系统聚合:Tab 数、分组数、书签数、置顶数、监控书签数(按 widgetType 分桶)<br>3. 返回统计 + 各 Tab 的名称/形态摘要 |
| **备选事件流** | 2a. 用户无任何数据:返回全 0 与空数组,不报错 |
| **业务规则** | BR-13:总览不返回明细,明细由各 list/search 工具分页获取 |

### UC-04/05/06 导航空间查询 / 创建更新 / 删除

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-04 / UC-05 / UC-06 |
| **用例名称** | 导航空间查询 / 创建更新 / 删除 |
| **参与者** | AI Agent |
| **优先级** | P0 / P0 / P1 |
| **前置条件** | 鉴权通过;写操作要求 scope=readwrite |
| **后置条件** | Tab 数据变更且浏览器下次加载即见新数据(BR-10) |
| **基本事件流** | **查询**:1. `panel_list_tabs()` → 2. 返回 Tab 列表(含每组分组数、书签数)<br>**创建**:1. `panel_create_tab {name, type=card, sort?}` → 2. 校验名称非空 ≤20 字符 → 3. 返回新建 Tab<br>**更新**:1. `panel_update_tab {id, name?, type?}` → 2. 归属校验后更新<br>**删除**:1. `panel_delete_tab {id, confirm, strategy, targetTabId?}` → 2. 校验"至少保留一个 Tab" → 3. 按 strategy 执行级联删除或迁移后删除(事务) |
| **备选事件流** | 查询:无<br>创建:2a. 名称空/超长 → INVALID_ARGUMENT(与 `editTabAction` 同规则,BR-08)<br>更新/删除:2b. id 不属于当前用户 → NOT_FOUND(不暴露他人资源存在性)<br>删除:2c. 仅剩 1 个 Tab → 拒绝(BR-11);2d. strategy=migrate 但 targetTabId 无效/等于源 → INVALID_ARGUMENT;2e. confirm≠true → 拒绝并提示(BR-04) |
| **业务规则** | BR-08:名称/长度校验与现有 Server Action 完全一致(单一真相,见 C4)<br>BR-11:至少保留一个 Tab;级联策略默认 cascade,需显式选择<br>BR-10:写成功后 `revalidatePath('/')` |

### UC-07 空间/分组/书签排序

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-07 |
| **用例名称** | 空间/分组/书签排序 |
| **参与者** | AI Agent |
| **优先级** | P2(拖拽为主,Agent 排序为低频兜底) |
| **基本事件流** | `panel_reorder_tabs / panel_reorder_groups / panel_reorder_bookmarks {orderedIds}` → 事务内批量更新 sort → 返回成功 |
| **备选事件流** | 2a. orderedIds 与该用户实际资源集合不一致(多/少/越权 id)→ 整体拒绝,事务回滚(BR-18:排序是全量替换,不接受部分提交) |
| **业务规则** | BR-18:排序输入必须为目标集合的**全量排列**,避免 Agent 部分提交导致顺序错乱 |

### UC-08 分组增删改查

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-08 |
| **用例名称** | 分组增删改查 |
| **参与者** | AI Agent |
| **优先级** | P0 |
| **基本事件流** | **查**:`panel_list_groups {tabId?}` 返回分组(含各自书签数);**增**:`panel_create_group {title, icon='lucide:globe', description?, tabId}`(tabId 缺省落到第一个 Tab,与 `editGroupAction` 一致);**改**:`panel_update_group {id, title?, icon?, description?, tabId?}`;**删**:`panel_delete_groups {ids, confirm}`(事务级联删除组内书签) |
| **备选事件流** | 增:2a. 目标 Tab 不存在/越权 → NOT_FOUND<br>删:2b. confirm 缺失 → 拒绝(BR-04);2c. 删除后某 Tab 将无任何分组 → 允许(与现有 Web 行为一致,不额外兜底) |
| **业务规则** | BR-05:一切读写带 userId 归属过滤<br>BR-19:分组删除级联删除组内书签,工具 description 必须明示该后果(Agent 需能向用户转述风险) |

### UC-09 书签检索与详情

Agent 使用频率最高的读工具——先找到,才能改/删。

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-09 |
| **用例名称** | 书签检索与详情 |
| **参与者** | AI Agent |
| **优先级** | P0 |
| **基本事件流** | 1. `panel_search_bookmarks {keyword?, tabId?, groupId?, widgetType?, pinnedOnly?, page?, pageSize?}`<br>2. keyword 对 title/url/description 做 SQLite `contains`(不区分大小写)联合匹配<br>3. 返回分页结果 + total<br>4. `panel_get_bookmark {id}` 返回单条脱敏详情(含 iconJson 解析结果与 widgetType) |
| **备选事件流** | 2a. 无命中:返回空列表与 total=0,不报错<br>4a. id 越权 → NOT_FOUND |
| **业务规则** | BR-06:输出永不包含 widgetSettings 与任何凭证<br>BR-13:pageSize 默认 50,上限 200 |

### UC-10 书签创建(单个 / 批量 / favicon)

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-10 |
| **用例名称** | 书签创建 |
| **参与者** | AI Agent |
| **优先级** | P0 |
| **基本事件流** | 1. `panel_create_bookmark {title, url, groupId, description?, lanUrl?, openMethod?, pinned?, fetchIcon=true}`<br>2. URL 查重(仅普通书签,与 `editItemIconAction` 同规则,BR-09)<br>3. fetchIcon=true 时服务端尝试抓取 favicon(复用现有 favicon 逻辑,失败不阻塞创建,icon 置空)<br>4. 落库,返回脱敏书签<br>5. 批量:`panel_batch_create_bookmarks {items[]}` 逐条校验,**部分成功**:返回 `{created[], failed:[{item, reason}]}` |
| **备选事件流** | 2a. URL 重复 → 返回已存在书签的 title 与 id 供 Agent 决策(而非直接报错,见 BR-09 说明)<br>3a. favicon 抓取超时(3s)→ 跳过,创建继续<br>5a. items > 100 → 拒绝,提示分批 |
| **业务规则** | BR-09:查重规则与现有逻辑一致(排除 widget 书签;agent 收到重复提示后可走"更新已有"路径)<br>BR-20:批量导入单次上限 100 条;结果必须逐一说明成败原因<br>BR-10:写后 revalidatePath |

### UC-11 书签更新 / 移动 / 置顶

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-11 |
| **用例名称** | 书签更新/移动/置顶 |
| **参与者** | AI Agent |
| **优先级** | P1 |
| **基本事件流** | 1. `panel_update_bookmark {id, title?, url?, lanUrl?, description?, openMethod?, pinned?, moveToGroupId?}`<br>2. 仅更新传入字段(部分更新语义)<br>3. moveToGroupId 存在时校验目标分组归属后执行"移动"<br>4. 返回更新后的脱敏书签 |
| **备选事件流** | 2a. url 变更触发查重(BR-09 同规则)<br>3a. 目标分组越权 → NOT_FOUND |
| **业务规则** | BR-21:widget 书签经 MCP 更新时**不得**触碰 widgetType/widgetSettings(凭证字段只能经浏览器 UI 修改;MCP 传参中出现即拒绝)——防 Agent 覆盖/破坏已加密凭证 |

### UC-12 书签删除

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-12 |
| **用例名称** | 书签删除 |
| **参与者** | AI Agent |
| **优先级** | P1 |
| **基本事件流** | 1. `panel_delete_bookmarks {ids, confirm}` → 2. 归属过滤批量删除 → 3. 返回实际删除数 |
| **备选事件流** | 1a. confirm≠true → 拒绝(BR-04)<br>2a. 部分不存在 → 删除存在且归属正确的部分,返回 `{deleted, skipped}` |
| **业务规则** | BR-04、BR-05 |

### UC-13/14/15 监控组件清单 / 状态查询 / 健康巡检

| 项目 | 内容 |
|------|------|
| **用例编号** | UC-13 / UC-14 / UC-15 |
| **用例名称** | 监控组件清单 / 状态查询 / 健康巡检 |
| **参与者** | AI Agent |
| **优先级** | P0 / P0 / P1 |
| **前置条件** | 鉴权通过(只读即可,无需 readwrite) |
| **基本事件流** | **清单**:1. `panel_list_widgets {widgetType?}` → 2. 返回监控书签列表(id、title、widgetType、url、所属 Tab/分组名)<br>**状态**:1. `panel_get_widget_status {ids}` → 2. 逐个调用 Provider `fetchData`(并发,单点 5s 超时,复用 §6 现有 stats 通道)→ 3. 返回 `Record<id, {success, data\|error}>`<br>**巡检**:1. `panel_health_check()` → 2. 等价于对全部监控书签执行状态查询 → 3. 输出报告:总数 / 正常数 / 异常数 / 明细(异常者含 error 文案) + 巡检时间戳 |
| **备选事件流** | 状态:2a. ids>20 → 拒绝,提示分批(BR-07);2b. 某 id 非监控书签 → 该项标记 `not_a_widget`;2c. widgetType 未注册 → 该项 `success:false, error:'不支持的组件类型'`(与现有 stats 路由文案一致)<br>巡检:2a. 用户无监控书签 → 返回空报告,不报错 |
| **业务规则** | BR-07:单次状态查询上限 20 个书签<br>BR-06:Provider 返回 data 中若含敏感字段(如 session token),沿用各 Provider 现有过滤,不在 MCP 层二次输出凭证<br>BR-16:巡检报告必须带巡检时间戳(ISO 8601),Agent 转述时可声明"截至何时"<br>BR-22:状态查询为**实时拉取不缓存**(MVP);同一秒内重复巡检不合并(N2 要求"现在") |

### 3.9 扩展与预留(P2+,不承诺排期)

| 能力 | 说明 | 价值 |
|------|------|------|
| panel_export_backup | 只读导出面板 JSON(与现有备份格式同构) | Agent 可代用户异地备份 |
| 管理员工具 | 公告(Notice)增删改查、系统设置读取 | role===1 的 Token 才可见 |
| MCP resources | 将 `bujic://overview` 暴露为 resource | 支持资源语义的客户端体验更佳 |
| 状态缓存 | 巡检结果 30s 缓存 | 降低 Agent 高频巡检对第三方的压力 |
| 通知订阅(远期) | Widget 异常时主动通知 Agent(sampling/回调) | 面板从"被查询"变"主动报告",架构成本高,远期评估 |

### 3.10 输出脱敏表(BR-06 落地口径)

| 字段 | MCP 输出策略 |
|------|-------------|
| `widgetSettings` | **永不返回**(含明文凭证) |
| `user.password` / `user.token` | 永不返回 |
| 书签对象 | 返回 id/title/url/lanUrl/description/openMethod/pinned/groupId/widgetType(仅类型)/icon(iconJson 解析)/sort/createdAt/updatedAt |
| Widget 状态 data | 透传 Provider fetchData 结果(各 Provider 已对敏感字段负责,见 §6 现状) |

---

## 4. 详细交互设计

### 4.1 端到端时序图

```
 AI Agent宿主          /api/mcp (MCP Server)       共享service层          SQLite/Provider
     │                       │                          │                     │
     │ 1. initialize         │                          │                     │
     │ (Bearer mcp_xxx)      │                          │                     │
     │ ─────────────────────►│ 2. verifyToken(哈希比对)  │                     │
     │                       │ ────────────────────────►│ (mcp_token 表)      │
     │ 3. serverInfo+tools    │                          │                     │
     │ ◄─────────────────────│                          │                     │
     │                       │                          │                     │
     │ 4. tools/list         │                          │                     │
     │ ─────────────────────►│                          │                     │
     │ 5. 工具schema清单      │                          │                     │
     │ ◄─────────────────────│                          │                     │
     │                       │                          │                     │
     │ 6. tools/call          │                          │                     │
     │  (panel_create_bookmark)│                          │                     │
     │ ─────────────────────►│ 7. scope/confirm/参数校验  │                     │
     │                       │ 8. 调 service.createIcon  │                     │
     │                       │ ────────────────────────►│ 9. 查重+事务写入 ───►│
     │                       │                          │ 10. revalidatePath   │
     │ 11. 脱敏结果           │ ◄────────────────────────│                     │
     │ ◄─────────────────────│                          │                     │
     │                       │                          │                     │
     │ 12. tools/call          │                          │                     │
     │  (panel_get_widget_status)                        │                     │
     │ ─────────────────────►│ 13. 并发 fetchData(5s超时)─┼────────────────────►│
     │ 14. Record<id,{...}>  │ ◄─────────────────────────┼─────────────────────│
     │ ◄─────────────────────│                          │                     │
```

### 4.2 关键状态机 — MCP Token

```
   [生成] ──► active ────「吊销」────► revoked(终态)
                │
                └─「用户被停用/删除」──► 失效(校验时判定,不迁移状态)
```

| 状态 | 可否调用 | 说明 |
|------|---------|------|
| active | ✓ | 正常 |
| revoked | ✗ 401 | 终态,不可恢复 |
| 用户 status≠1 | ✗ 401 | Token 状态不变,用户恢复启用后 Token 自动复效 |

### 4.3 写操作统一处理流程(所有写工具共用)

```
tools/call ─► Token校验 ─► scope≥readwrite? ─否─► PERMISSION_DENIED
                │是
                ▼
          删除类? ─是─► confirm=true? ─否─► 拒绝+说明
                │是/非删除类
                ▼
          参数 schema 校验(INVALID_ARGUMENT)
                ▼
          资源归属校验(NOT_FOUND)
                ▼
          service 层业务校验(名称/查重/保留规则…)
                ▼
          Prisma 事务写入 ─► revalidatePath('/')
                ▼
          脱敏输出(HTTP 200)
```

### 4.4 线程模型与并发约束

```
MCP Route Handler(Next.js 请求级隔离)
   ├─ 每请求: token校验(1次索引查询) → 工具handler
   │     ├─ CRUD:Prisma 事务(短事务,SQLite WAL,busy_timeout=5000 已有)
   │     └─ 状态查询:Promise.all 并发 fetchData(上限20,单点5s超时)
   └─ 与浏览器 Server Action 并发写:同一 SQLite,依赖 WAL + 短事务,无长锁
浏览器端(RSC 预读) ← revalidatePath('/') 保证写后一致
```

### 4.5 关键竞态清单

| # | 竞态场景 | 危害 | 应对(BR) |
|---|----------|------|----------|
| 1 | Agent 与浏览器同时创建相同 URL 书签 | 双写绕过查重(TOCTOU) | BR-23:接受最终一致——查重为应用层软校验(与现状一致),冲突概率低;P2 可评估部分唯一索引 |
| 2 | Agent 删除 Tab 与浏览器正在往该 Tab 拖入书签 | 浏览器写入孤儿分组 | BR-24:删除事务内先删书签再删分组再删 Tab(顺序与 `deleteTabAction` 一致),孤儿数据由事务原子性排除 |
| 3 | Agent 巡检风暴(循环调用 health_check) | 第三方服务被打爆 | BR-22:MVP 不缓存但工具 description 建议节制;P2 加 30s 缓存 |
| 4 | Token 吊销瞬间存在在途请求 | 已发出请求继续执行 | BR-25:吊销对"请求已通过校验"的在途调用不追杀(单次调用 ≤8s 自然结束),新请求立即 401 |
| 5 | last_used_at 并发更新 | 丢更新 | 无害(惰性语义,BR-17),用 updateMany 不带条件竞争 |
| 6 | 排序与新增并发 | 新书签 sort=9999 不在 orderedIds 内 | BR-18 排序为全量替换语义:新尾项由下次排序纳入;一次排序不承诺绝对时刻一致 |

---

## 5. UI 设计规范(仅新增区块)

MCP 本身无主界面,唯一 UI 为设置弹窗内新增「MCP 接入」区块(遵循现有 Modal 结构与 i18n 双语规范,zh/en 字典同补)。

```
┌─ 设置弹窗 ──────────────────────────────────────┐
│ …现有设置项…                                     │
│ ┌─ MCP 接入(新) ─────────────────────────────┐ │
│ │ 说明文案:生成访问令牌,让 AI 助手(Agent)    │ │
│ │ 通过 MCP 协议安全地管理你的面板。             │ │
│ │                                             │ │
│ │ [表格: 名称 | 权限 | 最后使用 | 创建时间 | 操作]│ │
│ │  我的Trae | 读写  | 2小时前   | 10-01  | 吊销 │ │
│ │  备份脚本| 只读  | 从未使用  | 09-12  | 吊销 │ │
│ │                                             │ │
│ │ [+ 生成新令牌]                               │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- **生成流程**:名称(必填)→ 权限(只读/读写,单选)→ 生成 → 明文弹层展示 + 「复制」按钮 + 提示"关闭后无法再次查看"。
- **空态**:始终展示「生成新令牌」按钮与说明文案(遵守项目约定:可操作入口即使无数据也展示)。
- **吊销**:二次确认弹层,提示影响("正在使用此令牌的 AI 助手将立即失去访问权限")。
- 复用 shadcn/ui 组件与现有主题变量,不新增设计语言。

---

## 6. 非功能需求

### 6.1 性能(分模式)

| 指标 | 目标 | 口径 |
|------|------|------|
| 常规工具(总览/检索/CRUD) | P95 < 300ms | 本地/局域网部署,数据量 ≤ 1000 书签 |
| panel_get_widget_status(≤20 个) | P95 < 5.5s | 单点 5s 超时硬上限(沿用 stats 路由) |
| panel_health_check | ≤ (⌈N/20⌉ 次内并发) 单轮 < 8s | N = 监控书签总数 |
| initialize + tools/list | < 200ms | 冷握手 |

### 6.2 兼容性

- MCP 协议版本 `2025-06-18`(Streamable HTTP);对仅支持旧 HTTP+SSE 的客户端提供降级握手协商。
- 客户端验证矩阵:Claude Desktop、Trae、Cursor、Codex CLI ≥ 各 1 项连通性用例(G1)。
- 部署形态:Docker standalone(现 CI 产物)零改动;`DATA_DIR` 反代/HTTPS 场景透传 `Authorization` 头(反代配置文档随附)。

### 6.3 安全与隐私

- BR-01/02/03/04/05/06/15(见各用例);补充:服务端日志禁止打印 Bearer Token、widgetSettings、Provider 凭证。
- MCP 端点默认不进现有"公开端点"白名单(现 `src/proxy.ts` 放行 `/api/openness/*` 等),保持需鉴权状态;`/api/mcp` 请求一律先鉴权后路由。
- HTTPS:自托管局域网 HTTP 可用,但文档提示公网暴露必须 TLS。

### 6.4 可靠性

- 任一工具异常不影响面板 Web 功能(MCP 路由独立于页面)。
- 工具失败必返结构化错误(code + 中文 message),Agent 可据此自纠(BR-14)。
- 新增 `mcp_token` 表走既有建表链路(schema.prisma → `pnpm db:push` → 同步 `current.sql` 与 Dockerfile 产物)。

### 6.5 技术验证清单(排期前 Spike)

| # | 验证项 | 风险 |
|---|--------|------|
| S1 | `@modelcontextprotocol/sdk` 在 Next.js 16 Route Handler(standalone 输出)中跑 Streamable HTTP 的可行性 | 高(框架边界) |
| S2 | `revalidatePath('/')` 在 Route Handler 内调用对 RSC 页面缓存的实际生效验证 | 中 |
| S3 | Server Action 逻辑抽 service 层后,Action 与 MCP 工具双通道回归(现有功能零退化) | 中 |
| S4 | mcp_token 表经 `prisma db:push` + `current.sql` 在 Docker 首启建表验证 | 低 |
| S5 | 反代(常见 Nginx/Caddy/群晖)透传 Authorization 头实测 | 低 |

---

## 7. 附录

### 7.1 工具速查表(最终命名以 tools/list 输出为准)

| 工具名 | 写? | scope | 对应 UC |
|--------|-----|--------|---------|
| panel_get_overview | 否 | readonly | UC-03 |
| panel_list_tabs | 否 | readonly | UC-04 |
| panel_create_tab | 是 | readwrite | UC-05 |
| panel_update_tab | 是 | readwrite | UC-05 |
| panel_delete_tab | 是(级联) | readwrite + confirm | UC-06 |
| panel_reorder_tabs | 是 | readwrite | UC-07 |
| panel_list_groups | 否 | readonly | UC-08 |
| panel_create_group | 是 | readwrite | UC-08 |
| panel_update_group | 是 | readwrite | UC-08 |
| panel_delete_groups | 是(级联) | readwrite + confirm | UC-08 |
| panel_search_bookmarks | 否 | readonly | UC-09 |
| panel_get_bookmark | 否 | readonly | UC-09 |
| panel_create_bookmark | 是 | readwrite | UC-10 |
| panel_batch_create_bookmarks | 是 | readwrite | UC-10 |
| panel_update_bookmark | 是 | readwrite | UC-11 |
| panel_delete_bookmarks | 是 | readwrite + confirm | UC-12 |
| panel_list_widgets | 否 | readonly | UC-13 |
| panel_get_widget_status | 否 | readonly | UC-14 |
| panel_health_check | 否 | readonly | UC-15 |

### 7.2 数据对象定义

- **A-1 mcp_token**:见 UC-01 数据表(唯一新增)。
- **A-2 view_tab / item_icon_group / item_icon**:沿用现有 schema,零改动。
- 脱敏口径见 §3.10。

### 7.3 术语表

| 术语 | 解释 |
|------|------|
| MCP | Model Context Protocol,Agent 与工具服务间的标准协议 |
| Streamable HTTP | MCP 传输方式:单端点 POST(JSON-RPC),可选 SSE 流 |
| scope | Token 权限范围:readonly(只读)/ readwrite(读写) |
| 级联删除 | 删除父资源时在同一事务内删除其全部子资源 |
| 巡检 | 对全部监控书签执行一次实时状态拉取并汇总 |

### 7.4 错误码约定(MCP error code)

| code | 语义 | 触发示例 |
|------|------|---------|
| UNAUTHORIZED | Token 无效/吊销/用户停用 | UC-02 |
| PERMISSION_DENIED | scope 不足或 confirm 缺失 | UC-02/BR-03/BR-04 |
| INVALID_ARGUMENT | 参数校验失败(名称超长、strategy 非法等) | UC-04/05 |
| NOT_FOUND | 资源不存在或不属于当前用户 | UC-06/08/09 |
| INTERNAL_ERROR | 未预期异常 | 兜底 |

---

## 8. 易用性设计原则(Agent 易用性 + 小白用户)

### 8.1 面板用户侧(小白语言规范)

| 禁止出现(面向用户) | 替换为 |
|---------------------|--------|
| MCP / Model Context Protocol | "AI 助手接入"(区块标题用「MCP 接入」+ 副标题解释) |
| Bearer Token / 凭证哈希 | "访问令牌(仅显示一次,请立即复制)" |
| scope=readonly/readwrite | "只读(仅查看)/ 读写(可修改)" |
| 401/吊销 | "令牌已失效,请重新生成" |

### 8.2 Agent 侧(无 UI,语义即体验)

- 每个 tool description 遵循「一句话用途 + 何时该用 + 危险性提示」三段式;级联删除必须写明后果(BR-19)。
- 错误 message 必须可指导 Agent 下一步(如重复 URL 错误返回已存在书签的 id)。
- 工具命名统一 `panel_` 前缀,动宾结构,避免与宿主其他 MCP 工具冲突。

### 8.3 用户可见配置 ≤ 4 项

生成 Token 时用户只面对:**名称、权限(只读/读写)** 两项决策,其余(前缀、哈希、限额)全部系统内化。

### 8.4 一致性检查表

| 项 | 基准 |
|----|------|
| 名称/长度/查重/保留规则 | 以现有 Server Action 为单一真相(C4),MCP 不另立规则 |
| Widget 状态文案与超时 | 以现有 `/api/widgets/stats` 为单一真相 |
| 删除级联顺序 | 以 `deleteTabAction` / `deleteGroupsAction` 事务为单一真相 |
| 脱敏边界 | 以 §3.10 表为唯一口径,后续新增字段默认"不输出",需显式评审加入 |

---

## 附:四维自审摘要(生成侧自查,供评审快速对照)

- **可行性**:唯一高危项为 S1(SDK × Next standalone);已给出三方案推演与 Spike 前置。C4(service 层抽取)是最大重构成本,建议排期时先做 S3。
- **并发**:核心竞态 6 项已列(§4.5),均落在既有 WAL/事务机制之上,无新引入中间件。
- **模糊控制**:BR 编号全局唯一(BR-01~BR-25),"至少保留一个 Tab""查重仅普通书签"等规则显式引用现有代码行为,消除二次解释空间。
- **易用性**:小白用户仅需"生成令牌→复制→粘贴到 AI 助手"三步;Agent 侧工具自解释 + 结构化错误自纠。
