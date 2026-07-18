# QHSE 后端开发路线

更新时间：2026-07-18

## 技术方案

后端采用高阶设计中约定的 NestJS + Prisma + PostgreSQL 模块化单体。每个能力域保持固定的 `controller / dto / service / repository / test` 结构，按纵向切片独立交付；达到独立扩缩容条件后再拆服务。

统一约定：

- API 前缀为 `/api/v1`，Swagger 地址为 `/api/docs`。
- 响应统一携带 `success`、`requestId`、`traceId` 和 `timestamp`，异常使用稳定业务错误码。
- 业务规则位于 `service`，数据访问通过 `repository` 接口隔离。
- 默认内存仓储保证项目开箱即启；设置 `QHSE_REPOSITORY=prisma` 后切换 PostgreSQL。
- 写操作支持 `expectedVersion` 乐观锁，防止多人同时操作产生静默覆盖。
- 驾驶舱聚合接口只作为读模型，领域写接口不再扩展巨型 `DashboardData`。

## 开发顺序

| 阶段 | 建设内容 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| 0 | NestJS 骨架、健康检查、统一错误/响应、请求追踪、Swagger、开发代理 | 后端可独立启动，API 构建和健康检查通过 | 已完成 |
| 1 | 风险分级首切片、Prisma 模型、种子和乐观锁 | 风险查询、LEC 评估、措施维护和并发冲突测试通过 | 已完成 |
| 2 | 组织、用户、角色、数据权限与审计拦截器 | 所有真实写接口有身份、权限和审计上下文 | 基础闭环已完成：查询、双仓储、账号启停、角色/区域授权和实时会话生效可用 |
| 3A | 隐患治理 | 上报、整改、证据、验收、督办、权限与审计闭环 | 已完成 |
| 3B | 作业许可 | 票证申请、分权审批、现场确认、暂停恢复和关闭持久化 | 已完成 |
| 4A | 通用审批流内核 | 有序节点、角色会签、驳回撤回、流程防重和并发控制 | 已完成 |
| 4B | 预警规则配置与发布 | 规则草稿、冲突检测、会签、灰度、版本和回滚由服务端管理 | 已完成 |
| 4C | 预警规则实时执行 | 采样窗口、表达式计算、去重抑制和告警事件生成 | 已完成 |
| 5A | 应急事件生命周期 | 告警转事件、响应调整、证据、关闭审批和审计闭环 | 已完成 |
| 5B1 | 应急预案与演练 | 预案发布、版本回滚、到期和演练复盘服务端闭环 | 已完成 |
| 5B2 | 应急资源 | 库存、批次、FEFO 调拨、归还和巡检维护服务端闭环 | 已完成 |
| 5C | 融合通信 | 多渠道发送、回执、重试、升级和审计 | 已完成 |
| 6 | GDS/VOC/MES、WebSocket/MQTT、对象存储 | 真实数据稳定接入，附件与证据可固化 | 已完成 |
| 7 | 报表、缓存、消息队列、部署、安全与性能 | 完成生产容量、安全和恢复验证 | 进行中：平台能力、追踪、容量、备份校验和核心前端 API 闭环已完成，待生产压测与恢复演练 |

应急资源基础闭环已经后端化；仓库/库位、完整库存流水、扫码盘点、维修工单和跨库调拨作为后续生产化增强项建设。

## 当前 API

