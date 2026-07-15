# QHSE 后端开发路线

更新时间：2026-07-15

## 技术方案

后端采用高阶设计中约定的 NestJS + Prisma + PostgreSQL 模块化单体。每个能力域保持固定的 `controller / dto / service / repository / test` 结构，按纵向切片独立交付；达到独立扩缩容条件后再拆服务。

统一约定：

- API 前缀为 `/api/v1`，Swagger 地址为 `/api/docs`。
- 响应统一携带 `success`、`requestId` 和 `timestamp`，异常使用稳定业务错误码。
- 业务规则位于 `service`，数据访问通过 `repository` 接口隔离。
- 默认内存仓储保证项目开箱即启；设置 `QHSE_REPOSITORY=prisma` 后切换 PostgreSQL。
- 写操作支持 `expectedVersion` 乐观锁，防止多人同时操作产生静默覆盖。
- 驾驶舱聚合接口只作为读模型，领域写接口不再扩展巨型 `DashboardData`。

## 开发顺序

| 阶段 | 建设内容 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| 0 | NestJS 骨架、健康检查、统一错误/响应、请求追踪、Swagger、开发代理 | 后端可独立启动，API 构建和健康检查通过 | 已完成 |
| 1 | 风险分级首切片、Prisma 模型、种子和乐观锁 | 风险查询、LEC 评估、措施维护和并发冲突测试通过 | 已完成 |
| 2 | 组织、用户、角色、数据权限与审计拦截器 | 所有真实写接口有身份、权限和审计上下文 | 基线已完成 |
| 3A | 隐患治理 | 上报、整改、证据、验收、督办、权限与审计闭环 | 已完成 |
| 3B | 作业许可 | 票证申请、分权审批、现场确认、暂停恢复和关闭持久化 | 已完成 |
| 4A | 通用审批流内核 | 有序节点、角色会签、驳回撤回、流程防重和并发控制 | 已完成 |
| 4B | 预警规则配置与发布 | 规则草稿、冲突检测、会签、灰度、版本和回滚由服务端管理 | 已完成 |
| 4C | 预警规则实时执行 | 采样窗口、表达式计算、去重抑制和告警事件生成 | 已完成 |
| 5A | 应急事件生命周期 | 告警转事件、响应调整、证据、关闭审批和审计闭环 | 已完成 |
| 5B | 应急预案与资源 | 预案发布、演练、库存、调拨和维护服务端闭环 | 待开发 |
| 5C | 融合通信 | 多渠道发送、回执、重试、升级和审计 | 待开发 |
| 6 | GDS/VOC/MES、WebSocket/MQTT、对象存储 | 真实数据稳定接入，附件与证据可固化 | 待开发 |
| 7 | 报表、缓存、消息队列、部署、安全与性能 | 完成生产容量、安全和恢复验证 | 待开发 |

应急资源原型仍缺仓库/库位、库存流水、扫码盘点、维修工单和跨库调拨。该模块依赖数据库事务和审计，因此安排在后端基础能力稳定后建设。

## 当前 API

- `GET /api/health`：服务健康状态。
- `POST /api/v1/auth/login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`：会话认证。
- `GET /api/v1/iam/organizations|roles|users`：组织、角色与用户授权查询。
- `GET /api/v1/audit-logs`：操作、登录与安全拒绝审计查询。
- `GET /api/v1/risks`：风险列表，支持 `areaId`、`level`、`keyword`。
- `GET /api/v1/risks/:id`：风险详情。
- `POST /api/v1/risks/:id/assessments`：提交 LEC 评估。
- `PUT /api/v1/risks/:id/controls`：更新管控措施。
- `GET /api/v1/hazards`、`GET /api/v1/hazards/:id`：按角色区域范围查询隐患。
- `POST /api/v1/hazards`：上报隐患，区域和操作人由服务端生成。
- `POST /api/v1/hazards/:id/evidence`：归档整改证据元数据。
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
- `GET /api/v1/emergency-events`、`GET /api/v1/emergency-events/:id`：按区域权限查询应急事件。
- `POST /api/v1/emergency-events`：将预警或告警转为待研判应急事件，禁止同源重复转化。
- `POST /api/v1/emergency-events/:id/actions|evidence`：执行响应状态迁移或归档可信证据。
- `POST /api/v1/emergency-events/:id/closure-request|closure-reminder|closure-approval`：关闭申请、催办和异人审批。

除健康检查、登录和 Swagger 外，接口默认需要 Bearer Token。演示账号包括 `admin`、`leader`、`qhse`、`dispatcher`、`unit_manager`、`operator`、`environment` 和 `commander`，本地演示密码统一为 `ant.design`。当前会话默认保存在进程内存中，仅用于开发；正式环境需切换统一身份认证或 Redis 会话并独立配置密码。

风险接口已经执行权限点和区域数据范围校验。企业领导只读，QHSE 管理人员拥有全厂风险维护权限，装置负责人只能访问分配区域；越权读取或更新统一返回 404，权限不足返回 403。评估人由认证主体生成，不接受客户端指定。

隐患接口采用同一数据范围策略，并增加 `hazard:read/report/rectify/accept/supervise` 权限点。状态机拒绝非法流转，提交验收必须存在证据，写操作使用 `expectedVersion` 防止并发覆盖；证据上传人、业务操作人和风险单元所属区域均取服务端可信数据。

作业许可接口增加 `permit:read/apply/approve/confirm/control` 权限点。三级审批节点分别校验属地、QHSE 和企业负责人角色；现场双人确认禁止同一账号代签。实时告警自动判定依赖阶段 4 的规则执行引擎，本阶段已提供可审计的暂停建议入口和完整后续状态流转。

通用审批流作为内部业务能力提供，不暴露绕过领域权限的万能审批接口。业务服务可按 `businessType + businessId` 创建有序会签实例，节点执行角色匹配、活动流程防重、驳回/撤回和 `expectedVersion` 并发控制；预警规则和后续应急预案将复用该能力。

预警规则配置已接入通用审批流。草稿与当前运行版本隔离，提交时由服务端检测启用规则的作用域/表达式冲突；QHSE 与生产负责人必须使用不同账号会签，发布后生成不可变版本快照。历史回滚只生成草稿，不会直接覆盖运行配置。

规则执行器接受统一样本模型，按已发布且启用的版本执行 AND/OR 表达式、持续时长、联合数据时间窗口和确定性灰度分群；同规则同对象 5 分钟内抑制重复信号，触发统计不修改配置修订号。较大/重大信号命中时，可由启用的作业许可联动规则自动生成暂停建议。真实 MQTT/WebSocket 数据消费安排在阶段 6。

应急事件已形成独立领域切片。告警转事件、研判启动、响应升级/降级、终止监控、证据归档和关闭均由服务端状态机控制；关闭申请创建 4 小时 QHSE 审批流程，申请人与审批人必须异人，审批意见和电子签名随事件归档。事件写操作执行区域数据范围、权限、审计和乐观锁。

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
