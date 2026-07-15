import type {
  RiskLevel,
  WarningRule,
  WarningRuleDraftInput,
  WarningRulePublishStatus,
} from '@/types/qhse';
import { findWarningRuleConflicts, getWarningRuleDisplayConfig } from '@/utils/warningRuleWorkflow';
import {
  AlertFilled,
  CheckCircleFilled,
  ControlFilled,
  DatabaseFilled,
  EditOutlined,
  HistoryOutlined,
  MinusCircleOutlined,
  NotificationFilled,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  message,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from './index.less';

const levelText: Record<RiskLevel, string> = { low: '低风险', medium: '一般', high: '较大', critical: '重大' };
const levelColor: Record<RiskLevel, string> = { low: 'success', medium: 'warning', high: 'orange', critical: 'error' };
const publishColor: Record<WarningRulePublishStatus, string> = { 草稿: 'gold', 待审批: 'purple', 已发布: 'success' };

function RuleItem({ rule, active, canToggle, onSelect, onToggle }: {
  rule: WarningRule;
  active: boolean;
  canToggle?: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const display = getWarningRuleDisplayConfig(rule);
  return <article className={`${active ? styles.active : ''} ${!rule.enabled ? styles.disabled : ''}`}>
    <button type="button" className={styles.ruleSelect} onClick={onSelect}>
      <header><Tag color={levelColor[display.level]}>{levelText[display.level]}</Tag><code>{rule.code}</code><span>{display.source}</span></header>
      <strong>{display.name}</strong>
      <p>{display.condition}</p>
      <footer><span><HistoryOutlined /> {rule.version > 0 ? `V${rule.version}` : '未发布'}</span><em className={styles.publishState}>{rule.publishStatus}</em></footer>
    </button>
    <Switch aria-label={`切换 ${rule.code}`} size="small" checked={rule.enabled} disabled={rule.version === 0 || !canToggle} onChange={onToggle} checkedChildren="启" unCheckedChildren="停" />
  </article>;
}

export default function WarningRules() {
  const access = useAccess();
  const {
    warningRules: ruleRecords, warningRuleLoading, warningRuleApiMode, loadWarningRules, toggleWarningRule, resetDashboard,
    saveWarningRule, submitWarningRule, approveWarningRule, rollbackWarningRuleVersion,
  } = useModel('qhse');
  const [source, setSource] = useState('全部');
  const [selectedId, setSelectedId] = useState('rule-001');
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [form] = Form.useForm<WarningRuleDraftInput>();

  useEffect(() => { void loadWarningRules(); }, [loadWarningRules]);

  const rules = useMemo(() => ruleRecords.filter((rule) => source === '全部' || rule.source === source), [ruleRecords, source]);
  const selected = ruleRecords.find((rule) => rule.id === selectedId) ?? rules[0];
  const display = selected ? getWarningRuleDisplayConfig(selected) : undefined;
  const conflicts = selected && display ? findWarningRuleConflicts(ruleRecords, display, selected.id) : [];

  if (warningRuleLoading && !ruleRecords.length) return <PageContainer><Skeleton active paragraph={{ rows: 14 }} /></PageContainer>;

  const enabled = ruleRecords.filter((rule) => rule.enabled).length;
  const pending = ruleRecords.filter((rule) => rule.publishStatus === '待审批').length;
  const triggers = ruleRecords.reduce((sum, rule) => sum + rule.triggerCount, 0);
  const openEditor = (rule?: WarningRule) => {
    const config = rule ? getWarningRuleDisplayConfig(rule) : {
      name: '', source: 'GDS' as const, scenario: 'gds-trend' as const, level: 'medium' as const,
      scope: '', condition: '', duration: '即时触发', notifyTargets: [], description: '', rolloutPercentage: 100 as const,
      expression: [{ metric: 'GDS.currentValue', operator: '>=' as const, threshold: '25', connector: 'AND' as const }],
    };
    setEditingId(rule?.id);
    form.setFieldsValue({ code: rule?.code ?? '', ...config });
    setEditorOpen(true);
  };
  const handleSave = async () => {
    const values = await form.validateFields();
    const expression = values.expression?.filter((item) => item.metric?.trim() && item.threshold?.trim()) ?? [];
    if (!expression.length) {
      message.error('至少配置一项有效触发条件');
      return;
    }
    const condition = expression.map((item, index) => `${index ? `${item.connector} ` : ''}${item.metric} ${item.operator} ${item.threshold}`).join(' ');
    setMutating(true);
    try {
      const saved = await saveWarningRule(editingId, { ...values, condition, expression, rolloutPercentage: values.rolloutPercentage ?? 100, code: values.code.trim().toUpperCase() });
      setSelectedId(saved?.id ?? editingId ?? '');
      setSource('全部');
      setEditorOpen(false);
      message.success(editingId ? '规则修改已保存为草稿' : '新规则草稿已创建');
    } finally {
      setMutating(false);
    }
  };

  return (
    <PageContainer title={false} className={styles.page} extra={<Space><Button type="primary" icon={<PlusOutlined />} disabled={!access.canEditWarningRule} onClick={() => openEditor()}>新建规则</Button>{!warningRuleApiMode && <Popconfirm title="恢复 Mock 初始状态？" description="将清除浏览器中保存的风险评估、隐患证据、票证审批、规则会签、预案、事件审批和附件证据。" okText="确认重置" cancelText="取消" onConfirm={() => { void resetDashboard(); message.success('演示数据已恢复初始状态'); }}><Button icon={<ReloadOutlined />}>重置演示数据</Button></Popconfirm>}</Space>}>
      <header className={styles.heading}>
        <div><span>WARNING RULE ORCHESTRATION</span><h1>预警规则配置</h1><p>统一管理单点阈值、持续时间、多源组合、作用范围和通知对象。</p></div>
        <div className={styles.persistence}><DatabaseFilled /><span>规则状态存储<strong>{warningRuleApiMode ? '服务端版本化已启用' : '本地持久化已启用'}</strong><small>草稿、会签与发布版本相互隔离</small></span></div>
      </header>

      <section className={styles.metrics}>
        <div><ControlFilled /><span>规则总数<strong>{ruleRecords.length}</strong><small>覆盖 5 类联动场景</small></span></div>
        <div><CheckCircleFilled /><span>启用规则<strong>{enabled}</strong><small>{ruleRecords.length - enabled} 条已停用</small></span></div>
        <div><AlertFilled /><span>待会签<strong>{pending}</strong><small>等待 QHSE / 生产负责人会签</small></span></div>
        <div><NotificationFilled /><span>累计触发<strong>{triggers}</strong><small>演示统计次数</small></span></div>
      </section>

      <section className={styles.toolbar}><Segmented value={source} onChange={(value) => setSource(String(value))} options={['全部', 'GDS', 'VOC', 'MES', '联合预警', '作业许可']} /><span>显示 {rules.length} / {ruleRecords.length} 条规则</span></section>

      <main className={styles.layout}>
        <section className={styles.catalog}>{rules.map((rule) => <RuleItem key={rule.id} rule={rule} active={selected?.id === rule.id} canToggle={access.canToggleWarningRule} onSelect={() => setSelectedId(rule.id)} onToggle={() => { if (!access.canToggleWarningRule) return; void toggleWarningRule(rule.id).then(() => message.success(`${rule.name}已${rule.enabled ? '停用' : '启用'}`)); }} />)}{rules.length === 0 && <Empty description="没有符合条件的规则" />}</section>
        {selected && display && <section className={styles.detail}>
          <header><div><code>{selected.code} · {selected.version > 0 ? `V${selected.version}` : '未发布'}</code><h2>{display.name}</h2><p>{display.description}</p></div><div className={styles.detailActions}><Tag color={publishColor[selected.publishStatus]}>{selected.publishStatus}</Tag><Switch aria-label={`详情切换 ${selected.code}`} checked={selected.enabled} disabled={selected.version === 0 || !access.canToggleWarningRule || mutating} onChange={() => void toggleWarningRule(selected.id)} checkedChildren="已启用" unCheckedChildren="已停用" /></div></header>
          <section className={styles.workflow}><div><span className={selected.publishStatus === '草稿' ? styles.workflowActive : ''}>1 草稿</span><i /><span className={selected.publishStatus === '待审批' ? styles.workflowActive : ''}>2 双人会签</span><i /><span className={selected.publishStatus === '已发布' ? styles.workflowActive : ''}>3 已发布</span></div><p>{selected.draft ? `当前展示未发布草稿；告警运行仍使用 ${selected.version > 0 ? `V${selected.version}` : '空配置'}。` : `V${selected.version} 已生效，编辑后将生成独立草稿。`}</p>{selected.approvalSteps && <div className={styles.approvalSteps}>{selected.approvalSteps.map((step) => <span key={step.role}><CheckCircleFilled className={step.status === '已通过' ? styles.approved : ''} /><strong>{step.role}</strong><small>{step.approver} · {step.approvedAt ?? step.status}</small></span>)}</div>}{conflicts.length > 0 && <div className={styles.conflict}><AlertFilled /> 发现 {conflicts.length} 条已发布规则与当前作用域及表达式重复：{conflicts.map((rule) => rule.code).join('、')}</div>}<Space wrap><Button icon={<EditOutlined />} disabled={!access.canEditWarningRule || selected.publishStatus === '待审批'} onClick={() => openEditor(selected)}>编辑规则</Button>{selected.publishStatus === '草稿' && <Button type="primary" loading={mutating} icon={<SendOutlined />} disabled={conflicts.length > 0 || !access.canSubmitWarningRule} onClick={async () => { setMutating(true); try { await submitWarningRule(selected.id); message.success('规则已提交双人会签'); } finally { setMutating(false); } }}>提交会签</Button>}{selected.publishStatus === '待审批' && <Button type="primary" loading={mutating} disabled={!access.canApproveWarningRule} icon={<CheckCircleFilled />} onClick={async () => { const next = selected.approvalSteps?.find((step) => step.status === '待审批'); setMutating(true); try { const updated = await approveWarningRule(selected.id); message.success(updated?.publishStatus === '已发布' ? `双人会签完成，规则已发布为 V${updated.version}` : `${next?.role ?? '当前节点'}已通过`); } finally { setMutating(false); } }}>{selected.approvalSteps?.find((step) => step.status === '待审批')?.role ?? '会签'}</Button>}<Button icon={<HistoryOutlined />} disabled={selected.versions.length === 0} onClick={() => setVersionsOpen(true)}>版本历史</Button></Space></section>
          <div className={styles.ruleExpression}><span>IF</span><div>{display.expression?.length ? display.expression.map((item, index) => <span key={`${item.metric}-${index}`}>{index > 0 && <i>{item.connector}</i>}<strong>{item.metric}</strong><em>{item.operator}</em><b>{item.threshold}</b></span>) : <strong>{display.condition}</strong>}</div><span>FOR</span><strong>{display.duration}</strong><span>THEN</span><strong>{levelText[display.level]}预警</strong></div>
          <dl><div><dt>数据来源</dt><dd>{display.source}</dd></div><div><dt>作用范围</dt><dd>{display.scope}</dd></div><div><dt>风险等级</dt><dd><Tag color={levelColor[display.level]}>{levelText[display.level]}</Tag></dd></div><div><dt>灰度范围</dt><dd><Tag color="blue">{display.rolloutPercentage ?? 100}%</Tag></dd></div><div><dt>运行状态</dt><dd><Tag color={selected.enabled ? 'success' : 'default'}>{selected.version === 0 ? '尚未发布' : selected.enabled ? '运行中' : '已停用'}</Tag></dd></div></dl>
          <section className={styles.targets}><h3>通知对象</h3><div>{display.notifyTargets.map((target, index) => <span key={target}><i>{index + 1}</i><strong>{target}</strong>{index < display.notifyTargets.length - 1 && <em>→</em>}</span>)}</div></section>
          <section className={styles.history}><h3>运行记录</h3><div><span>累计触发</span><strong>{selected.triggerCount}<em>次</em></strong></div><div><span>最近触发</span><strong>{selected.lastTriggeredAt ?? '尚未触发'}</strong></div><p><CheckCircleFilled /> 只有审批发布后的版本才会影响对应模拟告警场景。</p></section>
        </section>}
      </main>
      <Modal title={editingId ? '编辑规则草稿' : '新建预警规则'} open={editorOpen} confirmLoading={mutating} okText="保存草稿" cancelText="取消" width={720} onOk={() => void handleSave()} onCancel={() => setEditorOpen(false)}>
        <Form form={form} layout="vertical" className={styles.ruleForm}>
          <Form.Item name="code" label="规则编码" rules={[{ required: true, message: '请输入规则编码' }, { pattern: /^[A-Za-z][A-Za-z0-9_]{2,31}$/, message: '使用字母、数字或下划线，长度 3-32 位' }, { validator: (_, value) => ruleRecords.some((rule) => rule.code === String(value).trim().toUpperCase() && rule.id !== editingId) ? Promise.reject(new Error('规则编码已存在')) : Promise.resolve() }]}><Input disabled={Boolean(editingId)} placeholder="例如 GDS_TREND_10" /></Form.Item>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}><Input /></Form.Item>
          <Form.Item name="source" label="数据来源" rules={[{ required: true }]}><Select options={['GDS', 'VOC', 'MES', '联合预警', '作业许可'].map((value) => ({ value, label: value }))} /></Form.Item>
          <Form.Item name="scenario" label="联动场景" rules={[{ required: true }]}><Select options={[['gds-level2', 'GDS 二级报警'], ['voc-overlimit', 'VOC 连续超限'], ['joint-leak', '多源联合研判'], ['gds-trend', 'GDS 趋势预警'], ['permit-linkage', '作业许可联动']].map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="level" label="预警等级" rules={[{ required: true }]}><Select options={[['low', '低风险'], ['medium', '一般'], ['high', '较大'], ['critical', '重大']].map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="scope" label="作用范围" rules={[{ required: true, message: '请输入作用范围' }]}><Input /></Form.Item>
          <Form.Item label="可视化触发条件" className={styles.expressionEditor}><Form.List name="expression">{(fields, { add, remove }) => <><div className={styles.expressionHeader}><span>指标</span><span>关系</span><span>阈值</span><span>连接</span></div>{fields.map((field) => <Space key={field.key} className={styles.expressionRow} align="start"><Form.Item name={[field.name, 'metric']} rules={[{ required: true, message: '请填写指标' }]}><Input placeholder="GDS.currentValue" /></Form.Item><Form.Item name={[field.name, 'operator']}><Select options={['>', '>=', '<', '<=', '='].map((value) => ({ value }))} /></Form.Item><Form.Item name={[field.name, 'threshold']} rules={[{ required: true, message: '请填写阈值' }]}><Input placeholder="25" /></Form.Item><Form.Item name={[field.name, 'connector']}><Select options={['AND', 'OR'].map((value) => ({ value }))} /></Form.Item><Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} /></Space>)}<Button block icon={<PlusOutlined />} onClick={() => add({ operator: '>=', connector: 'AND' })}>添加条件</Button></>}</Form.List></Form.Item>
          <Form.Item name="duration" label="持续时间" rules={[{ required: true, message: '请输入持续时间' }]}><Input /></Form.Item>
          <Form.Item name="rolloutPercentage" label="灰度生效范围" rules={[{ required: true }]}><Select options={[25, 50, 100].map((value) => ({ value, label: `${value}% 范围` }))} /></Form.Item>
          <Form.Item name="notifyTargets" label="通知对象" rules={[{ required: true, message: '至少配置一个通知对象' }]}><Select mode="tags" tokenSeparators={[',']} placeholder="输入对象后回车" /></Form.Item>
          <Form.Item name="description" label="规则说明" rules={[{ required: true, message: '请输入规则说明' }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`${selected?.code ?? ''} 版本历史`} open={versionsOpen} footer={null} width={660} onCancel={() => setVersionsOpen(false)}>
        <section className={styles.versionList}>{selected && [...selected.versions].reverse().map((version) => <article key={version.version}><div><strong>V{version.version}</strong><span>{version.publishedAt}</span><p>{version.condition} · {version.duration}</p><small>{version.publisher}</small></div><Popconfirm title={`回滚至 V${version.version}？`} description="历史配置将生成新草稿，当前运行版本不会立即改变。" okText="生成草稿" cancelText="取消" disabled={!access.canEditWarningRule} onConfirm={async () => { await rollbackWarningRuleVersion(selected.id, version.version); setVersionsOpen(false); message.success(`V${version.version} 已恢复为待编辑草稿`); }}><Button size="small" disabled={!access.canEditWarningRule} icon={<RollbackOutlined />}>回滚为草稿</Button></Popconfirm></article>)}</section>
      </Modal>
    </PageContainer>
  );
}