- `GET /api/health`：服务健康状态。
- `GET /api/health/live`：不依赖外部系统的容器存活探针。
- `GET /api/health/ready`：主动检查数据库、缓存、会话和任务队列的容器就绪探针。
- `POST /api/v1/auth/login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`：会话认证。
- `PUT /api/v1/auth/password`：校验当前密码并修改本人密码，成功后撤销全部旧会话。
- `PUT /api/v1/auth/users/:id/password-reset`：管理员重置临时密码并要求目标用户下次登录改密。
- `GET /api/qhse/dashboard`：按账号数据范围聚合风险、遥测、预警、应急资源与通信数据，供驾驶舱和展示大屏使用。
- `GET /api/v1/iam/organizations|roles|users`：组织、角色与用户授权查询。
- `POST /api/v1/iam/roles`、`PUT /api/v1/iam/roles/:id`：创建自定义角色并维护权限矩阵和数据范围。
- `POST /api/v1/iam/users`：使用独立加盐初始密码创建用户并分配组织、角色和区域。
- `PUT /api/v1/iam/users/:id/authorization`：按版本更新用户状态、所属组织、角色和区域数据权限。
- `GET /api/v1/audit-logs`：操作、登录与安全拒绝审计查询。
- `GET /api/v1/risks`：风险列表，支持 `areaId`、`level`、`keyword`。
- `GET /api/v1/risks/:id`：风险详情。
- `POST /api/v1/risks/:id/assessments`：提交 LEC 评估。
- `PUT /api/v1/risks/:id/controls`：更新管控措施。
- `GET /api/v1/hazards`、`GET /api/v1/hazards/:id`：按角色区域范围查询隐患。
- `POST /api/v1/hazards`：上报隐患，区域和操作人由服务端生成。
- `POST /api/v1/hazards/:id/evidence`：绑定已上传对象并归档整改证据。
- `POST /api/v1/hazards/:id/rectification/start`：开始整改。
- `POST /api/v1/hazards/:id/acceptance/submit|close`：提交验收、验收关闭。
- `PUT /api/v1/hazards/:id/supervision`：显式设置挂牌督办状态。
- `GET /api/v1/work-permits`、`GET /api/v1/work-permits/:id`：按区域范围查询作业票。
- `POST /api/v1/work-permits`：申请五类作业票，申请人和区域名称由服务端生成。
- `POST /api/v1/work-permits/:id/approvals/next`：按属地、QHSE、负责人顺序分权签署。
- `POST /api/v1/work-permits/:id/site-confirmations`：作业负责人与现场监护人双人确认。
- `POST /api/v1/work-permits/:id/pause-recommendation|pause|resume|close`：暂停建议、确认暂停、复测恢复和关闭。
- `GET /api/v1/warning-rules`、`GET /api/v1/warning-rules/:id`：查询规则、草稿、会签和版本。
- `POST /api/v1/warning-rules`、`PUT /api/v1/warning-rules/:id/draft`：创建或维护独立草稿。
- `POST /api/v1/warning-rules/:id/submit|approve|reject`：提交双人会签、审批或驳回。
- `POST /api/v1/warning-rules/:id/rollback`：将历史版本恢复为新草稿。
- `PUT /api/v1/warning-rules/:id/enabled`：显式设置已发布规则的启停状态。
- `POST /api/v1/warning-execution/samples`：提交 GDS/VOC/MES/联合预警标准样本并执行生效规则。
- `GET /api/v1/warning-execution/signals`：查询规则执行生成的有效预警信号。
- `GET /api/v1/warning-execution/signals/:id`：按账号区域范围查询预警信号详情。
- `POST /api/v1/warning-execution/signals/:id/acknowledge|handling|close`：确认、开始处置和填写结论关闭预警信号。
- `POST /api/v1/warning-execution/signals/:id/evidence`：核验监测、工艺、票证或关联人员证据并记录可信操作人。
- `POST /api/v1/warning-execution/signals/:id/emergency`：从已确认预警幂等生成待研判应急事件并进入处置状态。
- `GET /api/v1/emergency-events`、`GET /api/v1/emergency-events/:id`：按区域权限查询应急事件。
- `POST /api/v1/emergency-events`：将预警或告警转为待研判应急事件，禁止同源重复转化。
- `POST /api/v1/emergency-events/:id/actions|evidence`：执行响应状态迁移或归档可信证据。
- `POST /api/v1/emergency-events/:id/closure-request|closure-reminder|closure-approval`：关闭申请、催办和异人审批。
- `GET /api/v1/event-reviews`、`GET /api/v1/event-reviews/:id`：按区域数据范围查询事件调查复盘。
- `GET /api/v1/event-reviews/:id/report`：导出服务端生成的可打印事件调查复盘报告。
- `GET /api/v1/knowledge/search`：跨已归档复盘、已关闭隐患和已发布预案检索企业正式知识。
- `PUT /api/v1/event-reviews/:id/analysis`：维护事件摘要、直接原因、根本原因和经验教训。
- `POST /api/v1/event-reviews/:id/evidence`：绑定统一对象存储附件并归档调查证据。
- `POST /api/v1/event-reviews/:id/actions`、`PUT /api/v1/event-reviews/:id/actions/:actionId`：新增或调整未完成整改措施。
- `POST /api/v1/event-reviews/:id/actions/:actionId/hazard`：把整改措施幂等转为同区域隐患治理任务。
- `POST /api/v1/event-reviews/:id/actions/hazards/sync`：把关联隐患状态同步回复盘整改措施。
- `POST /api/v1/event-reviews/:id/actions/advance|close`：推进整改措施或在全部完成后关闭归档复盘。
- `GET /api/v1/emergency-plans`、`GET /api/v1/emergency-plans/:id`：查询预案、运行版本、草稿、评审和演练。
- `POST /api/v1/emergency-plans`、`PUT /api/v1/emergency-plans/:id/draft`：创建或维护独立预案草稿。
- `POST /api/v1/emergency-plans/:id/submit|approve|rollback`：双人会签发布或将历史版本恢复为草稿。
- `POST /api/v1/emergency-plans/:id/drills...`：创建、启动和归档演练复盘。
- `GET /api/v1/emergency-resources`、`GET /api/v1/emergency-resources/:id`：查询应急资源、批次、调拨和巡检记录。
- `POST /api/v1/emergency-resources`、`POST /api/v1/emergency-resources/:id/batches`：资源入库和批次补充。
- `POST /api/v1/emergency-resources/:id/dispatches`：按有效期 FEFO 分配可用批次并占用库存。
- `POST /api/v1/emergency-resources/:id/dispatches/:dispatchId/arrival|return`：确认到位或归还并恢复批次库存。
- `POST /api/v1/emergency-resources/:id/inspections`：登记巡检结果和下次检查日期。
- `GET /api/v1/communications`、`GET /api/v1/communications/:eventId`：查询通信事件、发送任务、回执和升级状态。
- `POST /api/v1/communications/:eventId/escalate`：按重呼、班长、负责人/调度链逐级发送通知。
- `POST /api/v1/communications/:eventId/tasks/:taskId/receipt|confirm`：登记送达/失败回执或可信人员确认。
- `GET /api/v1/telemetry/points`、`GET /api/v1/telemetry/points/:id/samples`：按数据源、区域和状态查询点位与历史样本。
- `POST /api/v1/telemetry/samples`：幂等写入 GDS/VOC/MES 标准样本，更新点位状态并执行预警规则。
- `GET /api/v1/telemetry/integrations`：查询 MQTT 连接状态、接收/拒绝计数及 WebSocket 补传序号。
- WebSocket `/telemetry`：按会话权限、区域和数据源订阅实时样本，支持 `afterSequence` 断线补传。
- `POST /api/v1/attachments`：按区域权限上传附件，校验类型/大小并生成 SHA-256。
- `GET /api/v1/attachments/:id`、`GET /api/v1/attachments/:id/content`：按区域权限查询元数据或下载原始内容。
- `GET /api/v1/reports/summary`：按日期和区域聚合隐患、预警、作业许可、应急事件 KPI 与趋势。
- `GET /api/v1/reports/summary/export`：按相同口径导出带 UTF-8 BOM 的区域明细 CSV。
- `POST /api/v1/reports/exports`：创建受数据权限约束的后台报表导出任务。
- `GET /api/v1/reports/exports/:id`、`GET /api/v1/reports/exports/:id/content`：按创建人查询任务或下载已完成文件。
- `GET|POST /api/v1/platform-config/dictionaries`、`PUT /api/v1/platform-config/dictionaries/:id`：查询、创建和版本化维护业务字典。
- `GET|POST /api/v1/platform-config/integrations`、`PUT /api/v1/platform-config/integrations/:id`：维护不含凭据的外部系统登记。
- `GET /api/v1/system/diagnostics`：查询服务进程、存储模式、内存、集成状态和低基数请求指标。

