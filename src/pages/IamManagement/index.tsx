import type { IamRoleInput, UserAuthorizationInput } from '@/services/qhse/iam';
import {
  createIamRole,
  createIamUser,
  getIamOverview,
  resetIamUserPassword,
  reviewIamAuthorizationRequest,
  submitUserAuthorizationRequest,
  updateIamRole,
} from '@/services/qhse/iam';
import type { IamAuthorizationRequest, IamOrganization, IamRole, IamUser } from '@/types/qhse';
import {
  ApartmentOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import { Alert, Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './index.less';

interface UserForm extends UserAuthorizationInput {
  username?: string;
  name?: string;
  title?: string;
  initialPassword?: string;
  reason?: string;
}

interface RoleForm extends IamRoleInput {
  code?: string;
}

interface ReviewForm {
  decision: 'approve' | 'reject';
  opinion: string;
}

const domainLabels: Record<string, string> = {
  risk: '风险',
  hazard: '隐患',
  permit: '作业许可',
  warning: '预警',
  emergency: '应急事件',
  plan: '应急预案',
  resource: '应急资源',
  communication: '融合通信',
  telemetry: '监测数据',
  attachment: '附件',
  report: '报表',
  config: '平台配置',
  monitor: '运行诊断',
  iam: '权限管理',
  audit: '审计',
};

const actionLabels: Record<string, string> = {
  read: '查看',
  assess: '评估',
  'controls:update': '维护管控措施',
  report: '上报',
  rectify: '整改',
  accept: '验收',
  supervise: '督办',
  apply: '申请',
  approve: '审批',
  confirm: '确认',
  control: '作业控制',
  edit: '编辑',
  submit: '提交',
  toggle: '启停',
  evaluate: '评估',
  handle: '处置',
  close: '关闭',
  manage: '管理',
  evidence: '维护证据',
  drill: '演练',
  dispatch: '调度',
  inspect: '巡检',
  send: '发送',
  ingest: '接入',
  upload: '上传',
  export: '导出',
};

const permissionLabel = (permission: string) => {
  const [domain, ...actionParts] = permission.split(':');
  const action = actionParts.join(':');
  return `${domainLabels[domain] ?? domain} · ${actionLabels[action] ?? action}`;
};

export default function IamManagement() {
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const [organizations, setOrganizations] = useState<IamOrganization[]>([]);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [users, setUsers] = useState<IamUser[]>([]);
  const [authorizationRequests, setAuthorizationRequests] = useState<IamAuthorizationRequest[]>([]);
  const [editing, setEditing] = useState<IamUser>();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<IamUser>();
  const [editingRole, setEditingRole] = useState<IamRole>();
  const [creatingRole, setCreatingRole] = useState(false);
  const [reviewing, setReviewing] = useState<IamAuthorizationRequest>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | IamUser['status']>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<UserForm>();
  const [resetForm] = Form.useForm<{ temporaryPassword: string }>();
  const [roleForm] = Form.useForm<RoleForm>();
  const [reviewForm] = Form.useForm<ReviewForm>();
  const selectedRoleCodes = Form.useWatch('roleCodes', form) ?? [];
  const allScope = roles.some(
    (role) => selectedRoleCodes.includes(role.code) && role.dataScope === 'all',
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIamOverview();
      setOrganizations(data.organizations);
      setRoles(data.roles);
      setUsers(data.users);
      setAuthorizationRequests(data.authorizationRequests);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const areas = useMemo(
    () => organizations.flatMap((organization) => organization.areas),
    [organizations],
  );
  const permissionOptions = useMemo(
    () =>
      [...new Set(roles.flatMap((role) => role.permissions))]
        .sort()
        .map((permission) => ({ value: permission, label: permissionLabel(permission) })),
    [roles],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter(
      (user) =>
        (status === 'all' || user.status === status) &&
        (!keyword ||
          `${user.username}${user.name}${user.title}${user.organization?.name ?? ''}`
            .toLowerCase()
            .includes(keyword)),
    );
  }, [query, status, users]);

  const open = (user: IamUser) => {
    setCreating(false);
    setEditing(user);
    form.setFieldsValue({
      status: user.status,
      organizationId: user.organizationId,
      roleCodes: user.roleCodes,
      areaIds: user.areaIds,
      reason: undefined,
    });
  };

  const openCreate = () => {
    setEditing(undefined);
    setCreating(true);
    form.resetFields();
    form.setFieldsValue({
      status: 'enabled',
      organizationId: organizations[0]?.id,
      roleCodes: [],
      areaIds: [],
    });
  };

  const save = async () => {
    if (!editing && !creating) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (creating) {
        const created = await createIamUser({
          username: values.username!,
          name: values.name!,
          title: values.title!,
          initialPassword: values.initialPassword!,
          organizationId: values.organizationId,
          roleCodes: values.roleCodes,
          areaIds: allScope ? [] : values.areaIds,
        });
        setUsers((current) => [...current, created]);
        message.success('用户已创建，可使用初始密码登录');
      } else if (editing) {
        const request = await submitUserAuthorizationRequest(editing, {
          status: values.status,
          organizationId: values.organizationId,
          roleCodes: values.roleCodes,
          areaIds: allScope ? [] : values.areaIds,
          reason: values.reason!,
        });
        setAuthorizationRequests((current) => [request, ...current]);
        message.success('授权变更已提交，需由另一名管理员审批后生效');
      }
      setCreating(false);
      setEditing(undefined);
    } finally {
      setSaving(false);
    }
  };

  const openReview = (request: IamAuthorizationRequest, decision: ReviewForm['decision']) => {
    setReviewing(request);
    reviewForm.setFieldsValue({ decision, opinion: decision === 'approve' ? '同意' : '' });
  };

  const reviewAuthorization = async () => {
    if (!reviewing) return;
    const values = await reviewForm.validateFields();
    setSaving(true);
    try {
      const reviewed = await reviewIamAuthorizationRequest(
        reviewing.id,
        values.decision,
        values.opinion,
        reviewing.version,
      );
      setAuthorizationRequests((current) =>
        current.map((item) => (item.id === reviewed.id ? reviewed : item)),
      );
      if (reviewed.status === 'approved' && reviewed.targetUser) {
        setUsers((current) =>
          current.map((user) => (user.id === reviewed.targetUser?.id ? reviewed.targetUser : user)),
        );
      }
      setReviewing(undefined);
      reviewForm.resetFields();
      message.success(reviewed.status === 'approved' ? '授权变更已批准并生效' : '授权变更已驳回');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetting) return;
    const values = await resetForm.validateFields();
    setSaving(true);
    try {
      const result = await resetIamUserPassword(resetting.id, values.temporaryPassword);
      setUsers((current) =>
        current.map((user) => (user.id === result.user.id ? result.user : user)),
      );
      setResetting(undefined);
      resetForm.resetFields();
      message.success('临时密码已重置，该用户的现有会话已失效');
    } finally {
      setSaving(false);
    }
  };

  const openRole = (role: IamRole) => {
    setCreatingRole(false);
    setEditingRole(role);
    roleForm.setFieldsValue({
      name: role.name,
      permissions: role.permissions,
      dataScope: role.dataScope,
    });
  };

  const openCreateRole = () => {
    setEditingRole(undefined);
    setCreatingRole(true);
    roleForm.resetFields();
    roleForm.setFieldsValue({
      permissions: [],
      dataScope: 'assigned_areas',
    });
  };

  const saveRole = async () => {
    if (!creatingRole && !editingRole) return;
    const values = await roleForm.validateFields();
    setSaving(true);
    try {
      if (creatingRole) {
        const created = await createIamRole({
          code: values.code!,
          name: values.name,
          permissions: values.permissions,
          dataScope: values.dataScope,
        });
        setRoles((current) => [...current, created]);
        message.success('自定义角色已创建');
      } else if (editingRole) {
        const updated = await updateIamRole(editingRole.id, {
          name: values.name,
          permissions: values.permissions,
          dataScope: values.dataScope,
        });
        setRoles((current) => current.map((role) => (role.id === updated.id ? updated : role)));
        setUsers((current) =>
          current.map((user) => ({
            ...user,
            roles: user.roles.map((role) => (role.id === updated.id ? updated : role)),
          })),
        );
        message.success('角色权限已更新，现有会话将立即使用新权限');
      }
      setCreatingRole(false);
      setEditingRole(undefined);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<IamUser> = [
    {
      title: '用户',
      render: (_, user) => (
        <span className={styles.user}>
          <strong>{user.name}</strong>
          <small>
            {user.username} · {user.title}
          </small>
        </span>
      ),
    },
    {
      title: '所属组织',
      render: (_, user) => user.organization?.name ?? user.organizationId,
    },
    {
      title: '角色',
      render: (_, user) => (
        <Space size={[4, 4]} wrap>
          {user.roles.map((role) => (
            <Tag key={role.code}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '数据范围',
      render: (_, user) =>
        user.roles.some((role) => role.dataScope === 'all') ? (
          <Tag color="blue">全企业</Tag>
        ) : (
          <span>
            {user.areaIds.map((id) => areas.find((area) => area.id === id)?.name ?? id).join('、')}
          </span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value, user) => (
        <Space size={4}>
          <Tag color={value === 'enabled' ? 'success' : 'default'}>
            {value === 'enabled' ? '启用' : '停用'}
          </Tag>
          {user.passwordChangeRequired && <Tag color="warning">待改密</Tag>}
        </Space>
      ),
    },
    { title: '版本', dataIndex: 'version', width: 70, render: (value) => `v${value}` },
    {
      title: '操作',
      width: 190,
      render: (_, user) => (
        <Space size={0}>
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={!access.canAdmin}
            onClick={() => open(user)}
          >
            授权
          </Button>
          <Button
            type="link"
            icon={<KeyOutlined />}
            disabled={!access.canAdmin}
            onClick={() => {
              setResetting(user);
              resetForm.resetFields();
            }}
          >
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  const roleColumns: ColumnsType<IamRole> = [
    {
      title: '角色',
      render: (_, role) => (
        <span className={styles.user}>
          <strong>{role.name}</strong>
          <small>{role.code}</small>
        </span>
      ),
    },
    {
      title: '数据范围',
      dataIndex: 'dataScope',
      width: 110,
      render: (value) => (
        <Tag color={value === 'all' ? 'blue' : 'cyan'}>
          {value === 'all' ? '全企业' : '授权区域'}
        </Tag>
      ),
    },
    {
      title: '权限点',
      dataIndex: 'permissions',
      render: (values: string[]) => (
        <Space size={[4, 4]} wrap>
          {values.slice(0, 6).map((permission) => (
            <Tag key={permission}>{permissionLabel(permission)}</Tag>
          ))}
          {values.length > 6 && <Tag>+{values.length - 6}</Tag>}
        </Space>
      ),
    },
    {
      title: '用户',
      width: 75,
      render: (_, role) =>
        `${users.filter((user) => user.roleCodes.includes(role.code)).length} 人`,
    },
    {
      title: '类型',
      width: 90,
      render: (_, role) => (
        <Tag color={role.editable ? 'gold' : 'default'}>{role.editable ? '自定义' : '内置'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 90,
      render: (_, role) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          disabled={!access.canAdmin || !role.editable}
          onClick={() => openRole(role)}
        >
          编辑
        </Button>
      ),
    },
  ];

  const authorizationRequestColumns: ColumnsType<IamAuthorizationRequest> = [
    {
      title: '申请对象',
      render: (_, request) => (
        <span className={styles.user}>
          <strong>{request.targetUser?.name ?? request.targetUserId}</strong>
          <small>
            {request.targetUser?.username ?? request.targetUserId} · 用户版本 v
            {request.expectedUserVersion}
          </small>
        </span>
      ),
    },
    {
      title: '拟变更授权',
      render: (_, request) => (
        <Space size={[4, 4]} wrap>
          <Tag color={request.proposedAuthorization.status === 'enabled' ? 'success' : 'default'}>
            {request.proposedAuthorization.status === 'enabled' ? '启用' : '停用'}
          </Tag>
          {request.proposedAuthorization.roleCodes.map((code) => (
            <Tag key={code}>{roles.find((role) => role.code === code)?.name ?? code}</Tag>
          ))}
          {request.proposedAuthorization.areaIds.map((id) => (
            <Tag key={id} color="cyan">
              {areas.find((area) => area.id === id)?.name ?? id}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '申请信息',
      render: (_, request) => (
        <span className={styles.user}>
          <strong>{request.requestedByName}</strong>
          <small>{request.reason}</small>
        </span>
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_, request) => {
        const statusMap = {
          pending: { color: 'processing', label: '待审批' },
          approved: { color: 'success', label: '已批准' },
          rejected: { color: 'error', label: '已驳回' },
        } as const;
        const status = statusMap[request.status];
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: '审批结果',
      render: (_, request) =>
        request.reviewedByName ? (
          <span className={styles.user}>
            <strong>{request.reviewedByName}</strong>
            <small>{request.opinion ?? '—'}</small>
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      width: 150,
      render: (_, request) =>
        request.status === 'pending' ? (
          <Space size={0}>
            <Button
              type="link"
              icon={<CheckOutlined />}
              disabled={!access.canAdmin}
              onClick={() => openReview(request, 'approve')}
            >
              批准
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              disabled={!access.canAdmin}
              onClick={() => openReview(request, 'reject')}
            >
              驳回
            </Button>
          </Space>
        ) : (
          `v${request.version}`
        ),
    },
  ];

  const enabled = users.filter((user) => user.status === 'enabled').length;
  const assigned = users.filter((user) =>
    user.roles.every((role) => role.dataScope === 'assigned_areas'),
  ).length;
  const pendingAuthorizationRequests = authorizationRequests.filter(
    (request) => request.status === 'pending',
  ).length;

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>IDENTITY &amp; ACCESS GOVERNANCE</span>
          <h1>组织与权限管理</h1>
          <p>统一查看组织、角色权限矩阵和账号数据范围；授权变化实时作用于现有会话。</p>
        </div>
        <SafetyCertificateOutlined />
      </header>

      <section className={styles.metrics}>
        <article>
          <TeamOutlined />
          <span>
            用户账号<strong>{users.length}</strong>
            <small>{enabled} 个已启用</small>
          </span>
        </article>
        <article>
          <UserSwitchOutlined />
          <span>
            角色模型<strong>{roles.length}</strong>
            <small>基于最小权限组合</small>
          </span>
        </article>
        <article>
          <ApartmentOutlined />
          <span>
            组织节点<strong>{organizations.length}</strong>
            <small>{areas.length} 个授权区域</small>
          </span>
        </article>
        <article>
          <SafetyCertificateOutlined />
          <span>
            区域账号<strong>{assigned}</strong>
            <small>{pendingAuthorizationRequests} 条授权待审批</small>
          </span>
        </article>
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <h2>授权变更审批</h2>
            <p>申请人与审批人必须为不同账号；批准时校验用户版本并原子应用角色和区域权限。</p>
          </div>
          <Tag color={pendingAuthorizationRequests ? 'processing' : 'default'}>
            {pendingAuthorizationRequests} 条待审批
          </Tag>
        </header>
        <Table
          rowKey="id"
          loading={loading}
          columns={authorizationRequestColumns}
          dataSource={authorizationRequests}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          size="small"
        />
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <h2>角色权限矩阵</h2>
            <p>内置角色保持只读；自定义角色可维护权限点，已登录用户会立即获得最新权限。</p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!access.canAdmin}
            onClick={openCreateRole}
          >
            新增角色
          </Button>
        </header>
        <Table
          rowKey="id"
          loading={loading}
          columns={roleColumns}
          dataSource={roles}
          pagination={false}
          size="small"
        />
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <h2>用户授权台账</h2>
            <p>停用账号会立即失效；授权更新使用版本号防止覆盖其他管理员的修改。</p>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!access.canAdmin}
              onClick={openCreate}
            >
              新增用户
            </Button>
            <Input.Search
              allowClear
              value={query}
              placeholder="搜索姓名、账号、组织"
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'enabled', label: '已启用' },
                { value: 'disabled', label: '已停用' },
              ]}
            />
          </Space>
        </header>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          pagination={false}
        />
      </section>

      <Modal
        title={creating ? '新增用户' : `用户授权 · ${editing?.name ?? ''}`}
        open={creating || Boolean(editing)}
        confirmLoading={saving}
        okText={creating ? '创建用户' : '提交审批'}
        cancelText="取消"
        onOk={() => void save()}
        onCancel={() => {
          if (!saving) {
            setCreating(false);
            setEditing(undefined);
          }
        }}
      >
        {editing?.id === initialState?.currentUser?.userid && (
          <Alert
            type="warning"
            showIcon
            message="当前登录账号不能停用自身或移除自己的系统管理员角色"
          />
        )}
        <Form form={form} layout="vertical" className={styles.form}>
          {creating && (
            <>
              <Form.Item
                name="username"
                label="登录账号"
                rules={[
                  { required: true },
                  {
                    pattern: /^[a-z][a-z0-9._-]{2,49}$/,
                    message: '使用 3–50 位小写字母、数字、点、下划线或连字符',
                  },
                ]}
              >
                <Input autoComplete="off" />
              </Form.Item>
              <Form.Item name="name" label="姓名" rules={[{ required: true, max: 80 }]}>
                <Input />
              </Form.Item>
              <Form.Item name="title" label="岗位名称" rules={[{ required: true, max: 80 }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name="initialPassword"
                label="初始密码"
                rules={[{ required: true, min: 8, max: 72 }]}
                extra="密码只在本次创建时提交，页面和用户台账不会回显。"
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          {!creating && (
            <Form.Item name="status" label="账号状态" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'enabled', label: '启用' },
                  { value: 'disabled', label: '停用' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="organizationId" label="所属组织" rules={[{ required: true }]}>
            <Select
              options={organizations.map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.type}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="roleCodes"
            label="授权角色"
            rules={[{ required: true, type: 'array', min: 1 }]}
          >
            <Select
              mode="multiple"
              options={roles.map((role) => ({
                value: role.code,
                label: `${role.name} · ${role.permissions.length} 项权限`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="areaIds"
            label="授权区域"
            rules={
              allScope
                ? []
                : [
                    {
                      required: true,
                      type: 'array',
                      min: 1,
                      message: '区域角色至少选择一个授权区域',
                    },
                  ]
            }
          >
            <Select
              mode="multiple"
              disabled={allScope}
              placeholder={allScope ? '全企业角色无需单独分配区域' : '选择可访问区域'}
              options={areas.map((area) => ({
                value: area.id,
                label: `${area.name} · ${area.code}`,
              }))}
            />
          </Form.Item>
          {!creating && (
            <Form.Item
              name="reason"
              label="变更原因"
              rules={[
                { required: true, whitespace: true, message: '请填写授权变更原因' },
                { min: 2, max: 300 },
              ]}
              extra="提交后由另一名系统管理员审批，批准前不会改变当前权限。"
            >
              <Input.TextArea rows={3} maxLength={300} showCount />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={creatingRole ? '新增自定义角色' : `编辑角色 · ${editingRole?.name ?? ''}`}
        open={creatingRole || Boolean(editingRole)}
        confirmLoading={saving}
        okText={creatingRole ? '创建角色' : '保存角色'}
        cancelText="取消"
        width={720}
        onOk={() => void saveRole()}
        onCancel={() => {
          if (!saving) {
            setCreatingRole(false);
            setEditingRole(undefined);
          }
        }}
      >
        <Form form={roleForm} layout="vertical">
          {creatingRole && (
            <Form.Item
              name="code"
              label="角色编码"
              rules={[
                { required: true },
                {
                  pattern: /^[a-z][a-z0-9_]{2,49}$/,
                  message: '使用 3–50 位小写字母、数字或下划线，且以字母开头',
                },
              ]}
              extra="角色编码创建后不可修改。"
            >
              <Input autoComplete="off" />
            </Form.Item>
          )}
          <Form.Item name="name" label="角色名称" rules={[{ required: true, max: 80 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dataScope" label="数据范围" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'assigned_areas', label: '授权区域' },
                { value: 'all', label: '全企业' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限点"
            rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个权限点' }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={permissionOptions}
              placeholder="选择该角色允许执行的操作"
            />
          </Form.Item>
          {editingRole && users.some((user) => user.roleCodes.includes(editingRole.code)) && (
            <Alert
              type="info"
              showIcon
              message={`该角色已分配给 ${
                users.filter((user) => user.roleCodes.includes(editingRole.code)).length
              } 个用户；权限调整立即生效，数据范围类型需先移除用户授权后才能修改。`}
            />
          )}
        </Form>
      </Modal>

      <Modal
        title={`${reviewForm.getFieldValue('decision') === 'reject' ? '驳回' : '批准'}授权变更 · ${
          reviewing?.targetUser?.name ?? ''
        }`}
        open={Boolean(reviewing)}
        confirmLoading={saving}
        okText="确认审批"
        cancelText="取消"
        onOk={() => void reviewAuthorization()}
        onCancel={() => !saving && setReviewing(undefined)}
      >
        <Alert
          type="info"
          showIcon
          message={`申请人：${reviewing?.requestedByName ?? '—'}；申请原因：${
            reviewing?.reason ?? '—'
          }`}
          style={{ marginBottom: 16 }}
        />
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="decision" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="opinion"
            label="审批意见"
            rules={[
              {
                validator: async (_, value) => {
                  if (reviewForm.getFieldValue('decision') === 'reject' && !value?.trim()) {
                    throw new Error('驳回时必须填写审批意见');
                  }
                },
              },
              { max: 300 },
            ]}
          >
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
          <Alert type="warning" showIcon message="申请人不能审批本人提交的授权变更。" />
        </Form>
      </Modal>

      <Modal
        title={`重置密码 · ${resetting?.name ?? ''}`}
        open={Boolean(resetting)}
        confirmLoading={saving}
        okText="确认重置"
        cancelText="取消"
        onOk={() => void resetPassword()}
        onCancel={() => !saving && setResetting(undefined)}
      >
        <Alert
          type="warning"
          showIcon
          message="重置后该用户的所有现有会话立即失效，下次登录必须修改临时密码。"
          style={{ marginBottom: 16 }}
        />
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="temporaryPassword"
            label="临时密码"
            rules={[{ required: true, min: 8, max: 72 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
