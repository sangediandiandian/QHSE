import type { UserAuthorizationInput } from '@/services/qhse/iam';
import { getIamOverview, updateUserAuthorization } from '@/services/qhse/iam';
import type { IamOrganization, IamRole, IamUser } from '@/types/qhse';
import {
  ApartmentOutlined,
  EditOutlined,
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

export default function IamManagement() {
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const [organizations, setOrganizations] = useState<IamOrganization[]>([]);
  const [roles, setRoles] = useState<IamRole[]>([]);
  const [users, setUsers] = useState<IamUser[]>([]);
  const [editing, setEditing] = useState<IamUser>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | IamUser['status']>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<UserAuthorizationInput>();
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
    setEditing(user);
    form.setFieldsValue({
      status: user.status,
      organizationId: user.organizationId,
      roleCodes: user.roleCodes,
      areaIds: user.areaIds,
    });
  };

  const save = async () => {
    if (!editing) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await updateUserAuthorization(editing, {
        ...values,
        areaIds: allScope ? [] : values.areaIds,
      });
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setEditing(undefined);
      message.success('用户授权已更新，现有会话将立即使用新权限');
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
      render: (value) => (
        <Tag color={value === 'enabled' ? 'success' : 'default'}>
          {value === 'enabled' ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '版本', dataIndex: 'version', width: 70, render: (value) => `v${value}` },
    {
      title: '操作',
      width: 100,
      render: (_, user) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          disabled={!access.canAdmin}
          onClick={() => open(user)}
        >
          授权
        </Button>
      ),
    },
  ];

  const enabled = users.filter((user) => user.status === 'enabled').length;
  const assigned = users.filter((user) =>
    user.roles.every((role) => role.dataScope === 'assigned_areas'),
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
            <small>按分配区域裁剪数据</small>
          </span>
        </article>
      </section>

      <section className={styles.panel}>
        <header>
          <div>
            <h2>用户授权台账</h2>
            <p>停用账号会立即失效；授权更新使用版本号防止覆盖其他管理员的修改。</p>
          </div>
          <Space>
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
        title={`用户授权 · ${editing?.name ?? ''}`}
        open={Boolean(editing)}
        confirmLoading={saving}
        okText="保存授权"
        cancelText="取消"
        onOk={() => void save()}
        onCancel={() => !saving && setEditing(undefined)}
      >
        {editing?.id === initialState?.currentUser?.userid && (
          <Alert
            type="warning"
            showIcon
            message="当前登录账号不能停用自身或移除自己的系统管理员角色"
          />
        )}
        <Form form={form} layout="vertical" className={styles.form}>
          <Form.Item name="status" label="账号状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'enabled', label: '启用' },
                { value: 'disabled', label: '停用' },
              ]}
            />
          </Form.Item>
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
        </Form>
      </Modal>
    </PageContainer>
  );
}