除健康检查、登录和 Swagger 外，接口默认需要 Bearer Token。演示账号包括 `admin`、`leader`、`qhse`、`dispatcher`、`unit_manager`、`operator`、`environment` 和 `commander`，本地演示密码统一为 `ant.design`。会话默认保存在进程内存中保证本地开箱即启，生产可切换 Redis；正式身份源和账号密码仍需接入统一身份认证。

登录接口按客户端 IP 与账号组合执行 15 分钟失败窗口，第 5 次失败后暂时阻断继续尝试；单账号最多保留 5 个活动会话。所有 API 响应设置内容嗅探、嵌入、引用来源和浏览器能力限制响应头，HTTPS 请求额外启用 HSTS。生产环境默认不开放 Swagger，只有显式设置 `QHSE_SWAGGER_ENABLED=true` 时启用。

风险接口已经执行权限点和区域数据范围校验。企业领导只读，QHSE 管理人员拥有全厂风险维护权限，装置负责人只能访问分配区域；越权读取或更新统一返回 404，权限不足返回 403。评估人由认证主体生成，不接受客户端指定。

隐患接口采用同一数据范围策略，并增加 `hazard:read/report/rectify/accept/supervise` 权限点。状态机拒绝非法流转，提交验收必须存在证据，写操作使用 `expectedVersion` 防止并发覆盖；证据上传人、业务操作人和风险单元所属区域均取服务端可信数据。

