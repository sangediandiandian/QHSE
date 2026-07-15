import type { IntegrationConfig, PlatformDictionary } from '@/types/qhse';
import type { DictionaryInput, IntegrationInput } from '@/services/qhse/platformConfig';
import {
  getDictionaries,
  getIntegrationConfigs,
  saveDictionary,
  saveIntegration,
} from '@/services/qhse/platformConfig';
import {
  ApiOutlined,
  DatabaseOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const typeText: Record<IntegrationConfig['type'], string> = {
  telemetry: '遥测接入',
  communication: '融合通信',
  identity: '统一身份',
  storage: '对象存储',
};

export default function PlatformConfigPage() {
  const access = useAccess();
  const [dictionaries, setDictionaries] = useState<PlatformDictionary[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [dictionaryEditing, setDictionaryEditing] = useState<PlatformDictionary | null>();
  const [integrationEditing, setIntegrationEditing] = useState<IntegrationConfig | null>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dictionaryForm] = Form.useForm<DictionaryInput>();
  const [integrationForm] = Form.useForm<IntegrationInput>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dictionaryData, integrationData] = await Promise.all([
        getDictionaries(),
        getIntegrationConfigs(),
      ]);
      setDictionaries(dictionaryData);
      setIntegrations(integrationData);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const openDictionary = (value?: PlatformDictionary) => {
    setDictionaryEditing(value ?? null);
    dictionaryForm.setFieldsValue(
      value ?? {
        code: '',
        name: '',
        status: 'enabled',
        items: [{ value: '', label: '', sort: 10, enabled: true }],
      },
    );
  };
  const openIntegration = (value?: IntegrationConfig) => {
    setIntegrationEditing(value ?? null);
    integrationForm.setFieldsValue(
      value ?? {
        code: '',
        name: '',
        type: 'telemetry',
        protocol: 'HTTPS',
        endpoint: '',
        enabled: false,
        timeoutMs: 5000,
        owner: '',
      },
    );
  };

  const dictionaryColumns = useMemo<ColumnsType<PlatformDictionary>>(
    () => [
      { title: '编码', dataIndex: 'code', render: (value) => <code>{value}</code> },
      { title: '名称', dataIndex: 'name' },
      { title: '说明', dataIndex: 'description', render: (value) => value || '-' },
      { title: '字典项', dataIndex: 'items', render: (items) => `${items.length} 项` },
      {
        title: '状态',
        dataIndex: 'status',
        render: (value) => (
          <Tag color={value === 'enabled' ? 'success' : 'default'}>
            {value === 'enabled' ? '启用' : '停用'}
          </Tag>
        ),
      },
      { title: '版本', dataIndex: 'version', render: (value) => `v${value}` },
      {
        title: '操作',
        render: (_, value) => (
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={!access.canManageConfig}
            onClick={() => openDictionary(value)}
          >
            编辑
          </Button>
        ),
      },
    ],
    [access.canManageConfig],
  );

  const integrationColumns = useMemo<ColumnsType<IntegrationConfig>>(
    () => [
      {
        title: '编码 / 名称',
        render: (_, value) => (
          <>
            <code>{value.code}</code>
            <strong>{value.name}</strong>
          </>
        ),
      },
      {
        title: '类别',
        dataIndex: 'type',
        render: (value) => typeText[value as IntegrationConfig['type']],
      },
      { title: '协议', dataIndex: 'protocol', render: (value) => <Tag>{value}</Tag> },
      { title: '非敏感地址', dataIndex: 'endpoint', ellipsis: true },
      { title: '责任方', dataIndex: 'owner' },
      { title: '超时', dataIndex: 'timeoutMs', render: (value) => `${value} ms` },
      {
        title: '状态',
        render: (_, value) => (
          <Space>
            <Tag color={value.enabled ? 'success' : 'default'}>
              {value.enabled ? '启用' : '停用'}
            </Tag>
            <Tag>{value.healthStatus === 'unchecked' ? '待检测' : value.healthStatus}</Tag>
          </Space>
        ),
      },
      {
        title: '操作',
        render: (_, value) => (
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={!access.canManageConfig}
            onClick={() => openIntegration(value)}
          >
            编辑
          </Button>
        ),
      },
    ],
    [access.canManageConfig],
  );

  return (
    <PageContainer title={false} className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span>PLATFORM GOVERNANCE</span>
          <h1>平台基础配置</h1>
          <p>
            统一维护业务字典和非敏感集成登记；账号、密码、Token 与证书始终由部署环境或密钥系统管理。
          </p>
        </div>
        <SafetyCertificateOutlined />
      </header>
      <Tabs
        className={styles.tabs}
        items={[
          {
            key: 'dictionary',
            label: (
              <span>
                <DatabaseOutlined /> 数据字典
              </span>
            ),
            children: (
              <section className={styles.panel}>
                <header>
                  <div>
                    <h2>业务数据字典</h2>
                    <p>编码创建后不可修改，字典项值在单个字典内必须唯一。</p>
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!access.canManageConfig}
                    onClick={() => openDictionary()}
                  >
                    新增字典
                  </Button>
                </header>
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={dictionaryColumns}
                  dataSource={dictionaries}
                  pagination={false}
                  expandable={{
                    expandedRowRender: (value) => (
                      <Space wrap>
                        {value.items.map((item) => (
                          <Tag key={item.value} color={item.color}>
                            {item.label} · {item.value}
                            {!item.enabled ? '（停用）' : ''}
                          </Tag>
                        ))}
                      </Space>
                    ),
                  }}
                  locale={{ emptyText: <Empty description="暂无数据字典" /> }}
                />
              </section>
            ),
          },
          {
            key: 'integration',
            label: (
              <span>
                <ApiOutlined /> 集成登记
              </span>
            ),
            children: (
              <section className={styles.panel}>
                <header>
                  <div>
                    <h2>外部系统登记</h2>
                    <p>仅登记协议、地址和运维责任，不接受任何凭据进入业务数据库。</p>
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!access.canManageConfig}
                    onClick={() => openIntegration()}
                  >
                    新增集成
                  </Button>
                </header>
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={integrationColumns}
                  dataSource={integrations}
                  pagination={false}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: <Empty description="暂无集成配置" /> }}
                />
              </section>
            ),
          },
        ]}
      />

      <Modal
        width={760}
        title={`${dictionaryEditing ? '编辑' : '新增'}数据字典`}
        open={dictionaryEditing !== undefined}
        confirmLoading={saving}
        onCancel={() => setDictionaryEditing(undefined)}
        onOk={() =>
          dictionaryForm.validateFields().then(async (values) => {
            setSaving(true);
            try {
              await saveDictionary(values, dictionaryEditing ?? undefined);
              message.success('数据字典已保存');
              setDictionaryEditing(undefined);
              await load();
            } finally {
              setSaving(false);
            }
          })
        }
      >
        <Form form={dictionaryForm} layout="vertical">
          <div className={styles.formGrid}>
            <Form.Item
              name="code"
              label="字典编码"
              rules={[
                { required: true },
                {
                  pattern: /^[a-z][a-z0-9_]{2,49}$/,
                  message: '小写字母开头，仅支持小写字母、数字和下划线',
                },
              ]}
            >
              <Input disabled={Boolean(dictionaryEditing)} />
            </Form.Item>
            <Form.Item name="name" label="字典名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'enabled', label: '启用' },
                { value: 'disabled', label: '停用' },
              ]}
            />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <div className={styles.itemHeader}>
                  <strong>字典项</strong>
                  <Button
                    size="small"
                    onClick={() =>
                      add({ value: '', label: '', sort: (fields.length + 1) * 10, enabled: true })
                    }
                  >
                    添加一项
                  </Button>
                </div>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" className={styles.itemRow}>
                    <Form.Item {...field} name={[field.name, 'value']} rules={[{ required: true }]}>
                      <Input placeholder="值" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'label']} rules={[{ required: true }]}>
                      <Input placeholder="显示名称" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'sort']} rules={[{ required: true }]}>
                      <InputNumber min={0} max={9999} placeholder="排序" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'color']}>
                      <Input placeholder="#1677ff" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'enabled']} valuePropName="checked">
                      <Switch checkedChildren="启用" unCheckedChildren="停用" />
                    </Form.Item>
                    <Button
                      danger
                      type="link"
                      disabled={fields.length <= 1}
                      onClick={() => remove(field.name)}
                    >
                      移除
                    </Button>
                  </Space>
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={`${integrationEditing ? '编辑' : '新增'}集成登记`}
        open={integrationEditing !== undefined}
        confirmLoading={saving}
        onCancel={() => setIntegrationEditing(undefined)}
        onOk={() =>
          integrationForm.validateFields().then(async (values) => {
            setSaving(true);
            try {
              await saveIntegration(values, integrationEditing ?? undefined);
              message.success('集成配置已保存');
              setIntegrationEditing(undefined);
              await load();
            } finally {
              setSaving(false);
            }
          })
        }
      >
        <Form form={integrationForm} layout="vertical">
          <div className={styles.formGrid}>
            <Form.Item
              name="code"
              label="集成编码"
              rules={[{ required: true }, { pattern: /^[a-z][a-z0-9_]{2,49}$/ }]}
            >
              <Input disabled={Boolean(integrationEditing)} />
            </Form.Item>
            <Form.Item name="name" label="集成名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="type" label="类别" rules={[{ required: true }]}>
              <Select
                options={Object.entries(typeText).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
            <Form.Item name="protocol" label="协议" rules={[{ required: true }]}>
              <Select options={['HTTP', 'HTTPS', 'MQTT', 'MQTTS'].map((value) => ({ value }))} />
            </Form.Item>
          </div>
          <Form.Item name="endpoint" label="非敏感接口地址" rules={[{ required: true }]}>
            <Input placeholder="https://service.example.internal/api" />
          </Form.Item>
          <div className={styles.formGrid}>
            <Form.Item name="owner" label="运维责任方" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="timeoutMs" label="超时（毫秒）" rules={[{ required: true }]}>
              <InputNumber min={500} max={60000} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <p className={styles.secretTip}>
            禁止在地址中包含用户名、密码、Token 或密钥。敏感凭据应由部署环境或密钥管理系统注入。
          </p>
        </Form>
      </Modal>
    </PageContainer>
  );
}
