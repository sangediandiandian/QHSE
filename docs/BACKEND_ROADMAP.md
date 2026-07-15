# QHSE 后端开发路线

更新时间：2026-07-14

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
| 3 | 隐患治理、作业许可 | 两域持久化，并与风险域形成主业务联动 | 待开发 |
| 4 | 通用审批流、预警规则执行与发布 | 审批、会签、版本、灰度和回滚由服务端管理 | 待开发 |
| 5 | 应急事件、预案、资源、通信 | 告警到事件关闭全链路可审计 | 待开发 |
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

除健康检查、登录和 Swagger 外，接口默认需要 Bearer Token。演示账号包括 `admin`、`leader`、`qhse`、`dispatcher`、`unit_manager`、`operator`、`environment` 和 `commander`，本地演示密码统一为 `ant.design`。当前会话默认保存在进程内存中，仅用于开发；正式环境需切换统一身份认证或 Redis 会话并独立配置密码。

风险接口已经执行权限点和区域数据范围校验。企业领导只读，QHSE 管理人员拥有全厂风险维护权限，装置负责人只能访问分配区域；越权读取或更新统一返回 404，权限不足返回 403。评估人由认证主体生成，不接受客户端指定。

## 本地启动

无需数据库即可启动内存仓储模式：

```bash
npm run server:dev
npm run dev
```

前端开发服务器会将 `/api` 代理到 `http://127.0.0.1:3001`，可用 `QHSE_API_URL` 覆盖目标地址。

PostgreSQL 模式需要在进程环境中提供 `DATABASE_URL`，然后执行：

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
QHSE_REPOSITORY=prisma npm run server:dev
```