作业许可接口增加 `permit:read/apply/approve/confirm/control` 权限点。三级审批节点分别校验属地、QHSE 和企业负责人角色；现场双人确认禁止同一账号代签。规则执行引擎在较大/重大预警生成时自动写入同区域票证暂停建议；API 模式页面聚合真实 GDS 点位、规则和信号，并在遥测模拟后同步票证状态。

通用审批流作为内部业务能力提供，不暴露绕过领域权限的万能审批接口。业务服务可按 `businessType + businessId` 创建有序会签实例，节点执行角色匹配、活动流程防重、驳回/撤回和 `expectedVersion` 并发控制；预警规则和后续应急预案将复用该能力。

预警规则配置已接入通用审批流。草稿与当前运行版本隔离，提交时由服务端检测启用规则的作用域/表达式冲突；QHSE 与生产负责人必须使用不同账号会签，发布后生成不可变版本快照。历史回滚只生成草稿，不会直接覆盖运行配置。

规则执行器接受统一样本模型，按已发布且启用的版本执行 AND/OR 表达式、持续时长、联合数据时间窗口和确定性灰度分群；同规则同对象 5 分钟内抑制重复信号，触发统计不修改配置修订号。遥测服务把设备原始字段转换为来源限定的规则指标，表达式阈值可引用同一样本中的设备限值；较大/重大信号命中时，由启用的作业许可联动规则自动生成暂停建议。

应急事件已形成独立领域切片。预警详情可直接幂等生成应急事件，联动入口同时校验预警处置与应急管理权限，并以预警 ID 防止重复转化；研判启动、响应升级/降级、终止监控、证据归档和关闭均由服务端状态机控制。关闭申请创建 4 小时 QHSE 审批流程，申请人与审批人必须异人，审批意见和电子签名随事件归档。事件写操作执行区域数据范围、权限、审计和乐观锁。

应急预案草稿与当前生效版本隔离，QHSE 与生产负责人按通用审批流异人会签，末节点通过后生成不可变版本；历史回滚只生成草稿。演练计划、启动和复盘评分使用同一预案修订号控制并发，前端 API 模式已直接接入该领域切片。

应急资源已形成独立领域切片。调拨按有效批次 FEFO 分配并排除过期库存，维护中资源禁止调拨；到位和归还由服务端状态机控制，归还同步恢复批次及汇总库存。巡检人、调拨操作人取认证主体，写操作执行权限、审计和乐观锁，前端 API 模式不再依赖驾驶舱缓存。

融合通信已形成通信事件聚合。服务端维护 0/2/3/5 分钟升级链，多渠道发送任务记录送达、失败、重试和确认状态；失败回执最多自动重试 2 次，任一任务确认后阻断继续升级。确认人取认证主体，升级、回执和确认均执行权限、审计与乐观锁；真实电话、短信、App 和广播网关适配器安排在阶段 6。

统一遥测接入层已支持 GDS/VOC/MES 点位、当前指标和历史样本。样本以外部 `sampleId` 幂等落库，质量码驱动在线/故障状态，主指标按点位阈值派生业务状态；有效样本自动进入预警规则执行器。乱序样本保留历史但不覆盖当前值或重复触发规则，超出允许未来偏差的样本被拒绝。MQTT QoS 1 适配器通过标准主题接入受信样本；WebSocket 按认证主体和区域范围广播，并使用有界序号缓冲完成断线补传。三个监测页面已实时订阅点位更新。

附件服务以统一对象元数据隔离业务表和二进制内容。上传时执行 MIME 白名单、大小限制、区域权限和 SHA-256 计算；对象只能绑定一条业务记录，同一绑定保持幂等。开发环境默认使用本地文件适配器，生产可切换 S3 兼容存储。隐患整改与应急事件证据已接入真实上传、业务绑定和鉴权下载。

统计报表中心复用隐患、预警、作业许可和应急事件领域服务计算指标，不复制业务数据。日期范围最多 366 天且不能晚于当前日期，所有明细和趋势在报表层再次执行区域数据范围裁剪；单次预警聚合超过 10000 条时拒绝生成不完整结果并要求缩小范围。前端支持日期/区域筛选、近 30 天趋势、风险指数排序和 CSV 导出。风险指数仅用于报表排序，不替代风险分级结果。

平台基础配置包含业务数据字典和非敏感集成登记。配置编码创建后不可修改，更新使用版本号防止并发覆盖，所有写操作执行权限和审计。集成地址必须与声明协议一致，并拒绝 URL 内嵌用户名或密码；Token、证书和密钥不进入配置表，仍由部署环境或密钥管理系统注入。

IAM 管理接口只允许 `iam:manage` 账号创建用户、重置密码、创建/更新自定义角色或更新已有用户的状态、所属组织、角色和区域授权。新用户账号执行唯一性校验，初始密码使用每用户随机盐的 scrypt 摘要，列表和接口不返回密码摘要；认证仍兼容升级前的固定盐摘要。新账号和被重置密码的账号登录后只能查询本人、修改密码或退出登录，访问其他业务接口稳定返回 `PASSWORD_CHANGE_REQUIRED`；改密成功后需要使用新密码重新登录。会话保存密码摘要的 SHA-256 凭据版本指纹，密码变化后旧令牌即使尚未从会话存储物理清理也无法通过认证。内置角色保持只读，自定义角色编码创建后不可修改，可维护名称、权限点和全企业/授权区域数据范围；权限调整立即作用于现有会话，已分配用户时禁止切换数据范围类型，避免产生无区域授权账号。授权更新使用版本号阻止并发覆盖，并禁止管理员停用自身或移除自身管理员角色。区域角色必须分配至少一个有效区域，全局角色自动清空冗余区域。仓储支持默认进程内模式和 `QHSE_REPOSITORY=prisma` PostgreSQL 模式；Prisma 启动时加载组织、区域、角色和用户关系，用户、密码、角色和授权关系写入持久化存储。统一身份源、权限变更审批和多实例授权变更广播安排在后续阶段。

运行诊断使用进程内轻量指标聚合请求次数、错误率和延迟，动态资源路径按控制器路由模板归并，避免资源 ID 导致指标基数失控。诊断接口需要 `monitor:read` 权限，只返回服务模式、内存、集成健康元数据和请求统计，不返回集成地址或凭据；前端诊断页每 15 秒自动刷新。该能力用于单实例开发和首轮运维排障，生产多实例指标仍需接入集中式监控系统。

缓存基础设施默认使用进程内适配器保证开箱即启，生产可切换 Redis。统计报表摘要按查询参数和授权区域分别缓存 30 秒，CSV 导出仍实时计算；同一键并发未命中只执行一次聚合，防止缓存击穿。风险写入后按命名空间失效所有授权范围的驾驶舱快照，并等待同命名空间在途加载结束后再删除，避免旧快照回写。Redis 故障时缓存进入 30 秒降级窗口并直接回源，不阻断业务请求；命中、未命中、写入、失效和失败计数可在运行诊断页查看。

异步报表导出默认使用进程内队列，生产可切换 BullMQ/Redis。任务固化创建人、查询条件和授权区域快照，只有创建人能够查询和下载；Worker 并发数为 2，失败按指数退避最多重试 3 次，结果保留 24 小时且限制数量。Redis 生产者禁用离线命令排队，队列不可用时快速返回稳定 503，避免 HTTP 请求无限等待。

访问日志以单行 JSON 输出到标准输出，包含时间、级别、稳定事件名、请求 ID、HTTP 方法、路由模板、状态、耗时和已认证用户 ID，供容器或日志采集器直接接入。日志不记录请求体、查询参数、Authorization、Cookie 或异常消息；未处理异常只记录异常类型，客户端继续收到通用 500 响应。动态资源 ID 使用路由模板归并，与运行指标保持同一口径。

会话存储支持进程内和 Redis 双模式。Redis 模式使用带 TTL 的会话键和用户会话有序集合，同一账号最多保留最新 5 个活动会话；HTTP Guard、登录/退出和遥测 WebSocket 握手均使用异步会话存储，不存在只对 HTTP 生效的分裂认证链。会话后端不可用时登录或鉴权快速返回稳定 503，禁止静默降级到本地会话，以免多实例产生不一致身份状态。

容器健康检查拆分为存活和就绪两个端点。存活探针只证明 Node 进程可响应；就绪探针并行主动检查当前启用的 PostgreSQL、缓存、会话和任务队列，每项返回后端类型、状态和耗时。任一生产依赖失败或超过默认 1500 ms 时返回 `503/SERVICE_NOT_READY`，但存活探针继续返回 200，便于编排平台停止接流而不是盲目重启进程。

HTTP 请求上下文遵循 W3C Trace Context。有效上游 `traceparent` 会继承 `traceId`、父 span、`tracestate` 和采样标记，同时为当前 API 请求创建新的服务端 span；非法、全零或不支持版本的头会被替换。span 在响应完成或连接关闭时结束，路由模板和状态码使用 OpenTelemetry HTTP 语义属性，5xx 标记错误。标准成功/异常响应携带 `traceId`，响应头返回当前服务端 `traceparent`，访问日志记录 trace/span 关联字段。

未配置 Collector 时仍创建并传播真实 span，但不执行网络导出，保证本地零外部依赖启动。配置标准 OTLP/HTTP 端点后使用批处理器导出到 Collector，应用关闭时刷新队列；导出端点不进入诊断响应，就绪探针也不依赖可观测性后端，避免监控系统故障阻断业务接流。诊断页只显示导出模式、已开始/结束 span 数和最近结束时间。

## 本地启动

无需数据库即可启动内存仓储模式：

```bash
npm run server:dev
npm run dev
```

`npm run dev` 使用 API 数据模式；仅演示前端 Mock 数据时使用 `npm start`。

前端开发服务器会将 `/api` 代理到 `http://127.0.0.1:3001`，可用 `QHSE_API_URL` 覆盖目标地址。

PostgreSQL 模式需要在进程环境中提供 `DATABASE_URL`，然后执行：

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
QHSE_REPOSITORY=prisma npm run server:dev
```

可选 MQTT 接入不需要修改代码，运行时提供以下环境变量：

```bash
QHSE_MQTT_URL=mqtts://broker.example.com:8883 \
QHSE_MQTT_TOPIC='qhse/telemetry/+/+' \
QHSE_MQTT_CLIENT_ID=qhse-production-api \
QHSE_MQTT_USERNAME=qhse npm run server:dev
```

密码通过进程环境的 `QHSE_MQTT_PASSWORD` 提供。未配置 `QHSE_MQTT_URL` 时适配器保持禁用，不影响 HTTP/WebSocket 和本地开发启动。未来时钟允许偏差默认 60 秒，可用 `QHSE_TELEMETRY_MAX_FUTURE_SKEW_MS` 调整；单实例补传缓冲默认 1000 条，可用 `QHSE_TELEMETRY_REPLAY_SIZE` 调整。

附件默认写入仓库外忽略目录 `.qhse-data/objects`，可用 `QHSE_UPLOAD_DIR` 指定路径，`QHSE_ATTACHMENT_MAX_SIZE` 调整默认 20 MB 限制。生产 S3 兼容存储通过以下进程环境切换：

```bash
QHSE_OBJECT_STORAGE=s3 \
QHSE_S3_BUCKET=qhse-evidence \
QHSE_S3_REGION=cn-north-1 \
QHSE_S3_ENDPOINT=https://s3.example.com npm run server:dev
```

访问凭据使用 AWS SDK 标准凭据链提供；兼容 MinIO 等服务时可设置 `QHSE_S3_FORCE_PATH_STYLE=true`。

生产 Redis 缓存通过进程环境启用：

```bash
QHSE_CACHE=redis \
QHSE_REDIS_URL=redis://cache.example.com:6379 npm run server:dev
```

Redis 密码应包含在部署平台注入的连接地址中，不写入仓库。未设置 `QHSE_CACHE=redis` 时默认使用单实例内存缓存。

生产异步任务队列复用 Redis 或使用独立实例：

```bash
QHSE_QUEUE=redis \
QHSE_QUEUE_REDIS_URL=rediss://queue.example.com:6379 npm run server:dev
```

未设置 `QHSE_QUEUE=redis` 时使用进程内任务队列；该模式仅用于本地开发，服务重启后未下载任务不会保留。

访问日志默认启用，可在只需要最小控制台输出的本地场景设置 `QHSE_ACCESS_LOG=false` 关闭。生产环境应保持启用，并由容器平台或日志代理采集标准输出。

生产分布式会话可复用 Redis 或使用独立实例：

```bash
QHSE_SESSION_STORE=redis \
QHSE_SESSION_REDIS_URL=rediss://session.example.com:6379 npm run server:dev
```

未设置 `QHSE_SESSION_STORE=redis` 时使用进程内会话。当前 Redis Lua 会话上限逻辑面向单实例或 Sentinel 部署；Redis Cluster 哈希槽方案需在生产拓扑确定后单独验证。

就绪探针单依赖超时默认 1500 ms，可通过 `QHSE_READINESS_TIMEOUT_MS` 在 100–10000 ms 范围调整。容器编排应将 `/api/health/live` 配置为 livenessProbe，将 `/api/health/ready` 配置为 readinessProbe。

生产链路追踪使用 OpenTelemetry 标准环境变量启用 OTLP/HTTP 导出：

```bash
OTEL_SERVICE_NAME=qhse-api \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4318/v1/traces \
npm run server:start
```

采样、批量延迟、导出超时和认证 Header 使用 OpenTelemetry SDK 标准环境变量管理。端点只允许不内嵌账号密码的 HTTP(S) URL；认证信息应通过 `OTEL_EXPORTER_OTLP_HEADERS` 由部署平台注入，不写入仓库。

后端容量基线工具默认请求本地 liveness，输出吞吐、成功/错误数、网络错误、HTTP 状态分布和 P50/P95/P99/最大延迟，并按 P95 和错误率阈值设置进程退出码：

```bash
QHSE_CAPACITY_URL=http://127.0.0.1:3001/api/health/live \
QHSE_CAPACITY_REQUESTS=2000 \
QHSE_CAPACITY_CONCURRENCY=50 \
QHSE_CAPACITY_MAX_P95_MS=100 \
QHSE_CAPACITY_MAX_ERROR_RATE=0 \
npm run server:capacity
```

单请求超时使用 `QHSE_CAPACITY_TIMEOUT_MS` 调整。测试受保护接口时可由临时运行环境提供 `QHSE_CAPACITY_BEARER_TOKEN`，工具不会输出 Token；目标 URL 禁止内嵌凭据，报告会移除查询参数。开发机结果只能作为回归基线，生产容量结论必须在目标容器规格、真实 PostgreSQL/Redis/Collector 和代表性业务数据下重新执行。

PostgreSQL 自包含备份使用本机或运维容器内的 `pg_dump` 创建 custom archive，随后调用 `pg_restore --list` 校验归档结构并生成 SHA-256 清单：

```bash
QHSE_REPOSITORY=prisma \
DATABASE_URL=postgresql://user:password@db.example.com:5432/qhse \
QHSE_BACKUP_DIR=/secure-backups/qhse \
npm run server:backup
```

数据库连接会被拆分为 libpq 子进程环境变量，密码不会进入命令行参数、标准输出或清单。备份文件和清单使用 0600 权限；工具不自动删除旧备份，保留策略由外部备份平台执行。离线复核已生成归档：

```bash
QHSE_BACKUP_FILE=/secure-backups/qhse/qhse-20260715T083000000Z-1234abcd.dump \
npm run server:backup:verify
```

复核同时检查清单格式、文件名、长度、SHA-256 和 PostgreSQL 归档目录。该命令不连接目标数据库，也不等同于恢复演练；正式上线前仍必须在隔离数据库执行恢复、业务一致性检查和 RPO/RTO 计时。创建过程失败时可能保留没有清单的未完成归档，运维平台应将“有效清单存在且复核通过”作为可恢复备份的判据。
